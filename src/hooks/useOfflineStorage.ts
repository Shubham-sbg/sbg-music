import { useState, useEffect, useCallback } from 'react';
import { 
  OfflineSongMetadata, 
  getAllOfflineSongs, 
  getOfflineMetadata, 
  startDownloadSong, 
  pauseDownloadSong, 
  resumeDownloadSong, 
  cancelDownloadSong, 
  deleteOfflineSong,
  preloadOfflineBlobUrls,
  estimateStorageUsage
} from '../services/offlineStorageService';
import { Song } from '../types';
import { isSongDownloadable } from '../utils/catalogUtils';

export function useOfflineStorage(userId?: string) {
  const [offlineSongs, setOfflineSongs] = useState<OfflineSongMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<{
    usedBytes: number;
    quotaBytes: number;
    availableBytes: number;
    formattedUsed: string;
    formattedAvailable: string;
    formattedQuota: string;
    percentageUsed: number;
  }>({
    usedBytes: 0,
    quotaBytes: 1024 * 1024 * 1024,
    availableBytes: 1024 * 1024 * 1024,
    formattedUsed: '0 MB',
    formattedAvailable: '1 GB',
    formattedQuota: '1 GB',
    percentageUsed: 0,
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const loadOfflineSongs = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        getAllOfflineSongs(),
        estimateStorageUsage()
      ]);
      setOfflineSongs(list);
      setStorageStats(stats);
    } catch (err) {
      console.warn('Failed to load offline songs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfflineSongs();
    preloadOfflineBlobUrls();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleStorageUpdate = () => loadOfflineSongs();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sbg_offline_storage_updated', handleStorageUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sbg_offline_storage_updated', handleStorageUpdate);
    };
  }, [loadOfflineSongs]);

  const downloadSong = useCallback(async (song: Song) => {
    return await startDownloadSong(song, userId);
  }, [userId]);

  const pauseDownload = useCallback(async (songId: string) => {
    await pauseDownloadSong(songId);
  }, []);

  const resumeDownload = useCallback(async (song: Song) => {
    return await resumeDownloadSong(song, userId);
  }, [userId]);

  const cancelDownload = useCallback(async (songId: string) => {
    await cancelDownloadSong(songId);
  }, []);

  const deleteDownload = useCallback(async (songId: string) => {
    await deleteOfflineSong(songId);
  }, []);

  const getSongOfflineState = useCallback((songId: string): OfflineSongMetadata | undefined => {
    return offlineSongs.find((s) => s.songId === songId);
  }, [offlineSongs]);

  const isSongDownloaded = useCallback((songId: string): boolean => {
    return offlineSongs.some((s) => s.songId === songId && s.downloadStatus === 'downloaded');
  }, [offlineSongs]);

  return {
    isOnline,
    offlineSongs,
    storageStats,
    loading,
    downloadSong,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    getSongOfflineState,
    isSongDownloaded,
    isSongEligible: isSongDownloadable,
    refreshOfflineList: loadOfflineSongs,
  };
}
