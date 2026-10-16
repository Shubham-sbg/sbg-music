import { Song } from '../types';

const CACHE_NAME = 'sbg-music-offline-v1';
const RECENTLY_PLAYED_KEY = 'sbg_recently_played_offline_v2';

/**
 * Cache track metadata and thumbnail image for offline playback & history
 */
export async function cacheTrackForOffline(song: Song): Promise<void> {
  if (!song || !song.id) return;

  try {
    // 1. Store in localStorage recently played queue
    const existing = getOfflineRecentlyPlayed();
    const filtered = existing.filter((s) => s.id !== song.id);
    const updated = [song, ...filtered].slice(0, 50); // Keep last 50 tracks
    localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(updated));

    // 2. Cache image thumbnail using Cache API if available
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const imageUrl = song.coverUrl || song.thumbnailUrl;
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        try {
          // Attempt to fetch and cache cover image
          await cache.add(new Request(imageUrl, { mode: 'no-cors' }));
        } catch {
          // Ignore fetch errors for cross-origin images
        }
      }
    }
  } catch (e) {
    console.warn('[OfflineCache] Failed to cache track:', e);
  }
}

/**
 * Retrieve cached recently played tracks for offline listening
 */
export function getOfflineRecentlyPlayed(): Song[] {
  try {
    const raw = localStorage.getItem(RECENTLY_PLAYED_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Register Service Worker for offline PWA support
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}
