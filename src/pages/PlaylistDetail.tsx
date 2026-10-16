import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, ArrowLeft, Shuffle, Clock, Heart } from 'lucide-react';
import { FALLBACK_PLAYLISTS, FALLBACK_SONGS } from '../data/fallbackCatalog';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { Song, Playlist } from '../types';

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  let playlist: Playlist | undefined = FALLBACK_PLAYLISTS.find((p) => p.id === id);

  if (!playlist) {
    try {
      const stored = localStorage.getItem('sbg_user_custom_playlists');
      if (stored) {
        const custom: Playlist[] = JSON.parse(stored);
        playlist = custom.find((p) => p.id === id);
      }
    } catch {}
  }

  const songs: Song[] = playlist?.songs || FALLBACK_SONGS;

  return (
    <div className="space-y-6 pb-28">
      <button
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Playlists</span>
      </button>

      {/* Playlist Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 rounded-3xl bg-gradient-to-b from-purple-950/40 to-transparent border border-white/[0.06]">
        <img
          src={playlist?.coverUrl || FALLBACK_PLAYLISTS[0].coverUrl}
          alt={playlist?.title}
          className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover shadow-2xl border border-white/10 shrink-0"
        />
        <div className="space-y-3 text-center sm:text-left">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Playlist</span>
          <h1 className="text-2xl sm:text-4xl font-black text-white">{playlist?.title || 'Editorial Playlist'}</h1>
          <p className="text-xs sm:text-sm text-white/60 max-w-xl">{playlist?.description || 'Curated music stream'}</p>
          <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
            <button
              onClick={() => songs.length > 0 && playSong(songs[0], songs)}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play All</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
        {songs.map((song: Song, index: number) => {
          const isCurrent = currentSong?.id === song.id;
          const liked = isFavorite(song.id);

          return (
            <div
              key={song.id}
              onClick={() => playSong(song, songs)}
              className={`p-3 sm:p-4 flex items-center justify-between gap-3 group cursor-pointer transition-colors ${
                isCurrent ? 'bg-purple-900/15' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-4 text-center text-xs font-mono text-white/30 group-hover:text-purple-400">
                  {index + 1}
                </span>

                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                  </div>
                </div>

                <div className="min-w-0">
                  <h4 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                    {song.title}
                  </h4>
                  <p className="text-[11px] text-white/50 truncate">{song.artist}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono text-white/40">
                  {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(song);
                  }}
                  className="p-1.5 text-white/30 hover:text-pink-500 transition-colors cursor-pointer"
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
