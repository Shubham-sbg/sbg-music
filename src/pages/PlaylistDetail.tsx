import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, Shuffle, Clock, Heart, Plus, Loader2, RotateCcw } from 'lucide-react';
import { usePlaylistDetail } from '../hooks/useCatalog';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { Song } from '../types';

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying, addToQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { playlist, songs, loading, errorMsg, refetch } = usePlaylistDetail(id);

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  const handlePlayAll = (shuffle = false) => {
    if (songs.length === 0) return;
    const tracklist = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    playSong(tracklist[0], tracklist);
  };

  return (
    <div className="space-y-6 pb-28">
      <button
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Playlists</span>
      </button>

      {loading && !playlist ? (
        <div className="p-20 flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-xs">Loading playlist and tracks...</p>
        </div>
      ) : errorMsg && !playlist ? (
        <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/20 text-center space-y-3">
          <p className="text-red-200 text-xs">{errorMsg}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-red-800/50 hover:bg-red-800 text-white font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <>
          {/* Playlist Hero Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 rounded-3xl bg-gradient-to-b from-purple-950/40 via-purple-950/10 to-transparent border border-white/[0.06]">
            <img
              src={playlist?.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80'}
              alt={playlist?.title || playlist?.name}
              className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover shadow-2xl border border-white/10 shrink-0 bg-white/5"
            />
            <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                Official Playlist
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white truncate">
                {playlist?.title || playlist?.name || 'Curated Playlist'}
              </h1>
              <p className="text-xs sm:text-sm text-white/60 line-clamp-2 max-w-xl">
                {playlist?.description || 'Curated music compilation by SBG Music'}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono text-white/40">
                <span>{songs.length} tracks</span>
                {totalMinutes > 0 && (
                  <>
                    <span>•</span>
                    <span>approx. {totalMinutes} min</span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                <button
                  onClick={() => handlePlayAll(false)}
                  disabled={songs.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play All</span>
                </button>
                <button
                  onClick={() => handlePlayAll(true)}
                  disabled={songs.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 border border-white/10 cursor-pointer transition-all"
                >
                  <Shuffle className="w-4 h-4 text-purple-400" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tracklist Table */}
          <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            {songs.length === 0 ? (
              <div className="p-12 text-center text-white/40 text-xs">
                No tracks found in this playlist.
              </div>
            ) : (
              songs.map((song: Song, index: number) => {
                const isCurrent = currentSong?.id === song.id;
                const liked = isFavorite(song.id);

                return (
                  <div
                    key={song.id || index}
                    onClick={() => playSong(song, songs)}
                    className={`p-3 sm:p-4 flex items-center justify-between gap-3 group cursor-pointer transition-colors ${
                      isCurrent ? 'bg-purple-900/20' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-mono text-white/30 group-hover:text-purple-400 shrink-0">
                        {index + 1}
                      </span>

                      <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-white/5">
                        <img 
                          src={song.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80'} 
                          alt={song.title} 
                          className="w-full h-full object-cover" 
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {isCurrent && isPlaying ? (
                            <Pause className="w-4 h-4 fill-white text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-white/50 truncate">
                          {song.artist} {song.album ? `• ${song.album}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      {song.genre && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/50 hidden md:inline">
                          {song.genre}
                        </span>
                      )}

                      <span className="text-xs font-mono text-white/40">
                        {Math.floor((song.duration || 0) / 60)}:{((song.duration || 0) % 60).toString().padStart(2, '0')}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        className="p-1.5 text-white/30 hover:text-white transition-colors cursor-pointer"
                        title="Add to queue"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song);
                        }}
                        className="p-1.5 text-white/30 hover:text-pink-500 transition-colors cursor-pointer"
                        title={liked ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
