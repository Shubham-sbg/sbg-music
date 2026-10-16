import React, { createContext, useContext, useState, useRef, ReactNode, useEffect, useCallback } from 'react';
import { Song, AdCampaign } from '../types';
import { extractYoutubeVideoId } from '../lib/youtube';
import { flushPlaybackAnalytics } from '../lib/analytics';
import { recordPlaybackStart, recordPlaybackPause, recordPlaybackComplete, flushPlaybackEventsBuffer } from '../services/analyticsService';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  getSongSavedPosition, 
  saveSongPlaybackPosition, 
  clearSongPlaybackPosition, 
  SavedPlaybackPosition 
} from '../lib/playbackPosition';
import { 
  fetchAdSettings, 
  fetchActiveCampaigns, 
  recordAdImpression, 
  recordAdClick, 
  recordVoiceAdPlay, 
  recordVoiceAdCompletion 
} from '../lib/ads';
import { autoCacheActiveTrack } from '../services/offlineMusicService';
import { getOfflineSongBlobUrl } from '../services/offlineStorageService';
import { Minimize2, Maximize2, X, Radio, AlertCircle, RefreshCw } from 'lucide-react';

export type PlaybackLifecycleState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';
export type TrackSourceType = 'direct' | 'youtube';

export interface PlaybackDiagnosticInfo {
  diagnosticId: string;
  trackId: string;
  trackTitle: string;
  sourceType: TrackSourceType;
  urlHost: string;
  playbackTime: number;
  duration: number;
  playbackState: PlaybackLifecycleState;
  networkOnline: boolean;
  errorCode?: string | number;
  errorMessage?: string;
  timestamp: string;
}

export interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  playbackState: PlaybackLifecycleState;
  sourceType: TrackSourceType;
  progress: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isMiniPlayer: boolean;
  isPlayerDismissed: boolean;
  playbackError: string | null;
  diagnosticInfo: PlaybackDiagnosticInfo | null;
  activePlaylistId?: string;
  activeBannerAd: AdCampaign | null;
  activeVoiceAd: AdCampaign | null;
  isVoiceAdPlaying: boolean;
  isYoutubeDockVisible: boolean;
  isYoutubeDockMinimized: boolean;
  toggleYoutubeDock: () => void;
  toggleYoutubeDockMinimized: () => void;
  retryPlayback: () => void;
  playSong: (song: Song, newQueue?: Song[], playlistId?: string, resumeTime?: number, explicitSource?: string) => void;
  resumeSong: (song: Song, newQueue?: Song[], playlistId?: string) => void;
  getSavedPosition: (songId: string) => SavedPlaybackPosition | null;
  clearSavedPosition: (songId: string) => void;
  playPlaylist: (songs: Song[], startIndex?: number, playlistId?: string) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsMiniPlayer: (mini: boolean) => void;
  toggleMiniPlayer: () => void;
  dismissPlayer: () => void;
  restorePlayer: () => void;
  seek: (time: number) => void;
  clearError: () => void;
  dismissBannerAd: () => void;
  clickAd: (campaignId: string, url: string) => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveQueueItemUp: (index: number) => void;
  moveQueueItemDown: (index: number) => void;
  shuffleQueue: () => void;
  isShuffle: boolean;
  toggleShuffle: () => void;
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
  setSleepTimer: (minutes: number | null) => void;
  crossfadeEnabled: boolean;
  toggleCrossfade: () => void;
  volumeNormalizationEnabled: boolean;
  toggleVolumeNormalization: () => void;
  isLyricsOpen: boolean;
  toggleLyrics: () => void;
  setIsLyricsOpen: (open: boolean) => void;
  lyrics: string | null;
  syncedLyrics: string | null;
  isLyricsLoading: boolean;
  lyricsError: string | null;
  refetchLyrics: () => Promise<void>;
  shareCurrentSong: () => void;
  shareToast: string | null;
  repeatMode: 'off' | 'all' | 'one';
  toggleRepeatMode: () => void;
  audioMode: string;
  setAudioMode: (mode: string) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

/**
 * Determine track source type reliably
 */
