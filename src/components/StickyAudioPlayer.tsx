import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
} from 'lucide-react';
import { Track, RepeatMode } from '../types';
import { formatTime } from '../utils/formatTime';
import { AudioVisualizer } from './AudioVisualizer';

interface StickyAudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Track[];
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenQueue: () => void;
  isQueueOpen: boolean;
}

export const StickyAudioPlayer: React.FC<StickyAudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  repeatMode,
  isShuffle,
  queue,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onNextTrack,
  onPrevTrack,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onOpenQueue,
  isQueueOpen,
}) => {
  if (!currentTrack) return null;

  const safeDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const currentVolume = isMuted ? 0 : volume;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
      {/* Top Track Seeking Bar */}
      <div className="relative group w-full h-2 -top-1 cursor-pointer">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800 group-hover:h-1.5 transition-all">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 relative"
            style={{ width: `${progressPct}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.5}
          value={currentTime}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Seek track"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Track Information */}
        <div className="flex items-center gap-3 min-w-0 w-1/4 sm:w-1/3">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-900 shadow-md">
            <img
              src={currentTrack.artwork}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
              <button
                onClick={() => onToggleLike(currentTrack.id)}
                className="text-neutral-500 hover:text-amber-400 transition-colors p-1"
                aria-label="Favorite track"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${currentTrack.isLiked ? 'fill-amber-400 text-amber-400' : ''}`}
                />
              </button>
            </div>
            <p className="text-xs text-neutral-400 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Center: Playback Controls & Progress Indicator */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={onToggleShuffle}
              className={`p-2 rounded-lg transition-colors ${
                isShuffle
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={onPrevTrack}
              className="p-2 text-neutral-300 hover:text-white transition-colors"
              title="Previous Track"
              aria-label="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={onPlayPause}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-transform"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label="Play or Pause"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={onNextTrack}
              className="p-2 text-neutral-300 hover:text-white transition-colors"
              title="Next Track"
              aria-label="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`p-2 rounded-lg transition-colors relative ${
                repeatMode !== 'off'
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
              aria-label="Repeat Mode"
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-neutral-400 w-full justify-center">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(safeDuration)}</span>
          </div>
        </div>

        {/* Right: Visualizer, Volume, Queue */}
        <div className="flex items-center justify-end gap-3 w-1/4 sm:w-1/3">
          <div className="hidden md:block">
            <AudioVisualizer isPlaying={isPlaying} barCount={10} className="h-5 flex items-end gap-0.5" />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
              aria-label="Mute or Unmute"
            >
              {isMuted || currentVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : currentVolume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={currentVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 lg:w-24 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              aria-label="Volume slider"
            />
          </div>

          <button
            onClick={onOpenQueue}
            className={`p-2 rounded-xl transition-all relative ${
              isQueueOpen
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
            }`}
            title="Open Play Queue"
            aria-label="Toggle Queue"
          >
            <ListMusic className="w-4 h-4" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 font-bold text-[9px] flex items-center justify-center">
                {queue.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default StickyAudioPlayer;
