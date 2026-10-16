import { useState, useEffect, useCallback } from 'react';

export interface SavedPlaybackPosition {
  songId: string;
  position: number;
  duration: number;
  updatedAt: number;
}

const PLAYBACK_POSITIONS_KEY = 'sbg_playback_positions';
const MIN_RESUME_THRESHOLD_SECONDS = 3;
const END_THRESHOLD_SECONDS = 4;

export function getAllSavedPositions(): Record<string, SavedPlaybackPosition> {
  try {
    const raw = localStorage.getItem(PLAYBACK_POSITIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse saved playback positions:', err);
    return {};
  }
}

export function getSongSavedPosition(songId: string): SavedPlaybackPosition | null {
  if (!songId) return null;
  const positions = getAllSavedPositions();
  const entry = positions[songId];
  if (!entry) return null;

  // Check if position is meaningful (not in first 3s and not within 4s of track completion)
  if (entry.position < MIN_RESUME_THRESHOLD_SECONDS) return null;
  if (entry.duration > 0 && entry.duration - entry.position < END_THRESHOLD_SECONDS) {
    return null;
  }
  return entry;
}

export function saveSongPlaybackPosition(songId: string, position: number, duration: number): void {
  if (!songId || isNaN(position) || position < 0) return;

  try {
    const positions = getAllSavedPositions();

    // If near beginning or near end, remove saved position
    if (
      position < MIN_RESUME_THRESHOLD_SECONDS ||
      (duration > 0 && duration - position < END_THRESHOLD_SECONDS)
    ) {
      if (positions[songId]) {
        delete positions[songId];
        localStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(positions));
        window.dispatchEvent(new CustomEvent('playback_positions_updated', { detail: { songId, cleared: true } }));
      }
      return;
    }

    positions[songId] = {
      songId,
      position: Math.round(position * 10) / 10,
      duration: Math.round((duration || 0) * 10) / 10,
      updatedAt: Date.now(),
    };

    localStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(positions));
    window.dispatchEvent(new CustomEvent('playback_positions_updated', { detail: { songId, position, duration } }));
  } catch (err) {
    console.warn('Failed to save playback position to localStorage:', err);
  }
}

export function clearSongPlaybackPosition(songId: string): void {
  if (!songId) return;
  try {
    const positions = getAllSavedPositions();
    if (positions[songId]) {
      delete positions[songId];
      localStorage.setItem(PLAYBACK_POSITIONS_KEY, JSON.stringify(positions));
      window.dispatchEvent(new CustomEvent('playback_positions_updated', { detail: { songId, cleared: true } }));
    }
  } catch (err) {
    console.warn('Failed to clear playback position:', err);
  }
}

export function formatTimeDisplay(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function usePlaybackPositions(targetSongId?: string) {
  const [positions, setPositions] = useState<Record<string, SavedPlaybackPosition>>(() => getAllSavedPositions());

  const reload = useCallback(() => {
    setPositions(getAllSavedPositions());
  }, []);

  useEffect(() => {
    reload();
    const handleUpdate = () => {
      reload();
    };

    window.addEventListener('playback_positions_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('playback_positions_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [reload]);

  const targetPosition = targetSongId ? getSongSavedPosition(targetSongId) : null;

  return {
    positions,
    targetPosition,
    getSavedPosition: (id: string) => getSongSavedPosition(id),
    savePosition: saveSongPlaybackPosition,
    clearPosition: clearSongPlaybackPosition,
    reload,
  };
}