export function getTrackSourceType(song: Song | null): TrackSourceType {
  if (!song) return 'direct';
  const offlineBlob = getOfflineSongBlobUrl(song.id);
  if (offlineBlob) return 'direct';
  if (song.source === 'youtube') return 'youtube';
  if (song.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(song.youtubeVideoId)) return 'youtube';
  if (song.youtubeUrl && (song.youtubeUrl.includes('youtube.com') || song.youtubeUrl.includes('youtu.be'))) return 'youtube';
  if (song.audioUrl && (song.audioUrl.includes('youtube.com') || song.audioUrl.includes('youtu.be'))) return 'youtube';
  return 'direct';
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [audioMode, setAudioMode] = useState<string>('normal');
  const [queue, setQueue] = useState<Song[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sbg_player_shuffle");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackLifecycleState>('idle');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<PlaybackDiagnosticInfo | null>(null);
  
  // YouTube Dock View State (Deprecated - floating dock removed)
  const [isYoutubeDockVisible, setIsYoutubeDockVisible] = useState(false);
  const [isYoutubeDockMinimized, setIsYoutubeDockMinimized] = useState(false);

  // Native Audio & YouTube Player References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const resumeTimeRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionSaveTimeRef = useRef<number>(0);

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sbg_player_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return 0.8;
  });

  const [playbackRate, setPlaybackRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sbg_playback_rate');
      return saved ? parseFloat(saved) || 1 : 1;
    } catch {
      return 1;
    }
  });

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    try {
      localStorage.setItem('sbg_playback_rate', rate.toString());
    } catch {}
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const [isMiniPlayer, setIsMiniPlayerState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbg_mini_player_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isPlayerDismissed, setIsPlayerDismissed] = useState<boolean>(false);

  const dismissPlayer = useCallback(() => {
    setIsPlayerDismissed(true);
  }, []);

  const restorePlayer = useCallback(() => {
    setIsPlayerDismissed(false);
  }, []);

  const setIsMiniPlayer = useCallback((mini: boolean) => {
    setIsMiniPlayerState(mini);
    try {
      localStorage.setItem('sbg_mini_player_collapsed', mini ? 'true' : 'false');
    } catch {}
  }, []);

  const toggleMiniPlayer = useCallback(() => {
    setIsMiniPlayerState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_mini_player_collapsed', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const toggleYoutubeDock = useCallback(() => {
    setIsYoutubeDockVisible(prev => !prev);
  }, []);

  const toggleYoutubeDockMinimized = useCallback(() => {
    setIsYoutubeDockMinimized(prev => !prev);
  }, []);

  const [activePlaylistId, setActivePlaylistId] = useState<string | undefined>(undefined);
  const [activeBannerAd, setActiveBannerAd] = useState<AdCampaign | null>(null);
  const [activeVoiceAd, setActiveVoiceAd] = useState<AdCampaign | null>(null);
  const [isVoiceAdPlaying, setIsVoiceAdPlaying] = useState<boolean>(false);
  const songsPlayedSinceLastAdRef = useRef<number>(0);

  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const shareCurrentSong = useCallback(async () => {
    if (!currentSong) return;
    const url = `${window.location.origin}/?songId=${currentSong.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setShareToast('Song deep-link copied to clipboard!');
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
      setShareToast('Failed to copy link.');
      setTimeout(() => setShareToast(null), 3000);
    }
  }, [currentSong]);

  const [volumeNormalizationEnabled, setVolumeNormalizationEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sbg_volume_normalization');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleVolumeNormalization = useCallback(() => {
    setVolumeNormalizationEnabledState(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_volume_normalization', next.toString());
      } catch {}
      return next;
    });
  }, []);

  const getNormalizationGain = (song: Song | null): number => {
    if (!song || !song.id) return 1.0;
    let hash = 0;
    for (let i = 0; i < song.id.length; i++) {
      hash = song.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 0.90 + (Math.abs(hash) % 23) / 100;
  };

  const effectiveVolume = volumeNormalizationEnabled
    ? Math.min(1, volume * getNormalizationGain(currentSong))
    : volume;

  // Sync volume to native audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = effectiveVolume;
    }
  }, [effectiveVolume]);

  // Sleep Timer countdown
  useEffect(() => {
    if (!sleepTimerMinutes || sleepTimerMinutes <= 0) {
      setSleepTimerRemaining(null);
      return;
    }

    setSleepTimerRemaining(sleepTimerMinutes * 60);

    const timer = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setIsPlaying(false);
          setPlaybackState('paused');
          if (audioRef.current) audioRef.current.pause();
          setSleepTimerMinutes(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimerMinutes]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
  }, []);

  const [crossfadeEnabled, setCrossfadeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sbg_crossfade_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleCrossfade = useCallback(() => {
    setCrossfadeEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_crossfade_enabled', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(() => {
    try {
      const saved = localStorage.getItem('sbg_repeat_mode');
      if (saved === 'all' || saved === 'one') return saved;
      return 'off';
    } catch {
      return 'off';
    }
  });

  const toggleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      try {
        localStorage.setItem('sbg_repeat_mode', next);
      } catch {}
      return next;
    });
  }, []);

  // Lyrics State
  const [isLyricsOpen, setIsLyricsOpenState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbg_lyrics_open') === 'true';
    } catch {
      return false;
    }
  });

  const setIsLyricsOpen = useCallback((open: boolean) => {
    setIsLyricsOpenState(open);
    try {
      localStorage.setItem('sbg_lyrics_open', open ? 'true' : 'false');
    } catch {}
  }, []);

  const toggleLyrics = useCallback(() => {
    setIsLyricsOpenState(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_lyrics_open', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  const fetchSongLyrics = useCallback(async (song: Song | null) => {
    if (!song) {
      setLyrics(null);
      setSyncedLyrics(null);
      setLyricsError(null);
      setIsLyricsLoading(false);
      return;
    }

    if (song.lyrics) {
      setLyrics(song.lyrics);
      setSyncedLyrics(song.syncedLyrics || null);
      setLyricsError(null);
      setIsLyricsLoading(false);
      return;
    }

    setIsLyricsLoading(true);
    setLyricsError(null);

    try {
      const titleParam = encodeURIComponent(song.title || '');
      const artistParam = encodeURIComponent(song.artist || '');
      const res = await fetch(`/api/lyrics?title=${titleParam}&artist=${artistParam}`);
      const data = await res.json();

      if (data.ok) {
        setLyrics(data.plainLyrics || data.syncedLyrics || null);
        setSyncedLyrics(data.syncedLyrics || null);
        setLyricsError(null);
      } else {
        setLyrics(null);
        setSyncedLyrics(null);
        setLyricsError(data.error || 'No lyrics available for this track.');
      }
    } catch (err: any) {
      console.warn('Failed to load lyrics:', err);
      setLyrics(null);
      setSyncedLyrics(null);
      setLyricsError('Unable to connect to lyrics service.');
    } finally {
      setIsLyricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongLyrics(currentSong);
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, fetchSongLyrics]);

  const refetchLyrics = useCallback(async () => {
    await fetchSongLyrics(currentSong);
  }, [currentSong, fetchSongLyrics]);

  // Hotkey 'L' to toggle lyrics
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          toggleLyrics();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLyrics]);

  // Watch Time Analytics Ref
  const watchTimeRef = useRef<{
    song: Song | null;
    playlistId?: string;
    playbackSource?: string;
    lastActiveTimestamp: number | null;
    accumulatedSeconds: number;
    hasFlushedPlayStart: boolean;
    isCompleted: boolean;
  }>({
    song: null,
    playlistId: undefined,
    playbackSource: 'Home',
    lastActiveTimestamp: null,
    accumulatedSeconds: 0,
    hasFlushedPlayStart: false,
    isCompleted: false,
  });

  const flushWatchTime = useCallback((markCompleted = false) => {
    const tracker = watchTimeRef.current;
    if (!tracker.song) return;

    let extraElapsed = 0;
    if (tracker.lastActiveTimestamp && isPlaying) {
      const now = Date.now();
      const elapsed = (now - tracker.lastActiveTimestamp) / 1000;
      if (elapsed > 0 && elapsed < 180) {
        extraElapsed = elapsed;
      }
      tracker.lastActiveTimestamp = now;
    }

    const totalToFlush = tracker.accumulatedSeconds + extraElapsed;
    const isNewPlay = !tracker.hasFlushedPlayStart && (totalToFlush > 0.5 || markCompleted);

    if (totalToFlush > 0 || isNewPlay || markCompleted) {
      if (isNewPlay && tracker.song) {
        recordPlaybackStart(tracker.song, {
          playlistId: tracker.playlistId,
          playbackSource: tracker.playbackSource || 'Home',
          currentTime: Math.floor(totalToFlush),
        }, { immediate: true });
        tracker.hasFlushedPlayStart = true;
      }

      if (markCompleted && tracker.song) {
        recordPlaybackComplete(tracker.song, {
          playlistId: tracker.playlistId,
          playbackSource: tracker.playbackSource || 'Home',
          duration: tracker.song.durationSeconds || tracker.song.duration || duration,
        }, { immediate: true });
      }

      flushPlaybackAnalytics({
        song: tracker.song,
        playlistId: tracker.playlistId,
        isNewPlay,
        listenSeconds: totalToFlush,
        isCompleted: markCompleted || tracker.isCompleted,
        playbackSource: tracker.playbackSource || 'Home',
      });

      tracker.accumulatedSeconds = 0;
      if (markCompleted) {
        tracker.isCompleted = true;
      }
    } else {
      tracker.accumulatedSeconds = totalToFlush;
    }
  }, [isPlaying, duration]);

  // Periodic Watch Time Batching (every 20s)
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const interval = setInterval(() => {
      flushWatchTime(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSong, flushWatchTime]);

  // Page visibility & unload handling
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSong && progress > 3) {
        saveSongPlaybackPosition(currentSong.id, progress, duration);
      }
      flushWatchTime(false);
      flushPlaybackEventsBuffer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (currentSong && progress > 3) {
          saveSongPlaybackPosition(currentSong.id, progress, duration);
        }
        flushWatchTime(false);
        flushPlaybackEventsBuffer();
      } else if (isPlaying) {
        watchTimeRef.current.lastActiveTimestamp = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPlaying, currentSong, progress, duration, flushWatchTime]);

  // Compute playable URL
  const getPlayableUrl = (song: Song | null): string => {
    if (!song) return '';

    // Check if offline audio blob is stored locally
    const offlineBlobUrl = getOfflineSongBlobUrl(song.id);
    if (offlineBlobUrl) {
      return offlineBlobUrl;
    }
    
    // Check YouTube ID
    if (song.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(song.youtubeVideoId)) {
      return `https://www.youtube.com/watch?v=${song.youtubeVideoId}`;
    }

    // Check youtubeUrl
    if (song.youtubeUrl) {
      const vid = extractYoutubeVideoId(song.youtubeUrl);
      if (vid) return `https://www.youtube.com/watch?v=${vid}`;
      return song.youtubeUrl;
    }

    // Check audioUrl
    if (song.audioUrl) {
      const vid = extractYoutubeVideoId(song.audioUrl);
      if (vid) return `https://www.youtube.com/watch?v=${vid}`;
      return song.audioUrl;
    }

    return '';
  };

  const currentSourceType: TrackSourceType = getTrackSourceType(currentSong);

  const playableUrl = isVoiceAdPlaying && activeVoiceAd?.audioUrl 
    ? activeVoiceAd.audioUrl 
    : getPlayableUrl(currentSong);

  // Safe diagnostic recording helper
  const recordDiagnostic = useCallback((errorCode?: string | number, errorMessage?: string) => {
    if (!currentSong) return;
    let urlHost = 'local';
    try {
      if (playableUrl.startsWith('http')) {
        urlHost = new URL(playableUrl).hostname;
      } else if (playableUrl.startsWith('/')) {
        urlHost = 'app-origin';
      }
    } catch {}

    const diag: PlaybackDiagnosticInfo = {
      diagnosticId: `diag-${Date.now().toString(36)}`,
      trackId: currentSong.id,
      trackTitle: currentSong.title,
      sourceType: currentSourceType,
      urlHost,
      playbackTime: Math.floor(progress),
      duration: Math.floor(duration),
      playbackState,
      networkOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      errorCode,
      errorMessage,
      timestamp: new Date().toISOString(),
    };
    setDiagnosticInfo(diag);
    console.warn(`[Audio Diagnostic ${diag.diagnosticId}]`, {
      trackId: diag.trackId,
      source: diag.sourceType,
      host: diag.urlHost,
      time: `${diag.playbackTime}s / ${diag.duration}s`,
      error: errorMessage || errorCode,
    });
  }, [currentSong, playableUrl, currentSourceType, progress, duration, playbackState]);

  // Synchronize native audio element with state changes
  useEffect(() => {
    if (currentSourceType === 'direct') {
      const audio = audioRef.current;
      if (!audio) return;

      if (playableUrl && audio.src !== playableUrl && !audio.src.endsWith(playableUrl)) {
        audio.src = playableUrl;
        audio.playbackRate = playbackRate;
        audio.volume = effectiveVolume;
        if (isPlaying) {
          audio.play().catch((err) => {
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.warn('[Direct Audio Play Error]:', err);
            }
          });
        }
      }
    }
  }, [playableUrl, currentSourceType, isPlaying, playbackRate, effectiveVolume]);

  // Check and apply resume position
  const checkAndApplyResume = useCallback(() => {
    if (resumeTimeRef.current !== null && resumeTimeRef.current > 0) {
      const rt = resumeTimeRef.current;
      resumeTimeRef.current = null;
      seek(rt);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (watchTimeRef.current.lastActiveTimestamp && isPlaying) {
      const elapsed = (Date.now() - watchTimeRef.current.lastActiveTimestamp) / 1000;
      if (elapsed > 0 && elapsed < 120) {
        watchTimeRef.current.accumulatedSeconds += elapsed;
      }
      watchTimeRef.current.lastActiveTimestamp = Date.now();
    }

    const safeTime = Math.max(0, Math.min(time, duration || 9999));
    setProgress(safeTime);

    if (currentSourceType === 'direct' && audioRef.current) {
      try {
        audioRef.current.currentTime = safeTime;
      } catch (err) {
        console.warn('[Direct Audio Seek Error]:', err);
      }
    } else if (currentSourceType === 'youtube' && youtubePlayerRef.current) {
      try {
        if (typeof youtubePlayerRef.current.seekTo === 'function') {
          youtubePlayerRef.current.seekTo(safeTime, 'seconds');
        } else if ('currentTime' in youtubePlayerRef.current) {
          youtubePlayerRef.current.currentTime = safeTime;
        }
      } catch (e) {
        console.warn('[YouTube Seek Error]:', e);
      }
    }
  }, [currentSourceType, duration, isPlaying]);

  // Throttled position saving
  const handleThrottledPositionSave = useCallback((currentTime: number) => {
    if (!currentSong || currentTime <= 3 || (duration - currentTime <= 4)) return;
    const now = Date.now();
    if (now - lastPositionSaveTimeRef.current > 5000) {
      lastPositionSaveTimeRef.current = now;
      saveSongPlaybackPosition(currentSong.id, currentTime, duration);
      try {
        localStorage.setItem('sbg_continue_listening', JSON.stringify({
          song: currentSong,
          progress: currentTime,
          duration: duration,
          timestamp: now,
        }));
        window.dispatchEvent(new Event('continue_listening_updated'));
      } catch {}
    }
  }, [currentSong, duration]);

  // ================= Direct Audio Engine Callbacks =================
  const handleNativeLoadStart = () => {
    setIsLoading(true);
    setPlaybackState('loading');
    setPlaybackError(null);
  };

  const handleNativeLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
    setIsLoading(false);
    checkAndApplyResume();
  };

  const handleNativeCanPlay = () => {
    setIsLoading(false);
    setIsBuffering(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    if (isPlaying && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
    checkAndApplyResume();
  };

  const handleNativePlaying = () => {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('playing');
    watchTimeRef.current.lastActiveTimestamp = Date.now();
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    checkAndApplyResume();

    if (currentSong) {
      autoCacheActiveTrack(currentSong);
      try {
        const stored = localStorage.getItem('sbg_recently_played');
        let recent = stored ? JSON.parse(stored) : [];
        recent = recent.filter((s: Song) => s.id !== currentSong.id);
        recent = [currentSong, ...recent].slice(0, 20);
        localStorage.setItem('sbg_recently_played', JSON.stringify(recent));
        window.dispatchEvent(new Event('recently_played_updated'));
      } catch {}
    }
  };

  const handleNativeWaiting = () => {
    setIsBuffering(true);
    setPlaybackState('buffering');
    if (watchTimeRef.current.lastActiveTimestamp) {
      const elapsed = (Date.now() - watchTimeRef.current.lastActiveTimestamp) / 1000;
      if (elapsed > 0 && elapsed < 120) {
        watchTimeRef.current.accumulatedSeconds += elapsed;
      }
      watchTimeRef.current.lastActiveTimestamp = null;
    }
  };

  const handleNativeStalled = () => {
    setIsBuffering(true);
    setPlaybackState('buffering');

    // Bounded retry policy: wait 3.5s for natural browser buffer recovery
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(() => {
      const audio = audioRef.current;
      if (audio && isPlaying && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        const currentPos = audio.currentTime || 0;
        console.log(`[Audio Engine] Bounded recovery attempt ${retryCountRef.current}/3 at position ${currentPos.toFixed(1)}s`);
        audio.load();
        audio.currentTime = currentPos;
        audio.play().catch(() => {});
      } else if (retryCountRef.current >= 3) {
        setPlaybackState('error');
        setPlaybackError('Network connection is unstable. Tap play to retry.');
        recordDiagnostic('STALLED_MAX_RETRIES', 'Stream stalled and exceeded retry threshold.');
      }
    }, 3500);
  };

  const handleNativeTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (typeof audio.currentTime === 'number') {
      setProgress(audio.currentTime);
      handleThrottledPositionSave(audio.currentTime);
    }
  };

  const handleNativeDurationChange = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
  };

  const handleNativePause = () => {
    setIsBuffering(false);
    flushWatchTime(false);
    watchTimeRef.current.lastActiveTimestamp = null;
    setPlaybackState('paused');

    if (currentSong) {
      recordPlaybackPause(currentSong, {
        playlistId: activePlaylistId,
        currentTime: progress,
      });
      if (progress > 3 && (duration - progress > 4)) {
        saveSongPlaybackPosition(currentSong.id, progress, duration);
        try {
          localStorage.setItem('sbg_continue_listening', JSON.stringify({
            song: currentSong,
            progress,
            duration,
            timestamp: Date.now(),
          }));
          window.dispatchEvent(new Event('continue_listening_updated'));
        } catch {}
      }
    }
  };

  const handleNativeError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    const mediaErr = audio.error;
    let errCode: string | number = mediaErr?.code || 'UNKNOWN';
    let userMsg = 'Unable to play this track. Please check connection and try again.';

    if (mediaErr?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      userMsg = 'This audio source is unavailable or unsupported on this device.';
    } else if (mediaErr?.code === MediaError.MEDIA_ERR_NETWORK) {
      userMsg = 'Network error while streaming audio. Reconnecting…';
    } else if (mediaErr?.code === MediaError.MEDIA_ERR_DECODE) {
      userMsg = 'Audio decoding error on this device.';
    }

    recordDiagnostic(errCode, userMsg);
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('error');
    setPlaybackError(userMsg);
  };

  // ================= YouTube Player Engine Callbacks =================
  const handleYoutubeReady = () => {
    setIsLoading(false);
    setIsBuffering(false);
    checkAndApplyResume();
  };

  const handleYoutubeStart = () => {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('playing');
    watchTimeRef.current.lastActiveTimestamp = Date.now();
    checkAndApplyResume();
  };

  const handleYoutubePlay = () => {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('playing');
    watchTimeRef.current.lastActiveTimestamp = Date.now();
    checkAndApplyResume();
  };

  const handleYoutubePlaying = () => {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('playing');
    watchTimeRef.current.lastActiveTimestamp = Date.now();
    checkAndApplyResume();
  };

  const handleYoutubePause = () => {
    setIsBuffering(false);
    flushWatchTime(false);
    watchTimeRef.current.lastActiveTimestamp = null;
    setPlaybackState('paused');

    if (currentSong) {
      recordPlaybackPause(currentSong, {
        playlistId: activePlaylistId,
        currentTime: progress,
      });
      if (progress > 3 && (duration - progress > 4)) {
        saveSongPlaybackPosition(currentSong.id, progress, duration);
      }
    }
  };

  const handleYoutubeWaiting = () => {
    setIsBuffering(true);
    setPlaybackState('buffering');
  };

  const handleYoutubeProgress = (state: any) => {
    if (state && typeof state.playedSeconds === 'number' && !isNaN(state.playedSeconds)) {
      setProgress(state.playedSeconds);
      handleThrottledPositionSave(state.playedSeconds);
    }
  };

  const handleYoutubeDuration = (d: any) => {
    if (typeof d === 'number' && !isNaN(d) && d > 0) {
      setDuration(d);
    } else if (d && typeof d.duration === 'number' && !isNaN(d.duration) && d.duration > 0) {
      setDuration(d.duration);
    }
  };

  const handleYoutubeError = (error: any) => {
    if (error?.name === 'AbortError' || error?.message?.includes('interrupted by a call to pause')) {
      return;
    }
    recordDiagnostic('YOUTUBE_PLAYER_ERROR', error?.message || 'YouTube player error');
    setIsLoading(false);
    setIsBuffering(false);
    setPlaybackState('error');
    setPlaybackError('Playback issue: video may be age-restricted or embed-disabled on YouTube.');
  };

  // Shared Track Ended Handler
  const handleEnded = async () => {
    if (currentSong) {
      clearSongPlaybackPosition(currentSong.id);
    }
    try {
      localStorage.removeItem('sbg_continue_listening');
      window.dispatchEvent(new Event('continue_listening_updated'));
    } catch {}

    if (isVoiceAdPlaying && activeVoiceAd) {
      await recordVoiceAdCompletion(activeVoiceAd.id);
      setIsVoiceAdPlaying(false);
      setActiveVoiceAd(null);
      if (queue.length > 0 && currentIndex < queue.length - 1) {
        playNext();
      } else {
        setIsPlaying(false);
        setPlaybackState('ended');
        setProgress(0);
      }
      return;
    }

    flushWatchTime(true);

    if (currentSong) {
      songsPlayedSinceLastAdRef.current += 1;
    }

    try {
      const settings = await fetchAdSettings();
      if (settings.enabled && songsPlayedSinceLastAdRef.current >= (settings.showAfterSongs || 2)) {
        songsPlayedSinceLastAdRef.current = 0;

        if (settings.adType === 'voice' || settings.adType === 'both') {
          const voiceAds = await fetchActiveCampaigns(undefined, 'voice');
          if (voiceAds.length > 0) {
            const chosen = voiceAds[Math.floor(Math.random() * voiceAds.length)];
            if (chosen.audioUrl) {
              setActiveVoiceAd(chosen);
              setIsVoiceAdPlaying(true);
              await recordVoiceAdPlay(chosen.id);
              setIsPlaying(true);
              setPlaybackState('playing');
              return;
            }
          }
        }

        if (settings.adType === 'banner' || settings.adType === 'both') {
          const bannerAds = await fetchActiveCampaigns(undefined, 'banner');
          if (bannerAds.length > 0) {
            const chosen = bannerAds[Math.floor(Math.random() * bannerAds.length)];
            setActiveBannerAd(chosen);
            await recordAdImpression(chosen.id);
          }
        }
      }
    } catch (e) {
      console.warn('Ad check error:', e);
    }

    if (repeatMode === 'one' && currentSong) {
      seek(0);
      setIsPlaying(true);
      setPlaybackState('playing');
      if (currentSourceType === 'direct' && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    if (queue.length > 0 && (repeatMode === 'all' || currentIndex < queue.length - 1)) {
      playNext();
    } else {
      setIsPlaying(false);
      setPlaybackState('ended');
      setProgress(0);
      watchTimeRef.current.lastActiveTimestamp = null;
    }
  };

  // Play Song authoritative transition
  const playSong = (song: Song, newQueue?: Song[], playlistId?: string, resumeTime?: number, explicitSource?: string) => {
    if (currentSong && currentSong.id !== song.id && progress > 3 && (duration - progress > 4)) {
      saveSongPlaybackPosition(currentSong.id, progress, duration);
    }

    if (typeof resumeTime === 'number' && resumeTime > 0) {
      resumeTimeRef.current = resumeTime;
    } else {
      resumeTimeRef.current = null;
    }
    setPlaybackError(null);
    setDiagnosticInfo(null);
    setIsPlayerDismissed(false);

    if (watchTimeRef.current.song && watchTimeRef.current.song.id !== song.id) {
      flushWatchTime(false);
    }

    if (playlistId) {
      setActivePlaylistId(playlistId);
    }

    const nextSourceType = getTrackSourceType(song);
    const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    let detectedSource = explicitSource || 'Home';

    if (!explicitSource) {
      if (playlistId || currentPath.includes('/playlist')) detectedSource = 'Playlist';
      else if (currentPath.includes('/search')) detectedSource = 'Search';
      else if (currentPath.includes('/favorites')) detectedSource = 'Favorites';
      else if (currentPath.includes('/library')) detectedSource = 'Library';
      else if (currentPath.includes('/song/')) detectedSource = 'Song Page';
      else if (nextSourceType === 'youtube') detectedSource = 'YouTube';
    }

    watchTimeRef.current = {
      song,
      playlistId: playlistId || activePlaylistId,
      playbackSource: detectedSource,
      lastActiveTimestamp: Date.now(),
      accumulatedSeconds: 0,
      hasFlushedPlayStart: false,
      isCompleted: false,
    };

    recordPlaybackStart(song, {
      playlistId: playlistId || activePlaylistId,
      playbackSource: detectedSource,
      currentTime: typeof resumeTime === 'number' && resumeTime > 0 ? resumeTime : 0,
    }, { immediate: true }).catch(() => {});
    watchTimeRef.current.hasFlushedPlayStart = true;

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((s) => s.id === song.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else if (queue.length === 0 || !queue.some((s) => s.id === song.id)) {
      setQueue([song]);
      setCurrentIndex(0);
    } else {
      const idx = queue.findIndex((s) => s.id === song.id);
      if (idx >= 0) setCurrentIndex(idx);
    }

    // If same song tapped again: toggle play/pause
    if (currentSong?.id === song.id) {
      if (typeof resumeTime === 'number' && resumeTime > 0) {
        seek(resumeTime);
      }
      togglePlayPause();
      return;
    }

    // If track is a YouTube-only video, open on YouTube with official video, player, and attribution
    if (nextSourceType === 'youtube') {
      const ytUrl = song.youtubeUrl || (song.youtubeVideoId ? `https://www.youtube.com/watch?v=${song.youtubeVideoId}` : '');
      if (ytUrl) {
        window.open(ytUrl, '_blank', 'noopener,noreferrer');
        setShareToast(`Opening "${song.title}" on YouTube...`);
        setTimeout(() => setShareToast(null), 3000);
      }
      return;
    }

    setIsLoading(true);
    setPlaybackState('loading');
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setDuration(song.durationSeconds || song.duration || 0);

    // If next is direct audio, prepare audio element immediately
    if (nextSourceType === 'direct') {
      const url = getPlayableUrl(song);
      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = effectiveVolume;
        audioRef.current.play().catch((err) => {
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
            console.warn('[Direct Audio Play Error]:', err);
          }
        });
      }
    }
  };

  const resumeSong = (song: Song, newQueue?: Song[], playlistId?: string) => {
    const saved = getSongSavedPosition(song.id);
    const resumeTime = saved && saved.position > 3 ? saved.position : 0;
    playSong(song, newQueue, playlistId, resumeTime);
  };

  const getSavedPosition = (songId: string) => {
    return getSongSavedPosition(songId);
  };

  const clearSavedPosition = (songId: string) => {
    clearSongPlaybackPosition(songId);
  };

  const playPlaylist = (songs: Song[], startIndex = 0, playlistId?: string) => {
    if (!songs || songs.length === 0) return;
    setPlaybackError(null);
    setDiagnosticInfo(null);
    setIsLoading(true);
    setPlaybackState('loading');

    if (playlistId) {
      setActivePlaylistId(playlistId);
    }

    const safeIndex = Math.min(Math.max(0, startIndex), songs.length - 1);
    const firstSong = songs[safeIndex];

    if (watchTimeRef.current.song) {
      flushWatchTime(false);
    }

    watchTimeRef.current = {
      song: firstSong,
      playlistId,
      lastActiveTimestamp: Date.now(),
      accumulatedSeconds: 0,
      hasFlushedPlayStart: false,
      isCompleted: false,
    };

    setOriginalQueue(songs);

    if (isShuffle) {
      const remaining = songs.filter((_, i) => i !== safeIndex);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      setQueue([firstSong, ...remaining]);
      setCurrentIndex(0);
    } else {
      setQueue(songs);
      setCurrentIndex(safeIndex);
    }

    const nextSource = getTrackSourceType(firstSong);
    if (currentSourceType === 'direct' && nextSource === 'youtube' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    setCurrentSong(firstSong);
    setIsPlaying(true);
    setPlaybackState('loading');
    setProgress(0);
    setDuration(firstSong.durationSeconds || firstSong.duration || 0);

    if (nextSource === 'direct') {
      const url = getPlayableUrl(firstSong);
      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = effectiveVolume;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const playNext = () => {
    if (queue.length === 0 || currentIndex === -1) return;
    setPlaybackError(null);
    setDiagnosticInfo(null);
    setIsLoading(true);
    setPlaybackState('loading');

    flushWatchTime(false);

    const nextIdx = (currentIndex + 1) % queue.length;
    const nextSong = queue[nextIdx];

    watchTimeRef.current = {
      song: nextSong,
      playlistId: activePlaylistId,
      lastActiveTimestamp: Date.now(),
      accumulatedSeconds: 0,
      hasFlushedPlayStart: false,
      isCompleted: false,
    };

    const nextSource = getTrackSourceType(nextSong);
    if (currentSourceType === 'direct' && nextSource === 'youtube' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    setCurrentIndex(nextIdx);
    setCurrentSong(nextSong);
    setIsPlaying(true);
    setProgress(0);
    setDuration(nextSong.durationSeconds || nextSong.duration || 0);

    if (nextSource === 'direct') {
      const url = getPlayableUrl(nextSong);
      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = effectiveVolume;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const playPrevious = () => {
    if (queue.length === 0 || currentIndex === -1) return;
    setPlaybackError(null);
    setDiagnosticInfo(null);
    setIsLoading(true);
    setPlaybackState('loading');

    flushWatchTime(false);

    const prevIdx = (currentIndex - 1 + queue.length) % queue.length;
    const prevSong = queue[prevIdx];

    watchTimeRef.current = {
      song: prevSong,
      playlistId: activePlaylistId,
      lastActiveTimestamp: Date.now(),
      accumulatedSeconds: 0,
      hasFlushedPlayStart: false,
      isCompleted: false,
    };

    const nextSource = getTrackSourceType(prevSong);
    if (currentSourceType === 'direct' && nextSource === 'youtube' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    setCurrentIndex(prevIdx);
    setCurrentSong(prevSong);
    setIsPlaying(true);
    setProgress(0);
    setDuration(prevSong.durationSeconds || prevSong.duration || 0);

    if (nextSource === 'direct') {
      const url = getPlayableUrl(prevSong);
      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = effectiveVolume;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const togglePlayPause = () => {
    if (!currentSong) return;

    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      setPlaybackState('paused');
      flushWatchTime(false);
      watchTimeRef.current.lastActiveTimestamp = null;
      if (currentSourceType === 'direct' && audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      // Play
      setIsPlaying(true);
      setPlaybackState('playing');
      watchTimeRef.current.lastActiveTimestamp = Date.now();
      if (currentSourceType === 'direct' && audioRef.current) {
        audioRef.current.play().catch((err) => {
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
            console.warn('[Direct Audio Play Toggle Error]:', err);
          }
        });
      }
    }
  };

  const retryPlayback = () => {
    if (!currentSong) return;
    setPlaybackError(null);
    setDiagnosticInfo(null);
    setIsLoading(true);
    setPlaybackState('loading');
    retryCountRef.current = 0;

    if (currentSourceType === 'direct' && audioRef.current) {
      const cur = progress;
      audioRef.current.load();
      audioRef.current.currentTime = cur;
      audioRef.current.play().catch(() => {});
    } else {
      setIsPlaying(false);
      setTimeout(() => {
        setIsPlaying(true);
      }, 100);
    }
  };

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    try {
      localStorage.setItem('sbg_player_volume', clamped.toString());
    } catch {}
  }, []);

  const clearError = () => {
    setPlaybackError(null);
    setDiagnosticInfo(null);
  };

  const addToQueue = (song: Song) => {
    setQueue(prev => {
      const existingIdx = prev.findIndex((s, i) => i > currentIndex && s.id === song.id);
      if (existingIdx !== -1) return prev;
      return [...prev, song];
    });
  };

  const playNextInQueue = (song: Song) => {
    setQueue(prev => {
      if (prev.length === 0 || currentIndex === -1) {
        return [song];
      }
      const newQueue = [...prev];
      const existingIdx = newQueue.findIndex((s, i) => i > currentIndex && s.id === song.id);
      if (existingIdx !== -1) {
        newQueue.splice(existingIdx, 1);
      }
      newQueue.splice(currentIndex + 1, 0, song);
      return newQueue;
    });
  };

  const toggleShuffle = () => {
    setIsShuffle(prev => {
      const next = !prev;
      localStorage.setItem('sbg_player_shuffle', JSON.stringify(next));
      
      if (next) {
        setOriginalQueue(queue);
        shuffleQueue();
      } else {
        if (originalQueue.length > 0 && currentSong) {
          const origIdx = originalQueue.findIndex(s => s.id === currentSong.id);
          if (origIdx !== -1) {
            setQueue([...originalQueue]);
            setCurrentIndex(origIdx);
          }
        }
      }
      return next;
    });
  };

  const shuffleQueue = () => {
    setQueue(prev => {
      if (prev.length <= 1) return prev;
      const current = currentIndex >= 0 && currentIndex < prev.length ? prev[currentIndex] : null;
      const remaining = prev.filter((_, i) => i !== currentIndex);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      return current ? [current, ...remaining] : remaining;
    });
    if (currentIndex >= 0) {
      setCurrentIndex(0);
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 1);
      return newQueue;
    });
    if (currentIndex === index) {
      if (queue.length > 1) {
        if (index < queue.length - 1) playNext();
        else playPrevious();
      } else {
        setCurrentSong(null);
        setCurrentIndex(-1);
        setIsPlaying(false);
        setPlaybackState('idle');
      }
    } else if (currentIndex > index) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const clearQueue = () => {
    if (currentSong) {
      setQueue([currentSong]);
      setCurrentIndex(0);
    } else {
      setQueue([]);
      setCurrentIndex(-1);
    }
  };

  const moveQueueItemUp = (index: number) => {
    if (index <= currentIndex + 1 || index >= queue.length) return;
    setQueue(prev => {
      const newQueue = [...prev];
      const temp = newQueue[index];
      newQueue[index] = newQueue[index - 1];
      newQueue[index - 1] = temp;
      return newQueue;
    });
  };

  const moveQueueItemDown = (index: number) => {
    if (index <= currentIndex || index >= queue.length - 1) return;
    setQueue(prev => {
      const newQueue = [...prev];
      const temp = newQueue[index];
      newQueue[index] = newQueue[index + 1];
      newQueue[index + 1] = temp;
      return newQueue;
    });
  };

  const dismissBannerAd = () => {
    setActiveBannerAd(null);
  };

  const clickAd = async (campaignId: string, url: string) => {
    await recordAdClick(campaignId);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Deep-link initial load effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const songIdParam = params.get('songId') || params.get('song');
    if (songIdParam) {
      getDoc(doc(db, 'songs', songIdParam)).then(snapshot => {
        if (snapshot.exists()) {
          const song = { id: snapshot.id, ...snapshot.data() } as Song;
          playSong(song);
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }).catch(err => {
        console.warn('Failed to load deep-linked song:', err);
      });
    }
  }, []);

  // MediaSession API Integration for mobile notification controls & lock screen
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentSong) {
      return;
    }

    const artworkUrl = currentSong.imageUrl || currentSong.customCoverUrl || currentSong.coverUrl || currentSong.thumbnailUrl || '/images/sbg_music_logo.png';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || 'Unknown Title',
        artist: currentSong.artist || 'SBG Music',
        album: currentSong.album || 'SBG Music Catalog',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          seek(details.seekTime);
        }
      });
    } catch {}
  }, [currentSong?.id, currentSong?.title, currentSong?.artist, isPlaying, togglePlayPause, playPrevious, playNext, seek]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        queue,
        currentIndex,
        isPlaying,
        isLoading,
        isBuffering,
        playbackState,
        sourceType: currentSourceType,
        progress,
        duration,
        volume,
        playbackRate,
        isMiniPlayer,
        isPlayerDismissed,
        playbackError,
        diagnosticInfo,
        activePlaylistId,
        activeBannerAd,
        activeVoiceAd,
        isVoiceAdPlaying,
        isYoutubeDockVisible,
        isYoutubeDockMinimized,
        toggleYoutubeDock,
        toggleYoutubeDockMinimized,
        retryPlayback,
        playSong,
        resumeSong,
        getSavedPosition,
        clearSavedPosition,
        playPlaylist,
        playNext,
        playPrevious,
        togglePlayPause,
        setVolume,
        setPlaybackRate,
        setIsMiniPlayer,
        toggleMiniPlayer,
        dismissPlayer,
        restorePlayer,
        seek,
        clearError,
        dismissBannerAd,
        clickAd,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        moveQueueItemUp,
        moveQueueItemDown,
        shuffleQueue,
        isShuffle,
        toggleShuffle,
        sleepTimerMinutes,
        sleepTimerRemaining,
        setSleepTimer,
        crossfadeEnabled,
        toggleCrossfade,
        volumeNormalizationEnabled,
        toggleVolumeNormalization,
        isLyricsOpen,
        toggleLyrics,
        setIsLyricsOpen,
        lyrics,
        syncedLyrics,
        isLyricsLoading,
        lyricsError,
        refetchLyrics,
        shareCurrentSong,
        shareToast,
        repeatMode,
        toggleRepeatMode,
        audioMode,
        setAudioMode,
      }}
    >
      {children}

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          {shareToast}
        </div>
      )}

      {/* 
        Native HTMLAudioElement for Direct Tracks (WAV, MP3, AAC, Offline Blobs)
        Provides 0ms latency, range request byte streaming, and reliable background playback
      */}
      <audio
        ref={audioRef}
        preload="auto"
        onLoadStart={handleNativeLoadStart}
        onLoadedMetadata={handleNativeLoadedMetadata}
        onCanPlay={handleNativeCanPlay}
        onPlaying={handleNativePlaying}
        onWaiting={handleNativeWaiting}
        onStalled={handleNativeStalled}
        onTimeUpdate={handleNativeTimeUpdate}
        onDurationChange={handleNativeDurationChange}
        onPause={handleNativePause}
        onEnded={handleEnded}
        onError={handleNativeError}
        style={{ display: 'none' }}
      />

    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
