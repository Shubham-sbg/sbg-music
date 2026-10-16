import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  Edit3, 
  Library, 
  ListMusic, 
  Heart, 
  Calendar, 
  LogOut, 
  Share2, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ExternalLink,
  HardDrive,
  Download,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useFavorites } from '../context/FavoritesContext';
import { useSeo } from '../hooks/useSeo';
import { UserProfile, UserPlaylist, UserLibraryItem } from '../types';
import { getUserProfile, ensureUserProfile } from '../services/profileService';
import { getUserPlaylists } from '../services/userPlaylistService';
import { getUserLibrary } from '../services/libraryService';
import { OfflineDownloadService } from '../services/offlineDownloadService';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { useNavigationVisibility } from '../lib/navigationSettings';
import OfflineStorageManager from '../components/OfflineStorageManager';
import AuthModal from '../components/AuthModal';

export default function UserProfileView() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const { currentVersion, checkNow, isChecking, statusMessage } = useVersionCheck();
  const { settings: navVisibility } = useNavigationVisibility();

  const [activeTab, setActiveTab] = useState<'overview' | 'offline_storage'>('overview');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [libraryItems, setLibraryItems] = useState<UserLibraryItem[]>([]);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useSeo({
    title: profile?.displayName ? `${profile.displayName} (@${profile.username}) | SBG MUSIC` : 'User Profile | SBG MUSIC',
    description: profile?.bio || 'Music listener on SBG MUSIC.',
  });

  const userId = user?.uid || (user as any)?.id;

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        let p = await getUserProfile(userId);
        if (!p && user) {
          p = await ensureUserProfile({ uid: userId, email: user.email, displayName: user.displayName, photoURL: (user as any).photoURL });
        }
        if (isMounted) {
          setProfile(p);
        }

        const [pLists, lib, offlineTracks] = await Promise.all([
          getUserPlaylists(userId),
          getUserLibrary(userId, 10),
          OfflineDownloadService.getAllDownloadedTracks().catch(() => []),
        ]);

        if (isMounted) {
          setPlaylists(pLists);
          setLibraryItems(lib);
          setOfflineCount(offlineTracks.length);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    const unsubStorage = OfflineDownloadService.subscribeToStateChanges(() => {
      OfflineDownloadService.getAllDownloadedTracks().then((t) => setOfflineCount(t.length)).catch(() => {});
    });

    return () => {
      isMounted = false;
      unsubStorage();
    };
  }, [userId, user]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6 text-white/40 shadow-xl">
          <User size={36} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Listener Profile</h1>
        <p className="text-sm text-white/50 mb-8 max-w-sm mx-auto">
          Sign in to view your profile, manage your playlists, and track your personalized SBG Music library.
        </p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="px-8 py-3.5 bg-white text-black font-bold text-sm rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          Sign In with Google
        </button>

        {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-36">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-950/20 to-black/60 border border-white/10 rounded-3xl p-6 sm:p-10 mb-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-purple-500/40 bg-zinc-900 shadow-2xl flex items-center justify-center">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-white/40" />
              )}
            </div>
            {profile?.role === 'admin' || profile?.role === 'owner' ? (
              <span className="absolute bottom-0 right-0 p-1.5 bg-purple-600 rounded-full text-white border-2 border-black" title="Verified Admin">
                <ShieldCheck size={14} />
              </span>
            ) : null}
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {profile?.displayName || 'Music Listener'}
              </h1>
              {profile?.username && (
                <span className="text-xs sm:text-sm font-mono text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                  @{profile.username}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-white/50 mb-3 max-w-xl line-clamp-2">
              {profile?.bio || 'Music lover streaming on SBG MUSIC.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Joined {joinDate}
              </span>
              {user.email && (
                <span className="hidden sm:inline text-white/30">• {user.email}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-center sm:self-start">
            <Link
              to="/profile/edit"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all active:scale-95 shadow-sm"
            >
              <Edit3 size={14} />
              Edit Profile
            </Link>
            <button
              onClick={handleShare}
              title="Share profile link"
              className="p-2 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white rounded-xl border border-white/10 transition-all active:scale-90"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-2 bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 rounded-xl border border-white/10 transition-all active:scale-90"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Link
          to="/library"
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-2xl p-4 sm:p-5 transition-all text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <Library size={20} />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white block">{libraryItems.length}</span>
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Library Songs</span>
        </Link>

        <Link
          to="/library"
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 rounded-2xl p-4 sm:p-5 transition-all text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <ListMusic size={20} />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white block">{playlists.length}</span>
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Playlists</span>
        </Link>

        <Link
          to="/favorites"
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-2xl p-4 sm:p-5 transition-all text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <Heart size={20} />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white block">{favorites.size}</span>
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Favorites</span>
        </Link>

        <button
          onClick={() => setActiveTab('offline_storage')}
          className={`group bg-white/5 hover:bg-white/10 border ${activeTab === 'offline_storage' ? 'border-purple-500 bg-purple-500/10' : 'border-white/10'} hover:border-indigo-500/30 rounded-2xl p-4 sm:p-5 transition-all text-center cursor-pointer`}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <HardDrive size={20} />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white block">{offlineCount}</span>
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Offline Tracks</span>
        </button>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 mb-8 bg-black/40 border border-white/10 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <ListMusic size={15} />
          <span>Playlists & Library</span>
        </button>

        <button
          onClick={() => setActiveTab('offline_storage')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'offline_storage'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <HardDrive size={15} />
          <span>Offline Storage & Downloads ({offlineCount})</span>
        </button>
      </div>

      {activeTab === 'offline_storage' ? (
        <OfflineStorageManager />
      ) : (
        <>
          {/* User's Created Playlists Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListMusic size={18} className="text-purple-400" />
                <h2 className="text-lg font-bold text-white">Your Playlists</h2>
              </div>
              <Link to="/library" className="text-xs text-purple-400 hover:text-purple-300 font-semibold">
                View all ({playlists.length}) →
              </Link>
            </div>

            {playlists.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <p className="text-xs text-white/40 mb-3">You haven't created any playlists yet.</p>
                <Link
                  to="/library"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Go to Library to Create
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {playlists.slice(0, 3).map((pl) => (
                  <Link
                    key={pl.id}
                    to={`/user-playlist/${pl.id}`}
                    className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 transition-all flex items-center gap-3.5"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 flex items-center justify-center">
                      {pl.coverUrl ? (
                        <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <ListMusic size={20} className="text-white/20" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors truncate">
                        {pl.name}
                      </h4>
                      <p className="text-xs text-white/40 truncate">
                        {pl.songCount || pl.items?.length || 0} tracks • {pl.visibility === 'public' ? 'Public' : 'Private'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Library Additions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Library size={18} className="text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Recently Saved Tracks</h2>
              </div>
              <Link to="/library" className="text-xs text-purple-400 hover:text-purple-300 font-semibold">
                Open Library →
              </Link>
            </div>

            {libraryItems.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <p className="text-xs text-white/40 mb-3">No songs saved to your library yet.</p>
                <Link
                  to="/search"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Search YouTube & Catalog
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {libraryItems.slice(0, 4).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
                      {it.thumbnail || it.thumbnailUrl || it.coverUrl ? (
                        <img src={it.thumbnail || it.thumbnailUrl || it.coverUrl} alt={it.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <Library size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">{it.title}</h4>
                      <p className="text-[11px] text-white/50 truncate">{it.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Application Version & Update Center */}
      <div className="mt-12 bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Smartphone size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">SBG MUSIC Android App</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                v{currentVersion}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Production Release • Target SDK 34 (Android 14) • Universal ABI
            </p>
            {statusMessage && (
              <p className="text-xs text-purple-300 font-medium mt-1 animate-fadeIn">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => checkNow()}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isChecking ? 'animate-spin text-purple-400' : 'text-white/60'} />
            <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
          </button>

          {navVisibility.showGetApp !== false && (
            <Link
              to="/download"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Download size={13} />
              <span>Download APK</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
