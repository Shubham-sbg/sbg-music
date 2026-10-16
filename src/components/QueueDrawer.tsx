import React from 'react';
import { X, Play, Trash2, Music2 } from 'lucide-react';
import { Track } from '../types';
import { formatTime } from '../utils/formatTime';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  currentTrackId: string | null;
  onSelectTrack: (track: Track) => void;
  onRemoveTrack: (index: number) => void;
  onClearQueue: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  currentTrackId,
  onSelectTrack,
  onRemoveTrack,
  onClearQueue,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-neutral-900/95 backdrop-blur-2xl border-l border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Play Queue ({queue.length})</h3>
        </div>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="text-xs text-neutral-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              title="Clear Queue"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            aria-label="Close Queue"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-neutral-800/40">
        {queue.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-xs">
            Queue is empty. Select tracks from the catalog to populate your play queue.
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <div
                key={`${track.id}-${idx}`}
                className={`group flex items-center justify-between p-2 rounded-xl transition-all ${isCurrent ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-neutral-800/60'}`}
              >
                <div
                  onClick={() => onSelectTrack(track)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
                    <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-amber-400' : 'text-neutral-200 group-hover:text-white'}`}>
                      {track.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] font-mono text-neutral-500">{formatTime(track.duration)}</span>
                  <button
                    onClick={() => onRemoveTrack(idx)}
                    className="p-1 text-neutral-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
