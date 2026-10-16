import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  serverTimestamp,
  updateDoc,
  getDoc,
  orderBy
} from 'firebase/firestore';
import { CommunityPlaylist } from '../types';
import { generatePlaylistArtwork } from './artworkGenerator';
import { queueAndSyncPlaylistUpdate } from '../services/backgroundSyncService';

/**
 * Extract YouTube playlist ID from various URL formats.
 */
export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      const listId = parsed.searchParams.get('list');
      if (listId) return listId;
      if (parsed.pathname === '/playlist' && parsed.searchParams.has('list')) {
        return parsed.searchParams.get('list');
      }
    }
  } catch (e) {
    console.warn('Invalid URL provided:', url);
  }
  return null;
}

export function normalizePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export async function submitPlaylist(data: Omit<CommunityPlaylist, 'id' | 'status' | 'featured' | 'displayOrder' | 'createdAt' | 'playlistId'>): Promise<string> {
  const playlistId = extractPlaylistId(data.playlistUrl);
  if (!playlistId) throw new Error('Invalid YouTube playlist URL.');

  // Check online status
  if (!navigator.onLine) {
    queueOfflineSubmission({ ...data, playlistId });
    queueAndSyncPlaylistUpdate({
      action: 'submit_community',
      payload: { ...data, playlistId, createdAt: Date.now() },
    }).catch(() => {});
    return 'offline-queued';
  }

  // Deduplication check
  const q = query(collection(db, 'community_playlists'), where('playlistId', '==', playlistId));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error('This playlist has already been submitted.');

  // Attempt to fetch thumbnail automatically
  let thumbnailUrl = data.thumbnailUrl || '';
  try {
    const res = await fetch('/api/youtube/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.playlistUrl }),
    });
    const pData = await res.json();
    if (pData.ok && pData.thumbnailUrl) {
      thumbnailUrl = pData.thumbnailUrl;
    }
  } catch (e) {
    console.warn('Failed to auto-fetch playlist thumbnail', e);
  }

  // Auto-generate artwork if no thumbnail was provided or found
  if (!thumbnailUrl) {
    try {
      const art = await generatePlaylistArtwork({
        title: data.playlistName,
        description: data.description,
      });
      if (art?.imageUrl) {
        thumbnailUrl = art.imageUrl;
      }
    } catch (artErr) {
      console.warn('Failed to generate playlist artwork for community playlist:', artErr);
    }
  }

  const docRef = await addDoc(collection(db, 'community_playlists'), {
    ...data,
    playlistId,
    thumbnailUrl,
    status: 'pending',
    featured: false,
    displayOrder: 0,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

import { dedupeRequest, invalidateCache } from './cache';

export async function getApprovedFeaturedPlaylists(): Promise<CommunityPlaylist[]> {
  const CACHE_KEY = 'community_featured_playlists_cache';
  
  return dedupeRequest(
    'approved_featured_playlists',
    async () => {
      if (!navigator.onLine) {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : [];
      }

      try {
        const q = query(
          collection(db, 'community_playlists'),
          where('status', '==', 'approved'),
          where('featured', '==', true),
          orderBy('displayOrder', 'asc')
        );
        
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPlaylist));
        
        const finalResults = results.map(r => {
          if (!r.thumbnailUrl && r.playlistId) {
            r.thumbnailUrl = r.thumbnailUrl || '';
          }
          return r;
        });

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(finalResults));
        } catch {
          // ignore
        }
        return finalResults;
      } catch (err: any) {
        console.warn('[communityPlaylistService] Notice fetching featured community playlists (e.g. quota limit or offline):', err?.message || err);
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try { return JSON.parse(cached); } catch {}
        }
        return [];
      }
    },
    180000
  );
}

// OFFLINE QUEUE MANAGEMENT
const QUEUE_KEY = 'community_playlist_offline_queue';

function getOfflineQueue(): any[] {
  const q = localStorage.getItem(QUEUE_KEY);
  return q ? JSON.parse(q) : [];
}

function queueOfflineSubmission(data: any) {
  const q = getOfflineQueue();
  // Simple dedup in queue
  if (!q.find(item => item.playlistId === data.playlistId)) {
    q.push({ ...data, _queuedAt: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  const q = getOfflineQueue();
  if (q.length === 0) return;

  const successfulIds = [];

  for (const item of q) {
    try {
      const qCheck = query(collection(db, 'community_playlists'), where('playlistId', '==', item.playlistId));
      const snap = await getDocs(qCheck);
      
      if (snap.empty) {
        let thumbnailUrl = item.thumbnailUrl || '';
        try {
          const res = await fetch('/api/youtube/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.playlistUrl }),
          });
          const pData = await res.json();
          if (pData.ok && pData.thumbnailUrl) {
            thumbnailUrl = pData.thumbnailUrl;
          }
        } catch (e) {}

        if (!thumbnailUrl) {
          try {
            const art = await generatePlaylistArtwork({
              title: item.playlistName,
              description: item.description,
            });
            if (art?.imageUrl) {
              thumbnailUrl = art.imageUrl;
            }
          } catch (artErr) {}
        }

        await addDoc(collection(db, 'community_playlists'), {
          playlistName: item.playlistName,
          playlistUrl: item.playlistUrl,
          submitterName: item.submitterName,
          description: item.description,
          playlistId: item.playlistId,
          thumbnailUrl,
          status: 'pending',
          featured: false,
          displayOrder: 0,
          createdAt: serverTimestamp(),
        });
      }
      successfulIds.push(item.playlistId);
    } catch (e) {
      console.error('Failed to sync queued playlist:', item.playlistId, e);
    }
  }

  if (successfulIds.length > 0) {
    const remaining = q.filter(item => !successfulIds.includes(item.playlistId));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }
}

// Setup listener for online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineQueue();
  });
}
