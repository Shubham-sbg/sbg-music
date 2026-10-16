import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserLibraryItem } from '../types';
import { dedupeRequest, invalidateCache, isRateLimitError } from '../lib/cache';

/**
 * Normalized User Library Service with Multi-Tier Quota Protection
 * Stores lightweight song references in users/{userId}/library/{itemId}
 * Strictly isolated to each authenticated user's private library.
 * Leverages memory + localStorage caching to eliminate repetitive Firestore reads.
 */

const LIB_STORAGE_PREFIX = 'sbg_user_lib_v1_';
const LIB_CACHE_TTL_MS = 300000; // 5 minutes cache

function getLocalLibrary(userId: string): UserLibraryItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LIB_STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLibrary(userId: string, items: UserLibraryItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LIB_STORAGE_PREFIX + userId, JSON.stringify(items));
  } catch {
    // Graceful quota catch
  }
}

export async function getUserLibrary(userId: string, maxItems = 100): Promise<UserLibraryItem[]> {
  if (!userId) return [];
  
  return dedupeRequest(
    `user_library_${userId}`,
    async () => {
      try {
        const libRef = collection(db, 'users', userId, 'library');
        const q = query(libRef, orderBy('addedAt', 'desc'), limit(maxItems));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserLibraryItem));
        
        // Update persistent local cache
        saveLocalLibrary(userId, items);
        return items;
      } catch (err: any) {
        if (isRateLimitError(err)) {
          console.warn('[libraryService] Firestore quota limit reached. Serving user library from local offline cache.');
        } else {
          console.warn('[libraryService] Non-critical error loading library from Firestore, falling back to local cache:', err?.message || err);
        }
        // Always fall back to local storage cache so user never sees a broken screen
        return getLocalLibrary(userId);
      }
    },
    LIB_CACHE_TTL_MS
  );
}

export async function addToUserLibrary(
  userId: string,
  data: {
    id?: string;
    songId?: string;
    youtubeVideoId?: string;
    youtubeUrl?: string;
    title: string;
    artist: string;
    thumbnail?: string;
    thumbnailUrl?: string;
    coverUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    duration?: number;
    genre?: string;
    source?: 'youtube' | 'sbg' | 'upload';
  }
): Promise<{ success: boolean; alreadyExists: boolean; item?: UserLibraryItem; error?: string }> {
  if (!userId) {
    return { success: false, alreadyExists: false, error: 'User is not authenticated' };
  }

  try {
    // Generate deterministic ID to prevent duplicates
    let itemId = '';
    if (data.youtubeVideoId) {
      itemId = `yt_${data.youtubeVideoId.trim()}`;
    } else if (data.songId) {
      itemId = `sbg_${data.songId.trim()}`;
    } else if (data.id) {
      itemId = data.id.startsWith('yt_') || data.id.startsWith('sbg_') ? data.id : `sbg_${data.id.trim()}`;
    } else {
      itemId = `custom_${encodeURIComponent(data.title.toLowerCase().replace(/[^a-z0-9]/g, '_'))}_${Date.now()}`;
    }

    // Check fast local cache first to avoid unneeded reads
    const localItems = getLocalLibrary(userId);
    const existingLocal = localItems.find(i => i.id === itemId || (data.songId && i.songId === data.songId) || (data.youtubeVideoId && i.youtubeVideoId === data.youtubeVideoId));
    if (existingLocal) {
      return { success: true, alreadyExists: true, item: existingLocal };
    }

    const resolvedSource = data.source === 'upload' ? 'sbg' : (data.source || 'sbg');
    const resolvedThumb = data.thumbnailUrl || data.coverUrl || data.imageUrl || data.thumbnail || '';

    const newItem: UserLibraryItem = {
      id: itemId,
      userId,
      songId: data.songId || (itemId.startsWith('sbg_') ? itemId.replace('sbg_', '') : data.id),
      youtubeVideoId: data.youtubeVideoId,
      youtubeUrl: data.youtubeUrl || (data.youtubeVideoId ? `https://www.youtube.com/watch?v=${data.youtubeVideoId}` : undefined),
      title: data.title || 'Untitled Track',
      artist: data.artist || 'Unknown Artist',
      thumbnail: resolvedThumb,
      thumbnailUrl: resolvedThumb,
      coverUrl: resolvedThumb,
      audioUrl: data.audioUrl,
      duration: data.duration,
      source: resolvedSource,
      addedAt: Date.now()
    };

    // Optimistically update local cache
    const updatedItems = [newItem, ...localItems.filter(i => i.id !== itemId)];
    saveLocalLibrary(userId, updatedItems);
    invalidateCache(`user_library_${userId}`);

    // Persist to Firestore
    try {
      const itemRef = doc(db, 'users', userId, 'library', itemId);
      await setDoc(itemRef, newItem);
    } catch (writeErr: any) {
      if (isRateLimitError(writeErr)) {
        console.warn('[libraryService] Quota reached while saving to Firestore; saved to local offline library.');
      } else {
        console.warn('[libraryService] Firestore write failed, kept in local library cache:', writeErr);
      }
    }

    return { success: true, alreadyExists: false, item: newItem };
  } catch (err: any) {
    console.error('[libraryService] Failed to add to user library:', err);
    return { success: false, alreadyExists: false, error: err?.message || 'Failed to save to library' };
  }
}

export async function removeFromUserLibrary(userId: string, itemId: string): Promise<boolean> {
  if (!userId || !itemId) return false;
  try {
    // Optimistically update local cache
    const localItems = getLocalLibrary(userId);
    const filtered = localItems.filter(i => i.id !== itemId && i.songId !== itemId && i.youtubeVideoId !== itemId);
    saveLocalLibrary(userId, filtered);
    invalidateCache(`user_library_${userId}`);

    // Delete in Firestore
    try {
      const itemRef = doc(db, 'users', userId, 'library', itemId);
      await deleteDoc(itemRef);
    } catch (delErr: any) {
      if (isRateLimitError(delErr)) {
        console.warn('[libraryService] Quota exceeded on remote delete; local cache updated.');
      }
    }
    return true;
  } catch (err: any) {
    console.error('[libraryService] Failed to remove from user library:', err);
    return false;
  }
}

/**
 * High-speed 0-read in-memory lookup to check if a track is in the user's library.
 * Completely eliminates individual getDoc() roundtrips for song card lists.
 */
export async function checkInUserLibrary(userId: string, idOrVideoId: string): Promise<boolean> {
  if (!userId || !idOrVideoId) return false;
  
  // 1. Check local storage cache first (0 network reads)
  const localItems = getLocalLibrary(userId);
  const targetId = idOrVideoId.startsWith('yt_') || idOrVideoId.startsWith('sbg_')
    ? idOrVideoId
    : `yt_${idOrVideoId}`;
  const targetSbgId = idOrVideoId.startsWith('sbg_') ? idOrVideoId : `sbg_${idOrVideoId}`;
  const rawId = idOrVideoId.replace(/^(yt_|sbg_)/, '');

  const foundLocally = localItems.some(i => 
    i.id === targetId || 
    i.id === targetSbgId || 
    i.id === idOrVideoId || 
    i.songId === rawId || 
    i.youtubeVideoId === rawId
  );

  if (foundLocally) return true;

  // 2. If local library is empty, fetch via cached deduplicated getUserLibrary
  try {
    const freshItems = await getUserLibrary(userId);
    return freshItems.some(i => 
      i.id === targetId || 
      i.id === targetSbgId || 
      i.id === idOrVideoId || 
      i.songId === rawId || 
      i.youtubeVideoId === rawId
    );
  } catch {
    return false;
  }
}
