import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { getUserPlaylists } from '../services/userPlaylistService';
import { useAuth } from '../context/AuthProvider';
import { UserPlaylist, UserPlaylistItem, Song } from '../types';
import { X, Plus, Check, Loader2, ListMusic, Lock, Globe, Sparkles } from 'lucide-react';
import AuthModal from './AuthModal';
import CreatePlaylistModal from './CreatePlaylistModal';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Can pass an existing Song object or YouTube metadata
  songItem: Partial<Song> & { youtubeVideoId?: string; title: string; artist: string };
  onSuccess?: (playlistName: string) => void;
}

export default function AddToPlaylistModal({
  isOpen,
  onClose,
  songItem,
  onSuccess,
}: AddToPlaylistModalProps) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterTab, setFilterTab] = useState<'private' | 'all'>('private');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setSelectedPlaylistId(null);

    if (!user) {
      return;
    }

    const loadUserPlaylists = async () => {
      setLoading(true);
      try {
        const ownerId = user.uid || user.id;
        const list = await getUserPlaylists(ownerId);

        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setPlaylists(list);

        // If user has private playlists, set private as active tab
        const hasPrivate = list.some((p) => p.visibility === 'private' || p.isPublic === false);
        if (hasPrivate) {
          setFilterTab('private');
        } else if (list.length > 0) {
          // If no private playlists exist yet, default to all so they can see their playlists or create a private one
          setFilterTab('all');
        }
      } catch (err: any) {
        console.error('Failed to load user playlists:', err);
        setErrorMsg('Failed to load playlists.');
      } finally {
        setLoading(false);
      }
    };

    loadUserPlaylists();
  }, [isOpen, user]);

  const privatePlaylists = useMemo(() => {
    return playlists.filter((p) => p.visibility === 'private' || p.isPublic === false);
  }, [playlists]);

  const displayedPlaylists = useMemo(() => {
    if (filterTab === 'private') {
      return privatePlaylists;
    }
    return playlists;
  }, [filterTab, privatePlaylists, playlists]);

  if (!isOpen) return null;

  const newItem: UserPlaylistItem = {
    id: songItem.id || (songItem.youtubeVideoId ? `yt_${songItem.youtubeVideoId}` : `item_${Date.now()}`),
    songId: songItem.id,
    youtubeVideoId: songItem.youtubeVideoId,
    title: songItem.title || 'Untitled Track',
    artist: songItem.artist || 'SBG Music',
    thumbnailUrl: songItem.thumbnailUrl || songItem.coverUrl || (songItem.youtubeVideoId ? `https://img.youtube.com/vi/${songItem.youtubeVideoId}/hqdefault.jpg` : ''),
    coverUrl: songItem.coverUrl || songItem.thumbnailUrl || (songItem.youtubeVideoId ? `https://img.youtube.com/vi/${songItem.youtubeVideoId}/hqdefault.jpg` : ''),
    audioUrl: songItem.audioUrl || (songItem.youtubeVideoId ? `https://www.youtube.com/watch?v=${songItem.youtubeVideoId}` : ''),
    duration: songItem.duration || 0,
    source: songItem.source === 'youtube' || songItem.youtubeVideoId ? 'youtube' : 'sbg',
    addedAt: new Date().toISOString(),
  };

  const handleAddToSelectedPlaylist = async (targetPlaylistId?: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const playlistIdToUse = targetPlaylistId || selectedPlaylistId;
    if (!playlistIdToUse) return;

    setProcessing(true);
    setErrorMsg('');

    try {
      const plRef = doc(db, 'userPlaylists', playlistIdToUse);
      const plSnap = await getDoc(plRef);

      if (!plSnap.exists()) {
        throw new Error('Playlist no longer exists.');
      }

      const currentData = plSnap.data() as UserPlaylist;
      const currentItems: UserPlaylistItem[] = currentData.items || (currentData as any).songs || [];

      // Check if song/video already exists in playlist
      const exists = currentItems.some(
        (it) =>
          (newItem.songId && it.songId === newItem.songId) ||
          (newItem.youtubeVideoId && it.youtubeVideoId === newItem.youtubeVideoId) ||
          it.id === newItem.id
      );

      if (!exists) {
        const updatedItems = [...currentItems, newItem];
        const updatedCover = currentData.coverUrl || newItem.coverUrl || newItem.thumbnailUrl || '';

        await updateDoc(plRef, {
          items: updatedItems,
          songs: updatedItems,
          songCount: updatedItems.length,
          coverUrl: updatedCover,
          updatedAt: serverTimestamp(),
        });
      }

      if (onSuccess) {
        onSuccess(currentData.name || 'Playlist');
      }
      onClose();
    } catch (err: any) {
      console.error('Error adding song to playlist:', err);
      setErrorMsg(err.message || 'Failed to add song to playlist.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateSuccess = (newPlaylistId: string) => {
    setShowCreateModal(false);
    // Refresh user playlists
    if (user) {
      const ownerId = user.uid || user.id;
      getUserPlaylists(ownerId).then((list) => {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setPlaylists(list);
        setSelectedPlaylistId(newPlaylistId);
      }).catch(err => {
        console.error('Failed to refresh user playlists after create:', err);
      });
    }
  };

  const selectedPl = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
        <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ListMusic size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Add to Playlist</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                    <Lock size={10} /> Private Access
                  </span>
                </h3>
                <p className="text-xs text-white/40 truncate max-w-[240px]">
                  "{songItem.title}" — {songItem.artist}
                </p>
              </div>
            </div>
            <button
              id="add-to-playlist-close-btn"
              onClick={onClose}
              disabled={processing}
              className="text-white/40 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {!user ? (
            <div className="p-6 text-center bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
              <Sparkles size={24} className="mx-auto text-purple-400" />
              <p className="text-xs text-white/70 font-medium">
                Sign in to save this song to your private playlists.
              </p>
              <button
                type="button"
                id="add-to-playlist-auth-btn"
                onClick={() => setShowAuthModal(true)}
                className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Sign In / Sign Up
              </button>
            </div>
          ) : (
            <>
              {/* Category / Filter Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
                <button
                  type="button"
                  id="add-to-playlist-tab-private"
                  onClick={() => {
                    setFilterTab('private');
                    setSelectedPlaylistId(null);
                  }}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    filterTab === 'private'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Lock size={12} className={filterTab === 'private' ? 'text-amber-300' : 'text-white/40'} />
                  <span>Private Playlists ({privatePlaylists.length})</span>
                </button>
                <button
                  type="button"
                  id="add-to-playlist-tab-all"
                  onClick={() => {
                    setFilterTab('all');
                    setSelectedPlaylistId(null);
                  }}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Globe size={12} />
                  <span>All Playlists ({playlists.length})</span>
                </button>
              </div>

              {/* Create New Playlist Action */}
              <button
                type="button"
                id="add-to-playlist-create-btn"
                onClick={() => setShowCreateModal(true)}
                className="w-full p-2.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-3 text-purple-300 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                    <Plus size={16} />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-xs tracking-wide block text-purple-200">
                      Create New {filterTab === 'private' ? 'Private ' : ''}Playlist
                    </span>
                    <span className="text-[10px] text-white/40 block">
                      Save track immediately into a new collection
                    </span>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-purple-400 group-hover:translate-x-0.5 transition-transform mr-1">
                  + New
                </div>
              </button>

              {/* Playlist Selection List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {loading ? (
                  <div className="p-8 text-center text-white/40 text-xs flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-purple-400" />
                    <span>Loading your private playlists...</span>
                  </div>
                ) : displayedPlaylists.length === 0 ? (
                  <div className="p-6 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/10 space-y-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                      <Lock size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-white/80 font-bold">
                        {filterTab === 'private' ? 'No private playlists found' : 'No playlists found'}
                      </p>
                      <p className="text-[11px] text-white/40 max-w-xs mx-auto mt-0.5">
                        {filterTab === 'private'
                          ? 'Create a private playlist to keep this track exclusive to your account.'
                          : 'Create your first playlist using the button above.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Create Private Playlist</span>
                    </button>
                  </div>
                ) : (
                  displayedPlaylists.map((pl) => {
                    const isSelected = selectedPlaylistId === pl.id;
                    const items = pl.items || (pl as any).songs || [];
                    const hasSong = items.some(
                      (it: any) =>
                        (newItem.songId && it.songId === newItem.songId) ||
                        (newItem.youtubeVideoId && it.youtubeVideoId === newItem.youtubeVideoId) ||
                        it.id === newItem.id
                    );

                    return (
                      <div
                        key={pl.id}
                        id={`add-to-playlist-item-${pl.id}`}
                        onClick={() => {
                          if (!hasSong) {
                            setSelectedPlaylistId(pl.id);
                          }
                        }}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500/60 text-white ring-1 ring-purple-500/40'
                            : 'bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center relative">
                            {pl.coverUrl ? (
                              <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ListMusic size={18} className="text-white/20" />
                            )}
                            {pl.visibility === 'private' && (
                              <div className="absolute bottom-0.5 right-0.5 bg-black/80 rounded p-0.5 text-amber-400">
                                <Lock size={9} />
                              </div>
                            )}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm truncate">{pl.name}</p>
                              {pl.visibility === 'private' ? (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold flex items-center gap-0.5 shrink-0">
                                  <Lock size={9} /> Private
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-full bg-white/5 text-white/40 border border-white/5 text-[9px] font-medium flex items-center gap-0.5 shrink-0">
                                  <Globe size={9} /> Public
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-white/40">{pl.songCount || items.length || 0} tracks</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {hasSong ? (
                            <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Check size={11} className="stroke-[3]" /> Added
                            </span>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md">
                              <Check size={14} className="stroke-[3]" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToSelectedPlaylist(pl.id);
                              }}
                              title={`Add directly to ${pl.name}`}
                              className="w-6 h-6 rounded-full border border-white/20 hover:border-purple-400 hover:bg-purple-600 hover:text-white flex items-center justify-center text-white/40 transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  id="add-to-playlist-cancel-btn"
                  onClick={onClose}
                  disabled={processing}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="add-to-playlist-submit-btn"
                  onClick={() => handleAddToSelectedPlaylist()}
                  disabled={!selectedPlaylistId || processing}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg"
                >
                  {processing ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Add to {selectedPl ? `"${selectedPl.name}"` : 'Playlist'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign In to Manage Playlists"
        subtitle="Sign in to save tracks to your personal playlist library."
      />

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          initialItems={[newItem]}
          defaultVisibility={filterTab === 'private' ? 'private' : 'public'}
        />
      )}
    </>
  );
}
