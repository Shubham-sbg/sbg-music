import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  MessageCircle, 
  Twitter, 
  Send, 
  Mail, 
  Music, 
  Sparkles,
  ExternalLink,
  Facebook
} from 'lucide-react';
import { Song } from '../types';

interface ShareSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onOpenCardModal?: (song: Song) => void;
}

export default function ShareSongModal({
  isOpen,
  onClose,
  song,
  onOpenCardModal,
}: ShareSongModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !song) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = `${origin}/song/${song.id}`;
  const artwork = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(deepLinkUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = deepLinkUrl;
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
      console.error('Failed to copy song deep link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `${song.title} — SBG MUSIC`,
          text: `Listen to "${song.title}" by ${song.artist || 'SBG MUSIC'} on SBG MUSIC!`,
          url: deepLinkUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Social Share Encoded URLs
  const shareTitle = `Listen to "${song.title}" by ${song.artist || 'SBG Music'} on SBG MUSIC!`;
  const encodedUrl = encodeURIComponent(deepLinkUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  const socialPlatforms = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-emerald-600/20 hover:text-emerald-400 hover:border-emerald-500/30 text-emerald-400/90',
    },
    {
      name: 'X (Twitter)',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:bg-sky-600/20 hover:text-sky-400 hover:border-sky-500/30 text-sky-400/90',
    },
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-blue-600/20 hover:text-blue-400 hover:border-blue-500/30 text-blue-400/90',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-indigo-600/20 hover:text-indigo-400 hover:border-indigo-500/30 text-indigo-400/90',
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=Hey, check out this track: ${deepLinkUrl}`,
      color: 'hover:bg-purple-600/20 hover:text-purple-400 hover:border-purple-500/30 text-purple-400/90',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#131317] border border-white/10 rounded-3xl p-6 md:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Share Track</h2>
              <p className="text-xs text-white/50">Send deep link or share to social media</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Track Preview Card */}
        <div className="bg-black/50 border border-white/10 p-3.5 rounded-2xl flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {artwork ? (
              <img src={artwork} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <Music size={22} className="text-white/20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{song.title}</h3>
            <p className="text-xs text-white/50 truncate">{song.artist || 'SBG MUSIC'}</p>
            {song.genre && (
              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-purple-300 border border-purple-500/20">
                {song.genre}
              </span>
            )}
          </div>
        </div>

        {/* Deep Link Input & Copy Button */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70">Song Deep Link</label>
          <div className="flex items-center gap-2 bg-black/70 border border-white/10 rounded-2xl p-1.5 pl-3.5 focus-within:border-purple-500 transition-colors">
            <input
              type="text"
              readOnly
              value={deepLinkUrl}
              className="bg-transparent text-xs text-white/90 focus:outline-none flex-1 font-mono select-all truncate"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 active:scale-95'
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

        {/* Social Sharing Grid */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70">Share to Social Media</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {socialPlatforms.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 transition-all text-xs font-medium gap-1.5 cursor-pointer ${social.color}`}
                >
                  <Icon size={18} />
                  <span className="text-white/80">{social.name}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Native Web Share Button */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Share2 size={16} className="text-purple-400" />
            <span>Open System Share Menu</span>
          </button>
        )}

        {/* Stylized Visual Card Trigger if available */}
        {onOpenCardModal && (
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => {
                onClose();
                onOpenCardModal(song);
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 text-purple-300 font-bold text-xs rounded-2xl border border-purple-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
            >
              <Sparkles size={16} className="text-pink-400" />
              <span>Create Stylized Story Share Card</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
