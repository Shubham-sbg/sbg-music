import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  Globe, 
  Lock, 
  ListMusic, 
  ExternalLink,
  MessageCircle,
  Twitter,
  Send,
  Mail,
  Loader2,
  Sparkles
} from 'lucide-react';
import { UserPlaylist } from '../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthProvider';

interface SharePlaylistModalProps {
  isOpen?: boolean;
  onClose: () => void;
  playlist: UserPlaylist;
  onVisibilityChange?: (newVisibility: 'public' | 'private') => void;
}

export default function SharePlaylistModal({
  isOpen = true,
  onClose,
  playlist,
  onVisibilityChange,
}: SharePlaylistModalProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  if (!isOpen) return null;

  const currentUserId = user?.uid || user?.id;
  const isOwner = Boolean(currentUserId && (playlist.ownerId === currentUserId || playlist.uid === currentUserId));
  const isPublic = playlist.visibility === 'public' || playlist.isPublic === true;
  const shareUrl = `${window.location.origin}/user-playlist/${playlist.id}`;
  const coverImage = playlist.coverUrl || playlist.items?.[0]?.coverUrl || playlist.items?.[0]?.thumbnailUrl;
  const trackCount = playlist.songCount || playlist.items?.length || 0;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${playlist.name} — SBG MUSIC Playlist`,
          text: `Check out the playlist "${playlist.name}" on SBG MUSIC! Stream tracks or save a copy to your account.`,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleMakePublic = async () => {
    if (!isOwner) return;
    setIsUpdatingVisibility(true);
    try {
      await updateDoc(doc(db, 'userPlaylists', playlist.id), {
        visibility: 'public',
        isPublic: true,
        updatedAt: serverTimestamp(),
      });
      if (onVisibilityChange) {
        onVisibilityChange('public');
      }
    } catch (err) {
      console.error('Failed to update playlist to public:', err);
      alert('Failed to update visibility. Please try again.');
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  // Social share URLs
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(`Listen to "${playlist.name}" on SBG MUSIC!`);

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-emerald-600/20 hover:text-emerald-400 hover:border-emerald-500/30',
    },
    {
      name: 'X (Twitter)',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:bg-sky-600/20 hover:text-sky-400 hover:border-sky-500/30',
    },
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.org/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-blue-600/20 hover:text-blue-400 hover:border-blue-500/30',
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=Hey, check out this playlist: ${encodedUrl}`,
      color: 'hover:bg-purple-600/20 hover:text-purple-400 hover:border-purple-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#141416] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Share Playlist</h2>
              <p className="text-xs text-white/50">Generate a unique link to share with anyone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Playlist Preview Card */}
        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {coverImage ? (
              <img src={coverImage} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <ListMusic size={24} className="text-white/20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{playlist.name}</h3>
            <p className="text-xs text-white/40 truncate">By {playlist.ownerName || 'User'} • {trackCount} tracks</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {isPublic ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  <Globe size={10} />
                  Public Playlist
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  <Lock size={10} />
                  Private Playlist
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Private Warning / Visibility Toggle */}
        {!isPublic && isOwner && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3">
            <div className="flex items-start gap-2.5">
              <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">This playlist is currently Private</h4>
                <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                  Other users won't be able to view or save a copy of this playlist until you set it to Public.
                </p>
              </div>
            </div>
            <button
              onClick={handleMakePublic}
              disabled={isUpdatingVisibility}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isUpdatingVisibility ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Updating Visibility...</span>
                </>
              ) : (
                <>
                  <Globe size={14} />
                  <span>Make Public & Enable Sharing</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Share Link Input Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70">Unique Share Link</label>
          <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-2xl p-2 pl-4 focus-within:border-purple-500 transition-colors">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-xs text-white/90 focus:outline-none flex-1 font-mono select-all"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
              }`}
            >
              {copied ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Social Sharing Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70">Share Via</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {shareLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 text-white/70 transition-all text-xs font-medium gap-1.5 ${social.color}`}
                >
                  <Icon size={18} />
                  <span>{social.name}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Native Web Share Button if supported */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Share2 size={16} className="text-purple-400" />
            <span>Open System Share Menu</span>
          </button>
        )}

        {/* Clone/Save Info Banner */}
        <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-2xl flex items-start gap-2.5">
          <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-purple-200/80 leading-relaxed">
            When other listeners visit this link, they can listen to your playlist queue and click <strong>"Save a Copy"</strong> to add all {trackCount} tracks directly to their own account.
          </p>
        </div>
      </div>
    </div>
  );
}
