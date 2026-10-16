import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { 
  Mic2, 
  Sparkles, 
  Copy, 
  Check, 
  RotateCw, 
  Play, 
  Pause, 
  Clock, 
  Disc, 
  Music, 
  Sliders, 
  Radio, 
  Eye, 
  EyeOff, 
  Maximize2, 
  AlertCircle,
  Volume2
} from 'lucide-react';
import { parseLrcLyrics, findActiveLyricIndex, hasLrcTimestamps, ParsedLyricLine } from '../utils/lyricsParser';

interface SongLyricsTabProps {
  song: Song;
  relatedSongs?: Song[];
}

export default function SongLyricsTab({ song, relatedSongs = [] }: SongLyricsTabProps) {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    playSong,
    togglePlayPause,
    seek,
    toggleLyrics,
    isLyricsOpen,
    lyrics: playerLyrics,
    syncedLyrics: playerSyncedLyrics
  } = usePlayer();

  const isThisSongPlaying = currentSong?.id === song.id;

  // Local lyrics state for this specific song
  const [lyricsText, setLyricsText] = useState<string | null>(song.lyrics || null);
  const [syncedLyricsText, setSyncedLyricsText] = useState<string | null>(song.syncedLyrics || null);
  const [isLoading, setIsLoading] = useState<boolean>(!song.lyrics && !song.syncedLyrics);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // User preferences & toggle states
  const [lyricsEnabled, setLyricsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sbg_songdetail_lyrics_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [liveSyncEnabled, setLiveSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sbg_songdetail_lyrics_sync');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [viewMode, setViewMode] = useState<'synced' | 'plain'>(() => {
    try {
      const saved = localStorage.getItem('sbg_songdetail_lyrics_mode');
      return (saved as 'synced' | 'plain') || 'synced';
    } catch {
      return 'synced';
    }
  });

  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    try {
      return (localStorage.getItem('sbg_lyrics_font_size') as 'sm' | 'base' | 'lg') || 'base';
    } catch {
      return 'base';
    }
  });

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Fetch lyrics for this song
  const fetchLyrics = useCallback(async () => {
    // If song already contains direct embedded lyrics
    if (song.lyrics || song.syncedLyrics) {
      setLyricsText(song.lyrics || null);
      setSyncedLyricsText(song.syncedLyrics || null);
      setError(null);
      setIsLoading(false);
      setSource('verified-database');
      return;
    }

    // If this song is playing and player context already has fetched lyrics
    if (isThisSongPlaying && (playerLyrics || playerSyncedLyrics)) {
      setLyricsText(playerLyrics);
      setSyncedLyricsText(playerSyncedLyrics);
      setError(null);
      setIsLoading(false);
      setSource('live-session');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const titleParam = encodeURIComponent(song.title || '');
      const artistParam = encodeURIComponent(song.artist || '');
      const res = await fetch(`/api/lyrics?title=${titleParam}&artist=${artistParam}`);
      const data = await res.json();

      if (data.ok) {
        setLyricsText(data.plainLyrics || data.syncedLyrics || null);
        setSyncedLyricsText(data.syncedLyrics || null);
        setSource(data.source || 'lrclib');
        setError(null);
      } else {
        setLyricsText(null);
        setSyncedLyricsText(null);
        setError(data.error || 'Lyrics not found for this track.');
      }
    } catch (err: any) {
      console.warn('Failed to load lyrics for song:', err);
      setLyricsText(null);
      setSyncedLyricsText(null);
      setError('Unable to load lyrics. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [song.id, song.title, song.artist, song.lyrics, song.syncedLyrics, isThisSongPlaying, playerLyrics, playerSyncedLyrics]);

  useEffect(() => {
    fetchLyrics();
  }, [fetchLyrics]);

  // Persist toggles
  const toggleLyricsEnabled = () => {
    setLyricsEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_songdetail_lyrics_enabled', String(next));
      } catch {}
      return next;
    });
  };

  const toggleLiveSync = () => {
    setLiveSyncEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sbg_songdetail_lyrics_sync', String(next));
      } catch {}
      return next;
    });
  };

  const handleSetViewMode = (mode: 'synced' | 'plain') => {
    setViewMode(mode);
    try {
      localStorage.setItem('sbg_songdetail_lyrics_mode', mode);
    } catch {}
  };

  const cycleFontSize = () => {
    const nextSize = fontSize === 'sm' ? 'base' : fontSize === 'base' ? 'lg' : 'sm';
    setFontSize(nextSize);
    try {
      localStorage.setItem('sbg_lyrics_font_size', nextSize);
    } catch {}
  };

  // Extract raw timestamped lyrics if available from syncedLyricsText or fallback to song.lyrics
  const rawSyncedText = useMemo(() => {
    if (syncedLyricsText && hasLrcTimestamps(syncedLyricsText)) {
      return syncedLyricsText;
    }
    if (song.syncedLyrics && hasLrcTimestamps(song.syncedLyrics)) {
      return song.syncedLyrics;
    }
    if (lyricsText && hasLrcTimestamps(lyricsText)) {
      return lyricsText;
    }
    if (song.lyrics && hasLrcTimestamps(song.lyrics)) {
      return song.lyrics;
    }
    return null;
  }, [syncedLyricsText, song.syncedLyrics, lyricsText, song.lyrics]);

  // Parse chronological lines with timestamps
  const parsedSyncedLines: ParsedLyricLine[] = useMemo(() => {
    if (!rawSyncedText) return [];
    return parseLrcLyrics(rawSyncedText);
  }, [rawSyncedText]);

  // Determine active lyric line index during playback
  const activeLineIndex = useMemo(() => {
    if (!isThisSongPlaying || !liveSyncEnabled || parsedSyncedLines.length === 0) {
      return -1;
    }
    return findActiveLyricIndex(parsedSyncedLines, progress, 0.2);
  }, [parsedSyncedLines, progress, isThisSongPlaying, liveSyncEnabled]);

  const lastScrolledIndexRef = useRef<number>(-1);

  // Auto-scroll to active line inside container
  useEffect(() => {
    if (
      !autoScroll || 
      !liveSyncEnabled || 
      !isThisSongPlaying || 
      isUserScrollingRef.current || 
      activeLineIndex < 0
    ) {
      return;
    }

    if (lastScrolledIndexRef.current === activeLineIndex) {
      return;
    }
    lastScrolledIndexRef.current = activeLineIndex;

    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;
    if (!container || !activeEl) return;

    const relativeTop = activeEl.offsetTop - container.offsetTop;
    const targetScrollTop = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });
  }, [activeLineIndex, autoScroll, liveSyncEnabled, isThisSongPlaying]);

  const handleUserScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      lastScrolledIndexRef.current = -1;
    }, 2800);
  };

  const handleCopy = async () => {
    const textToCopy = lyricsText || (parsedSyncedLines.length > 0 ? parsedSyncedLines.map(l => l.text).join('\n') : '');
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.warn('Failed to copy lyrics:', err);
    }
  };

  const handleLineClick = (time: number) => {
    if (!isThisSongPlaying) {
      playSong(song, [song, ...relatedSongs], undefined, time);
    } else {
      seek(time);
      if (!isPlaying) {
        togglePlayPause();
      }
    }
  };

  // Helper format time [mm:ss]
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const hasSyncedLyrics = parsedSyncedLines.length > 0;
  const isCurrentlyShowingSynced = viewMode === 'synced' && hasSyncedLyrics;

  const fontClass = {
    sm: 'text-sm md:text-base leading-relaxed',
    base: 'text-base md:text-xl leading-relaxed md:leading-loose',
    lg: 'text-lg md:text-2xl leading-loose',
  }[fontSize];

  return (
    <div id="song-lyrics-tab" className="flex flex-col gap-6">
      {/* Control Header & Toolbar */}
      <div className="bg-[#111116] border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Lyrics Visibility Toggle */}
          <button
            id="btn-toggle-lyrics-visibility"
            onClick={toggleLyricsEnabled}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
              lyricsEnabled
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10'
            }`}
            title={lyricsEnabled ? 'Hide lyrics display' : 'Show lyrics display'}
          >
            {lyricsEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>Lyrics: {lyricsEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Live Playback Synchronization Toggle */}
          {hasSyncedLyrics && lyricsEnabled && (
            <button
              id="btn-toggle-live-sync"
              onClick={toggleLiveSync}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                liveSyncEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10'
              }`}
              title={liveSyncEnabled ? 'Disable live playback tracking' : 'Enable live playback tracking'}
            >
              <Radio size={14} className={liveSyncEnabled && isThisSongPlaying && isPlaying ? 'animate-pulse text-emerald-400' : ''} />
              <span>Live Sync: {liveSyncEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Synced vs Plain Text Mode Switcher */}
          {hasSyncedLyrics && lyricsEnabled && (
            <div className="bg-black/30 p-1 rounded-xl border border-white/5 flex items-center gap-1">
              <button
                onClick={() => handleSetViewMode('synced')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'synced'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                Karaoke (Synced)
              </button>
              <button
                onClick={() => handleSetViewMode('plain')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'plain'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                Plain Text
              </button>
            </div>
          )}
        </div>

        {/* Right Tools (Font Size, Copy, Popout, Refresh) */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {lyricsEnabled && !isLoading && !error && (
            <>
              {/* Font Size */}
              <button
                onClick={cycleFontSize}
                title={`Change font size (Current: ${fontSize.toUpperCase()})`}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-mono font-bold transition-all"
              >
                A{fontSize === 'sm' ? '-' : fontSize === 'lg' ? '+' : ''}
              </button>

              {/* Copy lyrics */}
              <button
                onClick={handleCopy}
                title="Copy Lyrics to Clipboard"
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Pop out to global drawer */}
              <button
                onClick={toggleLyrics}
                title={isLyricsOpen ? 'Close Floating Lyrics Drawer' : 'Open Floating Lyrics Drawer'}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Maximize2 size={14} className="text-purple-400" />
                <span className="hidden sm:inline">Drawer</span>
              </button>
            </>
          )}

          {/* Refresh / Retry */}
          <button
            onClick={fetchLyrics}
            disabled={isLoading}
            title="Reload lyrics"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all disabled:opacity-50"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
          </button>
        </div>
      </div>

      {/* Live Playback Indicator Bar */}
      {isThisSongPlaying && (
        <div className="bg-gradient-to-r from-purple-900/30 via-purple-600/10 to-transparent border border-purple-500/20 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={togglePlayPause}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {isPlaying ? 'Currently Playing' : 'Playback Paused'}
                </span>
              </div>
              <p className="text-xs text-white/60 font-mono mt-0.5">
                {formatTime(progress)} / {formatTime(duration || song.duration || 0)}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-purple-300 font-medium bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20">
            <Sparkles size={14} />
            <span>Click any lyric line to jump directly</span>
          </div>
        </div>
      )}

      {/* Main Lyrics Body Container */}
      {!lyricsEnabled ? (
        <div className="bg-[#111116]/80 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="p-4 rounded-2xl bg-white/5 text-white/40">
            <EyeOff size={32} />
          </div>
          <h3 className="text-lg font-bold text-white">Lyrics Display Toggled Off</h3>
          <p className="text-sm text-white/50 max-w-md">
            Lyrics are currently hidden. Toggle them back on at any time to follow along with the track.
          </p>
          <button
            onClick={toggleLyricsEnabled}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30"
          >
            Turn Lyrics On
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-[#111116] border border-white/5 rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-4 min-h-[360px]">
          <Disc size={36} className="animate-spin text-purple-500" />
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-white">Fetching Track Lyrics...</h3>
            <p className="text-xs text-white/50">Querying lyrics catalogue for "{song.title}" by {song.artist}</p>
          </div>
          <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
            <div className="w-full h-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
          </div>
        </div>
      ) : error ? (
        <div className="bg-[#111116] border border-white/5 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-bold text-white">No Lyrics Available</h3>
          <p className="text-sm text-white/50 max-w-md">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={fetchLyrics}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center gap-2"
            >
              <RotateCw size={14} />
              <span>Retry Fetching</span>
            </button>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${song.title} ${song.artist} lyrics`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 font-semibold text-xs transition-all"
            >
              Search Online ↗
            </a>
          </div>
        </div>
      ) : isCurrentlyShowingSynced ? (
        /* Karaoke Synced Lyrics View */
        <div 
          ref={scrollContainerRef}
          onScroll={handleUserScroll}
          className="relative bg-[#0d0d10] border border-white/10 rounded-3xl p-6 md:p-12 max-h-[600px] overflow-y-auto scroll-smooth shadow-2xl flex flex-col gap-6"
        >
          {parsedSyncedLines.map((line, idx) => {
            const isActive = isThisSongPlaying && liveSyncEnabled && idx === activeLineIndex;
            const isPast = isThisSongPlaying && liveSyncEnabled && activeLineIndex > -1 && idx < activeLineIndex;
            const isFuture = isThisSongPlaying && liveSyncEnabled && activeLineIndex > -1 && idx > activeLineIndex;

            return (
              <div
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => handleLineClick(line.time)}
                className={`group relative cursor-pointer px-4 py-3 rounded-2xl transition-all duration-300 flex items-start gap-4 ${
                  isActive
                    ? 'bg-purple-600/20 border border-purple-500/40 text-white scale-[1.02] shadow-lg shadow-purple-900/20'
                    : isPast
                    ? 'text-white/40 hover:text-white/80 hover:bg-white/5'
                    : isFuture
                    ? 'text-white/70 hover:text-white hover:bg-white/5'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                {/* Timestamp indicator */}
                <span className={`text-[11px] font-mono shrink-0 mt-1 transition-colors px-2 py-0.5 rounded-md ${
                  isActive 
                    ? 'bg-purple-500 text-white font-bold' 
                    : 'text-white/30 group-hover:text-purple-400 bg-white/5'
                }`}>
                  {formatTime(line.time)}
                </span>

                {/* Lyric text */}
                <p className={`flex-1 transition-all ${fontClass} ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                  {line.text || '♪'}
                </p>

                {/* Quick seek icon on hover */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-purple-600/30 text-purple-300 shrink-0 text-xs">
                  <Play size={12} fill="currentColor" />
                </span>
              </div>
            );
          })}

          {source && (
            <div className="pt-6 border-t border-white/5 flex items-center justify-between text-[11px] text-white/30">
              <span>Source: {source}</span>
              <span>Click any line to seek playback</span>
            </div>
          )}
        </div>
      ) : (
        /* Plain Text Lyrics View */
        <div className="bg-[#0d0d10] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
          <div className={`whitespace-pre-line text-white/80 ${fontClass} font-normal tracking-wide`}>
            {lyricsText || (parsedSyncedLines.length > 0 ? parsedSyncedLines.map(l => l.text).join('\n') : 'No lyrics text available.')}
          </div>

          {source && (
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[11px] text-white/30">
              <span>Source: {source}</span>
              <span>SBG MUSIC Lyrics Service</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
