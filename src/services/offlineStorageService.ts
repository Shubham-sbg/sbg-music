import { Song, SongSourceType } from '../types';
import { isSongDownloadable, getSongSourceType } from '../utils/catalogUtils';

export type OfflineDownloadStatus = 'waiting' | 'downloading' | 'paused' | 'downloaded' | 'failed' | 'not_available';

export interface OfflineSongMetadata {
  songId: string;
  userId?: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  downloadedAt?: number;
  downloadStatus: OfflineDownloadStatus;
  progress: number; // 0 to 100
  version: string;
  sizeBytes?: number;
  sourceType: SongSourceType;
  audioUrl?: string;
  error?: string | null;
}

const DB_NAME = 'sbg_music_offline_v2';
const DB_VERSION = 1;
const BLOBS_STORE = 'audio_blobs';
const META_STORE = 'downloads_meta';

// Active in-flight abort controllers
const activeDownloadControllers = new Map<string, AbortController>();
// In-memory blob URL cache for instant audio playback
const blobUrlCache = new Map<string, string>();

/**
 * Initializes and returns the IndexedDB instance for offline storage.
 */
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this platform.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'songId' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'songId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function emitUpdateEvent(songId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg_offline_storage_updated', { detail: { songId } }));
  }
}

/**
 * Saves or updates metadata in IndexedDB.
 */
export async function saveOfflineMetadata(meta: OfflineSongMetadata): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.put(meta);
    req.onsuccess = () => {
      emitUpdateEvent(meta.songId);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves metadata for a single song.
 */
export async function getOfflineMetadata(songId: string): Promise<OfflineSongMetadata | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.get(songId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves all offline downloaded songs metadata.
 */
export async function getAllOfflineSongs(): Promise<OfflineSongMetadata[]> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Saves the binary audio blob to user device IndexedDB.
 */
async function saveAudioBlob(songId: string, blob: Blob): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readwrite');
    const store = tx.objectStore(BLOBS_STORE);
    const req = store.put({
      songId,
      blob,
      mimeType: blob.type || 'audio/mpeg',
      sizeBytes: blob.size,
      savedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Gets audio blob from IndexedDB.
 */
export async function getAudioBlob(songId: string): Promise<Blob | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, 'readonly');
      const store = tx.objectStore(BLOBS_STORE);
      const req = store.get(songId);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Synchronous in-memory lookup for blob URL.
 * Also pre-populates asynchronously if not yet in cache.
 */
export function getOfflineSongBlobUrl(songId: string): string | null {
  if (blobUrlCache.has(songId)) {
    return blobUrlCache.get(songId)!;
  }

  // Pre-load in background
  getAudioBlob(songId).then((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(songId, url);
    }
  }).catch(() => {});

  return null;
}

/**
 * Asynchronously resolves blob URL for immediate offline playback.
 */
export async function resolveOfflineSongBlobUrl(songId: string): Promise<string | null> {
  if (blobUrlCache.has(songId)) {
    return blobUrlCache.get(songId)!;
  }
  const blob = await getAudioBlob(songId);
  if (blob) {
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(songId, url);
    return url;
  }
  return null;
}

/**
 * Checks whether a song is verified downloaded in IndexedDB.
 */
export async function isSongDownloaded(songId: string): Promise<boolean> {
  const meta = await getOfflineMetadata(songId);
  return Boolean(meta && meta.downloadStatus === 'downloaded');
}

/**
 * Starts or restarts downloading an eligible song into local device storage.
 */
export async function startDownloadSong(song: Song, userId?: string): Promise<{ success: boolean; error?: string }> {
  if (!song || !song.id) {
    return { success: false, error: 'Invalid song' };
  }

  // Check Eligibility
  const sourceType = getSongSourceType(song);
  if (sourceType === 'YOUTUBE' || !isSongDownloadable(song)) {
    await saveOfflineMetadata({
      songId: song.id,
      userId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl,
      duration: song.durationSeconds || song.duration,
      downloadStatus: 'not_available',
      progress: 0,
      version: '1.0',
      sourceType,
      error: 'Offline download unavailable for this source.',
    });
    return { success: false, error: 'Offline download unavailable for this source.' };
  }

  const audioUrl = song.audioUrl;
  if (!audioUrl) {
    return { success: false, error: 'No audio source stream available for download.' };
  }

  // Abort any existing download
  if (activeDownloadControllers.has(song.id)) {
    activeDownloadControllers.get(song.id)!.abort();
    activeDownloadControllers.delete(song.id);
  }

  const controller = new AbortController();
  activeDownloadControllers.set(song.id, controller);

  // Set Waiting state
  const artwork = song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl;
  await saveOfflineMetadata({
    songId: song.id,
    userId,
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork,
    duration: song.durationSeconds || song.duration,
    downloadStatus: 'downloading',
    progress: 5,
    version: '1.0',
    sourceType,
    audioUrl,
    error: null,
  });

  try {
    const response = await fetch(audioUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    let receivedBytes = 0;
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0) {
            const pct = Math.min(95, Math.max(10, Math.floor((receivedBytes / totalBytes) * 100)));
            await saveOfflineMetadata({
              songId: song.id,
              userId,
              title: song.title,
              artist: song.artist,
              album: song.album,
              artwork,
              duration: song.durationSeconds || song.duration,
              downloadStatus: 'downloading',
              progress: pct,
              version: '1.0',
              sizeBytes: receivedBytes,
              sourceType,
              audioUrl,
              error: null,
            });
          }
        }
      }
    } else {
      // Fallback if ReadableStream is not accessible
      const fullBlob = await response.blob();
      chunks.push(new Uint8Array(await fullBlob.arrayBuffer()));
      receivedBytes = fullBlob.size;
    }

    // Merge chunks into single blob
    const mimeType = response.headers.get('content-type') || 'audio/mpeg';
    const finalBlob = new Blob(chunks, { type: mimeType });

    // Store in IndexedDB
    await saveAudioBlob(song.id, finalBlob);

    // Cache Object URL for immediate playback
    const blobUrl = URL.createObjectURL(finalBlob);
    blobUrlCache.set(song.id, blobUrl);

    // Mark as downloaded
    await saveOfflineMetadata({
      songId: song.id,
      userId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork,
      duration: song.durationSeconds || song.duration,
      downloadedAt: Date.now(),
      downloadStatus: 'downloaded',
      progress: 100,
      version: '1.0',
      sizeBytes: receivedBytes,
      sourceType,
      audioUrl,
      error: null,
    });

    activeDownloadControllers.delete(song.id);
    return { success: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Intentionally paused or cancelled
      return { success: false, error: 'Download stopped' };
    }

    console.error('Failed to download song for offline storage:', err);
    await saveOfflineMetadata({
      songId: song.id,
      userId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork,
      duration: song.durationSeconds || song.duration,
      downloadStatus: 'failed',
      progress: 0,
      version: '1.0',
      sourceType,
      audioUrl,
      error: err?.message || 'Download failed',
    });

    activeDownloadControllers.delete(song.id);
    return { success: false, error: err?.message || 'Download failed' };
  }
}

