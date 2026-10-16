import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../lib/branding';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  textClassName?: string;
  iconOnly?: boolean;
  clickable?: boolean;
}

export default function Logo({
  size = 'md',
  showText = true,
  className = '',
  textClassName = '',
  iconOnly = false,
  clickable = true,
}: LogoProps) {
  const { branding } = useBranding();

  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-base', imgHeight: 'h-7' },
    md: { icon: 'w-9 h-9', text: 'text-xl md:text-2xl', imgHeight: 'h-9' },
    lg: { icon: 'w-11 h-11', text: 'text-2xl md:text-3xl', imgHeight: 'h-11' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl md:text-4xl', imgHeight: 'h-16' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* Official SBG MUSIC Brand Logo Icon */}
      <div className={`relative ${currentSize.icon} rounded-xl overflow-hidden shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-all duration-300 flex items-center justify-center shrink-0 bg-[#141416] border border-purple-500/20`}>
        <img
          src={branding.appIcon || branding.appLogo}
          alt="SBG MUSIC Logo"
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            (e.target as any).src = '/assets/branding/sbg-music-icon.png';
          }}
        />
      </div>

      {showText && !iconOnly && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tighter text-white group-hover:text-purple-400 transition-colors ${currentSize.text} ${textClassName}`}>
            SBG <span className="text-purple-500 font-extrabold">MUSIC</span>
          </span>
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase mt-0.5 hidden sm:block">
            BY SBG INDUSTRY
          </span>
        </div>
      )}
    </div>
  );

  if (clickable) {
    return <Link to="/">{content}</Link>;
  }

  return content;
}
