import { Song } from '../types';
import { isDataSaverEnabled } from './dataSaverService';
import { startDownloadSong, deleteOfflineSong, isSongDownloaded } from './offlineStorageService';

const OFFLINE_METADATA_KEY = 'sbg_offline_songs_metadata_v1';
const AUDIO_CACHE_NAME = 'sbg-audio-cache';
const IMAGES_CACHE_NAME = 'sbg-remote-images-cache';

export interface OfflineSongItem extends Song {
  cachedAt: number;
  fileSizeBytes?: number;
  isFullyCached: boolean;
}

export interface OfflineSyncProgress {
  total: number;
  completed: number;
  currentSongTitle?: string;
  isSyncing: boolean;
  error?: string | null;
}

type SyncListener = (progress: OfflineSyncProgress) => void;
const syncListeners: Set<SyncListener> = new Set();

let currentProgress: OfflineSyncProgress = {
  total: 0,
  completed: 0,
  isSyncing: false,
};

function notifyProgress(progress: Partial<OfflineSyncProgress>) {
  currentProgress = { ...currentProgress, ...progress };
  syncListeners.forEach((listener) => {
    try {
      listener(currentProgress);
    } catch (e) {
      console.warn('Sync listener error:', e);
    }
  });
}

export function subscribeToOfflineSyncProgress(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentProgress);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Gets all songs saved to local metadata.
 */
export function getSavedOfflineSongs(): OfflineSongItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_METADATA_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse offline songs metadata:', err);
    return [];
  }
}

/**
 * Saves offline songs list to localStorage.
 */
function saveOfflineSongs(songs: OfflineSongItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_METADATA_KEY, JSON.stringify(songs));
    window.dispatchEvent(new CustomEvent('offline_songs_updated', { detail: songs }));
  } catch (err) {
    console.warn('Failed to save offline songs metadata:', err);
  }
}

/**
 * Checks if a specific song is downloaded and available offline.
 */
export function isSongCachedOffline(songId: string): boolean {
  const songs = getSavedOfflineSongs();
  return songs.some((s) => s.id === songId && s.isFullyCached);
}

/**
 * Caches an individual song's audio and artwork into Workbox CacheStorage & IndexedDB persistent storage.
 */
export async function cacheSongForOffline(song: Song): Promise<boolean> {
  if (!song || !song.id) return false;

  // Never attempt to fetch or cache YouTube stream URLs via fetch
  if (
    song.source === 'youtube' ||
    Boolean(song.youtubeVideoId) ||
    (typeof song.audioUrl === 'string' && (song.audioUrl.includes('youtube.com') || song.audioUrl.includes('youtu.be')))
  ) {
    return false;
  }

  try {
    // 1. Persistent IndexedDB audio storage with verification
    try {
      await startDownloadSong(song);
    } catch (dbErr) {
      console.warn('IndexedDB persistent download warning:', dbErr);
    }

    const audioUrl = song.audioUrl;
    const coverUrl = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;

    // 2. Cache Audio Stream in Service Worker Cache if supported
    let audioCached = false;
    if (audioUrl && 'caches' in window) {
      try {
        const audioCache = await caches.open(AUDIO_CACHE_NAME);
        const existing = await audioCache.match(audioUrl);
        if (!existing) {
          const res = await fetch(audioUrl, { mode: 'cors' }).catch(() => fetch(audioUrl, { mode: 'no-cors' }));
          if (res && (res.status === 200 || res.type === 'opaque')) {
            await audioCache.put(audioUrl, res);
            audioCached = true;
          }
        } else {
          audioCached = true;
        }
      } catch (audioErr) {
        console.warn('Could not precache direct audio file in CacheStorage:', audioErr);
      }
    }

    // 3. Cache Artwork Image
    if (coverUrl && 'caches' in window) {
      try {
        const imgCache = await caches.open(IMAGES_CACHE_NAME);
        const existingImg = await imgCache.match(coverUrl);
        if (!existingImg) {
          const imgRes = await fetch(coverUrl, { mode: 'cors' }).catch(() => fetch(coverUrl, { mode: 'no-cors' }));
          if (imgRes && (imgRes.status === 200 || imgRes.type === 'opaque')) {
            await imgCache.put(coverUrl, imgRes);
          }
        }
      } catch (imgErr) {
        // Image cache failure is non-blocking
      }
    }

    // 4. Update Offline Metadata
    const existingSongs = getSavedOfflineSongs();
    const updated = existingSongs.filter((s) => s.id !== song.id);
    const offlineItem: OfflineSongItem = {
      ...song,
      cachedAt: Date.now(),
      isFullyCached: true,
    };
    updated.unshift(offlineItem);
    saveOfflineSongs(updated);

    return true;
  } catch (error) {
    console.error('Failed to cache song for offline playback:', error);
    return false;
  }
}

