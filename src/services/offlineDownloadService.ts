import { Song } from '../types';
import { isSongDownloadable, getSongSourceType, SongSourceType } from '../utils/catalogUtils';

export type DownloadStatus = 
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'unauthorized';

export interface DownloadProgress {
  songId: string;
  status: DownloadStatus;
  progressPercent: number; // 0 - 100
  bytesDownloaded: number;
  totalBytes: number;
  downloadSpeedBps?: number;
  errorMessage?: string;
}

export interface StoredOfflineTrack {
  songId: string;
  song: Song;
  status: DownloadStatus;
  sourceType: SongSourceType;
  audioUrl: string;
  fileSizeBytes: number;
  downloadedAt: number;
  localUri?: string; // Content URI or local file path in Android Media3 / internal app storage
  lastAccessedAt: number;
  quality: 'standard' | 'high' | 'lossless';
}

export interface ValidationResult {
  isEligible: boolean;
  reason?: string;
  song?: Song;
}

// Android Media3 Native Bridge interface definition (injected by Android WebView)
declare global {
  interface Window {
    AndroidMedia3Bridge?: {
      downloadTrack: (trackJson: string) => boolean;
      pauseDownload: (songId: string) => boolean;
      resumeDownload: (songId: string) => boolean;
      cancelDownload: (songId: string) => boolean;
      removeDownloadedTrack: (songId: string) => boolean;
      getDownloadStatus: (songId: string) => string;
      getAllDownloadsJson: () => string;
      getStorageStatsJson: () => string;
      isMedia3Available: () => boolean;
    };
    onMedia3DownloadProgress?: (progressJson: string) => void;
  }
}

const DB_NAME = 'sbg_offline_media3_storage_v1';
const DB_VERSION = 1;
const TRACKS_STORE = 'offline_tracks';
const BLOBS_STORE = 'offline_blobs';

let dbInstance: IDBDatabase | null = null;
const listeners = new Set<(progress: DownloadProgress) => void>();
const stateChangeListeners = new Set<() => void>();
const activeProgress = new Map<string, DownloadProgress>();
const activeAbortControllers = new Map<string, AbortController>();
const activeBlobUrls = new Map<string, string>();

/**
 * Initializes and caches the IndexedDB instance for device-local storage.
 */
async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'songId' });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'songId' });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Broadcasts progress updates to all subscribed UI components.
 */
function notifyProgress(progress: DownloadProgress) {
  activeProgress.set(progress.songId, progress);
  listeners.forEach((listener) => {
    try {
      listener(progress);
    } catch (e) {
      console.error('Error in download progress listener:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sbg_download_progress', { detail: progress })
    );
  }
}

/**
 * Broadcasts collection state changes (track added/removed/status changed).
 */
function notifyStateChanged() {
  stateChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in state change listener:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg_offline_storage_updated'));
  }
}

// Setup Media3 Native bridge callback receiver
if (typeof window !== 'undefined') {
  window.onMedia3DownloadProgress = (progressJson: string) => {
    try {
      const parsed: DownloadProgress = JSON.parse(progressJson);
      notifyProgress(parsed);
      if (parsed.status === 'completed' || parsed.status === 'failed') {
        notifyStateChanged();
      }
    } catch (e) {
      console.warn('Failed to parse Media3 progress callback:', e);
    }
  };
}

export class OfflineDownloadService {
  /**
   * 1. TRACK VALIDATION
   * Validates whether a song is authorized and eligible for offline download.
   * Enforces licensing: SBG Authorized audio ONLY. Rejects YouTube streams.
   */
  public static validateTrackForDownload(song?: Song | null): ValidationResult {
    if (!song || !song.id) {
      return {
        isEligible: false,
        reason: 'Invalid song metadata or missing track ID.',
      };
    }

    const sourceType = getSongSourceType(song);

    // Rule 1: YouTube references are strictly prohibited from offline downloading
    if (sourceType === 'YOUTUBE') {
      return {
        isEligible: false,
        reason: 'Offline download unavailable for SBG YT. YouTube audio streams cannot be saved offline.',
        song,
      };
    }

    // Rule 2: Must have a valid audio URL
    if (!song.audioUrl || typeof song.audioUrl !== 'string' || song.audioUrl.trim().length === 0) {
      return {
        isEligible: false,
        reason: 'Track has no accessible audio source file.',
        song,
      };
    }

    // Rule 3: Check eligibility flag
    if (!isSongDownloadable(song)) {
      return {
        isEligible: false,
        reason: 'This track is marked as non-downloadable by its creator or license.',
        song,
      };
    }

    return {
      isEligible: true,
      song,
    };
  }

