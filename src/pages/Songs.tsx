import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  Heart, 
  Plus, 
  Sparkles,
  RotateCcw,
  Music,
  Loader2
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePaginatedSongs } from '../hooks/useCatalog';
import { Song } from '../types';

export default function Songs() {
  const { playSong, currentSong, isPlaying, addToQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { songs, loading, errorMsg, refetch } = usePaginatedSongs(200);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [displayCount, setDisplayCount] = useState(50);

  // Dynamic genres extracted from actual songs catalog
  const genres = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.genre && typeof s.genre === 'string' && s.genre.trim()) {
        set.add(s.genre.trim());
      }
    });
    const sorted = Array.from(set).sort();
    return ['All', ...sorted];
  }, [songs]);

  // Filtered tracks
  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return songs.filter((s) => {
      const matchesQuery = 
        !q ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q)) ||
        (s.album && s.album.toLowerCase().includes(q));

      const matchesGenre = selectedGenre === 'All' || s.genre === selectedGenre;
      return matchesQuery && matchesGenre;
    });
  }, [songs, searchQuery, selectedGenre]);

  const visibleSongs = useMemo(() => {
    return filteredSongs.slice(0, displayCount);
  }, [filteredSongs, displayCount]);

  const hasMore = displayCount < filteredSongs.length;

  return (
    <div className="space-y-6 pb-28">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white">Music Catalog</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
              {loading && songs.length === 0 ? 'Loading...' : `${songs.length} Tracks`}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Official SBG Music releases, lossless streams, and curated tracks
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog by title, artist, or album..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111118] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 outline-none focus:border-purple-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Genre Filter Chips */}
      {genres.length > 1 && (
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
      )}

      {/* Error state */}
      {errorMsg && songs.length === 0 && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 flex items-center justify-between gap-3 text-red-200 text-xs">
          <span>{errorMsg}</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-800/40 hover:bg-red-800/60 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Songs Table / List */}
      <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
        {loading && songs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <p className="text-xs">Loading SBG Music catalog...</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="p-16 text-center text-white/40 text-xs space-y-2">
            <Music className="w-8 h-8 mx-auto text-white/20 mb-2" />
            <p className="font-semibold text-white/70">No tracks found</p>
            <p>Try adjusting your search query or genre filter.</p>
          </div>
        ) : (
          visibleSongs.map((song: Song, index: number) => {
            const isCurrent = currentSong?.id === song.id;
            const liked = isFavorite(song.id);

            return (
              <div
                key={song.id}
                onClick={() => playSong(song, filteredSongs)}
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

      {/* Pagination Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setDisplayCount((prev) => prev + 50)}
            className="px-6 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs border border-white/10 transition-colors cursor-pointer"
          >
            Load More Tracks ({filteredSongs.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