/**
 * Removes a song from CacheStorage, IndexedDB and metadata.
 */
export async function removeSongFromOffline(songId: string): Promise<void> {
  try {
    await deleteOfflineSong(songId);
  } catch (err) {
    console.warn('Error removing song from IndexedDB:', err);
  }

  const songs = getSavedOfflineSongs();
  const target = songs.find((s) => s.id === songId);

  if ('caches' in window && target) {
    try {
      if (target.audioUrl) {
        const audioCache = await caches.open(AUDIO_CACHE_NAME);
        await audioCache.delete(target.audioUrl);
      }
      const coverUrl = target.imageUrl || target.customCoverUrl || target.coverUrl || target.heroImageUrl;
      if (coverUrl) {
        const imgCache = await caches.open(IMAGES_CACHE_NAME);
        await imgCache.delete(coverUrl);
      }
    } catch (e) {
      console.warn('Error deleting cached song files:', e);
    }
  }

  const filtered = songs.filter((s) => s.id !== songId);
  saveOfflineSongs(filtered);
}

/**
 * Pre-caches popular or featured songs for instant offline playback.
 * 
 * @param songs Catalog songs list to select popular tracks from
 * @param maxCount Number of popular songs to buffer
 */
export async function cachePopularSongs(songs: Song[], maxCount = 8): Promise<number> {
  if (!songs || songs.length === 0) return 0;

  // Filter playable tracks (prefer songs with audioUrl or high play counts)
  const candidateSongs = [...songs]
    .filter((s) => s.published !== false)
    .sort((a, b) => {
      const countA = (a as any).playCount || (a as any).views || (a.isFeatured ? 100 : 0);
      const countB = (b as any).playCount || (b as any).views || (b.isFeatured ? 100 : 0);
      return countB - countA;
    })
    .slice(0, maxCount);

  if (candidateSongs.length === 0) return 0;

  notifyProgress({
    total: candidateSongs.length,
    completed: 0,
    isSyncing: true,
    error: null,
  });

  let successfullyCached = 0;

  for (let i = 0; i < candidateSongs.length; i++) {
    const song = candidateSongs[i];
    notifyProgress({
      currentSongTitle: song.title,
      completed: i,
    });

    try {
      await cacheSongForOffline(song);
      successfullyCached++;
    } catch (err) {
      console.warn(`Could not cache track ${song.title}:`, err);
    }
  }

  notifyProgress({
    completed: candidateSongs.length,
    isSyncing: false,
    currentSongTitle: undefined,
  });

  return successfullyCached;
}

/**
 * Automatically background caches the currently playing song to allow continued playback during spotty connections.
 */
export function autoCacheActiveTrack(song: Song | null): void {
  // Low-data streaming policy: Never pre-fetch or auto-cache when Data Saver is active
  if (isDataSaverEnabled()) return;
  if (!song || !song.id) return;
  if (
    song.source === 'youtube' ||
    Boolean(song.youtubeVideoId) ||
    (typeof song.audioUrl === 'string' && (song.audioUrl.includes('youtube.com') || song.audioUrl.includes('youtu.be')))
  ) {
    return;
  }
  if (isSongCachedOffline(song.id)) return;

  // Run in idle callback or background timeout
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      cacheSongForOffline(song).catch(() => {});
    });
  } else {
    setTimeout(() => {
      cacheSongForOffline(song).catch(() => {});
    }, 2000);
  }
}
