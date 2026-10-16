import React, { createContext, useContext, useState, useEffect } from 'react';
import { Song } from '../types';

interface FavoritesContextType {
  favorites: Song[];
  isFavorite: (songId: string) => boolean;
  toggleFavorite: (song: Song) => void;
  removeFavorite: (songId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

const STORAGE_KEY = 'sbg_favorites_v1';

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Song[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const isFavorite = (songId: string) => {
    return favorites.some((s) => s.id === songId);
  };

  const toggleFavorite = (song: Song) => {
    setFavorites((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) {
        return prev.filter((s) => s.id !== song.id);
      } else {
        return [song, ...prev];
      }
    });
  };

  const removeFavorite = (songId: string) => {
    setFavorites((prev) => prev.filter((s) => s.id !== songId));
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
