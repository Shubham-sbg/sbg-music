import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';

interface FavoriteButtonProps {
  songId?: string;
  song?: any;
  className?: string;
  size?: number;
}

export default function FavoriteButton({ songId, song, className = '', size = 16 }: FavoriteButtonProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [isAnimating, setIsAnimating] = useState(false);
  
  const targetId = songId || song?.id || (song?.youtubeVideoId ? `yt_${song.youtubeVideoId}` : '');
  const favorited = Boolean(targetId && isFavorite(targetId));

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!targetId) return;
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    await toggleFavorite(targetId, song);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative z-10 p-1.5 rounded-lg border backdrop-blur-md transition-all shadow ${
        favorited 
          ? 'bg-red-500/20 border-red-500/30 text-red-500 hover:bg-red-500/30' 
          : 'bg-black/60 border-white/20 text-white/80 hover:bg-black hover:text-white'
      } ${isAnimating ? 'scale-125' : 'scale-100'} ${className}`}
      title={favorited ? "Remove from Favorites" : "Add to Favorites"}
    >
      <Heart 
        size={size} 
        fill={favorited ? "currentColor" : "none"} 
        className={`transition-colors ${isAnimating ? 'animate-pulse' : ''}`}
      />
    </button>
  );
}
