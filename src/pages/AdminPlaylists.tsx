import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query,
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  where
} from 'firebase/firestore';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';
import { 
  ListMusic, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Youtube, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Play,
  Pause,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Music,
  PlusCircle,
  Loader2,
  FolderOpen,
  Volume2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Playlist, Song } from '../types';
import AddMoreSongsModal from '../components/AddMoreSongsModal';
import ImageUploadInput from '../components/ImageUploadInput';
import { generatePlaylistArtwork } from '../lib/artworkGenerator';
import { useAdminPlaylists, usePlaylistSongs, invalidateCache } from '../hooks/useCatalog';

export default function AdminPlaylists({ onSwitchToImport }: { onSwitchToImport?: () => void }) {
  const { user, hasPermission } = useAuth();
  const { playPlaylist, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering } = usePlayer();

  const { playlists, setPlaylists, loading, errorMsg, refetch: refetchPlaylists } = useAdminPlaylists();

  // Selected playlist for detailed song management view
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Selected active playlist object
  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;

  // Cached playlist songs hook
  const { songs: selectedPlaylistSongs, loading: loadingSelectedSongs } = usePlaylistSongs(activePlaylist?.songIds);

  // Add More Songs Modal State
  const [addMoreModalPlaylist, setAddMoreModalPlaylist] = useState<Playlist | null>(null);

  // Sync YouTube Playlist State
  const [syncingPlaylist, setSyncingPlaylist] = useState(false);
  const [syncModalData, setSyncModalData] = useState<any | null>(null);

  const handleSyncPlaylist = async () => {
    if (!activePlaylist) return;
    const ytId = activePlaylist.sourcePlaylistId || activePlaylist.id;
    setSyncingPlaylist(true);
    try {
      const res = await fetch('/api/youtube/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytId }),
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        console.error('[AdminPlaylists] Failed to parse JSON response. Status:', res.status, 'Raw:', text.substring(0, 100));
        throw new Error(`Invalid response from server (Status ${res.status}). Server might be down.`);
      }
      if (!res.ok) throw new Error(data.error || 'Failed to fetch YouTube playlist.');

      const ytVideos = data.videos || [];
      const currentSongIds = activePlaylist.songIds || [];

      // Check existing songs in DB
      const existingMap: Record<string, string> = {};
      const videoIds = ytVideos.map((v: any) => v.videoId).filter(Boolean);
      for (let i = 0; i < videoIds.length; i += 10) {
        const chunk = videoIds.slice(i, i + 10);
        const q = query(collection(db, 'songs'), where('youtubeVideoId', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const s = d.data() as any;
          if (s.youtubeVideoId) existingMap[s.youtubeVideoId] = d.id;
        });
      }

      // Check new songs not currently in playlist
      const newVideoItems: any[] = [];
      for (const v of ytVideos) {
        const songId = existingMap[v.videoId];
        if (!songId || !currentSongIds.includes(songId)) {
          newVideoItems.push({ ...v, existingId: songId });
        }
      }

      // Also check removed songs (songs in current playlist whose videoIds are not in ytVideos)
      // We can map current playlist songs to their youtubeVideoIds
      const ytVideoIdSet = new Set(videoIds);
      const removedSongs = selectedPlaylistSongs.filter(s => s.youtubeVideoId && !ytVideoIdSet.has(s.youtubeVideoId));

      setSyncModalData({
        totalYt: ytVideos.length,
        newVideos: newVideoItems,
        removedSongs,
        existingMap,
      });
    } catch (e: any) {
      alert('Sync failed: ' + e.message);
    } finally {
      setSyncingPlaylist(false);
    }
  };

  // Edit / Create Playlist Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editCreatorName, setEditCreatorName] = useState('SBG SHADOW');
  const [editCreatorVerified, setEditCreatorVerified] = useState(true);
  const [editPublished, setEditPublished] = useState(true);
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  const canCreatePlaylists = hasPermission('createPlaylists') || hasPermission('create_playlist');
  const canManageAll = user?.role === 'owner' || user?.role === 'admin' || hasPermission('manageAllPlaylists');
  const canDeletePlaylists = canManageAll || hasPermission('editPlaylists') || hasPermission('edit_playlist') || hasPermission('createPlaylists') || hasPermission('create_playlist');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPlaylist(null);
    setEditTitle('');
    setEditDescription('');
    setEditCoverUrl('');
    setEditCreatorName('SBG SHADOW');
    setEditCreatorVerified(true);
    setEditPublished(true);
    setShowEditModal(true);
  };

  // Open Edit Details Modal
  const handleOpenEdit = (pl: Playlist) => {
    setEditingPlaylist(pl);
    setEditTitle(pl.title);
    setEditDescription(pl.description || '');
    setEditCoverUrl(pl.coverUrl || '');
    setEditCreatorName(pl.creatorName || 'SBG SHADOW');
    setEditCreatorVerified(pl.creatorVerified ?? true);
    setEditPublished(pl.published ?? true);
    setShowEditModal(true);
  };

  // Save Playlist (Create or Update Details)
  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setSavingPlaylist(true);
    try {
      let finalCoverUrl = editCoverUrl.trim();

      // Auto-generate unique album/playlist artwork if none provided
      if (!finalCoverUrl) {
        try {
          const generated = await generatePlaylistArtwork({
            title: editTitle.trim(),
            description: editDescription.trim(),
          });
          if (generated?.imageUrl) {
            finalCoverUrl = generated.imageUrl;
          }
        } catch (genErr) {
          console.warn('Auto artwork generation error, continuing without art:', genErr);
        }
      }

      if (editingPlaylist) {
        await updateDoc(doc(db, 'playlists', editingPlaylist.id), {
          title: editTitle.trim(),
          description: editDescription.trim(),
          coverUrl: finalCoverUrl,
          creatorName: editCreatorName.trim(),
          creatorVerified: editCreatorVerified,
          published: editPublished,
          updatedAt: serverTimestamp(),
        });
        invalidateCache(`playlist_detail_${editingPlaylist.id}`);
      } else {
        const newRef = await addDoc(collection(db, 'playlists'), {
          title: editTitle.trim(),
          description: editDescription.trim(),
          coverUrl: finalCoverUrl,
          creatorName: editCreatorName.trim(),
          creatorVerified: editCreatorVerified,
          songIds: [],
          published: editPublished,
          source: 'manual',
          createdBy: user?.displayName || 'Shadow',
          createdById: user?.id || 'staff',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        // Select newly created playlist right away
        setSelectedPlaylistId(newRef.id);
      }
      invalidateCache('admin_playlists_list');
      invalidateCache('published_playlists_list');
      setShowEditModal(false);
      refetchPlaylists();
    } catch (err: any) {
      alert('Failed to save playlist: ' + err.message);
    } finally {
      setSavingPlaylist(false);
    }
  };

  // Toggle publish status
  const togglePublishStatus = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'playlists', id), { 
        published: !current,
        updatedAt: serverTimestamp()
      });
      invalidateCache('admin_playlists_list');
      invalidateCache('published_playlists_list');
      invalidateCache(`playlist_detail_${id}`);
      refetchPlaylists();
    } catch (e: any) {
      alert('Failed to toggle status: ' + e.message);
    }
  };

  // Delete entire playlist document
  const handleDeletePlaylist = async (id: string, plTitle: string) => {
    if (confirm(`Are you sure you want to delete playlist "${plTitle}"? (Songs in the catalog will NOT be deleted)`)) {
      try {
        await deleteDoc(doc(db, 'playlists', id));
        // Invalidate all catalog caches immediately
        invalidateCache('admin_playlists_list');
        invalidateCache('published_playlists_list');
        invalidateCache(`playlist_detail_${id}`);

        // Update local state right away for snappy UI feedback
        setPlaylists((prev) => prev.filter((p) => p.id !== id));

        if (selectedPlaylistId === id) {
          setSelectedPlaylistId(null);
        }
        refetchPlaylists();
      } catch (e: any) {
        alert('Delete failed: ' + e.message);
      }
    }
  };

  // Remove single song from playlist (WITHOUT deleting the song from the global collection)
  const handleRemoveSongFromPlaylist = async (songId: string, songTitle: string) => {
    if (!activePlaylist) return;
    if (confirm(`Remove "${songTitle}" from playlist "${activePlaylist.title}"? \n\nNote: This will only remove the song from this playlist. The song will remain in the SBG music catalog.`)) {
      try {
        const updatedIds = (activePlaylist.songIds || []).filter((id: string) => id !== songId);
        await updateDoc(doc(db, 'playlists', activePlaylist.id), {
          songIds: updatedIds,
          updatedAt: serverTimestamp(),
        });
        invalidateCache('admin_playlists_list');
        invalidateCache('published_playlists_list');
        invalidateCache(`playlist_detail_${activePlaylist.id}`);
        refetchPlaylists();
      } catch (e: any) {
        alert('Failed to remove song: ' + e.message);
      }
    }
  };

  // Move song up or down in sequence
  const handleMoveSong = async (index: number, direction: 'up' | 'down') => {
    if (!activePlaylist || !activePlaylist.songIds) return;
    const ids = [...activePlaylist.songIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= ids.length) return;

    // Swap positions
    const temp = ids[index];
    ids[index] = ids[targetIndex];
    ids[targetIndex] = temp;

    try {
      await updateDoc(doc(db, 'playlists', activePlaylist.id), {
        songIds: ids,
        updatedAt: serverTimestamp(),
      });
      invalidateCache('admin_playlists_list');
      invalidateCache('published_playlists_list');
      invalidateCache(`playlist_detail_${activePlaylist.id}`);
      refetchPlaylists();
    } catch (e: any) {
      console.error('Failed to reorder tracks:', e);
    }
  };

  // Handle Play All
  const handlePlayAll = () => {
    if (selectedPlaylistSongs.length === 0) return;
    playPlaylist(selectedPlaylistSongs, 0);
  };

  // --------------------------------------------------------------------------
  // RENDER: PLAYLIST DETAIL / SONG MANAGEMENT VIEW
  // --------------------------------------------------------------------------
  if (activePlaylist) {
    const isPlaylistPlaying = selectedPlaylistSongs.some((s) => s.id === currentSong?.id) && isPlaying;

    return (
      <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-xs font-bold transition-colors bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 hover:bg-white/10"
          >
            <ArrowLeft size={15} />
            <span>Back to All Playlists</span>
          </button>

          <div className="flex items-center gap-2">
            <Link
              to={`/playlists/${activePlaylist.id}`}
              className="text-xs text-white/50 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ExternalLink size={14} />
              <span>Public View</span>
            </Link>
            <button
              onClick={() => handleOpenEdit(activePlaylist)}
              className="text-xs text-white/70 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Edit3 size={14} />
              <span>Edit Details</span>
            </button>
          </div>
        </div>

        {/* Playlist Header Card */}
        <div className="bg-[#111112] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 relative shadow-xl">
              {activePlaylist.coverUrl || selectedPlaylistSongs[0]?.coverUrl ? (
                <img
                  src={activePlaylist.coverUrl || selectedPlaylistSongs[0]?.coverUrl || selectedPlaylistSongs[0]?.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ListMusic size={36} className="text-white/20" />
                </div>
              )}
              {activePlaylist.source === 'youtube' && (
                <div className="absolute top-1.5 right-1.5 bg-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase shadow">
                  YT
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                  Playlist
                </span>
                <span className="text-xs text-white/40">•</span>
                <span className="text-xs font-mono font-bold text-white/70">
                  {activePlaylist.songIds?.length || 0} Songs
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {activePlaylist.title}
              </h1>
              <p className="text-xs text-white/40 mt-1 max-w-xl line-clamp-2">
                {activePlaylist.description || 'No description provided.'}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-white/40 mt-2">
                <span>Created by <strong>{activePlaylist.createdBy || 'Staff'}</strong></span>
                <span>•</span>
                <span className={activePlaylist.published ? 'text-green-400' : 'text-zinc-400'}>
                  {activePlaylist.published ? 'Publicly Visible' : 'Hidden'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={handlePlayAll}
              disabled={selectedPlaylistSongs.length === 0}
              className="bg-white text-black font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-40"
            >
              {isPlaylistPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaylistPlaying ? 'Pause All' : 'Play All'}</span>
            </button>

            {/* PREDOMINANT ADD MORE SONGS BUTTON */}
            <button
              onClick={() => setAddMoreModalPlaylist(activePlaylist)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
            >
              <PlusCircle size={16} />
              <span>Add More Songs</span>
            </button>
          </div>
        </div>

        {/* Admin Playlist Diagnostic & Source Info Panel */}
        <div className="bg-[#111112] p-6 rounded-3xl border border-white/5 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-white/40 uppercase">Source</span>
            <p className="text-sm font-bold text-white uppercase">{activePlaylist.source || 'Manual'}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-white/40 uppercase">YouTube Playlist ID</span>
            <p className="text-xs font-mono font-bold text-red-400 truncate">{activePlaylist.sourcePlaylistId || 'N/A'}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-white/40 uppercase">Songs / Imported</span>
            <p className="text-xl font-bold text-green-400">{activePlaylist.songIds?.length || 0}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-white/40 uppercase">Last Synced</span>
            <p className="text-xs text-white/70 font-mono">
              {activePlaylist.updatedAt?.toDate ? activePlaylist.updatedAt.toDate().toLocaleString() : 'Just now'}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-[#111112] p-4 px-6 rounded-2xl border border-white/5">
          {selectedPlaylistSongs.length > 0 && (
            <button
              onClick={() => playPlaylist(selectedPlaylistSongs, 0, activePlaylist.id)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 hover:scale-[1.02] transition-all shadow-sm"
            >
              <Play size={15} fill="currentColor" />
              <span>[ Play All ({selectedPlaylistSongs.length}) ]</span>
            </button>
          )}

          <button
            onClick={() => setAddMoreModalPlaylist(activePlaylist)}
            className="bg-white text-black font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 hover:scale-[1.02] transition-all shadow-sm"
          >
            <Plus size={15} />
            <span>[ + Add More Songs ]</span>
          </button>

          {activePlaylist.source === 'youtube' && (
            <button
              onClick={handleSyncPlaylist}
              disabled={syncingPlaylist}
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              {syncingPlaylist ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>[ Sync Playlist ]</span>
            </button>
          )}

          <button
            onClick={() => handleOpenEdit(activePlaylist)}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <Edit3 size={14} />
            <span>[ Edit ]</span>
          </button>

          <button
            onClick={() => handleDeletePlaylist(activePlaylist.id, activePlaylist.title)}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors ml-auto shadow-sm"
          >
            <Trash2 size={14} />
            <span>[ Delete ]</span>
          </button>
        </div>

        {/* Songs Tracklist Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Tracklist</span>
              <span className="text-xs font-mono text-white/40 font-normal">
                ({selectedPlaylistSongs.length} tracks loaded)
              </span>
            </h2>
            <button
              onClick={() => setAddMoreModalPlaylist(activePlaylist)}
              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <Plus size={14} />
              <span>[ + Add More Songs ]</span>
            </button>
          </div>

          {loadingSelectedSongs ? (
            <div className="p-12 text-center text-white/40 text-xs bg-[#111112] rounded-3xl border border-white/5 flex items-center justify-center gap-3">
              <Loader2 size={18} className="animate-spin text-red-400" />
              <span>Loading playlist tracks in order...</span>
            </div>
          ) : selectedPlaylistSongs.length === 0 ? (
            <div className="p-12 text-center bg-[#111112] rounded-3xl border border-white/5 space-y-4">
              <ListMusic size={40} className="mx-auto text-white/20" />
              <div>
                <h3 className="text-sm font-bold text-white">This playlist is currently empty</h3>
                <p className="text-xs text-white/40 mt-1">
                  Add songs from the library or import a complete YouTube playlist.
                </p>
              </div>
              <button
                onClick={() => setAddMoreModalPlaylist(activePlaylist)}
                className="bg-white text-black font-bold px-5 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                <Plus size={15} />
                <span>Add More Songs Now</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 bg-[#111112] p-2 sm:p-3 rounded-3xl border border-white/5">
              {selectedPlaylistSongs.map((song, idx) => {
                const isTrackCurrent = currentSong?.id === song.id;
                const isTrackPlaying = isTrackCurrent && isPlaying;
                const isTrackLoading = isTrackCurrent && (isLoading || isBuffering);

                return (
                  <div
                    key={`${song.id}-${idx}`}
                    className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 text-xs transition-colors group ${
                      isTrackCurrent
                        ? 'bg-white/10 border border-white/15'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    {/* Left: Position #, Cover, Title, Artist */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <span className="font-mono text-xs text-white/30 w-6 text-right shrink-0">
                        {idx + 1}.
                      </span>

                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 relative">
                        {song.coverUrl || song.thumbnailUrl ? (
                          <img
                            src={song.coverUrl || song.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={16} className="text-white/20" />
                          </div>
                        )}
                        {isTrackLoading && !isPlaying ? (<div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white"><Loader2 size={16} className="animate-spin" /></div>) : isTrackPlaying && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-green-400">
                            <Volume2 size={16} className="animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 truncate">
                        <p className={`font-bold truncate ${isTrackCurrent ? 'text-green-400' : 'text-white'}`}>
                          {song.title}
                        </p>
                        <p className="text-[11px] text-white/40 truncate mt-0.5">
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions (Play, Move, Remove) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Play Track Button */}
                      <button
                        onClick={() => {
                          if (isTrackCurrent) {
                            togglePlayPause();
                          } else {
                            playPlaylist(selectedPlaylistSongs, idx);
                          }
                        }}
                        className={`p-2 rounded-xl transition-colors ${
                          isTrackCurrent
                            ? 'bg-white text-black font-bold'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                        title={isTrackPlaying ? 'Pause Track' : 'Play Track'}
                      >
                        {isTrackLoading && !isPlaying ? <Loader2 size={14} className="animate-spin" /> : isTrackPlaying ? <Pause size={14} /> : <Play size={14} />}
                      </button>

                      {/* Reorder Up / Down */}
                      <button
                        onClick={() => handleMoveSong(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp size={15} />
                      </button>

                      <button
                        onClick={() => handleMoveSong(idx, 'down')}
                        disabled={idx === selectedPlaylistSongs.length - 1}
                        className="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown size={15} />
                      </button>

                      {/* Remove Song from Playlist */}
                      <button
                        onClick={() => handleRemoveSongFromPlaylist(song.id, song.title)}
                        className="p-2 text-red-400/70 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors ml-1"
                        title="Remove from this playlist (keeps song in library)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add More Songs Modal */}
        <AddMoreSongsModal
          isOpen={Boolean(addMoreModalPlaylist)}
          onClose={() => setAddMoreModalPlaylist(null)}
          playlist={addMoreModalPlaylist}
          onSuccess={() => {
            // Updated automatically via Firestore real-time listener
          }}
        />

        {/* Sync Result Modal */}
        {syncModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Playlist Sync Results</span>
                  <h3 className="text-lg font-bold text-white">{activePlaylist.title}</h3>
                </div>
                <button
                  onClick={() => setSyncModalData(null)}
                  className="p-2 text-white/40 hover:text-white rounded-xl bg-white/5 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-white/40 font-mono uppercase">YouTube Total</span>
                  <p className="text-2xl font-bold text-white">{syncModalData.totalYt}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-green-400 font-mono uppercase">New Songs Found</span>
                  <p className="text-2xl font-bold text-green-400">{syncModalData.newVideos.length}</p>
                </div>
              </div>

              {syncModalData.removedSongs && syncModalData.removedSongs.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-amber-300">
                    {syncModalData.removedSongs.length} song(s) are no longer present on YouTube.
                  </p>
                  <p className="text-[11px] text-white/60">
                    SBG Music never automatically deletes library songs. Would you like to remove them from this playlist?
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={async () => {
                        const removedIds = new Set(syncModalData.removedSongs.map((s: any) => s.id));
                        const updatedIds = (activePlaylist.songIds || []).filter((id: string) => !removedIds.has(id));
                        await updateDoc(doc(db, 'playlists', activePlaylist.id), {
                          songIds: updatedIds,
                          updatedAt: serverTimestamp(),
                        });
                        setSyncModalData(null);
                        alert('Removed songs from playlist.');
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Remove from playlist
                    </button>
                    <button
                      onClick={() => setSyncModalData(null)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Keep in SBG Music
                    </button>
                  </div>
                </div>
              )}

              {syncModalData.newVideos.length > 0 ? (
                <button
                  onClick={async () => {
                    try {
                      const newSongIds = [...(activePlaylist.songIds || [])];
                      for (const v of syncModalData.newVideos) {
                        let songId = v.existingId;
                        if (!songId) {
                          const newDoc = await addDoc(collection(db, 'songs'), {
                            title: v.title,
                            artist: v.artist,
                            description: v.description || '',
                            genre: 'Various',
                            releaseDate: new Date().toISOString().split('T')[0],
                            youtubeUrl: v.youtubeUrl,
                            youtubeVideoId: v.videoId,
                            coverUrl: v.thumbnailUrl,
                            thumbnailUrl: v.thumbnailUrl,
                            audioUrl: v.youtubeUrl,
                            duration: 0,
                            durationSeconds: 0,
                            explicitContent: false,
                            downloadEnabled: false,
                            published: true,
                            showYoutubeSourceBadge: false,
                            source: 'youtube',
                            createdBy: user?.displayName || 'Staff',
                            createdById: user?.id || 'staff',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                          songId = newDoc.id;
                        }
                        if (!newSongIds.includes(songId)) {
                          newSongIds.push(songId);
                        }
                      }

                      await updateDoc(doc(db, 'playlists', activePlaylist.id), {
                        songIds: newSongIds,
                        updatedAt: serverTimestamp(),
                      });

                      setSyncModalData(null);
                      alert('Playlist synchronized successfully!');
                    } catch (e: any) {
                      alert('Sync update failed: ' + e.message);
                    }
                  }}
                  className="w-full py-3 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                  Add {syncModalData.newVideos.length} New Songs to Playlist
                </button>
              ) : (
                <div className="text-center py-4 text-xs text-white/60">
                  Playlist is fully in sync with YouTube. No new tracks found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Info Modal */}
        {showEditModal && renderEditModal()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: PLAYLISTS OVERVIEW GRID
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner & Primary Actions */}
      <div className="bg-[#111112] p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playlists Management</h1>
          <p className="text-sm text-white/40">
            Curate collections, manage tracklists, and import complete YouTube playlists.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {onSwitchToImport && hasPermission('importYouTubePlaylists') && (
            <button
              onClick={onSwitchToImport}
              className="bg-red-500/10 border border-red-500/30 text-red-300 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors"
            >
              <Youtube size={16} />
              <span>Import YouTube Playlist</span>
            </button>
          )}
          {canCreatePlaylists && (
            <button
              onClick={handleOpenCreate}
              className="bg-white text-black font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform shadow-lg"
            >
              <Plus size={16} />
              <span>Create Playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* Playlist Grid / Loading / Error Handling */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#111112] rounded-3xl border border-white/5 shadow-xl space-y-4">
          <Loader2 className="animate-spin text-red-500" size={32} />
          <p className="text-sm text-white/50 font-medium">Retrieving playlists database...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-300 text-xs flex items-center gap-3 shadow-xl">
          <ShieldAlert size={24} className="shrink-0 text-red-400" />
          <div>
            <h4 className="font-bold text-sm text-white mb-1">Database Access Error</h4>
            <p className="text-white/60">{errorMsg}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="bg-[#111112] p-5 rounded-2xl border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div className="flex gap-4 items-start mb-4">
                <div 
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 relative cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic size={28} className="text-white/20" />
                    </div>
                  )}
                  {pl.source === 'youtube' && (
                    <div className="absolute top-1 right-1 bg-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase shadow">
                      YT
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className="font-bold text-base text-white truncate cursor-pointer hover:underline"
                    >
                      {pl.title}
                    </h3>
                  </div>
                  <p className="text-xs text-white/40 line-clamp-2 mb-2">
                    {pl.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center gap-2.5 text-[11px] text-white/50">
                    <span className="font-mono font-bold text-white/80 bg-white/5 px-2 py-0.5 rounded">
                      {pl.songIds?.length || 0} tracks
                    </span>
                    <span>•</span>
                    <span className="truncate">Added by <strong>{pl.createdBy || 'Shadow'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Row */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublishStatus(pl.id, pl.published)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                      pl.published
                        ? 'border-green-500/30 text-green-400 bg-green-500/10'
                        : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
                    }`}
                  >
                    {pl.published ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>{pl.published ? 'Published' : 'Hidden'}</span>
                  </button>
                  <Link
                    to={`/playlists/${pl.id}`}
                    className="p-1.5 text-white/40 hover:text-white transition-colors"
                    title="View Public Playlist"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Manage Songs / Open Button */}
                  <button
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 border border-white/10 transition-colors"
                    title="Open Playlist & Manage Songs"
                  >
                    <FolderOpen size={13} />
                    <span>Manage</span>
                  </button>

                  {/* Direct Add More Songs Modal Trigger */}
                  <button
                    onClick={() => setAddMoreModalPlaylist(pl)}
                    className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-300 rounded-lg font-bold text-xs flex items-center gap-1.5 border border-red-500/30 transition-colors"
                    title="Add More Songs"
                  >
                    <Plus size={13} />
                    <span>Add Songs</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(pl)}
                    className="p-1.5 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Edit Playlist Details"
                  >
                    <Edit3 size={15} />
                  </button>

                  {(canDeletePlaylists || pl.createdBy === user?.displayName) && (
                    <button
                      onClick={() => handleDeletePlaylist(pl.id, pl.title)}
                      className="p-1.5 text-red-400/80 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete Playlist"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {playlists.length === 0 && (
            <div className="col-span-full text-center py-16 bg-[#111112] rounded-3xl border border-white/5 text-white/40">
              <ListMusic size={40} className="mx-auto mb-3 opacity-40" />
              <p>No playlists created yet. Import from YouTube or create one above.</p>
            </div>
          )}
        </div>
      )}

      {/* Add More Songs Modal */}
      <AddMoreSongsModal
        isOpen={Boolean(addMoreModalPlaylist)}
        onClose={() => setAddMoreModalPlaylist(null)}
        playlist={addMoreModalPlaylist}
      />

      {/* Create / Edit Modal */}
      {showEditModal && renderEditModal()}
    </div>
  );

  function renderEditModal() {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
        <div className="bg-[#141416] border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {editingPlaylist ? 'Edit Playlist Details' : 'Create New Playlist'}
            </h2>
            <button
              onClick={() => setShowEditModal(false)}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSavePlaylist} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                Playlist Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Best of Desi Hip-Hop"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                Description
              </label>
              <textarea
                placeholder="Curated tracks by SBG..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                Playlist By / Creator Name
              </label>
              <input
                type="text"
                placeholder="e.g. SBG SHADOW"
                value={editCreatorName}
                onChange={(e) => setEditCreatorName(e.target.value)}
                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Creator Verified Badge</span>
                <span className="text-[11px] text-white/40">Show verified checkmark ✓ next to creator name</span>
              </div>
              <button
                type="button"
                onClick={() => setEditCreatorVerified(!editCreatorVerified)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  editCreatorVerified 
                    ? 'bg-white text-black shadow-md' 
                    : 'bg-white/10 text-white/50 hover:text-white'
                }`}
              >
                {editCreatorVerified ? 'ON ✓' : 'OFF'}
              </button>
            </div>

            <div>
              <ImageUploadInput
                label="Cover Artwork / Thumbnail"
                value={editCoverUrl}
                onChange={setEditCoverUrl}
                storageFolder="playlists"
                placeholder="https://... or upload custom thumbnail"
                recommendedSize="1:1 square or 16:9 banner. If left blank, unique AI artwork will be generated!"
                promptContext={{
                  title: editTitle,
                  description: editDescription,
                }}
              />
            </div>

            <label className="flex items-center gap-2 text-xs pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="rounded border-white/20 bg-black/50 accent-white"
              />
              <span>Published (Visible to public visitors)</span>
            </label>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-1/2 p-3 rounded-xl border border-white/10 text-white/60 hover:text-white font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPlaylist}
                className="w-1/2 p-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
              >
                {savingPlaylist ? 'Saving...' : editingPlaylist ? 'Update Playlist' : 'Create & Open'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
