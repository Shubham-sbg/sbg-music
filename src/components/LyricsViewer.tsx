import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  X, 
  Mic2, 
  Copy, 
  Check, 
  RotateCw, 
  Loader2, 
  Type, 
  Sparkles, 
  Music,
  ArrowDownCircle,
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';

import { parseLrcLyrics, findActiveLyricIndex, hasLrcTimestamps, ParsedLyricLine } from '../utils/lyricsParser';

export default function LyricsViewer() {
  const {
    isLyricsOpen,
    toggleLyrics,
    lyrics,
    syncedLyrics,
    isLyricsLoading,
    lyricsError,
    refetchLyrics,
    currentSong,
    progress,
    seek,
  } = usePlayer();

  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    try {
      return (localStorage.getItem('sbg_lyrics_font_size') as 'sm' | 'base' | 'lg') || 'base';
    } catch {
      return 'base';
    }
  });

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isModalView, setIsModalView] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const lastScrolledIndexRef = useRef<number>(-1);

  // Extract raw timestamped lyrics if available from syncedLyrics or fallback to lyrics with LRC timestamps
  const rawSyncedText = useMemo(() => {
    if (syncedLyrics && hasLrcTimestamps(syncedLyrics)) {
      return syncedLyrics;
    }
    if (lyrics && hasLrcTimestamps(lyrics)) {
      return lyrics;
    }
    if (currentSong?.syncedLyrics && hasLrcTimestamps(currentSong.syncedLyrics)) {
      return currentSong.syncedLyrics;
    }
    if (currentSong?.lyrics && hasLrcTimestamps(currentSong.lyrics)) {
      return currentSong.lyrics;
    }
    return null;
  }, [syncedLyrics, lyrics, currentSong]);

  // Parse chronological lines with timestamps
  const parsedSyncedLines: ParsedLyricLine[] = useMemo(() => {
    if (!rawSyncedText) return [];
    return parseLrcLyrics(rawSyncedText);
  }, [rawSyncedText]);

  // Find currently active lyric line index based on actual audio playback position
  const activeLineIndex = useMemo(() => {
    if (parsedSyncedLines.length === 0) return -1;
    return findActiveLyricIndex(parsedSyncedLines, progress, 0.2);
  }, [parsedSyncedLines, progress]);

  // Smooth auto-scroll active lyric into view inside container without jumping or page scrolling
  useEffect(() => {
    if (!autoScroll || isUserScrollingRef.current || activeLineIndex < 0) {
      return;
    }

    // Only scroll when active line index actually transitions to avoid repetitive re-scrolling
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
  }, [activeLineIndex, autoScroll]);

  // When song changes, reset scroll index and scroll back to top
  useEffect(() => {
    lastScrolledIndexRef.current = -1;
    isUserScrollingRef.current = false;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentSong?.id]);

  // Detect manual user gesture scroll (mouse wheel or touch drag) to temporarily pause auto-scroll
  const handleUserInteractionScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      lastScrolledIndexRef.current = -1;
    }, 2800);
  };

  const handleCopy = async () => {
    const textToCopy = lyrics || (parsedSyncedLines.length > 0 ? parsedSyncedLines.map(l => l.text).join('\n') : '');
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy lyrics:', err);
    }
  };

  const cycleFontSize = () => {
    const nextSize = fontSize === 'sm' ? 'base' : fontSize === 'base' ? 'lg' : 'sm';
    setFontSize(nextSize);
    try {
      localStorage.setItem('sbg_lyrics_font_size', nextSize);
    } catch {}
  };

  // Close lyrics on Escape
  useEffect(() => {
    if (!isLyricsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleLyrics();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLyricsOpen, toggleLyrics]);

  if (!isLyricsOpen) return null;

  const fontClass = 
    fontSize === 'sm' ? 'text-sm sm:text-base leading-relaxed' : 
    fontSize === 'lg' ? 'text-xl sm:text-2xl font-medium leading-relaxed' : 
    'text-base sm:text-lg leading-relaxed';

  const songCover = currentSong?.imageUrl || currentSong?.customCoverUrl || currentSong?.coverUrl || currentSong?.heroImageUrl || currentSong?.thumbnailUrl;

  return (
    <>
      {/* Backdrop for click outside */}
      <div 
        onClick={toggleLyrics}
        className={`fixed inset-0 bg-black/70 backdrop-blur-md z-30 transition-opacity duration-200 ${
          isModalView ? 'block' : 'block md:hidden'
        }`}
        aria-hidden="true"
      />

      <div 
        id="sbg-lyrics-viewer"
        className={`fixed bg-[#0C0C0E]/95 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.85)] z-40 flex flex-col transition-all duration-300 ${
          isModalView
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-3xl h-[82vh] rounded-3xl animate-in zoom-in-95'
            : 'top-0 right-0 bottom-24 w-full md:w-[480px] lg:w-[540px] border-l border-t-0 border-b-0 border-r-0 animate-in slide-in-from-right-8'
        }`}
      >
      {/* Subtle ambient glow header */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-b from-purple-900/40 via-transparent to-transparent rounded-3xl" />

      {/* Header bar */}
      <div className="relative p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-black/20">
        <div className="flex items-center gap-3 min-w-0">
          {songCover ? (
            <img 
              src={songCover} 
              alt={currentSong?.title || 'Track'} 
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 shadow-md"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Music size={20} />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-white truncate">
                {currentSong?.title || 'Lyrics'}
              </h2>
              {parsedSyncedLines.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                  <Sparkles size={10} />
                  Synced
                </span>
              ) : lyrics ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 bg-white/5 border border-white/10 shrink-0">
                  Plain
                </span>
              ) : null}
            </div>
            <p className="text-xs text-white/50 truncate">
              {currentSong?.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {parsedSyncedLines.length > 0 && (
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Auto-scroll is On' : 'Auto-scroll is Off'}
              className={`p-2 rounded-xl transition-all ${
                autoScroll 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <ArrowDownCircle size={17} />
            </button>
          )}

          <button
            onClick={() => setIsModalView(!isModalView)}
            title={isModalView ? 'Switch to Side Panel' : 'Expand to Centered Modal'}
            className="hidden sm:flex p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            {isModalView ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          <button
            onClick={cycleFontSize}
            title={`Font Size: ${fontSize.toUpperCase()} (Click to toggle)`}
            className="p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <Type size={17} />
          </button>

          {(lyrics || parsedSyncedLines.length > 0) && (
            <button
              onClick={handleCopy}
              title={copied ? 'Copied to clipboard' : 'Copy lyrics'}
              className="p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={17} className="text-emerald-400" /> : <Copy size={17} />}
            </button>
          )}

          <button
            onClick={refetchLyrics}
            disabled={isLyricsLoading}
            title="Refresh Lyrics"
            className="p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RotateCw size={17} className={isLyricsLoading ? 'animate-spin text-purple-400' : ''} />
          </button>

          <button
            onClick={toggleLyrics}
            title="Close Lyrics (L)"
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors ml-1"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Lyrics Body */}
      <div 
        ref={scrollContainerRef}
        onWheel={handleUserInteractionScroll}
        onTouchMove={handleUserInteractionScroll}
        className="relative flex-1 overflow-y-auto px-6 py-8 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {isLyricsLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white/40 py-20">
            <Loader2 size={28} className="animate-spin text-purple-400" />
            <p className="text-sm font-medium text-white/60">Fetching lyrics for {currentSong?.title}...</p>
            <p className="text-xs text-white/30">Searching catalogs and matching timestamps</p>
          </div>
        ) : lyricsError && parsedSyncedLines.length === 0 && !lyrics ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              <Mic2 size={24} />
            </div>
            <h3 className="text-base font-bold text-white/80">No Lyrics Found</h3>
            <p className="text-xs text-white/40 max-w-xs leading-relaxed">
              {lyricsError}
            </p>
            <button
              onClick={refetchLyrics}
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RotateCw size={14} />
              <span>Retry Search</span>
            </button>
          </div>
        ) : parsedSyncedLines.length > 0 ? (
          /* Synchronized Karaoke-Style Lyrics */
          <div className="space-y-4 pb-32 pt-10 select-none">
            {parsedSyncedLines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;

              return (
                <div
                  key={`${line.time}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    seek(line.time);
                    lastScrolledIndexRef.current = -1;
                  }}
                  className={`group cursor-pointer transition-all duration-300 py-1.5 px-3 rounded-2xl ${
                    isActive
                      ? 'text-white font-bold scale-[1.02] bg-purple-500/15 border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.2)]'
                      : isPast
                      ? 'text-white/40 hover:text-white/80 hover:bg-white/5'
                      : 'text-white/30 hover:text-white/70 hover:bg-white/5'
                  }`}
                  title={`Click to jump to ${Math.floor(line.time / 60)}:${Math.floor(line.time % 60).toString().padStart(2, '0')}`}
                >
                  <p className={fontClass}>
                    {line.text || '♪ ♪ ♪'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : lyrics ? (
          /* Plain Formatted Lyrics */
          <div className="pb-32 pt-4">
            <div className="mb-4 p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
              <span>Showing plain lyrics (line-by-line sync requires timestamped LRC lyrics)</span>
            </div>
            <div className={`whitespace-pre-line text-white/80 font-normal ${fontClass}`}>
              {lyrics.split('\n').map((line, idx) => {
                const isSectionHeader = /^\[.*\]$/.test(line.trim());
                if (isSectionHeader) {
                  return (
                    <div key={idx} className="text-purple-400 font-bold uppercase tracking-wider text-xs pt-4 pb-1">
                      {line}
                    </div>
                  );
                }
                return (
                  <div key={idx} className={line.trim() === '' ? 'h-3' : 'py-0.5'}>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 text-white/40">
            <Music size={28} className="mb-2 opacity-40" />
            <p className="text-sm font-medium">Select a song to display lyrics</p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-white/5 bg-black/40 text-[11px] text-white/40 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">L</kbd> to toggle</span>
        </div>
        {parsedSyncedLines.length > 0 ? (
          <span className="text-white/30">Click line to seek</span>
        ) : (
          <span className="text-white/30">Plain text mode</span>
        )}
      </div>
    </div>
  </>
);
}
