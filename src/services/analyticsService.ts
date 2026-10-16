import { db, auth } from '../lib/firebase';
import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { Song } from '../types';
import { getVisitorId, getDeviceType } from '../lib/analytics';
import { queueAndSyncAnalytics } from './backgroundSyncService';

export interface PlaybackEventData {
  id?: string;
  songId: string;
  title: string;
  artist: string;
  source: 'internal' | 'youtube' | 'sbg' | string;
  eventType: 'playback_started' | 'playback_paused' | 'playback_completed' | 'playback_resumed' | 'playback_skipped' | 'playback_progress';
  currentTime?: number;
  duration?: number;
  playlistId?: string;
  userId?: string | null;
  anonymousSessionId?: string;
  anonymousId?: string;
  deviceType?: string;
  playbackSource?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface RecordEventOptions {
  /** If true, immediately triggers a bulk flush rather than waiting for the periodic timer */
  immediate?: boolean;
}

/** Configuration Constants for Batching */
const BUFFER_STORAGE_KEY = 'sbg_playback_event_buffer_v1';
const BATCH_FLUSH_INTERVAL_MS = 20000; // 20 seconds bulk flush window
const MAX_BUFFER_THRESHOLD = 20;       // Max events before forcing an immediate bulk write
const MAX_BATCH_WRITE_LIMIT = 450;     // Firestore writeBatch max is 500
const MAX_STORED_QUEUE_LIMIT = 100;    // Prevent unbounded local storage growth during offline periods

/** In-Memory Buffer State */
let eventBuffer: PlaybackEventData[] = [];
let flushTimeout: any = null;
let isFlushing = false;
let isInitialized = false;

/**
 * Initializes buffer from local persistence if available.
 */
function initBuffer(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  try {
    const raw = localStorage.getItem(BUFFER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        eventBuffer = parsed.slice(-MAX_STORED_QUEUE_LIMIT);
        scheduleNextFlush();
      }
    }
  } catch (err) {
    console.warn('Could not restore analytics buffer from storage:', err);
  }

  // Register lifecycle listeners to flush automatically before background sleep or tab close
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && eventBuffer.length > 0) {
        flushPlaybackEventsBuffer();
      }
    });

    window.addEventListener('beforeunload', () => {
      if (eventBuffer.length > 0) {
        flushPlaybackEventsBuffer();
      }
    });

    window.addEventListener('pagehide', () => {
      if (eventBuffer.length > 0) {
        flushPlaybackEventsBuffer();
      }
    });

    window.addEventListener('online', () => {
      if (eventBuffer.length > 0) {
        flushPlaybackEventsBuffer();
      }
    });
  } catch (err) {
    // Ignore in non-browser environments
  }
}

/**
 * Persists the current in-memory buffer to localStorage to ensure resilience against unexpected tab closures.
 */
function persistBuffer(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (eventBuffer.length === 0) {
      localStorage.removeItem(BUFFER_STORAGE_KEY);
    } else {
      localStorage.setItem(
        BUFFER_STORAGE_KEY,
        JSON.stringify(eventBuffer.slice(-MAX_STORED_QUEUE_LIMIT))
      );
    }
  } catch (err) {
    // Local storage quota or security error
  }
}

/**
 * Schedules a periodic batch flush timer only when events exist, preserving battery efficiency.
 */
function scheduleNextFlush(): void {
  if (flushTimeout) return;
  if (eventBuffer.length === 0) return;

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushPlaybackEventsBuffer();
  }, BATCH_FLUSH_INTERVAL_MS);
}

/**
 * Generates or retrieves a privacy-conscious anonymous session identifier.
 */
export function getAnonymousSessionId(): string {
  return getVisitorId();
}

/**
 * Determines whether a song track is a YouTube-embedded track or an internal library track.
 */
export function determineTrackSource(song: Partial<Song>): 'youtube' | 'internal' | 'sbg' {
  if (song.source === 'youtube' || Boolean(song.youtubeUrl) || Boolean(song.youtubeVideoId)) {
    return 'youtube';
  }
  if (song.source === 'sbg') {
    return 'sbg';
  }
  return 'internal';
}

/**
 * Performs a bulk write of all buffered playback events to Firestore in a single network round-trip.
 * Uses Firestore writeBatch to minimize write transactions and save device battery.
 *
 * @returns Promise resolving to the number of successfully written events.
 */
