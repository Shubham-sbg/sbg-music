import { useState, useEffect, useCallback } from 'react';
import { 
  getSavedOfflineSongs, 
  cacheSongForOffline, 
  removeSongFromOffline, 
  cachePopularSongs, 
  subscribeToOfflineSyncProgress, 
  OfflineSongItem, 
  OfflineSyncProgress 
} from '../services/offlineMusicService';
import { Song } from '../types';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [offlineSongs, setOfflineSongs] = useState<OfflineSongItem[]>(() => getSavedOfflineSongs());
  const [syncProgress, setSyncProgress] = useState<OfflineSyncProgress>({
    total: 0,
    completed: 0,
    isSyncing: false,
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSongsUpdated = (e: any) => {
      setOfflineSongs(e.detail || getSavedOfflineSongs());
    };
    window.addEventListener('offline_songs_updated', handleSongsUpdated);

    const unsubscribeSync = subscribeToOfflineSyncProgress((progress) => {
      setSyncProgress(progress);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_songs_updated', handleSongsUpdated);
      unsubscribeSync();
    };
  }, []);

  const downloadSong = useCallback(async (song: Song) => {
    return await cacheSongForOffline(song);
  }, []);

  const deleteDownloadedSong = useCallback(async (songId: string) => {
    await removeSongFromOffline(songId);
  }, []);

  const downloadPopularSongs = useCallback(async (songs: Song[], count = 8) => {
    return await cachePopularSongs(songs, count);
  }, []);

  const isDownloaded = useCallback((songId: string) => {
    return offlineSongs.some((s) => s.id === songId && s.isFullyCached);
  }, [offlineSongs]);

  return {
    isOnline,
    isOffline: !isOnline,
    offlineSongs,
    syncProgress,
    downloadSong,
    deleteDownloadedSong,
    downloadPopularSongs,
    isDownloaded,
  };
}
