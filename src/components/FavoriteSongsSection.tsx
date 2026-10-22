import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';
import { usePlayer } from '../context/PlayerContext';
import { fetchAllFirestoreSongs } from '../hooks/useCatalog';
import { Song } from '../types';
import { Play, Pause, Heart, Music, ChevronRight, Loader2, ListPlus, Youtube } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ShareSongButton from './ShareSongButton';

export default function FavoriteSongsSection() {
  const { favorites, favoriteMeta } = useFavorites();
  const { playSong, currentSong, isPlaying, togglePlayPause, addToQueue, isLoading, isBuffering } = usePlayer();
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFavorites() {
      if (favorites.size === 0) {
        if (isMounted) {
          setFavoriteSongs([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const allSongs = await fetchAllFirestoreSongs();
        if (!isMounted) return;

        const catalogMap = new Map<string, Song>();
        allSongs.forEach((s) => catalogMap.set(s.id, s));

        const result: Song[] = [];
        const seenIds = new Set<string>();

        for (const fav of Array.from(favorites)) {
          const favId = typeof fav === 'string' ? fav : (fav as any).id;
          if (!favId || seenIds.has(favId)) continue;
          seenIds.add(favId);

          if (catalogMap.has(favId)) {
            result.push(catalogMap.get(favId)!);
          } else if (typeof fav === 'object' && fav.title) {
            result.push(fav as Song);
          } else {
            const meta = favoriteMeta instanceof Map ? favoriteMeta.get(favId) : (favoriteMeta ? (favoriteMeta as any)[favId] : null);
            const isYt = favId.startsWith('yt_') || meta?.source === 'youtube' || Boolean(meta?.youtubeVideoId);
            const ytId = meta?.youtubeVideoId || (favId.startsWith('yt_') ? favId.replace('yt_', '') : undefined);
            const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';

            const fallbackSong: Song = {
              id: favId,
              title: meta?.title || (isYt ? 'YouTube Track' : 'Liked Track'),
              artist: meta?.artist || (isYt ? 'YouTube Music' : 'Unknown Artist'),
              coverUrl: meta?.coverUrl || meta?.thumbnailUrl || ytThumb,
              thumbnailUrl: meta?.thumbnailUrl || meta?.coverUrl || ytThumb,
              audioUrl: meta?.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined),
              youtubeVideoId: ytId,
              youtubeUrl: meta?.youtubeUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined),
              duration: meta?.duration || 0,
              published: true,
              source: isYt ? 'youtube' : 'upload',
            };
            result.push(fallbackSong);
          }
        }

        setFavoriteSongs(result);
      } catch (err) {
        console.warn('Failed to load favorite songs for home section', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFavorites();
    return () => {
      isMounted = false;
    };
  }, [favorites, favoriteMeta]);

  if (!loading && favoriteSongs.length === 0) {
    return (
      <section className="bg-gradient-to-r from-pink-950/20 via-[#111112] to-[#111112] p-5 md:p-6 rounded-2xl border border-pink-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
            <Heart size={20} fill="currentColor" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Your Favorite Songs</h3>
            <p className="text-white/40 text-xs mt-0.5">Click the heart icon on any song or YouTube track to quickly access your favorites here.</p>
          </div>
        </div>
        <Link
          to="/songs"
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium text-xs rounded-xl border border-white/10 transition-colors shrink-0 flex items-center gap-1"
        >
          <span>Explore Songs</span>
          <ChevronRight size={14} />
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500">
            <Heart size={18} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Your Favorites
            </h2>
            <p className="text-xs text-white/40">Quick access to your liked catalog and YouTube tracks</p>
          </div>
        </div>

        <Link
          to="/favorites"
          className="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1 group"
        >
          <span>See All ({favoriteSongs.length})</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-white/40 gap-2 text-xs">
          <Loader2 size={16} className="animate-spin text-pink-400" />
          <span>Loading favorites...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {favoriteSongs.slice(0, 5).map((song) => {
            const isCurrentPlaying = (currentSong?.id === song.id || currentSong?.youtubeVideoId === song.youtubeVideoId) && isPlaying;
            const isCurrentLoading = (currentSong?.id === song.id || currentSong?.youtubeVideoId === song.youtubeVideoId) && (isLoading || isBuffering);
            const displayImage = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;
            const isYt = song.source === 'youtube' || Boolean(song.youtubeVideoId) || song.id.startsWith('yt_');

            return (
              <div
                key={song.id}
                className="group bg-[#111112] p-3 rounded-2xl border border-white/5 hover:border-pink-500/30 hover:bg-[#18181A] transition-all shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-zinc-900 border border-white/5">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt={song.title}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music size={28} className="text-white/20" />
                      </div>
                    )}

                    {/* Top Left YouTube Badge */}
                    {isYt && (
                      <div className="absolute top-2 left-2 z-10 bg-red-600 text-white font-bold text-[8px] px-1 py-0.5 rounded uppercase tracking-wider shadow flex items-center gap-0.5">
                        <Youtube size={9} />
                        <span>YT</span>
                      </div>
                    )}

                    {/* Top Right Favorite & Share Buttons */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                      <FavoriteButton songId={song.id} song={song} size={13} />
                      <ShareSongButton song={song} size={12} variant="card" />
                    </div>

                    {/* Play Overlay */}
                    <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${isCurrentLoading || isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        onClick={() => {
                          if (currentSong?.id === song.id || (song.youtubeVideoId && currentSong?.youtubeVideoId === song.youtubeVideoId)) {
                            togglePlayPause();
                          } else {
                            playSong(song, favoriteSongs);
                          }
                        }}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        {isCurrentLoading && !isPlaying ? (
                          <Loader2 size={18} className="animate-spin text-black" />
                        ) : isCurrentPlaying ? (
                          <Pause size={18} fill="currentColor" />
                        ) : (
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        title="Add to Queue"
                        className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:scale-105 active:scale-95"
                      >
                        <ListPlus size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-xs truncate text-white mb-0.5" title={song.title}>{song.title}</h3>
                  <p className="text-white/40 text-[11px] truncate" title={song.artist}>{song.artist}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
