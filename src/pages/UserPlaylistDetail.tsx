import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';
import { UserPlaylist, UserPlaylistItem, Song } from '../types';
import ShareSongButton from '../components/ShareSongButton';
import { useSeo } from '../hooks/useSeo';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  ListMusic, 
  Volume2, 
  Loader2, 
  ListPlus, 
  Share2, 
  Check, 
  Lock, 
  Globe, 
  Trash2, 
  Edit3, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Shuffle, 
  Sparkles,
  Search,
  CopyPlus
} from 'lucide-react';
import FavoriteButton from '../components/FavoriteButton';
import BackButton from '../components/BackButton';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import AddMoreSongsModal from '../components/AddMoreSongsModal';
import SharePlaylistModal from '../components/SharePlaylistModal';
import CopyPlaylistModal from '../components/CopyPlaylistModal';
import AuthModal from '../components/AuthModal';

export default function UserPlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playPlaylist, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering, addToQueue, activePlaylistId } = usePlayer();

  const ssrUserPlaylist = typeof window !== 'undefined' && (window as any).__INITIAL_SSR_DATA__?.userPlaylist?.id === id
    ? (window as any).__INITIAL_SSR_DATA__.userPlaylist
    : null;
  const [playlist, setPlaylist] = useState<UserPlaylist | null>(() => ssrUserPlaylist);
  const [loading, setLoading] = useState(() => !ssrUserPlaylist);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Modal States
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isPublic = playlist?.visibility === 'public' || playlist?.isPublic === true;

  useSeo({
    title: playlist ? `${playlist.name || playlist.title} — Community Playlist` : 'User Playlist',
    description: playlist?.description || 'Custom playlist on SBG MUSIC.',
    noIndex: !isPublic,
    canonicalUrl: id && isPublic ? `${window.location.origin}/user-playlist/${id}` : undefined,
  });

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Songs State
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);

  const fetchPlaylist = async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const docRef = doc(db, 'userPlaylists', id);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setErrorMsg('Playlist not found or has been deleted.');
        setPlaylist(null);
        return;
      }

      const data = { id: snap.id, ...snap.data() } as UserPlaylist;
      const currentUserId = user?.uid || user?.id;

      // Strict Private Security Check
      if (data.visibility === 'private' && data.ownerId !== currentUserId && data.uid !== currentUserId) {
        setErrorMsg('Private Playlist — This playlist is private and can only be viewed by its owner.');
        setPlaylist(null);
        return;
      }

      setPlaylist(data);
      setEditName(data.name || '');
      setEditDescription(data.description || '');
    } catch (err: any) {
      console.error('Error fetching playlist:', err);
      setErrorMsg(err.message || 'Failed to load playlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [id, user?.uid]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-white/40 gap-3">
        <Loader2 size={24} className="animate-spin text-purple-400" />
        <span className="text-sm font-medium">Loading playlist...</span>
      </div>
    );
  }

  if (errorMsg || !playlist) {
    return (
      <div className="text-center py-20 bg-[#111112] rounded-3xl border border-white/5 max-w-xl mx-auto space-y-4 p-8">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">Access Restricted</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto">{errorMsg || 'Playlist unavailable.'}</p>
        <Link
          to="/my-playlists"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg text-sm mt-2"
        >
          <ArrowLeft size={18} />
          <span>Back to My Playlists</span>
        </Link>
      </div>
    );
  }

  const currentUserId = user?.uid || user?.id;
  const isOwner = Boolean(currentUserId && playlist.ownerId === currentUserId);
  const items = playlist.items || [];

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

  const songs = items.map(convertItemToSong);
  const isPlaylistActive = Boolean(id && activePlaylistId === id) || songs.some((s) => s.id === currentSong?.id);
  const isPlaylistLoading = isPlaylistActive && (isLoading || isBuffering);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    if (activePlaylistId === id && isPlaylistActive && isPlaying) {
      togglePlayPause();
    } else {
      playPlaylist(songs, 0, id);
    }
  };

  const handleShufflePlay = () => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    playPlaylist(shuffled, 0, id);
  };

  const handleAddAllToQueue = () => {
    if (songs.length === 0) return;
    songs.forEach((s) => addToQueue(s));
  };

  const handleToggleVisibility = async () => {
    if (!isOwner || !id) return;
    const newVisibility = playlist.visibility === 'public' ? 'private' : 'public';
    try {
      await updateDoc(doc(db, 'userPlaylists', id), {
        visibility: newVisibility,
        updatedAt: serverTimestamp(),
      });
      setPlaylist((prev) => prev ? { ...prev, visibility: newVisibility } : null);
    } catch (err) {
      console.error('Failed to update visibility:', err);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !id || !editName.trim()) return;

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'userPlaylists', id), {
        name: editName.trim(),
        description: editDescription.trim(),
        updatedAt: serverTimestamp(),
      });
      setPlaylist((prev) =>
        prev ? { ...prev, name: editName.trim(), description: editDescription.trim() } : null
      );
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save details:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!isOwner || !id) return;
    if (!window.confirm(`Are you sure you want to delete "${playlist.name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'userPlaylists', id));
      navigate('/my-playlists');
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const handleRemoveSong = async (index: number) => {
    if (!isOwner || !id) return;
    const updatedItems = [...items];
    updatedItems.splice(index, 1);

    try {
      const newCover = updatedItems[0]?.coverUrl || updatedItems[0]?.thumbnailUrl || '';
      await updateDoc(doc(db, 'userPlaylists', id), {
        items: updatedItems,
        songCount: updatedItems.length,
        coverUrl: newCover,
        updatedAt: serverTimestamp(),
      });
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              items: updatedItems,
              songCount: updatedItems.length,
              coverUrl: newCover,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to remove song:', err);
    }
  };

  const handleMoveSong = async (index: number, direction: 'up' | 'down') => {
    if (!isOwner || !id) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= items.length) return;

    const updatedItems = [...items];
    const temp = updatedItems[index];
    updatedItems[index] = updatedItems[newIdx];
    updatedItems[newIdx] = temp;

    try {
      await updateDoc(doc(db, 'userPlaylists', id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });
      setPlaylist((prev) => (prev ? { ...prev, items: updatedItems } : null));
    } catch (err) {
      console.error('Failed to move song:', err);
    }
  };

  const handleOpenCopyModal = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowCopyModal(true);
  };

  const handlePlayTrack = (index: number) => {
    if (currentSong?.id === songs[index].id) {
      togglePlayPause();
    } else {
      playPlaylist(songs, index, id);
    }
  };

  const displayCover = playlist.coverUrl || items[0]?.coverUrl || items[0]?.thumbnailUrl;

  return (
    <div className="flex-1 flex flex-col gap-10 max-w-7xl mx-auto w-full pb-20 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton />

        <div className="flex items-center gap-2">
          {/* Share Playlist Button */}
          <button
            id="share-playlist-top-btn"
            onClick={() => setShowShareModal(true)}
            className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Share Playlist"
          >
            <Share2 size={13} className="text-purple-400" />
            <span>Share</span>
          </button>

          {/* Save a Copy Button */}
          <button
            id="save-copy-top-btn"
            onClick={handleOpenCopyModal}
            className="px-3.5 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Save a copy of this playlist to your account"
          >
            <CopyPlus size={13} />
            <span>{isOwner ? 'Duplicate' : 'Save a Copy'}</span>
          </button>

          {isOwner && (
            <>
              <button
                onClick={handleToggleVisibility}
                className={`px-3.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all ${
                  playlist.visibility === 'private'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                }`}
              >
                {playlist.visibility === 'private' ? (
                  <>
                    <Lock size={13} />
                    <span>Private (Click to make Public)</span>
                  </>
                ) : (
                  <>
                    <Globe size={13} />
                    <span>Public (Click to make Private)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white transition-all"
                title="Edit Playlist Details"
              >
                <Edit3 size={16} />
              </button>

              <button
                onClick={handleDeletePlaylist}
                className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-all"
                title="Delete Playlist"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Details Inline Section */}
      {isEditing && (
        <form onSubmit={handleSaveDetails} className="bg-[#141416] p-6 rounded-3xl border border-purple-500/30 space-y-4">
          <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Edit Playlist Info</h3>
          <div>
            <label className="block text-xs text-white/60 mb-1">Playlist Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Description</label>
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-white/5 text-white/70 rounded-xl font-bold text-xs hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-2"
            >
              {savingEdit ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Hero Header */}
      <section className="relative min-h-[280px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center bg-[#111112] p-6 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent z-10 pointer-events-none" />
        {displayCover && (
          <img
            src={displayCover}
            className="absolute inset-0 w-full h-full object-cover object-center scale-110 opacity-20 blur-lg"
            alt=""
          />
        )}

        <div className="relative z-20 flex flex-col md:flex-row items-center gap-6 md:gap-10 w-full">
          <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-black/60 border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden shrink-0 relative">
            {displayCover ? (
              <img src={displayCover} className="w-full h-full object-cover" alt="" />
            ) : (
              <ListMusic size={56} className="text-white/20" />
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.3em] text-white/50">
                USER PLAYLIST • {items.length} TRACKS
              </span>
              <span className="text-white/30">•</span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                By {playlist.ownerName || 'User'}
              </span>
              <span className="text-white/30">•</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${playlist.visibility === 'private' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                {playlist.visibility === 'private' ? <Lock size={10} /> : <Globe size={10} />}
                <span>{playlist.visibility}</span>
              </span>

              {(playlist as any).copiedFromName && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Sparkles size={10} className="text-purple-400" />
                    <span>Copied from {(playlist as any).copiedFromOwner || 'Creator'}</span>
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight mb-2 text-white">
              {playlist.name}
            </h1>
            <p className="text-white/60 text-xs sm:text-sm md:text-base mb-6 max-w-2xl">
              {playlist.description || 'Personal playlist.'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                onClick={handlePlayAll}
                disabled={items.length === 0}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-purple-900/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isPlaylistLoading && !isPlaying ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>LOADING...</span>
                  </>
                ) : isPlaylistActive && isPlaying ? (
                  <>
                    <Pause size={18} fill="currentColor" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                    <span>PLAY ALL ({items.length})</span>
                  </>
                )}
              </button>

              {items.length > 0 && (
                <>
                  <button
                    onClick={handleShufflePlay}
                    className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Shuffle size={16} />
                    <span>Shuffle</span>
                  </button>

                  <button
                    onClick={handleAddAllToQueue}
                    title="Add all songs to queue"
                    className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ListPlus size={16} />
                    <span>Queue All</span>
                  </button>
                </>
              )}

              {/* Save a Copy to Account Button */}
              <button
                id="save-copy-hero-btn"
                onClick={handleOpenCopyModal}
                className="px-5 py-3 rounded-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white font-bold text-sm border border-purple-500/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-purple-950/40"
              >
                <CopyPlus size={16} />
                <span>{isOwner ? 'Duplicate Playlist' : 'Save a Copy'}</span>
              </button>

              {isOwner && (
                <button
                  onClick={() => setShowAddSongsModal(true)}
                  className="px-5 py-3 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-sm border border-purple-500/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Add More Songs</span>
                </button>
              )}

              {/* Share Button */}
              <button
                id="share-playlist-hero-btn"
                onClick={() => setShowShareModal(true)}
                title="Share playlist link"
                className="px-5 py-3 rounded-full font-bold text-sm border bg-white/10 hover:bg-white/20 text-white border-white/10 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tracklist Section */}
      <section className="bg-[#111112] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-white">Tracklist</h2>
          <div className="flex items-center gap-3">
            <span className="text-white/40 font-mono text-xs">{items.length} Tracks</span>
            {isOwner && (
              <button
                onClick={() => setShowAddSongsModal(true)}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                <span>Add Songs</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => {
            const song = songs[index];
            const isCurrentPlaying = currentSong?.id === song.id;
            const isCurrentLoading = isCurrentPlaying && (isLoading || isBuffering);

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => handlePlayTrack(index)}
                className={`group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  isCurrentPlaying
                    ? 'bg-purple-600/20 border-purple-500/40 text-white'
                    : 'bg-black/20 border-transparent hover:border-white/10 hover:bg-white/5 text-white/80'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-7 text-center shrink-0">
                    {isCurrentLoading && !isPlaying ? (
                      <Loader2 size={16} className="mx-auto text-purple-400 animate-spin" />
                    ) : isCurrentPlaying && isPlaying ? (
                      <Volume2 size={16} className="mx-auto text-purple-400 animate-pulse" />
                    ) : (
                      <>
                        <span className="text-white/30 font-mono text-xs group-hover:hidden">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <Play size={15} fill="currentColor" className="mx-auto hidden group-hover:block text-white" />
                      </>
                    )}
                  </div>

                  <div className="w-11 h-11 rounded-xl bg-zinc-800 overflow-hidden shrink-0 shadow-md border border-white/5">
                    {song.coverUrl || song.thumbnailUrl ? (
                      <img
                        src={song.coverUrl || song.thumbnailUrl}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={14} className="text-white/20" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className={`font-bold text-sm truncate ${isCurrentPlaying ? 'text-purple-300' : 'group-hover:text-white'}`}>
                      {song.title}
                    </div>
                    <div className="text-xs text-white/40 truncate flex items-center gap-2">
                      <span>{song.artist}</span>
                      {item.source === 'youtube' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          YouTube
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Reorder Buttons for Owner */}
                  {isOwner && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSong(index, 'up');
                        }}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10 disabled:opacity-20"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSong(index, 'down');
                        }}
                        disabled={index === items.length - 1}
                        title="Move Down"
                        className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10 disabled:opacity-20"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  )}

                  <ShareSongButton 
                    song={song} 
                    size={15} 
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToQueue(song);
                    }}
                    title="Add to Queue"
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  >
                    <ListPlus size={16} />
                  </button>

                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSong(index);
                      }}
                      title="Remove from Playlist"
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-12 text-white/40 text-sm space-y-3">
              <p>This playlist has no tracks yet.</p>
              {isOwner && (
                <button
                  onClick={() => setShowAddSongsModal(true)}
                  className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Add Songs to Playlist</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Add More Songs Modal */}
      {showAddSongsModal && id && (
        <AddMoreSongsModal
          playlistId={id}
          existingItems={items}
          onClose={() => setShowAddSongsModal(false)}
          onSuccess={() => {
            fetchPlaylist();
            setShowAddSongsModal(false);
          }}
        />
      )}

      {/* Share Playlist Modal */}
      {showShareModal && playlist && (
        <SharePlaylistModal
          playlist={playlist}
          onClose={() => setShowShareModal(false)}
          onVisibilityChange={(newVisibility) => {
            setPlaylist((prev) => prev ? { ...prev, visibility: newVisibility } : null);
          }}
        />
      )}

      {/* Copy Playlist Modal */}
      {showCopyModal && playlist && (
        <CopyPlaylistModal
          sourcePlaylist={playlist}
          onClose={() => setShowCopyModal(false)}
          onSuccess={(newPlaylistId) => {
            navigate(`/user-playlist/${newPlaylistId}`);
          }}
        />
      )}

      {/* Auth Modal for Unauthenticated Users */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
