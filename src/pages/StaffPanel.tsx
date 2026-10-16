import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useSeo } from '../hooks/useSeo';
import { 
  Music, 
  ListMusic, 
  Youtube, 
  Sparkles, 
  Link as LinkIcon, 
  LogOut, 
  ShieldCheck, 
  Lock,
  ExternalLink
} from 'lucide-react';
import AdminSongs from './AdminSongs';
import AdminPlaylists from './AdminPlaylists';
import AdminYouTubeImport from './AdminYouTubeImport';
import AdminFeaturedControl from './AdminFeaturedControl';
import BackButton from '../components/BackButton';

export default function StaffPanel() {
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();
  useSeo({ title: 'Staff Portal', noIndex: true });
  
  // Available permissions checks
  const canAddSong = hasPermission('add_song');
  const canEditSong = hasPermission('edit_song');
  const canDeleteSong = hasPermission('delete_song');
  const canSongs = canAddSong || canEditSong || canDeleteSong;

  const canCreatePlaylist = hasPermission('create_playlist');
  const canEditPlaylist = hasPermission('edit_playlist');
  const canAddPlaylistSong = hasPermission('add_playlist_song');
  const canPlaylists = canCreatePlaylist || canEditPlaylist || canAddPlaylistSong;

  const canImportYoutube = hasPermission('import_youtube_playlist');
  const canManageFeatured = hasPermission('manage_featured') || hasPermission('manage_cta');

  // Determine initial active tab based on permissions
  const getInitialTab = () => {
    if (canSongs) return 'songs';
    if (canPlaylists) return 'playlists';
    if (canImportYoutube) return 'youtube';
    if (canManageFeatured) return 'featured';
    return 'none';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());

  if (!user) {
    return (
      <div className="p-8 text-center bg-[#111112] rounded-3xl border border-white/5 max-w-xl mx-auto my-12">
        <Lock size={48} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-xl font-bold mb-2 text-white">Staff Authentication Required</h2>
        <p className="text-white/40 text-sm mb-6">Staff credentials are required to access this portal.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/sbgadmin')}
            className="px-5 py-2.5 bg-white text-black text-xs font-bold rounded-xl transition-all hover:scale-105"
          >
            Go to Staff & Admin Login
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (user.role === 'user') {
    return (
      <div className="p-8 text-center bg-[#111112] rounded-3xl border border-red-500/20 max-w-xl mx-auto my-12">
        <Lock size={48} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold mb-2 text-white">Access Denied</h2>
        <p className="text-white/40 text-sm mb-6">Your account does not have staff or administrator privileges.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-white text-black text-xs font-bold rounded-xl transition-all hover:scale-105"
          >
            Return to Home
          </button>
          <button
            onClick={logout}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (user.status === 'disabled') {
    return (
      <div className="p-8 text-center bg-[#111112] rounded-3xl border border-red-500/20 max-w-xl mx-auto my-12">
        <Lock size={48} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-bold mb-2 text-red-300">Account Disabled</h2>
        <p className="text-white/40 text-sm">Your staff account has been disabled by an administrator. Contact support for access.</p>
        <button
          onClick={logout}
          className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <BackButton />
      
      {/* Staff Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-[#111112] to-zinc-900 p-6 rounded-3xl border border-blue-500/20 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-xl">
            {user.displayName?.[0]?.toUpperCase() || 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider">
                Staff Portal
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/40 uppercase tracking-wider">
                Active
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              Assigned permissions are strictly enforced. Restricted pages are hidden.
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all self-end sm:self-center"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Staff Authorized Navigation Tabs */}
      <div className="flex bg-[#111112] p-1.5 rounded-2xl border border-white/5 overflow-x-auto gap-1 scrollbar-none">
        {canSongs && (
          <button
            onClick={() => setActiveTab('songs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'songs'
                ? 'bg-white text-black shadow-lg scale-[1.02]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Music size={15} />
            <span>Manage Songs</span>
          </button>
        )}

        {canPlaylists && (
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'playlists'
                ? 'bg-white text-black shadow-lg scale-[1.02]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <ListMusic size={15} />
            <span>Playlists</span>
          </button>
        )}

        {canImportYoutube && (
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'youtube'
                ? 'bg-red-600 text-white shadow-lg scale-[1.02]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Youtube size={15} />
            <span>YouTube Import</span>
          </button>
        )}

        {canManageFeatured && (
          <button
            onClick={() => setActiveTab('featured')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'featured'
                ? 'bg-purple-600 text-white shadow-lg scale-[1.02]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={15} />
            <span>Featured Control</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'songs' && canSongs && (
          <AdminSongs onSwitchToImport={canImportYoutube ? () => setActiveTab('youtube') : undefined} />
        )}

        {activeTab === 'playlists' && canPlaylists && (
          <AdminPlaylists />
        )}

        {activeTab === 'youtube' && canImportYoutube && (
          <AdminYouTubeImport />
        )}

        {activeTab === 'featured' && canManageFeatured && (
          <AdminFeaturedControl />
        )}

        {activeTab === 'none' && (
          <div className="p-12 text-center bg-[#111112] rounded-3xl border border-white/5">
            <Lock size={40} className="mx-auto mb-3 text-white/30" />
            <h3 className="text-base font-bold text-white mb-1">No Active Permissions</h3>
            <p className="text-xs text-white/40 max-w-md mx-auto">
              Your staff account is currently active, but no operational permissions have been granted yet. Please ask an Administrator to update your access matrix.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
