import { db, auth } from './firebase';
import { recordPlaybackEvent } from '../services/analyticsService';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { 
  DailyAnalytics, 
  SongAnalytics, 
  PlaylistAnalytics, 
  GlobalAnalytics, 
  Song 
} from '../types';

const VISITOR_STORAGE_KEY = 'sbg_music_anon_vid';
const VISITOR_DAILY_SET_KEY = 'sbg_daily_visited_days';

/**
 * Generates or retrieves a privacy-preserving anonymous visitor ID from localStorage.
 * No personal data, email, or IP address is tracked or stored.
 */
export function getVisitorId(): string {
  try {
    let vid = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!vid) {
      vid = 'vid_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem(VISITOR_STORAGE_KEY, vid);
    }
    return vid;
  } catch (e) {
    return 'vid_fallback_' + Math.random().toString(36).substring(2, 8);
  }
}

/**
 * Checks if the visitor was already counted today locally to reduce redundant unique counter increments.
 */
function isFirstVisitToday(dateStr: string): boolean {
  try {
    const raw = localStorage.getItem(VISITOR_DAILY_SET_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (set.includes(dateStr)) {
      return false;
    }
    const updated = [...set.slice(-30), dateStr];
    localStorage.setItem(VISITOR_DAILY_SET_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * Formats seconds into a human-readable duration string (e.g. "436h 21m" or "20m 23s").
 */
export function formatListenTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const sec = Math.floor(seconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSeconds = sec % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remSeconds}s`;
  }
  return `${remSeconds}s`;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD).
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface PlaybackBatchPayload {
  song: Song;
  playlistId?: string;
  isNewPlay: boolean;
  listenSeconds: number;
  isCompleted: boolean;
  isSkipped?: boolean;
  playbackSource?: 'Home' | 'Search' | 'Song Page' | 'Playlist' | 'YouTube' | 'Library' | 'Favorites' | string;
  eventType?: 'playback_started' | 'playback_paused' | 'playback_resumed' | 'playback_completed' | 'playback_skipped';
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

/**
  * Flushes accumulated playback watch time to Firestore.
  * Updates daily, song-level, playlist-level, source breakdown, and global aggregated metrics.
  */
export async function flushPlaybackAnalytics(payload: PlaybackBatchPayload): Promise<void> {
  const { song, playlistId, isNewPlay, listenSeconds, isCompleted, isSkipped, playbackSource = 'Home', eventType = 'playback_progress' } = payload;
  if (!song || !song.id) return;
  if (listenSeconds <= 0 && !isNewPlay && !isCompleted && !isSkipped) return;

  const today = getTodayDateString();
  const visitorId = getVisitorId();
  const isNewDailyVisitor = isFirstVisitToday(today);
  const now = Date.now();
  const isYoutube = song.source === 'youtube' || Boolean(song.youtubeUrl);
  const deviceType = getDeviceType();

  const currentUser = auth.currentUser;
  const isAuthenticated = Boolean(currentUser && currentUser.uid);
  const userId = currentUser ? currentUser.uid : null;
  const anonymousSessionId = visitorId;

  const listenSecs = Math.max(0, Math.floor(listenSeconds));

  try {
    // 1. Update Global Overview Aggregation in both analytics/overview and analytics_overview/global
    const dedicatedDocRef = doc(db, 'analytics', 'overview');
    const globalDocRef = doc(db, 'analytics_overview', 'global');
    
    const overviewUpdateData = {
      totalPlays: increment(isNewPlay ? 1 : 0),
      authenticatedPlays: increment(isNewPlay && isAuthenticated ? 1 : 0),
      anonymousPlays: increment(isNewPlay && !isAuthenticated ? 1 : 0),
      
      totalWatchTimeSeconds: increment(listenSecs),
      authenticatedWatchTimeSeconds: increment(isAuthenticated ? listenSecs : 0),
      anonymousWatchTimeSeconds: increment(!isAuthenticated ? listenSecs : 0),

      totalListenSeconds: increment(listenSecs),
      authenticatedListenSeconds: increment(isAuthenticated ? listenSecs : 0),
      anonymousListenSeconds: increment(!isAuthenticated ? listenSecs : 0),

      totalCompletions: increment(isCompleted ? 1 : 0),
      authenticatedCompletions: increment(isCompleted && isAuthenticated ? 1 : 0),
      anonymousCompletions: increment(isCompleted && !isAuthenticated ? 1 : 0),

      totalSkips: increment(isSkipped ? 1 : 0),
      authenticatedSkips: increment(isSkipped && isAuthenticated ? 1 : 0),
      anonymousSkips: increment(isSkipped && !isAuthenticated ? 1 : 0),

      uniqueVisitorsCount: increment(isNewDailyVisitor ? 1 : 0),
      authenticatedUniqueCount: increment(isNewDailyVisitor && isAuthenticated ? 1 : 0),
      anonymousUniqueCount: increment(isNewDailyVisitor && !isAuthenticated ? 1 : 0),

      anonymousSessionsCount: increment(isNewDailyVisitor && !isAuthenticated ? 1 : 0),
      youtubePlaysCount: increment(isNewPlay && isYoutube ? 1 : 0),
      sbgPlaysCount: increment(isNewPlay && !isYoutube ? 1 : 0),
      [`sourceBreakdown.${playbackSource}`]: increment(isNewPlay ? 1 : 0),
      [`deviceBreakdown.${deviceType}`]: increment(isNewPlay ? 1 : 0),
      updatedAt: now,
    };

    await Promise.all([
      setDoc(dedicatedDocRef, overviewUpdateData, { merge: true }),
      setDoc(globalDocRef, overviewUpdateData, { merge: true })
    ]);

    // 2. Update Daily Analytics (analytics_daily/{YYYY-MM-DD})
    const dailyDocRef = doc(db, 'analytics_daily', today);
    await setDoc(
      dailyDocRef,
      {
        date: today,
        totalPlays: increment(isNewPlay ? 1 : 0),
        authenticatedPlays: increment(isNewPlay && isAuthenticated ? 1 : 0),
        anonymousPlays: increment(isNewPlay && !isAuthenticated ? 1 : 0),

        totalListenSeconds: increment(listenSecs),
        authenticatedListenSeconds: increment(isAuthenticated ? listenSecs : 0),
        anonymousListenSeconds: increment(!isAuthenticated ? listenSecs : 0),

        uniqueVisitorsCount: increment(isNewDailyVisitor ? 1 : 0),
        authenticatedUniqueCount: increment(isNewDailyVisitor && isAuthenticated ? 1 : 0),
        anonymousUniqueCount: increment(isNewDailyVisitor && !isAuthenticated ? 1 : 0),

        completedCount: increment(isCompleted ? 1 : 0),
        authenticatedCompletedCount: increment(isCompleted && isAuthenticated ? 1 : 0),
        anonymousCompletedCount: increment(isCompleted && !isAuthenticated ? 1 : 0),

        skippedCount: increment(isSkipped ? 1 : 0),
        authenticatedSkippedCount: increment(isSkipped && isAuthenticated ? 1 : 0),
        anonymousSkippedCount: increment(isSkipped && !isAuthenticated ? 1 : 0),

        songsPlayedCount: increment(isNewPlay ? 1 : 0),
        playlistPlaysCount: increment(isNewPlay && playlistId ? 1 : 0),
        youtubePlaysCount: increment(isNewPlay && isYoutube ? 1 : 0),
        sbgPlaysCount: increment(isNewPlay && !isYoutube ? 1 : 0),
        
        [`sourceBreakdown.${playbackSource}`]: increment(isNewPlay ? 1 : 0),
        [`deviceBreakdown.${deviceType}`]: increment(isNewPlay ? 1 : 0),
        updatedAt: now,
      },
      { merge: true }
    );

    // 3. Update Song Analytics (analytics_songs/{songId})
    const songDocRef = doc(db, 'analytics_songs', song.id);
    const dailySongKey = `dailyHistory.${today}`;

    await setDoc(
      songDocRef,
      {
        songId: song.id,
        title: song.title || 'Untitled',
        artist: song.artist || 'Unknown Artist',
        source: isYoutube ? 'youtube' : 'sbg',
        coverUrl: song.heroImageUrl || song.coverUrl || song.thumbnailUrl || '',

        totalPlays: increment(isNewPlay ? 1 : 0),
        authenticatedPlays: increment(isNewPlay && isAuthenticated ? 1 : 0),
        anonymousPlays: increment(isNewPlay && !isAuthenticated ? 1 : 0),

        totalListenSeconds: increment(listenSecs),
        authenticatedListenSeconds: increment(isAuthenticated ? listenSecs : 0),
        anonymousListenSeconds: increment(!isAuthenticated ? listenSecs : 0),

        uniqueVisitorsCount: increment(isNewDailyVisitor ? 1 : 0),
        authenticatedUniqueCount: increment(isNewDailyVisitor && isAuthenticated ? 1 : 0),
        anonymousUniqueCount: increment(isNewDailyVisitor && !isAuthenticated ? 1 : 0),

        completedCount: increment(isCompleted ? 1 : 0),
        authenticatedCompletedCount: increment(isCompleted && isAuthenticated ? 1 : 0),
        anonymousCompletedCount: increment(isCompleted && !isAuthenticated ? 1 : 0),

        skippedCount: increment(isSkipped ? 1 : 0),
        lastPlayedAt: now,
        updatedAt: now,
        [`${dailySongKey}.plays`]: increment(isNewPlay ? 1 : 0),
        [`${dailySongKey}.listenSeconds`]: increment(listenSecs),
        [`${dailySongKey}.completions`]: increment(isCompleted ? 1 : 0),
      },
      { merge: true }
    );

    // 4. Update Playlist Analytics if played from a playlist
    if (playlistId) {
      const playlistDocRef = doc(db, 'analytics_playlists', playlistId);
      await setDoc(
        playlistDocRef,
        {
          playlistId,
          totalPlays: increment(isNewPlay ? 1 : 0),
          authenticatedPlays: increment(isNewPlay && isAuthenticated ? 1 : 0),
          anonymousPlays: increment(isNewPlay && !isAuthenticated ? 1 : 0),

          totalListenSeconds: increment(listenSecs),
          authenticatedListenSeconds: increment(isAuthenticated ? listenSecs : 0),
          anonymousListenSeconds: increment(!isAuthenticated ? listenSecs : 0),

          uniqueVisitorsCount: increment(isNewDailyVisitor ? 1 : 0),
          authenticatedUniqueCount: increment(isNewDailyVisitor && isAuthenticated ? 1 : 0),
          anonymousUniqueCount: increment(isNewDailyVisitor && !isAuthenticated ? 1 : 0),

          lastPlayedAt: now,
          updatedAt: now,
          [`songPlayCounts.${song.id}`]: increment(isNewPlay ? 1 : 0),
        },
        { merge: true }
      );
    }

    // 5. Raw Event Submission to playbackEvents
    await recordPlaybackEvent({
      songId: song.id,
      title: song.title || 'Untitled Track',
      artist: song.artist || 'Unknown Artist',
      source: isYoutube ? 'youtube' : 'internal',
      eventType: isCompleted ? 'playback_completed' : isSkipped ? 'playback_skipped' : isNewPlay ? 'playback_started' : eventType,
      currentTime: listenSecs,
      duration: song.durationSeconds || song.duration || 0,
      playlistId,
      userId: userId || undefined,
      anonymousSessionId,
      deviceType,
      playbackSource,
    });
  } catch (err) {
    console.warn('Analytics batch write failed non-critically:', err);
  }
}

/**
 * Fetches Global Analytics Summary
 */
export async function fetchGlobalAnalytics(): Promise<GlobalAnalytics> {
  try {
    let snap = await getDoc(doc(db, 'analytics', 'overview'));
    if (!snap.exists()) {
      snap = await getDoc(doc(db, 'analytics_overview', 'global'));
    }

    if (snap.exists()) {
      const data = snap.data();
      return {
        totalPlays: data.totalPlays || 0,
        authenticatedPlays: data.authenticatedPlays || 0,
        anonymousPlays: data.anonymousPlays || 0,
        totalListenSeconds: data.totalListenSeconds || data.totalWatchTimeSeconds || 0,
        authenticatedListenSeconds: data.authenticatedListenSeconds || data.authenticatedWatchTimeSeconds || 0,
        anonymousListenSeconds: data.anonymousListenSeconds || data.anonymousWatchTimeSeconds || 0,
        uniqueVisitorsCount: data.uniqueVisitorsCount || 0,
        authenticatedUniqueCount: data.authenticatedUniqueCount || 0,
        anonymousUniqueCount: data.anonymousUniqueCount || 0,
        totalCompletions: data.totalCompletions || 0,
        authenticatedCompletions: data.authenticatedCompletions || 0,
        anonymousCompletions: data.anonymousCompletions || 0,
        totalSkips: data.totalSkips || 0,
        authenticatedSkips: data.authenticatedSkips || 0,
        anonymousSkips: data.anonymousSkips || 0,
        songsPlayedCount: data.songsPlayedCount || 0,
        playlistPlaysCount: data.playlistPlaysCount || 0,
        anonymousSessionsCount: data.anonymousSessionsCount || 0,
        updatedAt: data.updatedAt,
      };
    }
  } catch (e) {
    console.warn('Error fetching global analytics:', e);
  }

  return {
    totalPlays: 0,
    authenticatedPlays: 0,
    anonymousPlays: 0,
    totalListenSeconds: 0,
    authenticatedListenSeconds: 0,
    anonymousListenSeconds: 0,
    uniqueVisitorsCount: 0,
    authenticatedUniqueCount: 0,
    anonymousUniqueCount: 0,
    totalCompletions: 0,
    authenticatedCompletions: 0,
    anonymousCompletions: 0,
    totalSkips: 0,
    authenticatedSkips: 0,
    anonymousSkips: 0,
    songsPlayedCount: 0,
    playlistPlaysCount: 0,
    anonymousSessionsCount: 0,
  };
}

/**
 * Fetches historical daily analytics
 */
export async function fetchDailyAnalytics(daysLimit: number = 30): Promise<DailyAnalytics[]> {
  try {
    const q = query(
      collection(db, 'analytics_daily'),
      orderBy('date', 'desc'),
      limit(daysLimit)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAnalytics));
    return list.reverse(); // chronological order
  } catch (e) {
    console.warn('Error fetching daily analytics:', e);
    return [];
  }
}

/**
 * Fetches top played songs by total plays or listening time
 */
export async function fetchTopSongsAnalytics(limitCount: number = 10): Promise<SongAnalytics[]> {
  try {
    const q = query(
      collection(db, 'analytics_songs'),
      orderBy('totalPlays', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SongAnalytics));
  } catch (e) {
    console.warn('Error fetching top songs analytics:', e);
    return [];
  }
}

/**
 * Fetches single song analytics
 */
export async function fetchSongAnalytics(songId: string): Promise<SongAnalytics | null> {
  try {
    const ref = doc(db, 'analytics_songs', songId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as SongAnalytics;
    }
  } catch (e) {
    console.warn(`Error fetching analytics for song ${songId}:`, e);
  }
  return null;
}

/**
 * Fetches all playlist analytics
 */
export async function fetchAllPlaylistsAnalytics(): Promise<PlaylistAnalytics[]> {
  try {
    const q = query(
      collection(db, 'analytics_playlists'),
      orderBy('totalPlays', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlaylistAnalytics));
  } catch (e) {
    console.warn('Error fetching playlists analytics:', e);
    return [];
  }
}

/**
 * Fetches single playlist analytics
 */
export async function fetchPlaylistAnalytics(playlistId: string): Promise<PlaylistAnalytics | null> {
  try {
    const ref = doc(db, 'analytics_playlists', playlistId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as PlaylistAnalytics;
    }
  } catch (e) {
    console.warn(`Error fetching analytics for playlist ${playlistId}:`, e);
  }
  return null;
}

/**
 * Fetches the distribution of YouTube song imports over the last X days.
 */
export async function fetchSongImportsDistribution(daysLimit: number = 30): Promise<{ date: string; imports: number }[]> {
  try {
    const now = Date.now();
    const limitMs = daysLimit * 24 * 60 * 60 * 1000;
    const cutoffTs = now - limitMs;

    // Use a filtered query to avoid full collection scan and save read quota
    const q = query(
      collection(db, 'songs'),
      where('source', '==', 'youtube'),
      where('createdAt', '>=', cutoffTs)
    );
    
    const snap = await getDocs(q);
    
    // Group by YYYY-MM-DD
    const countsByDate: Record<string, number> = {};
    
    snap.forEach((d) => {
      const data = d.data();
      if (data.createdAt) {
        let ts = 0;
        if (data.createdAt?.toMillis) {
          ts = data.createdAt.toMillis();
        } else if (typeof data.createdAt === 'number') {
          ts = data.createdAt;
        } else if (typeof data.createdAt === 'string') {
          ts = new Date(data.createdAt).getTime();
        }
        
        if (ts >= cutoffTs) {
          const dateObj = new Date(ts);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
        }
      }
    });

    const result: { date: string; imports: number }[] = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      result.push({
        date: dateStr,
        imports: countsByDate[dateStr] || 0
      });
    }

    return result;
  } catch (e) {
    console.warn('Error fetching song imports distribution:', e);
    return [];
  }
}

export interface RealtimeListenerInfo {
  activeCount: number;
  recentTracks: {
    songId: string;
    title: string;
    artist: string;
    source: string;
    timestamp: number;
    isAnonymous: boolean;
  }[];
}

/**
 * Fetches recent active listener sessions within the last 15 minutes.
 */
export async function fetchRealtimeListeners(): Promise<RealtimeListenerInfo> {
  try {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const q = query(
      collection(db, 'playbackEvents'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );
    const snap = await getDocs(q);
    const events = snap.docs
      .map((d) => d.data())
      .filter((e) => (e.timestamp || 0) >= cutoff);

    // Group unique listeners / sessions
    const uniqueSessions = new Set<string>();
    const recentTracks: RealtimeListenerInfo['recentTracks'] = [];

    events.forEach((ev) => {
      const sess = ev.userId || ev.anonymousSessionId || ev.anonymousId;
      if (sess) uniqueSessions.add(sess);

      if (!recentTracks.some((t) => t.songId === ev.songId)) {
        recentTracks.push({
          songId: ev.songId || 'unknown',
          title: ev.title || 'Untitled Track',
          artist: ev.artist || 'Unknown Artist',
          source: ev.source || 'sbg',
          timestamp: ev.timestamp || Date.now(),
          isAnonymous: !ev.userId,
        });
      }
    });

    return {
      activeCount: Math.max(uniqueSessions.size, recentTracks.length),
      recentTracks: recentTracks.slice(0, 8),
    };
  } catch (e) {
    return { activeCount: 0, recentTracks: [] };
  }
}

export interface YouTubeAnalyticsSummary {
  totalPlays: number;
  totalWatchTimeSeconds: number;
  completionRate: number;
  skipRate: number;
  topTracks: SongAnalytics[];
}

/**
 * Fetches YouTube playback metrics and top YouTube tracks.
 */
export async function fetchYouTubeAnalytics(): Promise<YouTubeAnalyticsSummary> {
  try {
    const q = query(
      collection(db, 'analytics_songs'),
      where('source', '==', 'youtube'),
      orderBy('totalPlays', 'desc'),
      limit(15)
    );
    const snap = await getDocs(q);
    const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SongAnalytics));

    let totalPlays = 0;
    let totalSecs = 0;
    let totalCompletions = 0;
    let totalSkips = 0;

    tracks.forEach((t) => {
      totalPlays += t.totalPlays || 0;
      totalSecs += t.totalListenSeconds || 0;
      totalCompletions += t.completedCount || 0;
      totalSkips += t.skippedCount || 0;
    });

    return {
      totalPlays,
      totalWatchTimeSeconds: totalSecs,
      completionRate: totalPlays > 0 ? Math.round((totalCompletions / totalPlays) * 100) : 0,
      skipRate: totalPlays > 0 ? Math.round((totalSkips / totalPlays) * 100) : 0,
      topTracks: tracks,
    };
  } catch (e) {
    return {
      totalPlays: 0,
      totalWatchTimeSeconds: 0,
      completionRate: 0,
      skipRate: 0,
      topTracks: [],
    };
  }
}

