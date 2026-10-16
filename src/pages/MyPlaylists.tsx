import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';
import { getUserPlaylists } from '../services/userPlaylistService';
import { UserPlaylist, UserPlaylistItem, Song } from '../types';
import { useSeo } from '../hooks/useSeo';
import { 
  ListMusic, 
  Play, 
  Pause, 
  Plus, 
  Lock, 
  Globe, 
  Trash2, 
  Share2, 
  Loader2, 
  Sparkles, 
  User, 
  Check,
  Disc3,
  Search,
  Music,
  Heart,
  Radio,
  ArrowRight,
  ShieldCheck,
  Layers
} from 'lucide-react';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import AuthModal from '../components/AuthModal';

export default function MyPlaylists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playPlaylist, currentSong, isPlaying, togglePlayPause, activePlaylistId } = usePlayer();

  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useSeo({ title: 'My Playlists', noIndex: true });

  const fetchUserPlaylists = async () => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ownerId = user.uid || user.id;
      const list = await getUserPlaylists(ownerId);
      
      list.sort((a, b) => {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : ((a.updatedAt as any)?.toMillis ? (a.updatedAt as any).toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : ((a.createdAt as any)?.toMillis?.() || 0)));
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : ((b.updatedAt as any)?.toMillis ? (b.updatedAt as any).toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : ((b.createdAt as any)?.toMillis?.() || 0)));
        return timeB - timeA;
      });
      setPlaylists(list);
    } catch (err) {
      console.error('Failed to fetch user playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPlaylists();
  }, [user]);

  const handleDeletePlaylist = async (e: React.MouseEvent, playlistId: string, playlistName: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(`Are you sure you want to delete "${playlistName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(playlistId);
    try {
      await deleteDoc(doc(db, 'userPlaylists', playlistId));
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    } catch (err) {
      console.error('Failed to delete playlist:', err);
      alert('Failed to delete playlist. Please try again.');
    } finally {
      setDeletingId(null);
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

  const handlePlayPlaylist = (e: React.MouseEvent, pl: UserPlaylist) => {
    e.preventDefault();
    e.stopPropagation();

    if (activePlaylistId === pl.id && currentSong) {
      togglePlayPause();
      return;
    }

    const songs = (pl.items || []).map(convertItemToSong);
    if (songs.length > 0) {
      playPlaylist(songs, 0, pl.id);
    }
  };

  const handleShare = async (e: React.MouseEvent, pl: UserPlaylist) => {
    e.preventDefault();
    e.stopPropagation();

    const url = `${window.location.origin}/user-playlist/${pl.id}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(pl.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <ListMusic size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white tracking-tight">My Playlists</h1>
          <p className="text-sm text-white/50">
            Sign in to create, manage, and share your personal playlists across devices.
          </p>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="py-3.5 px-8 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-900/30 transition-all hover:scale-105 active:scale-95"
        >
          Sign In / Create Account
        </button>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Sign in to View Playlists"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
              USER LIBRARY
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">My Playlists</h1>
          <p className="text-white/40 text-sm mt-1">
            Manage your custom playlists and mixes ({playlists.length})
          </p>
        </div>

        <button
          id="create-playlist-header-btn"
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-3 rounded-2xl text-sm flex items-center gap-2.5 shadow-xl shadow-purple-900/20 hover:scale-[1.02] active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus size={18} />
          <span>+ Create Own Playlist</span>
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center text-white/40 text-sm flex items-center justify-center gap-3">
          <Loader2 size={22} className="animate-spin text-purple-400" />
          <span>Loading your playlists...</span>
        </div>
      ) : playlists.length === 0 ? (
        /* Empty State Illustration & Onboarding View */
        <div className="flex flex-col items-center justify-center py-10 px-4 max-w-4xl mx-auto w-full space-y-10 animate-in fade-in">
          {/* Visual Illustration Card */}
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#181524] via-[#121118] to-[#0c0c0e] border border-purple-500/20 rounded-3xl p-8 md:p-12 text-center shadow-2xl overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-44 bg-purple-600/15 blur-3xl pointer-events-none rounded-full" />
            <div className="absolute -bottom-10 right-10 w-48 h-48 bg-pink-600/10 blur-3xl pointer-events-none rounded-full" />

            {/* Composed Vinyl & Disc Illustration */}
            <div className="relative mx-auto w-36 h-36 md:w-44 md:h-44 mb-6 flex items-center justify-center">
              {/* Back Vinyl Record Accent */}
              <div className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full bg-zinc-950 border-4 border-zinc-800/80 shadow-2xl flex items-center justify-center translate-x-6 -translate-y-2 rotate-12 opacity-80">
                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white">
                    <Disc3 size={14} className="animate-spin" style={{ animationDuration: '8s' }} />
                  </div>
                </div>
              </div>

              {/* Main Playlist Card Graphic */}
              <div className="relative z-10 w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 border border-white/20 shadow-2xl flex flex-col items-center justify-center p-3 text-white -translate-x-3 translate-y-1">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black/30 backdrop-blur-md flex items-center justify-center mb-2 border border-white/15">
                  <ListMusic size={26} className="text-purple-200" />
                </div>
                {/* Audio Waves Simulation */}
                <div className="flex items-end gap-1 h-3 mt-1">
                  <span className="w-1 h-2 bg-white/70 rounded-full animate-pulse" style={{ animationDuration: '600ms' }} />
                  <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDuration: '900ms' }} />
                  <span className="w-1 h-1.5 bg-white/50 rounded-full animate-pulse" style={{ animationDuration: '750ms' }} />
                  <span className="w-1 h-3 bg-purple-200 rounded-full animate-pulse" style={{ animationDuration: '1100ms' }} />
                  <span className="w-1 h-2 bg-white/80 rounded-full animate-pulse" style={{ animationDuration: '850ms' }} />
                </div>
              </div>

              {/* Floating Floating Badges */}
              <div className="absolute -top-1 -left-2 z-20 bg-[#1e1b2e] border border-purple-500/40 text-purple-300 p-2 rounded-xl shadow-lg flex items-center gap-1.5 text-[10px] font-bold">
                <Sparkles size={12} className="text-purple-400" />
                <span>Custom Mix</span>
              </div>

              <div className="absolute -bottom-2 -right-1 z-20 bg-[#1e1b2e] border border-amber-500/40 text-amber-300 p-1.5 px-2.5 rounded-xl shadow-lg flex items-center gap-1.5 text-[10px] font-bold">
                <Lock size={11} className="text-amber-400" />
                <span>Private & Secure</span>
              </div>
            </div>

            {/* Prompt Text & Details */}
            <div className="relative z-10 max-w-lg mx-auto space-y-3">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Build Your First Custom Playlist
              </h2>
              <p className="text-sm text-white/60 leading-relaxed">
                Organize your favorite songs and YouTube video tracks into seamless listening mixes. Keep them strictly private for yourself or share public links with friends.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                id="create-first-playlist-btn"
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto py-3.5 px-7 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-purple-900/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={18} className="stroke-[2.5]" />
                <span>+ Create Your First Playlist</span>
              </button>

              <Link
                to="/search"
                className="w-full sm:w-auto py-3.5 px-6 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
              >
                <Search size={16} className="text-purple-400" />
                <span>Search & Discover Tracks</span>
              </Link>
            </div>
          </div>

          {/* Onboarding Quick Feature Guide Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div className="bg-[#121115] border border-white/5 hover:border-purple-500/20 p-5 rounded-2xl flex flex-col gap-3 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Layers size={18} />
              </div>
              <h3 className="font-bold text-white text-sm">Mix SBG & YouTube</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Add tracks directly from the official SBG catalog or any YouTube video stream into a single seamless playback queue.
              </p>
            </div>

            <div className="bg-[#121115] border border-white/5 hover:border-amber-500/20 p-5 rounded-2xl flex flex-col gap-3 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-bold text-white text-sm">Private or Public</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Choose private to keep your collection exclusive to your profile, or switch to public for shareable web links.
              </p>
            </div>

            <div className="bg-[#121115] border border-white/5 hover:border-pink-500/20 p-5 rounded-2xl flex flex-col gap-3 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <Heart size={18} />
              </div>
              <h3 className="font-bold text-white text-sm">Add Anywhere</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Click the "+ Add to Playlist" button on any song card across Search, Library, or Favorites to quickly grow your mixes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((pl) => {
            const isPlaylistActive = activePlaylistId === pl.id;
            const items = pl.items || [];
            const coverImage = pl.coverUrl || items[0]?.coverUrl || items[0]?.thumbnailUrl;

            return (
              <div
                key={pl.id}
                className="group bg-[#111112] p-5 md:p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 hover:bg-[#161618] transition-all shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between relative"
              >
                <Link to={`/user-playlist/${pl.id}`} className="block flex-1 flex flex-col">
                  {/* Artwork & Overlay */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-zinc-900 border border-white/10 shadow-md flex items-center justify-center">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={pl.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <ListMusic size={48} className="text-white/20 group-hover:scale-110 transition-transform duration-500" />
                    )}

                    {/* Visibility Badge */}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-1.5 text-[10px] font-bold text-white">
                      {pl.visibility === 'private' ? (
                        <>
                          <Lock size={12} className="text-amber-400" />
                          <span>PRIVATE</span>
                        </>
                      ) : (
                        <>
                          <Globe size={12} className="text-purple-400" />
                          <span>PUBLIC</span>
                        </>
                      )}
                    </div>

                    {/* Play Button Overlay */}
                    {items.length > 0 && (
                      <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${isPlaylistActive && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => handlePlayPlaylist(e, pl)}
                          className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                        >
                          {isPlaylistActive && isPlaying ? (
                            <Pause size={24} fill="currentColor" />
                          ) : (
                            <Play size={24} fill="currentColor" className="ml-1" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <h2 className="text-xl font-bold truncate mb-1 text-white group-hover:text-purple-400 transition-colors">
                    {pl.name}
                  </h2>
                  <p className="text-white/40 text-xs line-clamp-2 mb-4 flex-grow">
                    {pl.description || 'Custom user playlist.'}
                  </p>
                </Link>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="text-xs font-mono text-white/40">
                    {pl.songCount || items.length} TRACKS
                  </div>

                  <div className="flex items-center gap-2">
                    {pl.visibility === 'public' && (
                      <button
                        onClick={(e) => handleShare(e, pl)}
                        title="Share Playlist"
                        className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                      >
                        {copiedId === pl.id ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeletePlaylist(e, pl.id, pl.name)}
                      disabled={deletingId === pl.id}
                      title="Delete Playlist"
                      className="p-2 text-white/40 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
                    >
                      {deletingId === pl.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>

                    <Link
                      to={`/user-playlist/${pl.id}`}
                      className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newId) => {
            fetchUserPlaylists();
            navigate(`/user-playlist/${newId}`);
          }}
        />
      )}
    </div>
  );
}

