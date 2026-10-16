import React, { useEffect, useState } from 'react';
import { getApprovedFeaturedPlaylists, syncOfflineQueue } from '../lib/communityPlaylistService';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { CommunityPlaylist, UserPlaylist, UserPlaylistItem, Song } from '../types';
import FeaturedPlaylistCard from './FeaturedPlaylistCard';
import SubmitPlaylistModal from './SubmitPlaylistModal';
import { WifiOff, Loader2, Play, Globe, ListMusic, AlertTriangle } from 'lucide-react';
import { getCachedData, dedupeRequest } from '../lib/cache';
import { Link } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

interface Props {
  showCommunityFeatured?: boolean;
}

export default function CommunityPlaylistsSection({ showCommunityFeatured = false }: Props) {
  const cachedInitial = getCachedData<CommunityPlaylist[]>('approved_featured_playlists');
  const [playlists, setPlaylists] = useState<CommunityPlaylist[]>(() => cachedInitial || []);
  const [userPublicPlaylists, setUserPublicPlaylists] = useState<UserPlaylist[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(() => showCommunityFeatured && (!cachedInitial || cachedInitial.length === 0));
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const { playPlaylist } = usePlayer();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
      loadPlaylists();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadPlaylists();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showCommunityFeatured]);

  const loadPlaylists = async () => {
    try {
      if (showCommunityFeatured) {
        if (playlists.length === 0) {
          setLoading(true);
        }
        const data = await getApprovedFeaturedPlaylists();
        setPlaylists(data);
      }

      // Fetch public user created playlists with deduplication & limit to minimize read usage
      const publicList = await dedupeRequest<UserPlaylist[]>(
        'public_user_playlists_home',
        async () => {
          const q = query(
            collection(db, 'userPlaylists'), 
            where('visibility', '==', 'public'),
            limit(8)
          );
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserPlaylist));
        },
        180000 // Cache for 3 minutes to avoid hammering Firestore
      );
      setUserPublicPlaylists(publicList);
      setQuotaExceeded(false);
    } catch (e: any) {
      console.error('Failed to load community playlists:', e);
      const errorMsg = String(e?.message || e).toLowerCase();
      if (errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setQuotaExceeded(true);
      }
    } finally {
      if (showCommunityFeatured) setLoading(false);
    }
  };

  const convertItemToSong = (item: UserPlaylistItem): Song => {
    return {
      id: item.songId || (item.youtubeVideoId ? `yt_${item.youtubeVideoId}` : item.id),
      title: item.title,
      artist: item.artist,
      youtubeVideoId: item.youtubeVideoId,
      youtubeUrl: item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : undefined,
      coverUrl: item.coverUrl || item.thumbnailUrl || (item.youtubeVideoId ? `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg` : undefined),
      thumbnailUrl: item.thumbnailUrl || item.coverUrl || (item.youtubeVideoId ? `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg` : undefined),
      audioUrl: item.audioUrl || (item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : undefined),
      duration: item.duration || 0,
      published: true,
      source: item.source === 'youtube' ? 'youtube' : 'upload',
    };
  };

  const handlePlayPublicPlaylist = (e: React.MouseEvent, pl: UserPlaylist) => {
    e.preventDefault();
    e.stopPropagation();
    const songs = (pl.items || []).map(convertItemToSong);
    if (songs.length > 0) {
      playPlaylist(songs, 0, pl.id);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6 pt-4 border-t border-white/5">
      {quotaExceeded && (
        <div className="bg-[#1c1214] border border-red-500/20 p-4 sm:p-6 rounded-2xl space-y-3 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-red-400">Database Quota Notice</h4>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                The free daily read quota for this project has been reached. Operations will resume automatically tomorrow, or you can enable billing in your console.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Public User Created Playlists */}
      {userPublicPlaylists.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-purple-400" />
              <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">Public User Playlists</h3>
            </div>
            <Link to="/playlists" className="text-xs font-semibold text-purple-400 hover:text-purple-300">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {userPublicPlaylists.map((pl) => {
              const items = pl.items || [];
              const coverImg = pl.coverUrl || items[0]?.coverUrl || items[0]?.thumbnailUrl;

              return (
                <div
                  key={pl.id}
                  className="group bg-[#111112] p-3 rounded-xl sm:rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all flex flex-col justify-between"
                >
                  <Link to={`/user-playlist/${pl.id}`} className="block flex-1">
                    <div className="relative aspect-video rounded-lg sm:rounded-xl overflow-hidden mb-2 bg-zinc-900 border border-white/10 flex items-center justify-center">
                      {coverImg ? (
                        <img src={coverImg} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <ListMusic size={28} className="text-white/20" />
                      )}
                      {items.length > 0 && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => handlePlayPublicPlaylist(e, pl)}
                            aria-label={`Play playlist ${pl.name}`}
                            className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                          >
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-purple-400 transition-colors">
                      {pl.name}
                    </h4>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">
                      By {pl.ownerName || 'User'} • {pl.songCount || items.length} tracks
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Featured Playlists */}
      {showCommunityFeatured && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base sm:text-xl font-bold text-white">Community Featured Playlists</h3>
            {isOffline && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold">
                <WifiOff size={12} /> Offline Mode
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8 text-white/40">
              <Loader2 className="animate-spin text-purple-400" size={24} />
            </div>
          ) : playlists.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {playlists.map(pl => <FeaturedPlaylistCard key={pl.id} playlist={pl} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
