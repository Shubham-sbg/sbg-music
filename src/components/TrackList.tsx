import React from 'react';
import { Play, Pause, Heart, Plus, Music, Disc } from 'lucide-react';
import { Track } from '../types';
import { formatTime } from '../utils/formatTime';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  onSelectTrack,
  onTogglePlayPause,
  onToggleLike,
  onAddToQueue,
}) => {
  if (tracks.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-500 text-xs">
        No tracks found for the selected category.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tracks.map((track, idx) => {
        const isCurrent = track.id === currentTrackId;
        const isCurrentPlaying = isCurrent && isPlaying;

        return (
          <div
            key={track.id}
            className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer ${
              isCurrent
                ? 'bg-amber-500/10 border border-amber-500/30 shadow-md shadow-amber-500/5'
                : 'hover:bg-neutral-900 border border-transparent'
            }`}
            onClick={() => {
              if (isCurrent) {
                onTogglePlayPause();
              } else {
                onSelectTrack(track);
              }
            }}
          >
            {/* Left: Index / Play Button + Artwork + Title/Artist */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              {/* Number or Play indicator */}
              <div className="w-6 text-center shrink-0">
                <span className="text-xs font-mono text-neutral-500 group-hover:hidden">
                  {isCurrentPlaying ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    String(idx + 1).padStart(2, '0')
                  )}
                </span>
                <button
                  className="hidden group-hover:inline-flex items-center justify-center text-white hover:text-amber-400 transition-colors"
                  aria-label={isCurrentPlaying ? 'Pause' : 'Play'}
                >
                  {isCurrentPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-amber-400" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Artwork */}
              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow">
                <img
                  src={track.artwork}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
                {isCurrentPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-3 bg-amber-400 animate-pulse" />
                      <span className="w-0.5 h-2 bg-amber-400 animate-pulse delay-75" />
                      <span className="w-0.5 h-3 bg-amber-400 animate-pulse delay-150" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Artist */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold truncate ${
                    isCurrent ? 'text-amber-400' : 'text-neutral-100 group-hover:text-white'
                  }`}
                >
                  {track.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
                  <span>{track.artist}</span>
                  <span className="hidden sm:inline text-neutral-600">·</span>
                  <span className="hidden sm:inline text-neutral-500 truncate">{track.album}</span>
                </div>
              </div>
            </div>

            {/* Middle: Genre / Mood Tag */}
            <div className="hidden md:flex items-center gap-2 shrink-0 px-4">
              <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] font-medium text-neutral-400">
                {track.genre}
              </span>
              {track.bpm && (
                <span className="text-[10px] font-mono text-neutral-500">
                  {track.bpm} BPM
                </span>
              )}
            </div>

            {/* Right: Duration & Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="text-xs font-mono text-neutral-400 w-12 text-right">
                {formatTime(track.duration)}
              </span>

              {/* Add to Queue Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue(track);
                }}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                title="Add to queue"
                aria-label="Add to Queue"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Like Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(track.id);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  track.isLiked
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                }`}
                title={track.isLiked ? 'Unlike' : 'Like'}
                aria-label="Like"
              >
                <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackList;
