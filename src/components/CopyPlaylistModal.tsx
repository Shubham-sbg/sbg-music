import React, { useState } from 'react';
import { 
  X, 
  CopyPlus, 
  Loader2, 
  Sparkles, 
  Lock, 
  Globe, 
  ListMusic, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { UserPlaylist } from '../types';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthProvider';
import { useNavigate } from 'react-router-dom';

interface CopyPlaylistModalProps {
  isOpen?: boolean;
  onClose: () => void;
  playlist?: UserPlaylist;
  sourcePlaylist?: UserPlaylist;
  onSuccess?: (newPlaylistId: string) => void;
}

export default function CopyPlaylistModal({
  isOpen = true,
  onClose,
  playlist: propPlaylist,
  sourcePlaylist: propSourcePlaylist,
  onSuccess,
}: CopyPlaylistModalProps) {
  const playlist = propPlaylist || propSourcePlaylist;
  if (!playlist) return null;

  const { user } = useAuth();
  const navigate = useNavigate();

  const [copyName, setCopyName] = useState(`${playlist.name || 'Playlist'} (Copy)`);
  const [copyDescription, setCopyDescription] = useState(
    playlist.description
      ? `Saved from ${playlist.ownerName || 'User'}: ${playlist.description}`
      : `Saved copy of ${playlist.ownerName || 'User'}'s playlist.`
  );
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [isCopying, setIsCopying] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const trackCount = playlist.songCount || playlist.items?.length || 0;
  const coverImage = playlist.coverUrl || playlist.items?.[0]?.coverUrl || playlist.items?.[0]?.thumbnailUrl;

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to save a copy of this playlist.');
      return;
    }

    if (!copyName.trim()) {
      setError('Please provide a name for your playlist.');
      return;
    }

    setIsCopying(true);
    setError(null);

    try {
      const currentUserId = user.uid || (user as any).id;
      const ownerName = user.displayName || user.email?.split('@')[0] || 'User';

      const items = (playlist.items || []).map((item) => ({
        ...item,
        addedAt: new Date().toISOString(),
      }));

      const newDoc = await addDoc(collection(db, 'userPlaylists'), {
        ownerId: currentUserId,
        uid: currentUserId,
        userId: currentUserId,
        ownerEmail: user.email || '',
        ownerName,
        name: copyName.trim(),
        title: copyName.trim(),
        description: copyDescription.trim(),
        visibility,
        isPublic: visibility === 'public',
        songCount: items.length,
        coverUrl: coverImage || '',
        items,
        songs: items,
        copiedFromId: playlist.id,
        copiedFromName: playlist.name,
        copiedFromOwner: playlist.ownerName || 'User',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCreatedId(newDoc.id);
      if (onSuccess) {
        onSuccess(newDoc.id);
      }
    } catch (err: any) {
      console.error('Failed to copy playlist:', err);
      setError(err?.message || 'Failed to save copy. Please check permissions and try again.');
    } finally {
      setIsCopying(false);
    }
  };

  const handleOpenCopied = () => {
    if (createdId) {
      onClose();
      navigate(`/user-playlist/${createdId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[#141416] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success State */}
        {createdId ? (
          <div className="text-center py-6 space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Playlist Saved!</h2>
              <p className="text-sm text-white/60 mt-1">
                A copy with {trackCount} tracks has been added to your personal playlists.
              </p>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                {coverImage ? (
                  <img src={coverImage} alt={copyName} className="w-full h-full object-cover" />
                ) : (
                  <ListMusic size={20} className="text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{copyName}</h3>
                <p className="text-xs text-white/40 truncate">{trackCount} tracks • {visibility.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-all"
              >
                Keep Browsing
              </button>
              <button
                onClick={handleOpenCopied}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <span>Open My Playlist</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Form State */
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <CopyPlus size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Save a Copy</h2>
                  <p className="text-xs text-white/50">Add this playlist to your personal collection</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Source Preview */}
            <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                {coverImage ? (
                  <img src={coverImage} alt={playlist.name} className="w-full h-full object-cover" />
                ) : (
                  <ListMusic size={20} className="text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">COPYING FROM</p>
                <h3 className="text-xs font-bold text-white truncate">{playlist.name}</h3>
                <p className="text-[11px] text-white/40 truncate">By {playlist.ownerName || 'User'} • {trackCount} tracks</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCopy} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="e.g. My Favorites (Copy)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={copyDescription}
                  onChange={(e) => setCopyDescription(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  placeholder="Description of your copied playlist"
                />
              </div>

              {/* Visibility Choice */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all ${
                      visibility === 'private'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md'
                        : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <Lock size={15} className={visibility === 'private' ? 'text-amber-400' : ''} />
                    <span>Private (Only You)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all ${
                      visibility === 'public'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-md'
                        : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <Globe size={15} className={visibility === 'public' ? 'text-purple-400' : ''} />
                    <span>Public</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCopying}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isCopying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Copy...</span>
                    </>
                  ) : (
                    <>
                      <CopyPlus size={15} />
                      <span>Save to My Playlists</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
