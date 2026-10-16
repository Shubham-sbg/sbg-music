import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useBranding } from '../lib/branding';

interface SBGMusicLogoProps {
  variant?: 'full' | 'icon' | 'monochrome' | 'animated';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  playing?: boolean;
  className?: string;
  clickable?: boolean;
}

export default function SBGMusicLogo({
  variant = 'full',
  size = 'md',
  playing,
  className = '',
  clickable = true,
}: SBGMusicLogoProps) {
  const { isPlaying } = usePlayer();
  const { branding } = useBranding();
  const isActuallyPlaying = typeof playing !== 'undefined' ? playing : isPlaying;

  const sizeMap = {
    sm: { img: 'h-7 w-auto', text: 'text-xl' },
    md: { img: 'h-9 w-auto', text: 'text-2xl' },
    lg: { img: 'h-12 w-auto', text: 'text-3xl' },
    xl: { img: 'h-16 w-auto', text: 'text-4xl' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Official SBG MUSIC Headphones Brand Logo */}
      <div className={`relative ${currentSize.img} aspect-square rounded-xl overflow-hidden bg-[#141416] p-0.5 border border-purple-500/30 shadow-md shadow-purple-900/30 flex items-center justify-center shrink-0`}>
        <img
          src={variant === 'icon' ? branding.appIcon : branding.websiteLogo}
          alt="SBG MUSIC Logo"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as any).src = '/assets/branding/sbg-music-logo.png';
          }}
        />
      </div>

      {variant === 'full' && (
        <span className={`font-black tracking-tight text-white hidden sm:block ${currentSize.text}`}>
          SBG <span className="text-purple-500 font-extrabold">MUSIC</span>
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link to="/" className="inline-block hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

