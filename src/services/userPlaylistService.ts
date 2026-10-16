import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserPlaylist, UserPlaylistItem } from '../types';
import { queueAndSyncPlaylistUpdate } from './backgroundSyncService';

export async function getUserPlaylists(userId: string): Promise<UserPlaylist[]> {
  if (!userId) return [];
  try {
    const colRef = collection(db, 'userPlaylists');
    const q = query(colRef, where('ownerId', '==', userId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserPlaylist));
    // Sort in-memory to avoid needing a composite index
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err: any) {
    if (err?.message?.includes('Quota limit exceeded')) {
      console.warn('[userPlaylistService] Firestore quota limit reached. Returning empty playlist list.');
    } else {
      console.warn('[userPlaylistService] Failed to get user playlists:', err?.message || err);
    }
    return [];
  }
}

export async function getPublicUserPlaylists(userId: string): Promise<UserPlaylist[]> {
  if (!userId) return [];
  try {
    const colRef = collection(db, 'userPlaylists');
    const q = query(colRef, where('ownerId', '==', userId), where('visibility', '==', 'public'));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserPlaylist));
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err: any) {
    console.error('[userPlaylistService] Failed to get public playlists:', err);
    return [];
  }
}

export async function getUserPlaylistById(playlistId: string): Promise<UserPlaylist | null> {
  if (!playlistId) return null;
  try {
    const docRef = doc(db, 'userPlaylists', playlistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as UserPlaylist;
  } catch (err: any) {
    console.error('[userPlaylistService] Failed to get playlist:', err);
    return null;
  }
}

export async function createUserPlaylist(
  ownerId: string,
  ownerName: string,
  payload: {
    name: string;
    description?: string;
    visibility?: 'public' | 'private';
    coverUrl?: string;
    initialItems?: UserPlaylistItem[];
  }
): Promise<{ success: boolean; playlist?: UserPlaylist; error?: string }> {
  if (!ownerId) return { success: false, error: 'User is not authenticated' };
  if (!payload.name?.trim()) return { success: false, error: 'Playlist name is required' };

  try {
    const colRef = collection(db, 'userPlaylists');
    const newDoc = doc(colRef);
    const now = Date.now();

    const items = payload.initialItems || [];
    const newPlaylist: UserPlaylist = {
      id: newDoc.id,
      ownerId,
      ownerName: ownerName || 'Music Fan',
      name: payload.name.trim(),
      title: payload.name.trim(),
      description: payload.description?.trim() || '',
      visibility: payload.visibility || 'public',
      isPublic: (payload.visibility || 'public') === 'public',
      songCount: items.length,
      coverUrl: payload.coverUrl || items[0]?.thumbnailUrl || items[0]?.coverUrl || '',
      items,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDoc, newPlaylist);
    return { success: true, playlist: newPlaylist };
  } catch (err: any) {
    console.warn('[userPlaylistService] Network/Firestore error creating playlist, queueing for Background Sync:', err?.message || err);
    // Queue for Service Worker Background Sync API to push when connectivity is restored
    try {
      const fallbackPlaylist: UserPlaylist = {
        id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ownerId,
        ownerName: ownerName || 'Music Fan',
        name: payload.name.trim(),
        title: payload.name.trim(),
        description: payload.description?.trim() || '',
        visibility: payload.visibility || 'public',
        isPublic: (payload.visibility || 'public') === 'public',
        songCount: (payload.initialItems || []).length,
        coverUrl: payload.coverUrl || (payload.initialItems || [])[0]?.thumbnailUrl || '',
        items: payload.initialItems || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await queueAndSyncPlaylistUpdate({
        action: 'create',
        payload: fallbackPlaylist,
      });
      return { success: true, playlist: fallbackPlaylist };
    } catch {
      return { success: false, error: err?.message || 'Failed to create playlist' };
    }
  }
}

export async function addSongToUserPlaylist(
  playlistId: string,
  ownerId: string,
  songItem: UserPlaylistItem
): Promise<{ success: boolean; alreadyInPlaylist?: boolean; error?: string }> {
  if (!playlistId || !ownerId) return { success: false, error: 'Invalid parameters' };

  try {
    const pRef = doc(db, 'userPlaylists', playlistId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return { success: false, error: 'Playlist not found' };

    const data = snap.data() as UserPlaylist;
    if (data.ownerId !== ownerId) return { success: false, error: 'Unauthorized' };

    const items = data.items || [];
    // Check if track is already present in playlist
    const targetVideoId = songItem.youtubeVideoId;
    const targetSongId = songItem.songId;
    const exists = items.some(
      (it: UserPlaylistItem) => (targetVideoId && it.youtubeVideoId === targetVideoId) ||
            (targetSongId && it.songId === targetSongId) ||
            it.id === songItem.id
    );

    if (exists) {
      return { success: true, alreadyInPlaylist: true };
    }

    const updatedItems = [
      ...items,
      {
        ...songItem,
        id: songItem.id || `track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        addedAt: Date.now(),
      },
    ];

    await updateDoc(pRef, {
      items: updatedItems,
      songCount: updatedItems.length,
      coverUrl: data.coverUrl || songItem.thumbnailUrl || songItem.coverUrl || '',
      updatedAt: Date.now(),
    });

    return { success: true, alreadyInPlaylist: false };
  } catch (err: any) {
    console.warn('[userPlaylistService] Network error adding track, queueing for Background Sync:', err?.message || err);
    try {
      await queueAndSyncPlaylistUpdate({
        action: 'add_song',
        payload: { playlistId, ownerId, songItem },
      });
      return { success: true, alreadyInPlaylist: false };
    } catch {
      return { success: false, error: err?.message || 'Failed to add track' };
    }
  }
}

export async function removeSongFromUserPlaylist(
  playlistId: string,
  ownerId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  if (!playlistId || !ownerId || !itemId) return { success: false, error: 'Invalid parameters' };

  try {
    const pRef = doc(db, 'userPlaylists', playlistId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return { success: false, error: 'Playlist not found' };

    const data = snap.data() as UserPlaylist;
    if (data.ownerId !== ownerId) return { success: false, error: 'Unauthorized' };

    const items = (data.items || []).filter(
      (it: UserPlaylistItem) => it.id !== itemId && it.youtubeVideoId !== itemId && it.songId !== itemId
    );

    await updateDoc(pRef, {
      items,
      songCount: items.length,
      coverUrl: items.length > 0 ? (data.coverUrl || items[0].thumbnailUrl || items[0].coverUrl || '') : '',
      updatedAt: Date.now(),
    });

    return { success: true };
  } catch (err: any) {
    console.warn('[userPlaylistService] Network error removing track, queueing for Background Sync:', err?.message || err);
    try {
      await queueAndSyncPlaylistUpdate({
        action: 'remove_song',
        payload: { playlistId, ownerId, itemId },
      });
      return { success: true };
    } catch {
      return { success: false, error: err?.message || 'Failed to remove track' };
    }
  }
}

export async function reorderUserPlaylist(
  playlistId: string,
  ownerId: string,
  reorderedItems: UserPlaylistItem[]
): Promise<{ success: boolean; error?: string }> {
  if (!playlistId || !ownerId) return { success: false, error: 'Invalid parameters' };

  try {
    const pRef = doc(db, 'userPlaylists', playlistId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return { success: false, error: 'Playlist not found' };

    const data = snap.data() as UserPlaylist;
    if (data.ownerId !== ownerId) return { success: false, error: 'Unauthorized' };

    await updateDoc(pRef, {
      items: reorderedItems,
      updatedAt: Date.now(),
    });

    return { success: true };
  } catch (err: any) {
    console.warn('[userPlaylistService] Network error saving order, queueing for Background Sync:', err?.message || err);
    try {
      await queueAndSyncPlaylistUpdate({
        action: 'reorder',
        payload: { playlistId, ownerId, reorderedItems },
      });
      return { success: true };
    } catch {
      return { success: false, error: err?.message || 'Failed to save order' };
    }
  }
}

export async function deleteUserPlaylist(
  playlistId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!playlistId || !ownerId) return { success: false, error: 'Invalid parameters' };

  try {
    const pRef = doc(db, 'userPlaylists', playlistId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return { success: false, error: 'Playlist not found' };

    const data = snap.data() as UserPlaylist;
    if (data.ownerId !== ownerId) return { success: false, error: 'Unauthorized' };

    await deleteDoc(pRef);
    return { success: true };
  } catch (err: any) {
    console.warn('[userPlaylistService] Network error deleting playlist, queueing for Background Sync:', err?.message || err);
    try {
      await queueAndSyncPlaylistUpdate({
        action: 'delete',
        payload: { playlistId, ownerId },
      });
      return { success: true };
    } catch {
      return { success: false, error: err?.message || 'Failed to delete playlist' };
    }
  }
}
