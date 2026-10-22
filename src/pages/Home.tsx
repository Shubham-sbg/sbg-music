import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Sparkles, 
  Music, 
  ChevronRight, 
  Flame, 
  ListPlus, 
  Heart,
  Loader2,
  ListMusic
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePaginatedSongs, usePaginatedPlaylists } from '../hooks/useCatalog';
import { getActiveFeatured, UnifiedActiveFeaturedResult } from '../lib/featured';
import { Song, Playlist } from '../types';

import HomepageFeaturedHero from '../components/HomepageFeaturedHero';
import TrendingTagsSection from '../components/TrendingTagsSection';
import ContinueListeningSection from '../components/ContinueListeningSection';
import RecentlyPlayedSection from '../components/RecentlyPlayedSection';
import FavoriteSongsSection from '../components/FavoriteSongsSection';
import CommunityPlaylistsSection from '../components/CommunityPlaylistsSection';
import FavoriteButton from '../components/FavoriteButton';
import ShareSongButton from '../components/ShareSongButton';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import AdPlacementBanner from '../components/AdPlacementBanner';

export default function Home() {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying, togglePlayPause, addToQueue, isLoading, isBuffering } = usePlayer();
  const { isFavorite } = useFavorites();

  // Featured Release State
  const [featuredData, setFeaturedData] = useState<UnifiedActiveFeaturedResult | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Modal State for adding songs to playlists
  const [playlistModalItem, setPlaylistModalItem] = useState<Song | null>(null);

  // Real Catalog Songs & Playlists from Firestore
  const { songs, loading: songsLoading, errorMsg: songsError } = usePaginatedSongs(16);
  const { playlists, loading: playlistsLoading } = usePaginatedPlaylists(6);

  useEffect(() => {
    let isMounted = true;
    getActiveFeatured()
      .then((data) => {
        if (isMounted) {
          setFeaturedData(data);
          setFeaturedLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setFeaturedLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSongPlay = (song: Song) => {
    if (currentSong?.id === song.id) {
      togglePlayPause();
    } else {
      playSong(song, songs);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10 pb-28">
      {/* 1. HERO SHOWCASE / FEATURED RELEASE BANNER */}
      {featuredData?.config ? (
        <HomepageFeaturedHero
          activeFeatured={featuredData.config}
          song={featuredData.song}
          playlist={featuredData.playlist}
          loading={featuredLoading}
        />
      ) : featuredLoading ? (
        <div className="w-full bg-[#111116] border border-purple-500/20 rounded-2xl md:rounded-3xl p-6 sm:p-8 animate-pulse flex items-center gap-6 min-h-[180px]">
          <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-2xl bg-white/5 shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="w-32 h-5 rounded-full bg-purple-500/20" />
            <div className="w-2/3 h-8 rounded-xl bg-white/10" />
            <div className="w-1/2 h-4 rounded-lg bg-white/5" />
          </div>
        </div>
      ) : null}

      {/* 2. TRENDING DISCOVERY TAGS */}
      <TrendingTagsSection />

      {/* 3. CONTINUE LISTENING (Resumes playback where user paused) */}
      <ContinueListeningSection />

      {/* 4. RECENTLY PLAYED */}
      <RecentlyPlayedSection />

      {/* 5. FAVORITE SONGS */}
      <FavoriteSongsSection />

      {/* 6. POPULAR / CATALOG TRACKS (Real Firestore Songs) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>Popular Tracks</span>
            </h2>
            <p className="text-xs text-white/50">Top streaming master tracks from SBG Music</p>
          </div>

          <Link
            to="/songs"
            className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
          >
            <span>View All ({songs.length})</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {songsLoading && songs.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 rounded-2xl bg-[#111118] border border-white/5 animate-pulse flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white/5 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {songs.slice(0, 12).map((song) => {
              const isCurrent = currentSong?.id === song.id;
              const isCurrentPlaying = isCurrent && isPlaying;
              const isCurrentLoading = isCurrent && (isLoading || isBuffering);
              const artwork = song.coverUrl || song.thumbnailUrl || (song as any).imageUrl;

              return (
                <div
                  key={song.id}
                  onClick={() => handleSongPlay(song)}
                  className={`group relative p-3 rounded-2xl bg-[#111116] hover:bg-[#18181f] border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent 
                      ? 'border-purple-500/40 bg-purple-950/20 shadow-lg shadow-purple-950/30' 
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Artwork + Play Overlay */}
                    <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-white/10 shadow-sm">
                      {artwork ? (
                        <img
                          src={artwork}
                          alt={song.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <Music size={20} />
                        </div>
                      )}

                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                        isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {isCurrentLoading ? (
                          <Loader2 size={16} className="text-purple-400 animate-spin" />
                        ) : isCurrentPlaying ? (
                          <Pause size={16} fill="white" className="text-white" />
                        ) : (
                          <Play size={16} fill="white" className="text-white ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Song Details */}
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                        isCurrent ? 'text-purple-300' : 'text-white group-hover:text-purple-300'
                      }`} title={song.title}>
                        {song.title}
                      </h3>
                      <p className="text-[11px] text-white/50 truncate mt-0.5" title={song.artist}>
                        {song.artist}
                      </p>
                      {song.duration ? (
                        <span className="text-[10px] font-mono text-white/30 block mt-0.5">
                          {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <FavoriteButton songId={song.id} song={song} size={15} />
                    <button
                      onClick={() => setPlaylistModalItem(song)}
                      title="Add to Playlist"
                      className="p-1.5 text-white/40 hover:text-purple-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <ListPlus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 7. FEATURED & COMMUNITY PLAYLISTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-indigo-400" />
              <span>Curated Playlists</span>
            </h2>
            <p className="text-xs text-white/50">Hand-picked selections and official sound collections</p>
          </div>

          <Link
            to="/playlists"
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <span>Explore All</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {playlists.slice(0, 6).map((pl) => (
            <div
              key={pl.id}
              onClick={() => navigate(`/playlist/${pl.id}`)}
              className="group p-4 rounded-2xl bg-[#111118] hover:bg-white/[0.04] border border-white/5 hover:border-purple-500/30 transition-all duration-200 cursor-pointer space-y-3 shadow-lg"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10">
                <img
                  src={pl.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80'}
                  alt={pl.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform">
                    <Play size={16} fill="white" className="ml-0.5 text-white" />
                  </div>
                </div>
                {pl.songCount ? (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
                    {pl.songCount} tracks
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                  {pl.title}
                </h3>
                <p className="text-xs text-white/50 line-clamp-1 mt-0.5">
                  {pl.description || (pl.songCount ? `${pl.songCount} tracks` : 'Curated soundscape')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. COMMUNITY PLAYLISTS EXPANDED */}
      <CommunityPlaylistsSection showCommunityFeatured={true} />

      {/* 9. NON-INTRUSIVE AD PLACEMENT */}
      <AdPlacementBanner placement="footer" />

      {/* MODAL: ADD TO PLAYLIST */}
      {playlistModalItem && (
        <AddToPlaylistModal
          isOpen={Boolean(playlistModalItem)}
          onClose={() => setPlaylistModalItem(null)}
          songItem={playlistModalItem}
          onSuccess={() => setPlaylistModalItem(null)}
        />
      )}
    </div>
  );
}