/**
 * Pauses an ongoing download.
 */
export async function pauseDownloadSong(songId: string): Promise<void> {
  const controller = activeDownloadControllers.get(songId);
  if (controller) {
    controller.abort();
    activeDownloadControllers.delete(songId);
  }

  const meta = await getOfflineMetadata(songId);
  if (meta && meta.downloadStatus === 'downloading') {
    meta.downloadStatus = 'paused';
    await saveOfflineMetadata(meta);
  }
}

/**
 * Resumes a paused download.
 */
export async function resumeDownloadSong(song: Song, userId?: string): Promise<{ success: boolean; error?: string }> {
  return startDownloadSong(song, userId);
}

/**
 * Cancels a download and cleans up.
 */
export async function cancelDownloadSong(songId: string): Promise<void> {
  const controller = activeDownloadControllers.get(songId);
  if (controller) {
    controller.abort();
    activeDownloadControllers.delete(songId);
  }

  await deleteOfflineSong(songId);
}

/**
 * Deletes downloaded song from user storage.
 */
export async function deleteOfflineSong(songId: string): Promise<void> {
  try {
    const db = await openOfflineDB();

    // Revoke object URL
    if (blobUrlCache.has(songId)) {
      URL.revokeObjectURL(blobUrlCache.get(songId)!);
      blobUrlCache.delete(songId);
    }

    // Delete from both stores
    const tx = db.transaction([BLOBS_STORE, META_STORE], 'readwrite');
    tx.objectStore(BLOBS_STORE).delete(songId);
    tx.objectStore(META_STORE).delete(songId);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    emitUpdateEvent(songId);
  } catch (err) {
    console.warn('Error deleting offline song from IndexedDB:', err);
  }
}

/**
 * Calculates current IndexedDB and browser storage estimate.
 */
export async function estimateStorageUsage(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  formattedUsed: string;
  formattedAvailable: string;
  formattedQuota: string;
  percentageUsed: number;
}> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1024 * 1024 * 1024; // default 1GB fallback
      const available = Math.max(0, quota - used);
      const percentage = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

      const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };

      return {
        usedBytes: used,
        quotaBytes: quota,
        availableBytes: available,
        formattedUsed: formatSize(used),
        formattedAvailable: formatSize(available),
        formattedQuota: formatSize(quota),
        percentageUsed: Math.round(percentage * 10) / 10,
      };
    }
  } catch (err) {
    console.warn('Storage estimate failed:', err);
  }

  return {
    usedBytes: 0,
    quotaBytes: 1024 * 1024 * 1024,
    availableBytes: 1024 * 1024 * 1024,
    formattedUsed: '0 MB',
    formattedAvailable: '1 GB',
    formattedQuota: '1 GB',
    percentageUsed: 0,
  };
}

/**
 * Pre-warms in-memory blob URLs for all downloaded songs.
 */
export async function preloadOfflineBlobUrls(): Promise<void> {
  const songs = await getAllOfflineSongs();
  for (const song of songs) {
    if (song.downloadStatus === 'downloaded' && !blobUrlCache.has(song.songId)) {
      const blob = await getAudioBlob(song.songId);
      if (blob) {
        blobUrlCache.set(song.songId, URL.createObjectURL(blob));
      }
    }
  }
}
