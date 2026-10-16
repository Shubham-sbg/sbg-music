import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Music, Trash2 } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { usePlayer } from '../context/PlayerContext';
import { Song } from '../types';

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, removeFavorite } = useFavorites();
  const { playSong, currentSong } = usePlayer();

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Heart className="w-6 h-6 fill-pink-500 text-pink-500" />
            Favorite Songs
          </h1>
          <p className="text-xs text-white/50">{favorites.length} saved tracks in your personal library</p>
        </div>

        {favorites.length > 0 && (
          <button
            onClick={() => playSong(favorites[0], favorites)}
            className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-pink-900/40 cursor-pointer self-start sm:self-auto"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Play Favorites</span>
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="p-16 rounded-3xl bg-[#111118] border border-white/[0.06] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
            <Music className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No liked songs yet</h3>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Tap the heart icon on any song while listening to build your offline-accessible favorite tracklist.
          </p>
          <button
            onClick={() => navigate('/songs')}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 cursor-pointer"
          >
            Explore Music
          </button>
        </div>
      ) : (
        <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {favorites.map((song: Song, index: number) => {
            const isCurrent = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                onClick={() => playSong(song, favorites)}
                className={`p-3 sm:p-4 flex items-center justify-between gap-3 group cursor-pointer transition-colors ${
                  isCurrent ? 'bg-purple-900/15' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-4 text-center text-xs font-mono text-white/30">
                    {index + 1}
                  </span>

                  <img
                    src={song.coverUrl || '/pwa-192x192.png'}
                    alt={song.title}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                  />

                  <div className="min-w-0">
                    <h4 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-white/50 truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-white/40">
                    {Math.floor((song.duration || 0) / 60)}:{((song.duration || 0) % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(song.id);
                    }}
                    className="p-1.5 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove from favorites"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