export async function flushPlaybackEventsBuffer(): Promise<number> {
  initBuffer();

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (isFlushing || eventBuffer.length === 0) {
    return 0;
  }

  isFlushing = true;
  const eventsToWrite = [...eventBuffer.slice(0, MAX_BATCH_WRITE_LIMIT)];

  // If client is currently offline, dispatch directly to Service Worker Background Sync
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      await queueAndSyncAnalytics(eventsToWrite);
      eventBuffer = eventBuffer.slice(eventsToWrite.length);
      persistBuffer();
      return eventsToWrite.length;
    } catch {
      // Fallback to local memory retry
    } finally {
      isFlushing = false;
    }
  }

  try {
    const batch = writeBatch(db);
    const currentUser = auth.currentUser;
    const currentUserId = currentUser ? currentUser.uid : null;
    const defaultAnonId = getAnonymousSessionId();
    const defaultDevice = getDeviceType();
    const now = Date.now();

    const eventsCollectionRef = collection(db, 'playbackEvents');

    for (const event of eventsToWrite) {
      const docRef = doc(eventsCollectionRef);
      const payload = {
        ...event,
        id: docRef.id,
        userId: event.userId !== undefined ? event.userId : currentUserId,
        anonymousSessionId: event.anonymousSessionId || event.anonymousId || defaultAnonId,
        anonymousId: event.anonymousId || event.anonymousSessionId || defaultAnonId,
        deviceType: event.deviceType || defaultDevice,
        createdAt: serverTimestamp(),
        timestamp: event.timestamp || now,
      };

      batch.set(docRef, payload);
    }

    await batch.commit();

    // Remove successfully processed events from buffer
    eventBuffer = eventBuffer.slice(eventsToWrite.length);
    persistBuffer();

    const flushedCount = eventsToWrite.length;

    // If more events accumulated in the meantime, schedule another batch
    if (eventBuffer.length > 0) {
      scheduleNextFlush();
    }

    return flushedCount;
  } catch (error) {
    console.warn('Bulk write of analytics playback events failed non-critically, queueing for Background Sync:', error);
    // Push failed events to Service Worker Background Sync API
    try {
      await queueAndSyncAnalytics(eventsToWrite);
      eventBuffer = eventBuffer.slice(eventsToWrite.length);
      persistBuffer();
      return eventsToWrite.length;
    } catch {
      // Keep items in the buffer, cap size to prevent unbounded growth
      if (eventBuffer.length > MAX_STORED_QUEUE_LIMIT) {
        eventBuffer = eventBuffer.slice(-MAX_STORED_QUEUE_LIMIT);
      }
      persistBuffer();
      scheduleNextFlush();
      return 0;
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Records a playback event into the local buffer for periodic bulk processing.
 * Works uniformly for both internal library tracks and YouTube-embedded tracks.
 */
export async function recordPlaybackEvent(
  eventData: PlaybackEventData,
  options?: RecordEventOptions
): Promise<string | null> {
  initBuffer();

  const currentUser = auth.currentUser;
  const userId = eventData.userId !== undefined ? eventData.userId : (currentUser ? currentUser.uid : null);
  const anonymousSessionId = eventData.anonymousSessionId || eventData.anonymousId || getAnonymousSessionId();
  const deviceType = eventData.deviceType || getDeviceType();

  const preparedEvent: PlaybackEventData = {
    ...eventData,
    userId,
    anonymousSessionId,
    anonymousId: anonymousSessionId,
    deviceType,
    timestamp: eventData.timestamp || Date.now(),
  };

  // Add event to in-memory and persisted buffer
  eventBuffer.push(preparedEvent);
  persistBuffer();

  // If buffer exceeds threshold or immediate option is requested, flush immediately
  if (options?.immediate || eventBuffer.length >= MAX_BUFFER_THRESHOLD) {
    await flushPlaybackEventsBuffer();
  } else {
    scheduleNextFlush();
  }

  return preparedEvent.id || 'buffered';
}

/**
 * Convenience method to track when a track begins playing (buffered).
 */
export async function recordPlaybackStart(
  song: Song, 
  extra?: Partial<PlaybackEventData>, 
  options?: RecordEventOptions
): Promise<string | null> {
  if (!song || !song.id) return null;
  const source = determineTrackSource(song);
  return recordPlaybackEvent({
    songId: song.id,
    title: song.title || 'Untitled Track',
    artist: song.artist || 'Unknown Artist',
    source,
    eventType: 'playback_started',
    duration: song.durationSeconds || song.duration || 0,
    currentTime: extra?.currentTime || 0,
    playlistId: extra?.playlistId,
    ...extra,
  }, options);
}

/**
 * Convenience method to track when a track is paused (buffered).
 */
export async function recordPlaybackPause(
  song: Song, 
  extra?: Partial<PlaybackEventData>, 
  options?: RecordEventOptions
): Promise<string | null> {
  if (!song || !song.id) return null;
  const source = determineTrackSource(song);
  return recordPlaybackEvent({
    songId: song.id,
    title: song.title || 'Untitled Track',
    artist: song.artist || 'Unknown Artist',
    source,
    eventType: 'playback_paused',
    duration: song.durationSeconds || song.duration || 0,
    currentTime: extra?.currentTime || 0,
    playlistId: extra?.playlistId,
    ...extra,
  }, options);
}

/**
 * Convenience method to track when a track completes full playback (buffered).
 */
export async function recordPlaybackComplete(
  song: Song, 
  extra?: Partial<PlaybackEventData>, 
  options?: RecordEventOptions
): Promise<string | null> {
  if (!song || !song.id) return null;
  const source = determineTrackSource(song);
  return recordPlaybackEvent({
    songId: song.id,
    title: song.title || 'Untitled Track',
    artist: song.artist || 'Unknown Artist',
    source,
    eventType: 'playback_completed',
    duration: song.durationSeconds || song.duration || 0,
    currentTime: song.durationSeconds || song.duration || extra?.currentTime || 0,
    playlistId: extra?.playlistId,
    ...extra,
  }, options);
}

/**
 * Convenience method to track when a track is skipped (buffered).
 */
export async function recordPlaybackSkip(
  song: Song, 
  extra?: Partial<PlaybackEventData>, 
  options?: RecordEventOptions
): Promise<string | null> {
  if (!song || !song.id) return null;
  const source = determineTrackSource(song);
  return recordPlaybackEvent({
    songId: song.id,
    title: song.title || 'Untitled Track',
    artist: song.artist || 'Unknown Artist',
    source,
    eventType: 'playback_skipped',
    duration: song.durationSeconds || song.duration || 0,
    currentTime: extra?.currentTime || 0,
    playlistId: extra?.playlistId,
    ...extra,
  }, options);
}

/**
 * Convenience method to record continuous progress milestones (buffered).
 */
export async function recordPlaybackProgress(
  song: Song, 
  extra?: Partial<PlaybackEventData>, 
  options?: RecordEventOptions
): Promise<string | null> {
  if (!song || !song.id) return null;
  const source = determineTrackSource(song);
  return recordPlaybackEvent({
    songId: song.id,
    title: song.title || 'Untitled Track',
    artist: song.artist || 'Unknown Artist',
    source,
    eventType: 'playback_progress',
    duration: song.durationSeconds || song.duration || 0,
    currentTime: extra?.currentTime || 0,
    playlistId: extra?.playlistId,
    ...extra,
  }, options);
}

/**
 * Returns current count of pending events in buffer.
 */
export function getPendingEventsCount(): number {
  return eventBuffer.length;
}

/**
 * Clears the buffer and local storage queue.
 */
export function clearPlaybackEventsBuffer(): void {
  eventBuffer = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  try {
    localStorage.removeItem(BUFFER_STORAGE_KEY);
  } catch {}
}

/**
 * Records a playlist interaction event (views, opens, library additions, track plays) into Firestore.
 * This satisfies PART 8 of tracking playlist interactions accurately without counting views as plays.
 * Features session deduplication for views to prevent quota exhaustion from repeated page visits.
 */
export async function recordPlaylistInteraction(
  playlistId: string,
  eventType: 'featured_view' | 'playlist_open' | 'add_to_library' | 'track_play',
  extra?: Record<string, any>
): Promise<void> {
  if (!playlistId) return;

  // Session-level deduplication for view impressions to prevent quota exhaustion
  if (eventType === 'featured_view') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessionKey = `sbg_view_recorded_${playlistId}`;
      if (sessionStorage.getItem(sessionKey)) {
        return; // Already recorded in this browsing session
      }
      try {
        sessionStorage.setItem(sessionKey, '1');
      } catch {}
    }
  }

  try {
    const { setDoc, collection, doc, serverTimestamp } = await import('firebase/firestore');
    const colRef = collection(db, 'analytics');
    const docRef = doc(colRef);
    const currentUser = auth.currentUser;
    await setDoc(docRef, {
      id: docRef.id,
      playlistId,
      eventType,
      userId: currentUser ? currentUser.uid : null,
      deviceType: getDeviceType(),
      anonymousSessionId: getAnonymousSessionId(),
      timestamp: Date.now(),
      createdAt: serverTimestamp(),
      ...extra,
    });
  } catch (err: any) {
    if (err?.message?.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
      // Non-critical background analytics write suppressed when quota is tight
      return;
    }
    console.warn('Failed to record playlist interaction event (non-critical):', err?.message || err);
  }
}

/**
 * Fetches recent granular playback events for accurate dashboard reporting.
 */
export async function fetchPlaybackEvents(limitCount = 50): Promise<PlaybackEventData[]> {
  try {
    const q = query(
      collection(db, 'playbackEvents'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as unknown as PlaybackEventData));
  } catch (error) {
    console.warn('Error fetching playback events:', error);
    return [];
  }
}
