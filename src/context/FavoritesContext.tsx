import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Song } from '../types';

export type FavoritesList = Song[] & {
  size: number;
  has: (id: string) => boolean;
};

export interface FavoritesContextType {
  favorites: FavoritesList;
  favoriteIds: Set<string>;
  favoriteMeta: Map<string, any>;
  isFavorite: (songId: string) => boolean;
  toggleFavorite: (songOrId: string | Song, songMeta?: any) => Promise<void> | void;
  removeFavorite: (songId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

const STORAGE_KEY = 'sbg_favorites_v1';
const META_STORAGE_KEY = 'sbg_favorites_meta_v1';

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === 'string') {
            return {
              id: item,
              title: item.startsWith('yt_') ? 'YouTube Track' : 'Favorite Track',
              artist: 'Favorite Music',
              duration: 180,
            } as Song;
          }
          return item as Song;
        });
      }
      return [];
    } catch {
      return [];
    }
  });

  const [favoriteMeta, setFavoriteMeta] = useState<Map<string, any>>(() => {
    try {
      const stored = localStorage.getItem(META_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch {}
    return new Map();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteSongs));
    } catch {}
  }, [favoriteSongs]);

  useEffect(() => {
    try {
      const obj = Object.fromEntries(favoriteMeta);
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }, [favoriteMeta]);

  const favoriteIds = useMemo(() => {
    return new Set(favoriteSongs.map((s) => s.id));
  }, [favoriteSongs]);

  const isFavorite = (songId: string) => {
    if (!songId) return false;
    return favoriteIds.has(songId) || favoriteSongs.some((s) => s.id === songId);
  };

  const toggleFavorite = (songOrId: string | Song, songMeta?: any) => {
    let targetId = '';
    let songObject: Song | null = null;

    if (typeof songOrId === 'string') {
      targetId = songOrId;
      if (songMeta && typeof songMeta === 'object') {
        songObject = {
          id: targetId,
          title: songMeta.title || 'Liked Track',
          artist: songMeta.artist || 'Unknown Artist',
          coverUrl: songMeta.coverUrl || songMeta.thumbnailUrl || '',
          thumbnailUrl: songMeta.thumbnailUrl || songMeta.coverUrl || '',
          audioUrl: songMeta.audioUrl || '',
          duration: songMeta.duration || 180,
          youtubeVideoId: songMeta.youtubeVideoId,
          youtubeUrl: songMeta.youtubeUrl,
          source: songMeta.source || (targetId.startsWith('yt_') ? 'youtube' : 'upload'),
        };
      } else {
        songObject = {
          id: targetId,
          title: targetId.startsWith('yt_') ? 'YouTube Track' : 'Liked Track',
          artist: 'Favorite Track',
          duration: 180,
        };
      }
    } else if (songOrId && typeof songOrId === 'object') {
      targetId = songOrId.id;
      songObject = songOrId;
    }

    if (!targetId) return;

    if (isFavorite(targetId)) {
      setFavoriteSongs((prev) => prev.filter((s) => s.id !== targetId));
      setFavoriteMeta((prev) => {
        const next = new Map(prev);
        next.delete(targetId);
        return next;
      });
    } else {
      const newSong = songObject || {
        id: targetId,
        title: 'Liked Track',
        artist: 'Favorite',
        duration: 180,
      };
      setFavoriteSongs((prev) => [newSong, ...prev.filter((s) => s.id !== targetId)]);
      if (songMeta || songObject) {
        setFavoriteMeta((prev) => {
          const next = new Map(prev);
          next.set(targetId, songMeta || songObject);
          return next;
        });
      }
    }
  };

  const removeFavorite = (songId: string) => {
    setFavoriteSongs((prev) => prev.filter((s) => s.id !== songId));
    setFavoriteMeta((prev) => {
      const next = new Map(prev);
      next.delete(songId);
      return next;
    });
  };

  const favoritesProxy = useMemo(() => {
    const arr = [...favoriteSongs] as FavoritesList;
    Object.defineProperty(arr, 'size', {
      get() {
        return this.length;
      },
      configurable: true,
    });
    Object.defineProperty(arr, 'has', {
      value(id: string) {
        return this.some((s: any) => s.id === id);
      },
      configurable: true,
    });
    return arr;
  }, [favoriteSongs]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites: favoritesProxy,
        favoriteIds,
        favoriteMeta,
        isFavorite,
        toggleFavorite,
        removeFavorite,
      }}
    >
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
