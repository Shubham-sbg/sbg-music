import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  Filter, 
  Heart, 
  Plus, 
  Sparkles,
  Download
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { FALLBACK_SONGS } from '../data/fallbackCatalog';
import { Song } from '../types';

export default function Songs() {
  const { playSong, currentSong, isPlaying, addToQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const genres = ['All', 'Synthwave', 'Lo-Fi', 'Desi Hip-Hop', 'Ambient', 'Electronic', 'R&B / Soul'];

  const filteredSongs = FALLBACK_SONGS.filter((s) => {
    const matchesQuery = 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.album && s.album.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre = selectedGenre === 'All' || s.genre === selectedGenre;
    return matchesQuery && matchesGenre;
  });

  return (
    <div className="space-y-6 pb-28">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Music Catalog</h1>
          <p className="text-xs text-white/50">Explore lossless master tracks & royalty-free releases</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111118] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-purple-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Genre Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedGenre === g
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/5'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Songs Table / List */}
      <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
        {filteredSongs.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs">
            No tracks found matching your query.
          </div>
        ) : (
          filteredSongs.map((song: Song, index: number) => {
            const isCurrent = currentSong?.id === song.id;
            const liked = isFavorite(song.id);

            return (
              <div
                key={song.id}
                onClick={() => playSong(song, filteredSongs)}
                className={`p-3 sm:p-4 flex items-center justify-between gap-3 group cursor-pointer transition-colors ${
                  isCurrent ? 'bg-purple-900/15' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-4 text-center text-xs font-mono text-white/30 group-hover:text-purple-400">
                    {index + 1}
                  </span>

                  <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isCurrent && isPlaying ? (
                        <Pause className="w-4 h-4 fill-white text-white" />
                      ) : (
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
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
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
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
                  >
                    <Heart className={`w-4 h-4 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
