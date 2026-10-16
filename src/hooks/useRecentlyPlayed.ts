import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types';

const RECENTLY_PLAYED_KEY = 'sbg_recently_played';
const MAX_RECENT_SONGS = 20;

export function useRecentlyPlayed() {
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);

  const loadRecent = useCallback(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_PLAYED_KEY);
      if (stored) {
        setRecentSongs(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse recently played songs', e);
    }
  }, []);

  useEffect(() => {
    loadRecent();
    const handleUpdate = () => loadRecent();
    window.addEventListener('recently_played_updated', handleUpdate);
    return () => window.removeEventListener('recently_played_updated', handleUpdate);
  }, [loadRecent]);

  const addRecentSong = useCallback((song: Song) => {
    setRecentSongs((prev) => {
      // Remove if already exists to push it to the top
      const filtered = prev.filter(s => s.id !== song.id);
      const newRecent = [song, ...filtered].slice(0, MAX_RECENT_SONGS);
      
      try {
        localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(newRecent));
      } catch (e) {
        console.warn('Failed to save recently played songs', e);
      }
      
      return newRecent;
    });
  }, []);

  const clearRecentSongs = useCallback(() => {
    setRecentSongs([]);
    try {
      localStorage.removeItem(RECENTLY_PLAYED_KEY);
    } catch (e) {
      console.warn('Failed to clear recently played songs', e);
    }
  }, []);

  return { recentSongs, addRecentSong, clearRecentSongs };
}
