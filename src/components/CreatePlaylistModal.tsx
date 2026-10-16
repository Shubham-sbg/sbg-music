import React, { useState } from 'react';
import { X, Loader2, Sparkles, Plus, Lock, Globe, Youtube, ListMusic, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthProvider';
import { UserPlaylistItem } from '../types';
import AuthModal from './AuthModal';

interface CreatePlaylistModalProps {
  onClose: () => void;
  onSuccess?: (playlistId: string) => void;
  initialItems?: UserPlaylistItem[];
  defaultVisibility?: 'public' | 'private';
}

export default function CreatePlaylistModal({
  onClose,
  onSuccess,
  initialItems = [],
  defaultVisibility = 'public',
}: CreatePlaylistModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'custom' | 'youtube'>(initialItems.length > 0 ? 'custom' : 'custom');
  const [name, setName] = useState(initialItems.length > 0 ? 'My Favorite Tracks' : '');
  const [description, setDescription] = useState(
    initialItems.length > 0 ? `Curated collection of my favorite ${initialItems.length} songs` : ''
  );
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // YouTube Playlist Import State
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytImportedItems, setYtImportedItems] = useState<UserPlaylistItem[]>([]);
  const [ytCoverUrl, setYtCoverUrl] = useState('');

  const handleFetchYouTubePlaylist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ytUrl.trim()) {
      setError('Please enter a YouTube playlist link or ID.');
      return;
    }

    setYtLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/youtube/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl.trim() }),
      });

      const data = await res.json();
      if (!data.ok || !data.playlist) {
        throw new Error(data.error || 'Failed to fetch YouTube playlist. Ensure the playlist is public or unlisted.');
      }

      const p = data.playlist;
      setName(p.title || 'YouTube Playlist');
      setDescription(p.description || `Imported from YouTube (${p.items?.length || 0} tracks)`);
      setYtCoverUrl(p.thumbnailUrl || '');

      const converted: UserPlaylistItem[] = (p.items || []).map((it: any) => ({
        id: `yt_${it.videoId}`,
        youtubeVideoId: it.videoId,
        title: it.title,
        artist: it.artist || it.channelTitle || 'YouTube Music',
        coverUrl: it.thumbnailUrl,
        thumbnailUrl: it.thumbnailUrl,
        audioUrl: `https://www.youtube.com/watch?v=${it.videoId}`,
        duration: it.duration || 0,
        source: 'youtube',
        addedAt: new Date().toISOString(),
      }));

      setYtImportedItems(converted);
    } catch (err: any) {
      console.error('Error fetching YouTube playlist:', err);
      setError(err?.message || 'Failed to import YouTube playlist.');
    } finally {
      setYtLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required.');
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ownerId = user.uid || (user as any).id;
      const ownerName = user.displayName || user.email?.split('@')[0] || 'User';

      const finalItems = mode === 'youtube' && ytImportedItems.length > 0 
        ? ytImportedItems 
        : initialItems;

      const firstItemCover = ytCoverUrl || finalItems[0]?.coverUrl || finalItems[0]?.thumbnailUrl || '';

      const docRef = await addDoc(collection(db, 'userPlaylists'), {
        ownerId,
        uid: ownerId,
        userId: ownerId,
        ownerEmail: user.email || '',
        ownerName,
        name: name.trim(),
        title: name.trim(),
        description: description.trim(),
        visibility,
        isPublic: visibility === 'public',
        songCount: finalItems.length,
        coverUrl: firstItemCover,
        items: finalItems,
        songs: finalItems,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (onSuccess) {
        onSuccess(docRef.id);
      }
      onClose();
    } catch (err: any) {
      console.error('Error creating user playlist:', err);
      setError(err?.message || 'Failed to create playlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Create Playlist</h2>
                <p className="text-xs text-white/40">Build your personal music collection</p>
              </div>
            </div>
            <button
              id="create-playlist-close-btn"
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mode Switcher: Custom vs Import from YouTube */}
          {initialItems.length === 0 && (
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
              <button
                type="button"
                id="create-playlist-mode-custom"
                onClick={() => { setMode('custom'); setError(null); }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  mode === 'custom'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListMusic size={15} />
                <span>Custom Playlist</span>
              </button>
              <button
                type="button"
                id="create-playlist-mode-youtube"
                onClick={() => { setMode('youtube'); setError(null); }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  mode === 'youtube'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Youtube size={15} />
                <span>Import YouTube Playlist</span>
              </button>
            </div>
          )}

          {initialItems.length > 0 && (
            <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
                <Check size={16} />
              </div>
              <div className="text-xs">
                <p className="text-white font-bold">Populating from Your Favorites</p>
                <p className="text-white/50">{initialItems.length} tracks (including YouTube favorites) will be added</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* YouTube Playlist URL Fetcher Step */}
          {mode === 'youtube' && (
            <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
              <label className="block text-xs font-bold uppercase tracking-wider text-red-300">
                YouTube Playlist Link or ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="create-playlist-yt-url-input"
                  placeholder="https://www.youtube.com/playlist?list=..."
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  className="flex-1 p-2.5 bg-black/60 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-red-500/50"
                />
                <button
                  type="button"
                  id="create-playlist-yt-fetch-btn"
                  onClick={handleFetchYouTubePlaylist}
                  disabled={ytLoading || !ytUrl.trim()}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                >
                  {ytLoading ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />}
                  <span>{ytLoading ? 'Fetching...' : 'Fetch Tracks'}</span>
                </button>
              </div>

              {ytImportedItems.length > 0 && (
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                  <Check size={14} />
                  <span>Found {ytImportedItems.length} tracks ready to import!</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="create-playlist-name-input" className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                Playlist Name <span className="text-purple-400">*</span>
              </label>
              <input
                id="create-playlist-name-input"
                type="text"
                required
                placeholder="e.g. My Favorites, Late Night Chill, Desi Hits"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="create-playlist-desc-input" className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                Description <span className="text-white/30 font-normal">(Optional)</span>
              </label>
              <textarea
                id="create-playlist-desc-input"
                placeholder="Brief description of this playlist..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Visibility Options */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Privacy / Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="create-playlist-visibility-public"
                  onClick={() => setVisibility('public')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    visibility === 'public'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg'
                      : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Globe size={18} className={visibility === 'public' ? 'text-purple-400 shrink-0 mt-0.5' : 'text-white/40 shrink-0 mt-0.5'} />
                  <div>
                    <p className="font-bold text-xs">Public</p>
                    <p className="text-[11px] text-white/40 leading-tight mt-0.5">
                      Anyone can view and listen to this playlist
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  id="create-playlist-visibility-private"
                  onClick={() => setVisibility('private')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    visibility === 'private'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg'
                      : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Lock size={18} className={visibility === 'private' ? 'text-purple-400 shrink-0 mt-0.5' : 'text-white/40 shrink-0 mt-0.5'} />
                  <div>
                    <p className="font-bold text-xs">Private</p>
                    <p className="text-[11px] text-white/40 leading-tight mt-0.5">
                      Only you can view and play this playlist
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                id="create-playlist-cancel-btn"
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="create-playlist-submit-btn"
                disabled={isSubmitting || !name.trim()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Create Playlist</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to Create Playlists"
        subtitle="Please log in or create a free account to permanently save your playlists."
      />
    </>
  );
}