  /**
   * 2. STATUS TRACKING & SUBSCRIPTION
   * Subscribes to real-time download progress events.
   */
  public static subscribeToProgress(listener: (progress: DownloadProgress) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Subscribes to overall storage / state change updates.
   */
  public static subscribeToStateChanges(listener: () => void): () => void {
    stateChangeListeners.add(listener);
    return () => stateChangeListeners.delete(listener);
  }

  /**
   * Returns current active progress for a specific song if running.
   */
  public static getActiveProgress(songId: string): DownloadProgress | null {
    return activeProgress.get(songId) || null;
  }

  /**
   * 3. INITIATE DOWNLOAD (QUEUED -> DOWNLOADING -> COMPLETED)
   * Uses Android Media3 DownloadManager if running in APK, or IndexedDB storage on Web.
   */
  public static async enqueueDownload(song: Song, quality: 'standard' | 'high' | 'lossless' = 'high'): Promise<boolean> {
    const validation = this.validateTrackForDownload(song);
    if (!validation.isEligible) {
      notifyProgress({
        songId: song.id,
        status: 'unauthorized',
        progressPercent: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        errorMessage: validation.reason,
      });
      return false;
    }

    // Check if already completed
    const existing = await this.getOfflineTrack(song.id);
    if (existing && existing.status === 'completed') {
      return true;
    }

    // Notify Queued state
    notifyProgress({
      songId: song.id,
      status: 'queued',
      progressPercent: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
    });

    // Check if Android Media3 Native Bridge is available
    if (typeof window !== 'undefined' && window.AndroidMedia3Bridge && window.AndroidMedia3Bridge.isMedia3Available()) {
      try {
        const payload = JSON.stringify({
          songId: song.id,
          title: song.title,
          artist: song.artist || 'SBG MUSIC',
          audioUrl: song.audioUrl,
          artworkUrl: song.imageUrl || song.coverUrl || song.customCoverUrl || '',
          quality,
        });

        const dispatched = window.AndroidMedia3Bridge.downloadTrack(payload);
        if (dispatched) {
          return true;
        }
      } catch (err) {
        console.warn('Native Media3 dispatch failed, falling back to local engine:', err);
      }
    }

    // Web / Local Internal App-Specific Engine Fallback
    return this.executeLocalDownload(song, quality);
  }

  /**
   * Executes local background download into App-Specific IndexedDB Storage.
   */
  private static async executeLocalDownload(song: Song, quality: 'standard' | 'high' | 'lossless'): Promise<boolean> {
    const songId = song.id;
    const controller = new AbortController();
    activeAbortControllers.set(songId, controller);

    try {
      notifyProgress({
        songId,
        status: 'downloading',
        progressPercent: 2,
        bytesDownloaded: 0,
        totalBytes: 0,
      });

      const startTime = Date.now();
      const response = await fetch(song.audioUrl!, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: Failed to fetch audio stream.`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let loadedBytes = 0;

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            loadedBytes += value.length;

            const elapsedSec = (Date.now() - startTime) / 1000;
            const speed = elapsedSec > 0 ? Math.round(loadedBytes / elapsedSec) : 0;
            const percent = totalBytes > 0 
              ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
              : Math.min(95, Math.round(loadedBytes / (1024 * 1024 * 5) * 100));

            notifyProgress({
              songId,
              status: 'downloading',
              progressPercent: percent,
              bytesDownloaded: loadedBytes,
              totalBytes: totalBytes || loadedBytes,
              downloadSpeedBps: speed,
            });
          }
        }
      } else {
        const fullBlob = await response.blob();
        loadedBytes = fullBlob.size;
        chunks.push(new Uint8Array(await fullBlob.arrayBuffer()));
      }

      const audioBlob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' });

      // 4. STATE & FILE PERSISTENCE
      await this.saveTrackBlobAndMetadata(song, audioBlob, quality);

      activeAbortControllers.delete(songId);

      notifyProgress({
        songId,
        status: 'completed',
        progressPercent: 100,
        bytesDownloaded: loadedBytes,
        totalBytes: loadedBytes,
      });

      notifyStateChanged();
      return true;
    } catch (err: any) {
      activeAbortControllers.delete(songId);

      if (err.name === 'AbortError') {
        notifyProgress({
          songId,
          status: 'paused',
          progressPercent: 0,
          bytesDownloaded: 0,
          totalBytes: 0,
        });
        return false;
      }

      console.error(`Download failed for track ${songId}:`, err);
      notifyProgress({
        songId,
        status: 'failed',
        progressPercent: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        errorMessage: err.message || 'Download failed unexpectedly.',
      });
      return false;
    }
  }

  /**
   * Saves Audio Blob and Track Metadata into IndexedDB.
   */
  private static async saveTrackBlobAndMetadata(
    song: Song,
    blob: Blob,
    quality: 'standard' | 'high' | 'lossless'
  ): Promise<void> {
    const db = await getDB();
    const trackRecord: StoredOfflineTrack = {
      songId: song.id,
      song,
      status: 'completed',
      sourceType: getSongSourceType(song),
      audioUrl: song.audioUrl!,
      fileSizeBytes: blob.size,
      downloadedAt: Date.now(),
      lastAccessedAt: Date.now(),
      quality,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
      
      tx.objectStore(TRACKS_STORE).put(trackRecord);
      tx.objectStore(BLOBS_STORE).put({ songId: song.id, blob, mimeType: blob.type });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Pauses an active download.
   */
  public static pauseDownload(songId: string): boolean {
    if (typeof window !== 'undefined' && window.AndroidMedia3Bridge?.pauseDownload) {
      window.AndroidMedia3Bridge.pauseDownload(songId);
    }

    const controller = activeAbortControllers.get(songId);
    if (controller) {
      controller.abort();
      activeAbortControllers.delete(songId);
      notifyProgress({
        songId,
        status: 'paused',
        progressPercent: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
      });
      return true;
    }
    return false;
  }

  /**
   * Retrieves offline track record.
   */
  public static async getOfflineTrack(songId: string): Promise<StoredOfflineTrack | null> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(TRACKS_STORE, 'readonly');
        const req = tx.objectStore(TRACKS_STORE).get(songId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Retrieves all offline downloaded tracks.
   */
  public static async getAllDownloadedTracks(): Promise<StoredOfflineTrack[]> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(TRACKS_STORE, 'readonly');
        const req = tx.objectStore(TRACKS_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  /**
   * Retrieves an offline playback URL for local player playback.
   */
  public static async getOfflinePlaybackUrl(songId: string): Promise<string | null> {
    // Check cached blob url
    if (activeBlobUrls.has(songId)) {
      return activeBlobUrls.get(songId)!;
    }

    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(BLOBS_STORE, 'readonly');
        const req = tx.objectStore(BLOBS_STORE).get(songId);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            const blobUrl = URL.createObjectURL(req.result.blob);
            activeBlobUrls.set(songId, blobUrl);
            resolve(blobUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Removes a downloaded track and frees app-specific storage.
   */
  public static async removeDownload(songId: string): Promise<boolean> {
    // Media3 bridge call if present
    if (typeof window !== 'undefined' && window.AndroidMedia3Bridge?.removeDownloadedTrack) {
      window.AndroidMedia3Bridge.removeDownloadedTrack(songId);
    }

    // Cancel in-flight if running
    this.pauseDownload(songId);

    // Clean up memory blob URL
    if (activeBlobUrls.has(songId)) {
      URL.revokeObjectURL(activeBlobUrls.get(songId)!);
      activeBlobUrls.delete(songId);
    }

    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
        tx.objectStore(TRACKS_STORE).delete(songId);
        tx.objectStore(BLOBS_STORE).delete(songId);
        tx.oncomplete = () => {
          activeProgress.delete(songId);
          notifyStateChanged();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  }

  /**
   * Purges all offline tracks and resets local offline storage.
   */
  public static async removeAllDownloads(): Promise<void> {
    activeBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrls.clear();
    activeAbortControllers.forEach((c) => c.abort());
    activeAbortControllers.clear();

    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite');
        tx.objectStore(TRACKS_STORE).clear();
        tx.objectStore(BLOBS_STORE).clear();
        tx.oncomplete = () => {
          activeProgress.clear();
          notifyStateChanged();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('Failed to clear offline storage:', e);
    }
  }

  /**
   * Calculates total offline storage used and estimate free device space.
   */
  public static async getStorageMetrics(): Promise<{
    usedBytes: number;
    trackCount: number;
    quotaBytes?: number;
    availableBytes?: number;
  }> {
    const tracks = await this.getAllDownloadedTracks();
    const usedBytes = tracks.reduce((sum, t) => sum + (t.fileSizeBytes || 0), 0);

    let quotaBytes: number | undefined;
    let availableBytes: number | undefined;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) quotaBytes = estimate.quota;
        if (estimate.quota && estimate.usage) {
          availableBytes = Math.max(0, estimate.quota - estimate.usage);
        }
      } catch {
        // Fallback
      }
    }

    return {
      usedBytes,
      trackCount: tracks.length,
      quotaBytes,
      availableBytes,
    };
  }
}

export default OfflineDownloadService;
