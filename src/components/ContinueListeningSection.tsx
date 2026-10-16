import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, PlayCircle, RotateCcw } from 'lucide-react';
import { Song } from '../types';
import { formatTimeDisplay, clearSongPlaybackPosition } from '../lib/playbackPosition';

interface ContinueState {
  song: Song;
  progress: number;
  duration: number;
  timestamp: number;
}

export default function ContinueListeningSection() {
  const [continueState, setContinueState] = useState<ContinueState | null>(null);
  const { currentSong, resumeSong, playSong } = usePlayer();

  const loadState = () => {
    try {
      const stored = localStorage.getItem('sbg_continue_listening');
      if (stored) {
        setContinueState(JSON.parse(stored));
      } else {
        setContinueState(null);
      }
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    loadState();
    window.addEventListener('continue_listening_updated', loadState);
    return () => window.removeEventListener('continue_listening_updated', loadState);
  }, []);

  if (!continueState || !continueState.song) return null;
  // Don't show if this song is currently playing
  if (currentSong?.id === continueState.song.id) return null;

  const { song, progress, duration } = continueState;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const songArtwork = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;

  return (
    <section className="mb-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <PlayCircle size={20} className="text-purple-500" />
            <span>Continue Listening</span>
          </h2>
        </div>
      </div>
      
      <div className="group relative bg-[#111112] p-4 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-[#18181A] transition-all shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden max-w-md flex gap-4 items-center justify-between">
        <div 
          onClick={() => resumeSong(song)}
          className="flex gap-4 items-center flex-1 min-w-0 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-white/10 relative">
            {songArtwork ? (
              <img src={songArtwork} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-zinc-800" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play size={24} fill="currentColor" className="text-white ml-1" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0 py-1">
            <h3 className="font-bold text-sm text-white truncate">{song.title}</h3>
            <p className="text-xs text-white/50 truncate mb-1.5">{song.artist}</p>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-purple-400 font-mono tracking-wider tabular-nums font-medium">
                {formatTimeDisplay(progress)} / {formatTimeDisplay(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => resumeSong(song)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <Play size={12} fill="currentColor" />
            <span>Resume</span>
          </button>
          
          <button
            onClick={() => {
              clearSongPlaybackPosition(song.id);
              localStorage.removeItem('sbg_continue_listening');
              setContinueState(null);
              playSong(song, undefined, undefined, 0);
            }}
            title="Start from beginning"
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        
        {/* Progress bar line at bottom */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </section>
  );
}
