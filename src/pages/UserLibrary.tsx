import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Library, 
  Search, 
  Play, 
  Pause, 
  Trash2, 
  Plus, 
  Youtube, 
  Music, 
  ListMusic, 
  Heart, 
  Sparkles, 
  Loader2, 
  ArrowUpDown, 
  ListPlus, 
  Check, 
  WifiOff, 
  Download, 
  HardDrive,
  AlertCircle,
  RotateCcw,
  X,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { useOfflineStorage } from '../hooks/useOfflineStorage';
import ShareSongButton from '../components/ShareSongButton';
import { useSeo } from '../hooks/useSeo';
import { UserLibraryItem, UserPlaylist, Song } from '../types';
import { getUserLibrary, removeFromUserLibrary } from '../services/libraryService';
import { getUserPlaylists } from '../services/userPlaylistService';
import FavoriteButton from '../components/FavoriteButton';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import AuthModal from '../components/AuthModal';
import OfflineStorageManager from '../components/OfflineStorageManager';
import { getSongSourceType, isSongDownloadable, getSourceBadgeInfo } from '../utils/catalogUtils';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useNavigationVisibility } from '../lib/navigationSettings';

export default function UserLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: navVisibility } = useNavigationVisibility();
  const { currentSong, isPlaying, playSong, togglePlayPause, playPlaylist, activePlaylistId } = usePlayer();
  const { favorites } = useFavorites();

  const userId = user?.uid || (user as any)?.id;

  const {
    isOnline,
    offlineSongs,
    storageStats,
    downloadSong,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    getSongOfflineState,
    isSongDownloaded,
  } = useOfflineStorage(userId);

  useSeo({
    title: 'My Music Library | SBG MUSIC',
    description: 'Manage your personal music library, YouTube imports, and playlists on SBG MUSIC.',
    noIndex: true,
  });

  const [items, setItems] = useState<UserLibraryItem[]>([]);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [youtubePlaylists, setYoutubePlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'youtube' | 'sbg' | 'playlists' | 'favorites' | 'offline' | 'youtubePlaylists'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title' | 'artist'>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // States for YouTube playlists features
  const [showAddYtModal, setShowAddYtModal] = useState(false);
  const [ytPlaylistUrlInput, setYtPlaylistUrlInput] = useState('');
  const [addingYtPlaylist, setAddingYtPlaylist] = useState(false);
  const [selectedYtPlaylistDetail, setSelectedYtPlaylistDetail] = useState<any | null>(null);
  const [fetchingYtPlaylistDetail, setFetchingYtPlaylistDetail] = useState(false);
  const [showOfflineManagerModal, setShowOfflineManagerModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    if (!userId) {
      setItems([]);
      setPlaylists([]);
      setYoutubePlaylists([]);
      setLoading(false);
      return;
    }

    // Fast instant hydration from localStorage
    try {
      const storedYt = localStorage.getItem(`sbg_user_yt_playlists_${userId}`);
      if (storedYt) {
        const parsed = JSON.parse(storedYt);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setYoutubePlaylists(parsed);
        }
      }
    } catch {}

    setLoading(true);
    try {
      // Fetch each collection independently with error shielding so quota exhaustion on one does not blank out the entire screen
      const [libDataResult, plistDataResult, ytSnapResult] = await Promise.allSettled([
        getUserLibrary(userId, 100),
        getUserPlaylists(userId),
        getDocs(collection(db, 'users', userId, 'youtubePlaylists'))
      ]);

      if (libDataResult.status === 'fulfilled') {
        setItems(libDataResult.value);
      }

      if (plistDataResult.status === 'fulfilled') {
        setPlaylists(plistDataResult.value);
      }

      if (ytSnapResult.status === 'fulfilled') {
        const ytList: any[] = [];
        ytSnapResult.value.forEach((d) => {
          ytList.push({ id: d.id, ...d.data() });
        });
        setYoutubePlaylists(ytList);
        try {
          localStorage.setItem(`sbg_user_yt_playlists_${userId}`, JSON.stringify(ytList));
        } catch {}
      } else {
        console.warn('[UserLibrary] Using cached YouTube playlists due to network or quota limitation.');
      }
    } catch (err) {
      console.warn('Notice loading user library (serving from cache):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const extractPlaylistId = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/[&?]list=([^&]+)/) || trimmed.match(/playlist\/([^?\/]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{18,50}$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleAddYoutubePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !ytPlaylistUrlInput.trim()) return;

    const playlistId = extractPlaylistId(ytPlaylistUrlInput);
    if (!playlistId) {
      alert('Error: Invalid Playlist URL or Playlist ID format.');
      return;
    }

    setAddingYtPlaylist(true);
    try {
      const { fetchYouTubePlaylistServer } = await import('../lib/youtubeImportService');
      const meta = await fetchYouTubePlaylistServer(playlistId);
      
      if (!meta) {
        throw new Error('No metadata returned from YouTube.');
      }

      const docData = {
        playlistId,
        title: meta.title || 'Saved YouTube Playlist',
        channelTitle: meta.author || 'YouTube Channel',
        thumbnailUrl: meta.thumbnailUrl || '',
        youtubeUrl: `https://youtube.com/playlist?list=${playlistId}`,
        addedAt: Date.now()
      };

      // Optimistically update local cache and state
      setYoutubePlaylists((prev) => {
        const updated = [{ id: playlistId, ...docData }, ...prev.filter((p) => p.playlistId !== playlistId)];
        try {
          localStorage.setItem(`sbg_user_yt_playlists_${userId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Persist to Firestore
      try {
        await setDoc(doc(db, 'users', userId, 'youtubePlaylists', playlistId), docData);
      } catch (writeErr: any) {
        console.warn('[UserLibrary] Notice: Saved to local offline library (remote quota or network):', writeErr?.message || writeErr);
      }
      
      // Track analytics
      const { recordPlaylistInteraction } = await import('../services/analyticsService');
      recordPlaylistInteraction(playlistId, 'add_to_library', { playlistTitle: docData.title });

      setYtPlaylistUrlInput('');
      setShowAddYtModal(false);
      showToast(`YouTube Playlist "${docData.title}" added to your library!`);
    } catch (err: any) {
      console.error('Failed to save YouTube playlist:', err);
      alert(`Failed to add playlist: ${err.message || String(err)}`);
    } finally {
      setAddingYtPlaylist(false);
    }
  };

  const handleRemoveYoutubePlaylist = async (playlistId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    if (!window.confirm(`Are you sure you want to remove "${title}" from your library?`)) return;

    // Optimistically update state and local cache
    setYoutubePlaylists((prev) => {
      const filtered = prev.filter((p) => p.playlistId !== playlistId && p.id !== playlistId);
      try {
        localStorage.setItem(`sbg_user_yt_playlists_${userId}`, JSON.stringify(filtered));
      } catch {}
      return filtered;
    });

    try {
      await deleteDoc(doc(db, 'users', userId, 'youtubePlaylists', playlistId));
      showToast(`Removed "${title}" from your library.`);
    } catch (err: any) {
      console.warn('[UserLibrary] Remote delete failed or quota exceeded; kept local removal:', err?.message || err);
      showToast(`Removed "${title}" from your library.`);
    }
  };

  const handleOpenYoutubePlaylistDetail = async (playlistId: string, title: string) => {
    setFetchingYtPlaylistDetail(true);
    try {
      const { fetchYouTubePlaylistServer } = await import('../lib/youtubeImportService');
      const data = await fetchYouTubePlaylistServer(playlistId);
      if (data) {
        setSelectedYtPlaylistDetail(data);
        
        // Track analytics
        const { recordPlaylistInteraction } = await import('../services/analyticsService');
        recordPlaylistInteraction(playlistId, 'playlist_open', { playlistTitle: title });
      } else {
        showToast('Failed to fetch details for this playlist.');
      }
    } catch (err: any) {
      console.error('Failed to load YouTube playlist details:', err);
      showToast(`Failed to load details: ${err.message || String(err)}`);
    } finally {
      setFetchingYtPlaylistDetail(false);
    }
  };

  const handlePlayYoutubePlaylist = async (playlistId: string, title: string) => {
    try {
      showToast(`Loading YouTube Playlist: "${title}"...`);
      const { fetchYouTubePlaylistServer } = await import('../lib/youtubeImportService');
      const data = await fetchYouTubePlaylistServer(playlistId);
      if (data && data.videos && data.videos.length > 0) {
        const playlistSongs: Song[] = data.videos.map((v) => ({
          id: `yt_${v.videoId}`,
          title: v.title,
          artist: v.artist || 'YouTube Creator',
          thumbnailUrl: v.thumbnailUrl,
          coverUrl: v.thumbnailUrl,
          youtubeVideoId: v.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          duration: v.duration || 0,
          published: true,
          source: 'youtube',
        }));
        
        // Track analytics
        const { recordPlaylistInteraction } = await import('../services/analyticsService');
        recordPlaylistInteraction(playlistId, 'track_play', { playlistTitle: title });

        playPlaylist(playlistSongs, 0, playlistId);
        showToast(`Playing YouTube Playlist: "${title}"`);
      } else {
        showToast('This YouTube Playlist is empty or unavailable.');
      }
    } catch (err: any) {
      console.error('Failed to play YouTube Playlist:', err);
      showToast(`Playback failed: ${err.message || 'Check your internet connection.'}`);
    }
  };

  const handleRemove = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    setDeletingId(itemId);
    const success = await removeFromUserLibrary(userId, itemId);
    if (success) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
    }
    setDeletingId(null);
  };

  const handlePlayItem = (item: UserLibraryItem) => {
    const songObj: Song = {
      id: item.songId || item.id,
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnail || item.thumbnailUrl || item.coverUrl,
      coverUrl: item.coverUrl || item.thumbnail || item.thumbnailUrl,
      audioUrl: item.audioUrl,
      youtubeVideoId: item.youtubeVideoId,
      youtubeUrl: item.youtubeUrl || (item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : undefined),
      duration: item.duration,
      source: item.source,
      sourceType: getSongSourceType(item as any),
      downloadable: isSongDownloadable(item as any),
      published: true,
    };

    if (currentSong?.id === songObj.id || (songObj.youtubeVideoId && currentSong?.youtubeVideoId === songObj.youtubeVideoId)) {
      togglePlayPause();
      return;
    }

    // Set active queue to filtered library items
    const queueList: Song[] = filteredItems.map((it) => ({
      id: it.songId || it.id,
      title: it.title,
      artist: it.artist,
      thumbnailUrl: it.thumbnail || it.thumbnailUrl || it.coverUrl,
      coverUrl: it.coverUrl || it.thumbnail || it.thumbnailUrl,
      audioUrl: it.audioUrl,
      youtubeVideoId: it.youtubeVideoId,
      youtubeUrl: it.youtubeUrl || (it.youtubeVideoId ? `https://www.youtube.com/watch?v=${it.youtubeVideoId}` : undefined),
      duration: it.duration,
      source: it.source,
      sourceType: getSongSourceType(it as any),
      downloadable: isSongDownloadable(it as any),
      published: true,
    }));

    playSong(songObj, queueList);
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let list: UserLibraryItem[] = [];

    if (activeTab === 'offline') {
      list = offlineSongs.map((s) => ({
        id: s.songId,
        userId: userId || '',
        songId: s.songId,
        title: s.title,
        artist: s.artist,
        thumbnail: s.artwork,
        thumbnailUrl: s.artwork,
        coverUrl: s.artwork,
        audioUrl: s.audioUrl,
        duration: s.duration || 0,
        source: s.sourceType === 'SBG_CATALOG' ? 'sbg' : (s.sourceType === 'YOUTUBE' ? 'youtube' : 'upload'),
        addedAt: s.downloadedAt || Date.now(),
      }));
    } else {
      list = [...items];
      if (activeTab === 'youtube') {
        list = list.filter((i) => i.source === 'youtube' || Boolean(i.youtubeVideoId));
      } else if (activeTab === 'sbg') {
        list = list.filter((i) => i.source === 'sbg' && !i.youtubeVideoId);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.artist.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    } else if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist));
    }

    return list;
  }, [items, offlineSongs, activeTab, searchQuery, sortBy, userId]);

  const ytCount = items.filter((i) => i.source === 'youtube' || i.youtubeVideoId).length;
  const sbgCount = items.filter((i) => i.source === 'sbg' && !i.youtubeVideoId).length;
  const downloadedCount = offlineSongs.filter((s) => s.downloadStatus === 'downloaded').length;

  if (!user && activeTab !== 'offline') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-purple-400 shadow-xl">
          <Library size={36} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Your SBG Music Library</h1>
        <p className="text-white/60 max-w-md mx-auto mb-8 text-sm leading-relaxed">
          Sign in to save songs directly from YouTube, organize your favorites, download offline music, and create personalized playlists.
        </p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles size={18} />
          Sign In to Access Library
        </button>

        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
      {/* Offline Status Warning Banner */}
      {!isOnline && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-4 text-amber-300">
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold">You are currently offline</p>
              <p className="text-[11px] text-amber-300/80">
                Playing songs directly from your device local storage. No internet connection required.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('offline')}
            className="px-3 py-1.5 bg-amber-500 text-black text-xs font-bold rounded-xl whitespace-nowrap hover:bg-amber-400 transition-colors"
          >
            View Offline Tracks
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400">
              <Library size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">My SBG Library</h1>
              <p className="text-xs sm:text-sm text-white/50">
                Personal collection of YouTube imports, SBG catalog tracks, and device downloads
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {navVisibility.showGetApp !== false && (
            <Link
              to="/download"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/10 transition-all active:scale-95"
            >
              <Smartphone size={16} className="text-purple-400" />
              <span>Download APK</span>
            </Link>
          )}
          <button
            onClick={() => setShowAddYtModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Youtube size={16} />
            <span>Add YouTube Playlist</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            Create Playlist
          </button>
        </div>
      </div>

      {/* Stats Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">Total Saved</span>
          <span className="text-2xl font-bold text-white">{items.length}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">YouTube Imports</span>
          <span className="text-2xl font-bold text-purple-400 flex items-center gap-1.5">
            <Youtube size={20} />
            {ytCount}
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">SBG Tracks</span>
          <span className="text-2xl font-bold text-indigo-400 flex items-center gap-1.5">
            <Music size={20} />
            {sbgCount}
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">Offline Downloaded</span>
          <span className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5">
            <HardDrive size={20} />
            {downloadedCount}
          </span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            All Tracks ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('sbg')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sbg'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Music size={14} />
            SBG Catalog ({sbgCount})
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Youtube size={14} />
            YouTube ({ytCount})
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'offline'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <HardDrive size={14} className="text-emerald-400" />
            Downloads & Offline ({downloadedCount})
          </button>
          <button
            onClick={() => setActiveTab('youtubePlaylists')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'youtubePlaylists'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Youtube size={14} />
            <span>YouTube Playlists ({youtubePlaylists.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'playlists'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListMusic size={14} />
            Playlists ({playlists.length})
          </button>
          <Link
            to="/favorites"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all whitespace-nowrap"
          >
            <Heart size={14} className="text-red-400" />
            Favorites ({favorites.size})
          </Link>
        </div>

        {/* Search & Sort */}
        {activeTab !== 'playlists' && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in library..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white/70">
              <ArrowUpDown size={12} className="text-white/40" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="recent" className="bg-zinc-900 text-white">Recently Added</option>
                <option value="oldest" className="bg-zinc-900 text-white">Oldest Added</option>
                <option value="title" className="bg-zinc-900 text-white">Title (A-Z)</option>
                <option value="artist" className="bg-zinc-900 text-white">Artist (A-Z)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Offline Storage Metrics Banner (Only when activeTab === 'offline') */}
      {activeTab === 'offline' && !loading && (
        <div className="mb-6 p-5 rounded-2xl bg-[#111114] border border-emerald-500/20 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <HardDrive size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Device Storage & Offline Cache</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    {downloadedCount} {downloadedCount === 1 ? 'Song' : 'Songs'} Saved
                  </span>
                </h3>
                <p className="text-xs text-white/50">
                  Audio tracks are stored locally on your device via private IndexedDB for zero-data offline playback.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <span className="text-white/40 block text-[10px] uppercase">Storage Used</span>
                <span className="font-bold text-emerald-400">{storageStats?.formattedUsed || '0 MB'}</span>
              </div>
              <div className="h-6 w-px bg-white/10 hidden sm:block" />
              <div className="text-right">
                <span className="text-white/40 block text-[10px] uppercase">Available</span>
                <span className="font-bold text-white/80">{storageStats?.formattedAvailable || 'Unknown'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineManagerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ml-auto"
              >
                <HardDrive size={13} />
                <span>Manage Offline Files</span>
              </button>
            </div>
          </div>

          {/* Storage Bar */}
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, storageStats?.percentageUsed || 0))}%` }}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="text-purple-500 animate-spin" />
          <p className="text-xs text-white/40 font-mono uppercase tracking-wider">Loading your library...</p>
        </div>
      ) : activeTab === 'youtubePlaylists' ? (
        /* Saved YouTube Playlists View */
        <div>
          {youtubePlaylists.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] p-8">
              <Youtube size={40} className="mx-auto text-red-500/50 mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No Saved YouTube Playlists</h3>
              <p className="text-xs text-white/50 max-w-sm mx-auto mb-6">
                Add public YouTube playlists to your library to play them through our supported streaming integration.
              </p>
              <button
                onClick={() => setShowAddYtModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add YouTube Playlist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {youtubePlaylists.map((pl) => {
                const isPlActive = activePlaylistId === pl.playlistId;
                return (
                  <div
                    key={pl.playlistId}
                    onClick={() => handleOpenYoutubePlaylistDetail(pl.playlistId, pl.title)}
                    className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black/40 border border-white/5">
                        {pl.thumbnailUrl ? (
                          <img src={pl.thumbnailUrl} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <Youtube size={32} />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white uppercase tracking-wider">
                          YouTube
                        </div>

                        {/* Play Overlay */}
                        <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${isPlActive && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPlActive && isPlaying) {
                                togglePlayPause();
                              } else {
                                handlePlayYoutubePlaylist(pl.playlistId, pl.title);
                              }
                            }}
                            className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                          >
                            {isPlActive && isPlaying ? (
                              <Pause size={20} fill="currentColor" />
                            ) : (
                              <Play size={20} fill="currentColor" className="ml-0.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors truncate">
                        {pl.title}
                      </h4>
                      <p className="text-xs text-white/50 line-clamp-1 mb-2">
                        By {pl.channelTitle || 'YouTube Curator'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                      <button
                        onClick={(e) => handleRemoveYoutubePlaylist(pl.playlistId, pl.title, e)}
                        className="p-1.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Remove from Library"
                      >
                        <Trash2 size={14} />
                      </button>
                      <span className="text-red-400 group-hover:translate-x-0.5 transition-transform font-bold">Open Playlist →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'playlists' ? (
        /* User Playlists View */
        <div>
          {playlists.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] p-8">
              <ListMusic size={40} className="mx-auto text-white/20 mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No playlists yet</h3>
              <p className="text-xs text-white/50 max-w-sm mx-auto mb-6">
                Organize your favorite YouTube imports and SBG songs into custom playlists.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus size={14} />
                Create Your First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {playlists.map((pl) => (
                <Link
                  key={pl.id}
                  to={`/user-playlist/${pl.id}`}
                  className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black/40 border border-white/5">
                      {pl.coverUrl ? (
                        <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <ListMusic size={32} />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-medium text-white/80">
                        {pl.visibility === 'public' ? 'Public' : 'Private'}
                      </div>
                    </div>
                    <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors truncate">
                      {pl.name}
                    </h4>
                    <p className="text-xs text-white/50 line-clamp-1 mb-2">
                      {pl.description || `${pl.songCount || pl.items?.length || 0} tracks`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                    <span>{pl.songCount || pl.items?.length || 0} tracks</span>
                    <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty Tracks State */
        <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] p-8">
          {activeTab === 'offline' ? (
            <>
              <HardDrive size={48} className="mx-auto text-emerald-400/50 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No offline downloads yet</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto mb-6">
                Download eligible SBG Catalog songs to keep them stored directly in your device memory for zero-data listening.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/songs"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                  <Music size={14} />
                  Browse SBG Catalog
                </Link>
                {navVisibility.showGetApp !== false && (
                  <Link
                    to="/download"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-95"
                  >
                    <Smartphone size={14} />
                    Get Android APK
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <Library size={48} className="mx-auto text-white/20 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">
                {searchQuery ? 'No matching songs found' : 'Your library is empty'}
              </h3>
              <p className="text-xs text-white/50 max-w-md mx-auto mb-6">
                {searchQuery
                  ? `No tracks matching "${searchQuery}". Try a different keyword.`
                  : 'Add songs while searching YouTube or playing music to build your custom SBG library.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                  <Search size={14} />
                  Search & Add Songs
                </Link>
                <Link
                  to="/songs"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-95"
                >
                  <Music size={14} />
                  Browse Catalog
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Song List Grid */
        <div className="space-y-2">
          {filteredItems.map((item, index) => {
            const isThisPlaying =
              isPlaying &&
              (currentSong?.id === item.songId ||
                currentSong?.id === item.id ||
                (item.youtubeVideoId && currentSong?.youtubeVideoId === item.youtubeVideoId));

            const songObj: Song = {
              id: item.songId || item.id,
              title: item.title,
              artist: item.artist,
              thumbnailUrl: item.thumbnail || item.thumbnailUrl || item.coverUrl,
              coverUrl: item.coverUrl || item.thumbnail || item.thumbnailUrl,
              youtubeVideoId: item.youtubeVideoId,
              audioUrl: item.audioUrl,
              duration: item.duration,
              source: item.source,
              published: true,
            };

            const sourceBadge = getSourceBadgeInfo(songObj);
            const offlineState = getSongOfflineState(songObj.id);
            const downloaded = isSongDownloaded(songObj.id);
            const isEligible = isSongDownloadable(songObj);

            return (
              <div
                key={item.id}
                onClick={() => handlePlayItem(item)}
                className={`group flex items-center justify-between gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${
                  isThisPlaying
                    ? 'bg-purple-900/20 border-purple-500/40 shadow-sm'
                    : 'bg-[#111113] hover:bg-white/[0.06] border-white/5 hover:border-white/15'
                }`}
              >
                {/* Left: Number + Thumbnail + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-5 text-center text-xs font-mono text-white/30 group-hover:text-white/60">
                    {index + 1}
                  </span>

                  {/* Artwork */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/5">
                    {item.thumbnail || item.thumbnailUrl || item.coverUrl ? (
                      <img
                        src={item.thumbnail || item.thumbnailUrl || item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <Music size={18} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {isThisPlaying ? (
                        <Pause size={18} className="text-white" fill="white" />
                      ) : (
                        <Play size={18} className="text-white ml-0.5" fill="white" />
                      )}
                    </div>
                  </div>

                  {/* Title & Artist & Source Badge */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-bold truncate ${
                          isThisPlaying ? 'text-purple-400' : 'text-white group-hover:text-purple-300'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border flex items-center gap-1 ${sourceBadge.badgeClass}`}>
                        {sourceBadge.type === 'YOUTUBE' ? <Youtube size={10} /> : <Music size={10} />}
                        {sourceBadge.label}
                      </span>

                      {/* Download Status Badge */}
                      {downloaded && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase shrink-0 flex items-center gap-1">
                          <Check size={10} className="stroke-[3]" />
                          Downloaded
                        </span>
                      )}
                      {offlineState && offlineState.downloadStatus === 'downloading' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase shrink-0 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          Downloading ({offlineState.progress}%)
                        </span>
                      )}
                      {offlineState && offlineState.downloadStatus === 'paused' && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold uppercase shrink-0">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 truncate">{item.artist}</p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <ShareSongButton 
                    song={songObj} 
                    size={14} 
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-transparent hover:bg-white/5 border-none rounded-lg text-white/50 hover:text-white"
                  />
                  {item.songId && (
                    <FavoriteButton songId={item.songId} size={15} className="bg-transparent border-none p-2" />
                  )}

                  {/* Offline Download Button with Comprehensive Lifecycle */}
                  {isEligible ? (
                    downloaded ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Downloaded to device. Click to remove."
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteDownload(songObj.id);
                            showToast(`Removed "${item.title}" from device storage.`);
                          }}
                          className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                        >
                          <Check size={14} className="stroke-[3]" />
                        </button>
                      </div>
                    ) : offlineState?.downloadStatus === 'downloading' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Pause Download"
                          onClick={() => pauseDownload(songObj.id)}
                          className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                        >
                          <Pause size={14} />
                        </button>
                        <button
                          type="button"
                          title="Cancel Download"
                          onClick={() => cancelDownload(songObj.id)}
                          className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-red-400 border border-white/10 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : offlineState?.downloadStatus === 'paused' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Resume Download"
                          onClick={() => resumeDownload(songObj)}
                          className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          onClick={() => cancelDownload(songObj.id)}
                          className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-red-400 border border-white/10 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : offlineState?.downloadStatus === 'failed' ? (
                      <button
                        type="button"
                        title="Download failed. Click to retry."
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await downloadSong(songObj);
                          if (res.success) showToast(`Downloaded "${item.title}"`);
                        }}
                        className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all"
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Download for offline playback (User device storage)"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await downloadSong(songObj);
                          if (res.success) {
                            showToast(`Downloaded "${item.title}" to device storage!`);
                          } else if (res.error) {
                            showToast(res.error);
                          }
                        }}
                        className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                      >
                        <Download size={14} />
                      </button>
                    )
                  ) : (
                    /* Ineligible for download (e.g. YouTube streaming content) */
                    <div 
                      title={sourceBadge.unavailabilityNotice || "Offline download unavailable for this source."}
                      className="p-2 rounded-xl text-white/20 cursor-not-allowed"
                    >
                      <Download size={14} />
                    </div>
                  )}

                  <button
                    type="button"
                    id={`add-to-playlist-library-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSongForPlaylist(songObj);
                    }}
                    title="Add to Playlist"
                    className="px-2.5 py-1.5 bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/25 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <ListPlus size={14} />
                    <span className="hidden sm:inline">Add to Playlist</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleRemove(item.id, e)}
                    disabled={deletingId === item.id}
                    title="Remove from Library"
                    className="p-2 text-white/40 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
                  >
                    {deletingId === item.id ? (
                      <Loader2 size={16} className="animate-spin text-red-400" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
            showToast('Playlist created!');
          }}
        />
      )}

      {selectedSongForPlaylist && (
        <AddToPlaylistModal
          isOpen={Boolean(selectedSongForPlaylist)}
          songItem={selectedSongForPlaylist}
          onClose={() => setSelectedSongForPlaylist(null)}
          onSuccess={(pName) => showToast(`Added to "${pName}"!`)}
        />
      )}

      {/* Add YouTube Playlist Modal */}
      {showAddYtModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Youtube size={20} className="text-red-500" />
                <span>Add YouTube Playlist</span>
              </h3>
              <button
                onClick={() => setShowAddYtModal(false)}
                className="text-white/40 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddYoutubePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                  YouTube Playlist URL or ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://youtube.com/playlist?list=... or PL..."
                  value={ytPlaylistUrlInput}
                  onChange={(e) => setYtPlaylistUrlInput(e.target.value)}
                  disabled={addingYtPlaylist}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddYtModal(false)}
                  disabled={addingYtPlaylist}
                  className="px-4 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingYtPlaylist || !ytPlaylistUrlInput.trim()}
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center gap-1.5"
                >
                  {addingYtPlaylist ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add to Library</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YouTube Playlist Detail View Modal */}
      {selectedYtPlaylistDetail && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-start gap-4 justify-between bg-black/20">
              <div className="flex gap-4 items-center min-w-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                  {selectedYtPlaylistDetail.thumbnailUrl ? (
                    <img
                      src={selectedYtPlaylistDetail.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <Youtube size={28} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{selectedYtPlaylistDetail.title}</h3>
                  <p className="text-xs text-white/40 truncate">
                    Playlist by <strong className="text-white/60">{selectedYtPlaylistDetail.author || 'YouTube Curator'}</strong> • {selectedYtPlaylistDetail.totalVideos || selectedYtPlaylistDetail.videos?.length || 0} Tracks
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const isPlActive = activePlaylistId === selectedYtPlaylistDetail.id;
                    if (isPlActive && isPlaying) {
                      togglePlayPause();
                    } else {
                      handlePlayYoutubePlaylist(selectedYtPlaylistDetail.id, selectedYtPlaylistDetail.title);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                >
                  {activePlaylistId === selectedYtPlaylistDetail.id && isPlaying ? (
                    <>
                      <Pause size={14} fill="currentColor" />
                      <span>Pause Playlist</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" className="ml-0.5" />
                      <span>Play Playlist</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedYtPlaylistDetail(null)}
                  className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body / Videos List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0 divide-y divide-white/5 bg-black/10">
              {selectedYtPlaylistDetail.description && (
                <p className="text-xs text-white/50 bg-white/5 p-3 rounded-xl border border-white/5 mb-4 leading-relaxed">
                  {selectedYtPlaylistDetail.description}
                </p>
              )}

              {(selectedYtPlaylistDetail.videos || []).map((video: any, idx: number) => {
                const isThisPlaying = currentSong?.youtubeVideoId === video.videoId && isPlaying;
                return (
                  <div
                    key={video.videoId + '-' + idx}
                    onClick={() => {
                      const songObj: Song = {
                        id: `yt_${video.videoId}`,
                        title: video.title,
                        artist: video.artist || selectedYtPlaylistDetail.author || 'YouTube Creator',
                        thumbnailUrl: video.thumbnailUrl,
                        coverUrl: video.thumbnailUrl,
                        youtubeVideoId: video.videoId,
                        youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
                        audioUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
                        duration: video.duration || 0,
                        published: true,
                        source: 'youtube',
                      };
                      if (isThisPlaying) {
                        togglePlayPause();
                      } else {
                        const queueList: Song[] = selectedYtPlaylistDetail.videos.map((v: any) => ({
                          id: `yt_${v.videoId}`,
                          title: v.title,
                          artist: v.artist || selectedYtPlaylistDetail.author || 'YouTube Creator',
                          thumbnailUrl: v.thumbnailUrl,
                          coverUrl: v.thumbnailUrl,
                          youtubeVideoId: v.videoId,
                          youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                          audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                          duration: v.duration || 0,
                          published: true,
                          source: 'youtube',
                        }));
                        playSong(songObj, queueList, selectedYtPlaylistDetail.id);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isThisPlaying
                        ? 'bg-red-950/20 border-red-500/30'
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono text-xs text-white/30 w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/5 relative">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10">
                            <Youtube size={16} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          {isThisPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate ${isThisPlaying ? 'text-red-400' : 'text-white'}`}>{video.title}</h4>
                        <p className="text-[10px] text-white/40 truncate">{video.artist || selectedYtPlaylistDetail.author || 'YouTube Creator'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Offline Download Tooltip for YouTube tracks */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alert('Offline download unavailable for this source.');
                        }}
                        title="Offline download unavailable for this source."
                        className="p-1.5 text-white/20 hover:text-white/40 rounded transition-colors"
                      >
                        <Download size={13} />
                      </button>
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-white/30 hover:text-white rounded transition-colors"
                        title="Watch on YouTube"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-black/30 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedYtPlaylistDetail(null)}
                className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fetching YouTube Playlist Detail Overlay */}
      {fetchingYtPlaylistDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="text-red-500 animate-spin" />
          <p className="text-xs font-mono text-white/60 uppercase tracking-widest">Loading Playlist Tracks...</p>
        </div>
      )}

      {/* Manage Offline Files Modal */}
      {showOfflineManagerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#0e0e13] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 sticky top-0 bg-[#0e0e13]/95 backdrop-blur-lg z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Manage Offline Files</h2>
                  <p className="text-xs text-white/50">Local device cache, storage metrics, and offline tracks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineManagerModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <OfflineStorageManager />
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-white text-black font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center">
            <Check size={14} className="stroke-[3]" />
          </div>
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
