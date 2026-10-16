import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Song } from '../types';
import ShareSongModal from './ShareSongModal';
import ShareCardModal from './ShareCardModal';

interface ShareSongButtonProps {
  song: Song;
  className?: string;
  size?: number;
  showText?: boolean;
  text?: string;
  variant?: 'icon' | 'card' | 'pill' | 'button';
  stopPropagation?: boolean;
}

export default function ShareSongButton({
  song,
  className = '',
  size = 14,
  showText = false,
  text = 'Share',
  variant = 'icon',
  stopPropagation = true,
}: ShareSongButtonProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsShareModalOpen(true);
  };

  const baseStyles = (() => {
    switch (variant) {
      case 'card':
        return 'p-1.5 rounded-lg bg-black/60 hover:bg-black text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all shadow flex items-center justify-center cursor-pointer active:scale-95';
      case 'pill':
        return 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer active:scale-95';
      case 'button':
        return 'flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl border border-white/10 transition-colors cursor-pointer active:scale-95';
      case 'icon':
      default:
        return 'p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer';
    }
  })();

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`Share "${song.title}"`}
        aria-label={`Share ${song.title}`}
        className={`${baseStyles} ${className}`}
      >
        <Share2 size={size} />
        {showText && <span className="truncate">{text}</span>}
      </button>

      {/* Share Modal */}
      {isShareModalOpen && (
        <ShareSongModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          song={song}
          onOpenCardModal={() => setIsCardModalOpen(true)}
        />
      )}

      {/* Stylized Story Card Modal */}
      {isCardModalOpen && (
        <ShareCardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          song={song}
        />
      )}
    </>
  );
}
