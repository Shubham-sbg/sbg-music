import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, AlertCircle, X, Gauge, Minimize2, Maximize2, Moon, Activity, Mic2, MoreVertical, Sliders, Share2, Repeat, Repeat1, Shuffle, BookmarkPlus, ListPlus, ArrowUpDown, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { usePlayer } from '../context/PlayerContext';
import FavoriteButton from './FavoriteButton';
import AddToLibraryButton from './AddToLibraryButton';
import AddToCatalogButton from './AddToCatalogButton';
import AddToPlaylistModal from './AddToPlaylistModal';
import QueueDrawer from './QueueDrawer';
import LyricsViewer from './LyricsViewer';
import AudioVisualizer from './AudioVisualizer';
import ShareCardModal from './ShareCardModal';

interface AnimatedProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  className?: string;
  formatTime: (sec: number) => string;
  size?: 'sm' | 'md' | 'lg';
  showTimestampTooltip?: boolean;
}

function AnimatedProgressBar({
  progress,
  duration,
  onSeek,
  isPlaying,
  className = '',
  formatTime,
  size = 'md',
  showTimestampTooltip = true,
}: AnimatedProgressBarProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubProgress, setScrubProgress] = useState<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const barRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);

  const safeDuration = duration > 0 ? duration : 0;
  const currentProgress = isScrubbing ? scrubProgress : progress;
  const pct = safeDuration > 0 ? Math.min(100, Math.max(0, (currentProgress / safeDuration) * 100)) : 0;

  const calculateTargetFromEvent = (clientX: number) => {
    if (!barRef.current || safeDuration <= 0) return { targetTime: 0, x: 0 };
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const targetPct = rect.width > 0 ? x / rect.width : 0;
    const targetTime = targetPct * safeDuration;
    return { targetTime, x };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsScrubbing(true);

    const { targetTime, x } = calculateTargetFromEvent(e.clientX);
    setScrubProgress(targetTime);
    setHoverTime(targetTime);
    setHoverPos(x);

    if (barRef.current && typeof barRef.current.setPointerCapture === 'function') {
      try {
        barRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    const { targetTime, x } = calculateTargetFromEvent(e.clientX);

    setHoverTime(targetTime);
    setHoverPos(x);

    if (isDraggingRef.current) {
      setScrubProgress(targetTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsScrubbing(false);
      const { targetTime } = calculateTargetFromEvent(e.clientX);
      onSeek(targetTime);
    }

    if (barRef.current && typeof barRef.current.releasePointerCapture === 'function') {
      try {
        barRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsScrubbing(false);
    }
    setHoverTime(null);
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoverTime(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    let step = 5;
    if (e.shiftKey) step = 15;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const newTime = Math.max(0, progress - step);
      onSeek(newTime);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const newTime = Math.min(safeDuration, progress + step);
      onSeek(newTime);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(safeDuration);
    }
  };

  const trackHeight = size === 'sm' ? 'h-1.5 group-hover:h-2' : size === 'lg' ? 'h-2.5 group-hover:h-3' : 'h-1.5 group-hover:h-2.5';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek track playback"
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={Math.round(currentProgress)}
      aria-valuetext={`${formatTime(currentProgress)} of ${formatTime(safeDuration)}`}
      tabIndex={0}
      className={`relative w-full group py-2.5 cursor-pointer touch-none select-none flex items-center outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 rounded-full transition-all ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      {/* Background Track */}
      <div className={`w-full ${trackHeight} bg-white/10 group-hover:bg-white/20 rounded-full overflow-hidden transition-all relative backdrop-blur-sm border border-white/5`}>
        {/* Animated Progress Fill */}
        <div
          className={`h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full relative transition-all ${
            isScrubbing ? 'duration-0' : 'duration-75'
          } ${isPlaying || isScrubbing ? 'shadow-[0_0_12px_rgba(168,85,247,0.7)]' : ''}`}
          style={{ width: `${pct}%` }}
        >
          {/* Active shimmer/glow overlay when playing */}
          {isPlaying && !isScrubbing && (
            <div className="absolute inset-0 opacity-60 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          )}
        </div>
      </div>

      {/* Glowing Progress Thumb */}
      <div
        className={`absolute ${thumbSize} bg-white rounded-full shadow-[0_0_12px_rgba(168,85,247,1)] border-2 border-purple-400 transition-all transform -translate-x-1/2 pointer-events-none z-20 ${
          isScrubbing ? 'opacity-100 scale-125 ring-4 ring-purple-500/30' : 'opacity-0 group-hover:opacity-100 group-hover:scale-110'
        }`}
        style={{ left: `${pct}%` }}
      />

      {/* Floating Hover / Scrub Time Tooltip Badge */}
      {showTimestampTooltip && (hoverTime !== null || isScrubbing) && (
        <div
          className="absolute bottom-full mb-2 bg-zinc-900/95 border border-purple-500/40 text-purple-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.8)] pointer-events-none transform -translate-x-1/2 z-30 backdrop-blur-md flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: `${Math.max(20, Math.min(hoverPos || (pct / 100) * (barRef.current?.clientWidth || 0), (barRef.current?.clientWidth || 250) - 20))}px` }}
        >
          <span>{formatTime(isScrubbing ? scrubProgress : (hoverTime ?? currentProgress))}</span>
          <span className="text-white/40 font-normal">/</span>
          <span className="text-white/60 font-normal">{formatTime(safeDuration)}</span>
        </div>
      )}
    </div>
  );
}

export default function Player() {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const {
    currentSong,
    isPlaying,
    isLoading,
    isBuffering,
    progress,
    duration,
    volume,
    playbackRate,
    isMiniPlayer,
    isPlayerDismissed,
    queue,
    currentIndex,
    playbackError,
    playbackState,
    sourceType,
    diagnosticInfo,
    retryPlayback,
    activeBannerAd,
    activeVoiceAd,
    isVoiceAdPlaying,
    sleepTimerMinutes,
    sleepTimerRemaining,
    setSleepTimer,
    crossfadeEnabled,
    toggleCrossfade,
    volumeNormalizationEnabled,
    toggleVolumeNormalization,
    shareCurrentSong,
    isLyricsOpen,
    toggleLyrics,
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
    isShuffle,
    toggleShuffle,
    dismissBannerAd,
    clickAd,
    repeatMode,
    toggleRepeatMode,
    shuffleQueue,
  } = usePlayer();

  const [autoMinimizeOnScroll, setAutoMinimizeOnScroll] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbg_auto_minimize_scroll') !== 'false';
    } catch {
      return true;
    }
  });

  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // Touch Gesture Handling for Mobile Swipe-to-Skip
  const [swipeFeedback, setSwipeFeedback] = useState<string | null>(null);

  const bind = useDrag(({ swipe: [swipeX, swipeY], tap }) => {
    if (tap) return;
    
    if (swipeX !== 0) {
      if (swipeX === 1) {
        playPrevious();
        triggerSwipeToast('← Previous Track');
      } else if (swipeX === -1) {
        playNext();
        triggerSwipeToast('Next Track →');
      }
    } else if (swipeY !== 0) {
       if (swipeY === 1 && !isMiniPlayer) {
        setIsMiniPlayer(true);
        triggerSwipeToast('Mini Player');
      } else if (swipeY === -1 && isMiniPlayer) {
        setIsMiniPlayer(false);
        triggerSwipeToast('Full Player');
      }
    }
  }, { swipe: { distance: 30 } });

  const triggerSwipeToast = (msg: string) => {
    setSwipeFeedback(msg);
    setTimeout(() => {
      setSwipeFeedback((cur) => (cur === msg ? null : cur));
    }, 1800);
  };

  useEffect(() => {
    try {
      localStorage.setItem('sbg_auto_minimize_scroll', autoMinimizeOnScroll ? 'true' : 'false');
    } catch {}
  }, [autoMinimizeOnScroll]);

  // Automatically minimize player when scrolling away from top, restore when back
  useEffect(() => {
    if (!autoMinimizeOnScroll) return;

    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If scrolled down > 100px from top, switch to mini player
      if (currentScrollY > 100 && lastScrollY <= 100 && !isMiniPlayer) {
        setIsMiniPlayer(true);
      } 
      // If scrolled back to top, restore full player
      else if (currentScrollY <= 100 && lastScrollY > 100 && isMiniPlayer) {
        setIsMiniPlayer(false);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [autoMinimizeOnScroll, isMiniPlayer, setIsMiniPlayer]);

  const effectiveDuration = (duration && duration > 0)
    ? duration
    : (currentSong?.durationSeconds || currentSong?.duration || 0);

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return '0:00';
    const totalSeconds = Math.floor(time);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatSleepTimerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong && !isVoiceAdPlaying) return null;

  const displayTitle = isVoiceAdPlaying && activeVoiceAd ? activeVoiceAd.title : currentSong?.title;
  const displayArtist = isVoiceAdPlaying && activeVoiceAd ? (activeVoiceAd.sponsorMessage || 'Sponsored Message') : currentSong?.artist;
  const displayImage = isVoiceAdPlaying && activeVoiceAd ? activeVoiceAd.imageUrl : (currentSong?.imageUrl || currentSong?.customCoverUrl || currentSong?.coverUrl || currentSong?.heroImageUrl || currentSong?.thumbnailUrl);

  return (
    <>
      {/* Swipe Feedback Toast */}
      {swipeFeedback && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-purple-600 text-white font-bold text-xs px-4 py-2 rounded-full shadow-2xl border border-purple-400 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md flex items-center gap-1.5 pointer-events-none">
          <Activity size={14} className="animate-spin" />
          <span>{swipeFeedback}</span>
        </div>
      )}

      {activeBannerAd && (
        <div className={`fixed ${isMiniPlayer ? 'bottom-[140px] md:bottom-28 right-4 sm:right-6' : 'bottom-[144px] md:bottom-28 left-4 right-4 md:left-auto md:right-8'} md:max-w-md bg-zinc-900/95 border border-purple-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl z-50 flex items-center gap-4 animate-in slide-in-from-bottom-4`}>
          {activeBannerAd.imageUrl && (
            <img src={activeBannerAd.imageUrl} alt={activeBannerAd.title} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300">Sponsored</span>
              <span className="text-xs font-bold text-white truncate">{activeBannerAd.title}</span>
            </div>
            <p className="text-[11px] text-white/60 truncate">{activeBannerAd.description || 'Check out our featured partner.'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => clickAd(activeBannerAd.id, activeBannerAd.destinationUrl)}
              className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:scale-105 transition-transform"
            >
              {activeBannerAd.buttonLabel || 'Learn More'}
            </button>
            <button
              onClick={dismissBannerAd}
              className="text-white/40 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Actionable Playback Diagnostic & Error Banner */}
      {playbackError && (
        <div className={`fixed ${isMiniPlayer ? 'bottom-[136px] md:bottom-28 right-4 sm:right-6' : 'bottom-[140px] md:bottom-28 left-4 right-4 md:left-auto md:right-8'} md:max-w-md bg-[#1c1214]/95 border border-red-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl z-50 flex items-center justify-between gap-3 text-white animate-in slide-in-from-bottom-3`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white/90 truncate">{playbackError}</span>
              {diagnosticInfo && (
                <span className="text-[10px] text-white/40 font-mono">Ref: {diagnosticInfo.diagnosticId} • {diagnosticInfo.sourceType}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={retryPlayback}
              title="Retry playback"
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1 shadow"
            >
              <RefreshCw size={12} />
              Retry
            </button>
            <button
              onClick={clearError}
              className="text-white/40 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Player Container with AnimatePresence & Framer Motion Transitions */}
      <AnimatePresence mode="wait">
        {isPlayerDismissed && currentSong ? (
          <motion.div
            key="restore-pill"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-[80px] md:bottom-5 right-4 sm:right-6 z-50 flex items-center gap-2 p-1.5 pr-3 bg-[#111114]/95 border border-purple-500/30 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.85)] backdrop-blur-xl text-white text-xs font-semibold group transition-all"
          >
            <button
              onClick={restorePlayer}
              title="Click to restore player"
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-purple-500/40">
                {displayImage ? (
                  <img src={displayImage} alt={displayTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-purple-900 flex items-center justify-center text-[10px]">🎵</div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  </div>
                )}
              </div>
              <div className="flex flex-col max-w-[130px] sm:max-w-[170px]">
                <span className="truncate text-white text-[11px] font-bold">{displayTitle}</span>
                <span className="truncate text-white/50 text-[9px]">{isPlaying ? 'Playing' : 'Paused'}</span>
              </div>
            </button>

            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow shrink-0 cursor-pointer ml-1"
            >
              {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              onClick={restorePlayer}
              title="Expand Player"
              className="p-1 text-purple-400 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <Maximize2 size={14} />
            </button>
          </motion.div>
        ) : isMiniPlayer ? (
          <motion.div
            key="mini-player"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="fixed bottom-[80px] md:bottom-5 left-4 right-4 md:left-auto md:right-6 md:w-[440px] z-50"
          >
            <div {...bind()} className="relative bg-[#111114]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] p-3 flex flex-col gap-2.5 overflow-hidden group">
              {/* Top Header bar inside mini player with Close (X) button */}
              <div className="flex items-center justify-between text-[10px] text-white/40 border-b border-white/5 pb-1">
                <span className="uppercase tracking-widest font-mono text-[9px] text-purple-400/80">SBG Player</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMiniPlayer(false)}
                    title="Expand to Full Player"
                    className="hover:text-white transition-colors"
                  >
                    Expand
                  </button>
                  <span>•</span>
                  <button
                    onClick={dismissPlayer}
                    title="Close Mini Player (keeps playing)"
                    aria-label="Close Mini Player"
                    className="hover:text-white p-0.5 rounded text-white/40 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Interactive Scrubber with timestamps */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-mono text-white/50 tabular-nums shrink-0">
                  {formatTime(progress)}
                </span>
                <div className="flex-1 min-w-0">
                  <AnimatedProgressBar
                    progress={progress}
                    duration={effectiveDuration}
                    onSeek={seek}
                    isPlaying={isPlaying}
                    formatTime={formatTime}
                    size="sm"
                    showTimestampTooltip={true}
                  />
                </div>
                <span className="text-[10px] font-mono text-white/50 tabular-nums shrink-0">
                  {formatTime(effectiveDuration)}
                </span>
              </div>

              {/* Content Row: Art + Info + Controls */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSong?.id || 'mini-ad'}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 w-full"
                >
                  {/* Artwork */}
                  <div
                    onClick={() => setIsMiniPlayer(false)}
                    title="Click to expand to full player"
                    className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0 cursor-pointer bg-zinc-900 group/art shadow-md"
                  >
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={displayTitle || 'Audio'}
                        className="w-full h-full object-cover group-hover/art:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800" />
                    )}
                    {(isLoading || isBuffering) && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 size={16} className="text-white animate-spin" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-purple-600/30 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 size={14} className="text-white drop-shadow" />
                    </div>
                  </div>

                  {/* Title & Artist */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setIsMiniPlayer(false)}
                    title="Click to expand to full player"
                  >
                    <div className="flex items-center gap-1.5">
                      {isVoiceAdPlaying && (
                        <span className="px-1 py-0.2 bg-purple-500/20 text-purple-300 text-[8px] font-bold uppercase rounded">Ad</span>
                      )}
                      <div className="font-bold text-xs sm:text-sm truncate text-white hover:text-purple-300 transition-colors">
                        {displayTitle}
                      </div>
                    </div>
                    <div className="text-[11px] text-white/50 truncate flex items-center gap-2">
                      <span>{displayArtist}</span>
                      {playbackRate !== 1 && (
                        <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded">
                          {playbackRate}x
                        </span>
                      )}
                      {!isVoiceAdPlaying && queue.length > 1 && (
                        <span className="text-[10px] text-white/30 font-mono">
                          ({currentIndex + 1}/{queue.length})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Mini Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isVoiceAdPlaying && currentSong && (
                      <>
                        <AddToLibraryButton song={currentSong} compact className="shrink-0" />
                        <AddToCatalogButton song={currentSong} compact className="shrink-0" />
                      </>
                    )}

                    {!isVoiceAdPlaying && currentSong && (
                      <FavoriteButton songId={currentSong.id} size={16} className="bg-transparent border-none shadow-none hover:bg-white/5 min-w-[36px] min-h-[36px] flex items-center justify-center" />
                    )}

                    <button
                      onClick={playPrevious}
                      title="Previous Track"
                      aria-label="Previous Track"
                      className="w-10 h-10 min-w-[40px] min-h-[40px] text-white/60 hover:text-white flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all shrink-0"
                    >
                      <SkipBack size={18} />
                    </button>

                    <button
                      onClick={togglePlayPause}
                      title={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                      aria-label={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                      disabled={isLoading && !isPlaying}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-50 shrink-0"
                    >
                      {isLoading || isBuffering ? (
                        <Loader2 size={18} className="animate-spin text-black" />
                      ) : isPlaying ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={playNext}
                      title="Next Track"
                      aria-label="Next Track"
                      className="w-10 h-10 min-w-[40px] min-h-[40px] text-white/60 hover:text-white flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all shrink-0"
                    >
                      <SkipForward size={18} />
                    </button>

                    {/* Expand Button */}
                    <button
                      onClick={() => setIsMiniPlayer(false)}
                      title="Expand to Full Player"
                      aria-label="Expand to Full Player"
                      className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-all shrink-0 ml-0.5"
                    >
                      <Maximize2 size={16} className="text-purple-400" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          /* Full-Width Player Bar */
          <motion.div
            key="full-player"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="fixed bottom-[64px] md:bottom-0 left-0 w-full bg-[#0A0A0B]/95 backdrop-blur-xl border-t border-white/5 z-50"
          >
          
          {/* ================= MOBILE-FIRST LAYOUT (< 768px) ================= */}
          <div 
            className="block md:hidden relative px-3 py-2.5 h-20 flex flex-col justify-between select-none"
            {...bind()}
          >
            {/* Top Edge Animated Progress Bar */}
            <div className="absolute top-0 left-0 w-full px-1 -mt-2 z-20">
              <AnimatedProgressBar
                progress={progress}
                duration={effectiveDuration}
                onSeek={seek}
                isPlaying={isPlaying}
                formatTime={formatTime}
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between gap-2 min-w-0 mt-1">
              {/* Artwork & Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div 
                  onClick={() => setIsMiniPlayer(true)}
                  className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 relative bg-zinc-900 shadow-sm"
                >
                  {displayImage ? (
                    <img src={displayImage} alt={displayTitle || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800" />
                  )}
                  {(isLoading || isBuffering) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={14} className="text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1" onClick={() => setIsMiniPlayer(true)}>
                  <div className="font-bold text-xs text-white truncate">{displayTitle}</div>
                  <div className="text-[11px] text-white/50 truncate">{displayArtist}</div>
                </div>
              </div>

              {/* Mobile Touch Controls with Enlarged 44px+ Hit Targets */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {!isVoiceAdPlaying && currentSong && (
                  <AddToLibraryButton song={currentSong} compact className="shrink-0" />
                )}

                {!isVoiceAdPlaying && currentSong && (
                  <FavoriteButton songId={currentSong.id} song={currentSong} size={18} className="bg-transparent border-none p-2 min-w-[40px] min-h-[40px] flex items-center justify-center" />
                )}

                <button
                  onClick={playPrevious}
                  title="Previous song"
                  aria-label="Previous song"
                  className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center text-white/80 hover:text-white bg-white/5 active:scale-90 transition-transform rounded-full"
                >
                  <SkipBack size={24} />
                </button>

                <button
                  onClick={togglePlayPause}
                  title={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                  aria-label={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                  disabled={isLoading && !isPlaying}
                  className="w-14 h-14 min-w-[56px] min-h-[56px] bg-white text-black rounded-full flex items-center justify-center active:scale-95 shadow shrink-0"
                >
                  {isLoading || isBuffering ? (
                    <Loader2 size={24} className="animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                <button
                  onClick={playNext}
                  title="Next song"
                  aria-label="Next song"
                  className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center text-white/80 hover:text-white bg-white/5 active:scale-90 transition-transform rounded-full"
                >
                  <SkipForward size={24} />
                </button>

                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  title="More controls"
                  aria-label="More controls"
                  className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-full border flex items-center justify-center transition-all ${
                    showMobileMenu 
                      ? 'bg-purple-600 text-white border-purple-400' 
                      : 'bg-white/5 text-white/70 border-white/10'
                  }`}
                >
                  <Sliders size={24} />
                </button>
              </div>
            </div>

            {/* Mobile Expanded Overflow Menu Sheet */}
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute bottom-full left-0 w-full bg-[#121216]/98 border-t border-white/15 rounded-t-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-200 backdrop-blur-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Audio Controls & Settings</span>
                    <button onClick={() => setShowMobileMenu(false)} className="text-white/50 hover:text-white p-1">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Playback Scrub Bar in Mobile Menu */}
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-white/60">Position</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-300 font-bold">{formatTime(progress)}</span>
                        <span className="text-white/30">/</span>
                        <span className="text-white/60">{formatTime(effectiveDuration)}</span>
                      </div>
                    </div>
                    <AnimatedProgressBar
                      progress={progress}
                      duration={effectiveDuration}
                      onSeek={seek}
                      isPlaying={isPlaying}
                      formatTime={formatTime}
                      size="lg"
                      showTimestampTooltip={true}
                    />
                  </div>

                  {/* Volume Slider in Mobile Menu */}
                  <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} className="text-white/70">
                      {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="Volume slider"
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                    />
                    <span className="text-xs font-mono text-white/50 w-8 text-right">{Math.round(volume * 100)}%</span>
                  </div>

                  {/* Action Buttons Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { toggleRepeatMode(); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors ${
                        repeatMode !== 'off' ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'bg-white/5 text-white/80 border-white/10'
                      }`}
                    >
                      {repeatMode === 'one' ? <Repeat1 size={16} className="text-pink-400" /> : <Repeat size={16} className="text-purple-400" />}
                      <span>Repeat: {repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}</span>
                    </button>

                    <button
                      onClick={() => { toggleShuffle(); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors ${isShuffle ? 'bg-purple-600 text-white border-purple-400' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'}`}
                    >
                      <Shuffle size={16} className={isShuffle ? 'text-white' : 'text-purple-400'} />
                      <span>{isShuffle ? 'Unshuffle Queue' : 'Shuffle Queue'}</span>
                    </button>

                    <button
                      onClick={() => { setAutoMinimizeOnScroll(!autoMinimizeOnScroll); setShowMobileMenu(false); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors ${
                        autoMinimizeOnScroll ? 'bg-purple-600 text-white border-purple-400' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <ArrowUpDown size={16} className={autoMinimizeOnScroll ? 'text-white' : 'text-purple-400'} />
                      <span>{autoMinimizeOnScroll ? 'Auto-Mini On' : 'Auto-Mini Off'}</span>
                    </button>
                    
                    <button
                      onClick={() => { toggleLyrics(); setShowMobileMenu(false); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors ${
                        isLyricsOpen ? 'bg-purple-600 text-white border-purple-400' : 'bg-white/5 text-white/80 border-white/10'
                      }`}
                    >
                      <Mic2 size={16} className="text-purple-400" />
                      <span>{isLyricsOpen ? 'Hide Lyrics' : 'Show Lyrics'}</span>
                    </button>

                    <button
                      onClick={() => { toggleCrossfade(); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors ${
                        crossfadeEnabled ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/80 border-white/10'
                      }`}
                    >
                      <Activity size={16} className={crossfadeEnabled ? 'text-emerald-400' : 'text-white/50'} />
                      <span>Crossfade: {crossfadeEnabled ? 'On' : 'Off'}</span>
                    </button>

                    <button
                      onClick={() => { toggleVolumeNormalization(); }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors col-span-2 ${
                        volumeNormalizationEnabled ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-white/80 border-white/10'
                      }`}
                    >
                      <Gauge size={16} className={volumeNormalizationEnabled ? 'text-purple-400' : 'text-white/50'} />
                      <span>Volume Normalization (LUFS): {volumeNormalizationEnabled ? 'On' : 'Off'}</span>
                    </button>

                    <button
                      onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                      className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors col-span-2 bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                    >
                      <Share2 size={16} className="text-purple-400" />
                      <span>Share Song Card</span>
                    </button>

                    <button
                      onClick={() => { setShowPlaylistModal(true); setShowMobileMenu(false); }}
                      className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border transition-colors col-span-2 bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30"
                    >
                      <ListPlus size={16} className="text-purple-400" />
                      <span>Add to Playlist</span>
                    </button>

                    {currentSong && (
                      <div className="col-span-2 flex items-center gap-2 pt-1">
                        <AddToLibraryButton song={currentSong} className="flex-1 justify-center py-2.5" />
                        <AddToCatalogButton song={currentSong} className="flex-1 justify-center py-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Speed & Sleep Selectors */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/5 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs text-white/60">Speed</span>
                      <select
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(Number(e.target.value))}
                        className="bg-zinc-800 text-white text-xs font-mono rounded px-2 py-1 border border-white/10 outline-none"
                      >
                        {[0.75, 1, 1.25, 1.5, 2].map(r => (
                          <option key={r} value={r}>{r}x</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 bg-white/5 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs text-white/60">Sleep Timer</span>
                      <select
                        value={sleepTimerMinutes || 0}
                        onChange={(e) => setSleepTimer(Number(e.target.value) || null)}
                        className="bg-zinc-800 text-white text-xs font-mono rounded px-2 py-1 border border-white/10 outline-none"
                      >
                        <option value={0}>Off</option>
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                        <option value={60}>60m</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2">
                    <QueueDrawer />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setIsMiniPlayer(true); setShowMobileMenu(false); }}
                        className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1.5 py-2 px-3 bg-purple-500/10 rounded-xl"
                      >
                        <Minimize2 size={14} />
                        <span>Mini</span>
                      </button>
                      <button
                        onClick={() => { dismissPlayer(); setShowMobileMenu(false); }}
                        className="text-xs font-medium text-red-400 hover:text-red-300 flex items-center gap-1.5 py-2 px-3 bg-red-500/10 rounded-xl"
                      >
                        <X size={14} />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ================= DESKTOP LAYOUT (>= 768px) ================= */}
          <div className="hidden md:grid px-4 md:px-6 h-24 grid-cols-[minmax(220px,1fr)_minmax(380px,2fr)_minmax(260px,1fr)] items-center gap-4">
            
            {/* LEFT SECTION: Artwork, Song Info & Favorite */}
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <div className="w-13 h-13 md:w-14 md:h-14 rounded-xl overflow-hidden border border-white/10 shadow-lg shrink-0 relative bg-zinc-900">
                {displayImage ? (
                  <img
                    src={displayImage}
                    className="w-full h-full object-cover"
                    alt={displayTitle || 'Audio'}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                {(isLoading || isBuffering) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 size={18} className="text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {isVoiceAdPlaying && (
                    <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase rounded shrink-0">Ad</span>
                  )}
                  <div className="font-bold text-sm text-white truncate w-full" title={displayTitle || ''}>
                    {displayTitle}
                  </div>
                </div>
                <div className="text-xs text-white/50 truncate flex items-center gap-2 w-full">
                  <span className="truncate" title={displayArtist || ''}>{displayArtist}</span>
                  {!isVoiceAdPlaying && queue.length > 1 && (
                    <span className="hidden xl:inline text-[10px] text-white/30 font-mono shrink-0">
                      ({currentIndex + 1}/{queue.length})
                    </span>
                  )}
                </div>
              </div>

              {!isVoiceAdPlaying && currentSong && (
                <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                  <AddToLibraryButton song={currentSong} compact className="shrink-0" />
                  <AddToCatalogButton song={currentSong} compact className="shrink-0" />
                  <FavoriteButton songId={currentSong.id} song={currentSong} size={18} className="bg-transparent border-none shadow-none hover:bg-white/5" />
                  <button
                    onClick={() => setShowPlaylistModal(true)}
                    title="Add to Playlist"
                    aria-label="Add to Playlist"
                    className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center"
                  >
                    <ListPlus size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* CENTER SECTION: Core Controls & Timeline */}
            <div className="flex flex-col items-center justify-center gap-1.5 w-full max-w-xl mx-auto min-w-0">
              <div className="flex items-center gap-4">
                {/* Shuffle Button */}
                <button
                  onClick={toggleShuffle}
                  title="Shuffle Queue"
                  aria-label="Shuffle Queue"
                  className={`transition-colors p-1.5 rounded-full hover:bg-white/5 active:scale-90 shrink-0 ${isShuffle ? 'text-purple-400' : 'text-white/40 hover:text-white'}`}
                >
                  <Shuffle size={16} />
                </button>

                <button
                  onClick={playPrevious}
                  title="Previous song"
                  aria-label="Previous song"
                  className="text-white/50 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 active:scale-90 shrink-0"
                >
                  <SkipBack size={20} />
                </button>

                <button
                  onClick={togglePlayPause}
                  title={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                  aria-label={isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
                  disabled={isLoading && !isPlaying}
                  className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 shrink-0"
                >
                  {isLoading || isBuffering ? (
                    <Loader2 size={18} className="animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                <button
                  onClick={playNext}
                  title="Next song"
                  aria-label="Next song"
                  className="text-white/50 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 active:scale-90 shrink-0"
                >
                  <SkipForward size={20} />
                </button>

                {/* Repeat Toggle Button */}
                <button
                  onClick={toggleRepeatMode}
                  title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}`}
                  aria-label={`Repeat mode: ${repeatMode}`}
                  className={`p-1.5 rounded-xl transition-all relative shrink-0 flex items-center justify-center ${
                    repeatMode === 'off'
                      ? 'text-white/40 hover:text-white'
                      : repeatMode === 'all'
                      ? 'text-purple-400 bg-purple-500/20 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                  }`}
                >
                  {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                  {repeatMode !== 'off' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Timeline & Progress */}
              <div className="flex items-center gap-3 w-full">
                <span className="text-[10px] font-mono text-white/50 tabular-nums w-9 text-right shrink-0">
                  {formatTime(progress)}
                </span>
                <AnimatedProgressBar
                  progress={progress}
                  duration={effectiveDuration}
                  onSeek={seek}
                  isPlaying={isPlaying}
                  formatTime={formatTime}
                  size="md"
                />
                <span className="text-[10px] font-mono text-white/50 tabular-nums w-9 shrink-0">
                  {formatTime(effectiveDuration)}
                </span>
              </div>
            </div>

            {/* RIGHT SECTION: Secondary & Utility Controls (Non-overlapping) */}
            <div className="flex items-center justify-end gap-2.5 min-w-0 overflow-hidden">
              {/* Audio Visualizer (Desktop only) */}
              <div className="hidden lg:block w-20 xl:w-24 shrink-0">
                <AudioVisualizer isPlaying={isPlaying} height={24} barCount={10} />
              </div>

              {/* Speed Controller */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  title="Playback speed"
                  aria-label="Playback speed"
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 shrink-0 ${
                    playbackRate !== 1
                      ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
                  }`}
                >
                  <Gauge size={13} className={playbackRate !== 1 ? 'text-white' : 'text-purple-400'} />
                  <span>{playbackRate}x</span>
                </button>

                {showSpeedMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                    <div className="absolute bottom-full mb-3 right-0 w-36 bg-[#18181b]/95 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 backdrop-blur-xl">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-mono font-bold tracking-wider text-white/40 border-b border-white/5 mb-1 flex items-center justify-between">
                        <span>Speed</span>
                        <span className="text-purple-400 font-bold">{playbackRate}x</span>
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate);
                            setShowSpeedMenu(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                            playbackRate === rate
                              ? 'bg-purple-600 font-bold text-white shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{rate === 1 ? '1x (Normal)' : `${rate}x`}</span>
                          {playbackRate === rate && <span className="text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Sleep Timer */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setShowSleepMenu(!showSleepMenu)}
                  title="Sleep timer"
                  aria-label="Sleep timer"
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 shrink-0 ${
                    sleepTimerMinutes !== null
                      ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
                  }`}
                >
                  <Moon size={13} className={sleepTimerMinutes !== null ? 'text-white' : 'text-purple-400'} />
                  <span>{sleepTimerRemaining !== null ? formatSleepTimerTime(sleepTimerRemaining) : 'Sleep'}</span>
                </button>

                {showSleepMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSleepMenu(false)} />
                    <div className="absolute bottom-full mb-3 right-0 w-44 bg-[#18181b]/95 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 backdrop-blur-xl">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-mono font-bold tracking-wider text-white/40 border-b border-white/5 mb-1 flex items-center justify-between">
                        <span>Sleep Timer</span>
                        {sleepTimerMinutes !== null && (
                          <button 
                            onClick={() => { setSleepTimer(null); setShowSleepMenu(false); }}
                            className="text-purple-400 hover:text-purple-300 font-bold"
                          >
                            Turn Off
                          </button>
                        )}
                      </div>
                      {[
                        { label: 'Off', minutes: null },
                        { label: '15 mins', minutes: 15 },
                        { label: '30 mins', minutes: 30 },
                        { label: '45 mins', minutes: 45 },
                        { label: '60 mins', minutes: 60 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            setSleepTimer(item.minutes);
                            setShowSleepMenu(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                            sleepTimerMinutes === item.minutes
                              ? 'bg-purple-600 font-bold text-white shadow-sm'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{item.label}</span>
                          {sleepTimerMinutes === item.minutes && <span className="text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Crossfade Toggle */}
              <button
                onClick={toggleCrossfade}
                title={`Crossfade: ${crossfadeEnabled ? 'On' : 'Off'}`}
                aria-label="Toggle crossfade"
                className={`hidden lg:flex px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border items-center gap-1.5 shrink-0 ${
                  crossfadeEnabled
                    ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 border-white/10'
                }`}
              >
                <Activity size={13} className={crossfadeEnabled ? 'text-emerald-400' : 'text-white/40'} />
                <span>Crossfade</span>
              </button>

              {/* Queue Drawer */}
              <QueueDrawer />

              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                title="Generate Social Share Card"
                aria-label="Share song"
                className="px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border-white/10"
              >
                <Share2 size={14} className="text-purple-400" />
                <span className="hidden xl:inline text-xs font-medium">Share</span>
              </button>

              {/* Lyrics Button */}
              <button
                onClick={toggleLyrics}
                title={isLyricsOpen ? 'Hide Lyrics (L)' : 'Show Lyrics (L)'}
                aria-label="Toggle lyrics"
                className={`px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0 ${
                  isLyricsOpen
                    ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                    : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border-white/10'
                }`}
              >
                <Mic2 size={14} className={isLyricsOpen ? 'text-white' : 'text-purple-400'} />
                <span className="hidden xl:inline text-xs font-medium">Lyrics</span>
              </button>

              {/* Volume Control */}
              <div className="hidden sm:flex items-center gap-2 group ml-1">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                  title="Volume"
                  aria-label="Mute or unmute"
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume slider"
                  className="w-16 md:w-20 lg:w-24 h-1 bg-white/10 hover:bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all"
                />
              </div>

              {/* Auto-Minimize on Scroll Toggle */}
              <button
                onClick={() => setAutoMinimizeOnScroll(!autoMinimizeOnScroll)}
                title="Toggle Auto-Minimize on Scroll"
                aria-label="Toggle Auto-Minimize on Scroll"
                className={`hidden lg:flex p-2 rounded-xl transition-all hover:scale-105 active:scale-95 items-center justify-center shrink-0 border ${
                  autoMinimizeOnScroll
                    ? 'bg-purple-600/20 text-purple-400 hover:text-purple-300 border-purple-500/30'
                    : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border-white/10'
                }`}
              >
                <ArrowUpDown size={16} />
              </button>

              {/* Collapse / Mini Player Toggle */}
              <button
                onClick={toggleMiniPlayer}
                title="Collapse to Mini Player"
                aria-label="Collapse to Mini Player"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0 ml-1"
              >
                <Minimize2 size={16} className="text-purple-400" />
                <span className="hidden xl:inline text-xs font-medium">Mini</span>
              </button>

              {/* Dismiss Player Button */}
              <button
                onClick={dismissPlayer}
                title="Dismiss Player Bar (music keeps playing)"
                aria-label="Dismiss Player Bar"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/50 hover:text-red-400 border border-white/10 transition-all hover:scale-105 active:scale-95 flex items-center shrink-0 ml-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Synchronized & Plain Lyrics Viewer Drawer */}
      <LyricsViewer />

      {/* Social Share Card Generator Modal */}
      <ShareCardModal
        song={currentSong}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Add to Custom Playlist Modal */}
      {showPlaylistModal && currentSong && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          songItem={currentSong}
        />
      )}
    </>
  );
}
