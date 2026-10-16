import React from 'react';
import { useRecentlyPlayed } from '../hooks/useRecentlyPlayed';
import { usePlayer } from '../context/PlayerContext';
import { usePlaybackPositions, formatTimeDisplay } from '../lib/playbackPosition';
import { Play, Pause, Loader2, RotateCcw, Clock } from 'lucide-react';

export default function RecentlyPlayedSection() {
  const { recentSongs } = useRecentlyPlayed();
  const { playSong, resumeSong, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering } = usePlayer();
  const { positions, clearPosition } = usePlaybackPositions();

  if (recentSongs.length === 0) return null;

  return (
    <section className="mb-10 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Recently Played
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Jump back in or resume where you left off</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {recentSongs.map((song) => {
          const isCurrentSong = currentSong?.id === song.id;
          const isCurrentPlaying = isCurrentSong && isPlaying;
          const isCurrentLoading = isCurrentSong && (isLoading || isBuffering);
          const songArtwork = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;
          
          const saved = positions[song.id];
          const hasUnfinishedPosition = !isCurrentPlaying && Boolean(
            saved && 
            saved.position > 3 && 
            (saved.duration <= 0 || (saved.duration - saved.position > 4))
          );
          
          const savedProgressPercent = saved && saved.duration > 0 
            ? Math.min(100, Math.max(0, (saved.position / saved.duration) * 100))
            : 0;

          return (
            <div 
              key={`recent-${song.id}`}
              className="group shrink-0 w-36 sm:w-44 bg-[#111112] p-3 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-[#18181A] transition-all shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between"
            >
              <div>
                {/* Artwork Container */}
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3 shadow-md bg-zinc-900 border border-white/5">
                  {songArtwork ? (
                    <img
                      src={songArtwork}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={song.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white/10">
                      <span className="font-bold text-3xl">?</span>
                    </div>
                  )}

                  {/* Unfinished / Resume Badge */}
                  {hasUnfinishedPosition && saved && (
                    <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-md text-purple-300 border border-purple-500/30 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Clock size={10} className="text-purple-400 shrink-0" />
                      <span>{formatTimeDisplay(saved.position)}</span>
                    </div>
                  )}

                  {/* Saved progress bar at bottom of thumbnail */}
                  {hasUnfinishedPosition && savedProgressPercent > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-10 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${savedProgressPercent}%` }}
                      />
                    </div>
                  )}
                  
                  {/* Hover Overlay Controls */}
                  <div className={`absolute inset-0 bg-black/60 transition-opacity flex flex-col items-center justify-center gap-2 p-2 ${isCurrentLoading || isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isCurrentPlaying ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayPause();
                        }}
                        title="Pause"
                        className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        <Pause size={20} fill="currentColor" />
                      </button>
                    ) : isCurrentLoading ? (
                      <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-black shadow-xl">
                        <Loader2 size={20} className="animate-spin text-black" />
                      </div>
                    ) : hasUnfinishedPosition && saved ? (
                      /* Resume and Restart Options */
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resumeSong(song);
                          }}
                          title={`Resume from ${formatTimeDisplay(saved.position)}`}
                          className="w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white py-1.5 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg hover:scale-102 active:scale-98 transition-all"
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Resume</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearPosition(song.id);
                            playSong(song, undefined, undefined, 0);
                          }}
                          title="Play from beginning"
                          className="text-[10px] text-white/70 hover:text-white flex items-center gap-1 py-1 hover:underline transition-colors"
                        >
                          <RotateCcw size={10} />
                          <span>Start Over</span>
                        </button>
                      </div>
                    ) : (
                      /* Standard Play Button */
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrentSong) {
                            togglePlayPause();
                          } else {
                            playSong(song);
                          }
                        }}
                        title="Play"
                        className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Title & Artist */}
                <h3 className="font-bold text-xs sm:text-sm line-clamp-2 text-white mb-0.5">
                  {song.title}
                </h3>
                <p className="text-white/40 text-[10px] sm:text-xs line-clamp-1">{song.artist}</p>
              </div>

              {/* Bottom status text if unfinished */}
              {hasUnfinishedPosition && saved && (
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-purple-400/90 font-mono">
                  <span>Resume at {formatTimeDisplay(saved.position)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
