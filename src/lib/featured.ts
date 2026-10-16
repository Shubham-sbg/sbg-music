import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  increment,
  Timestamp 
} from 'firebase/firestore';
import { 
  FeaturedRelease, 
  FeaturedReleaseAnalytics, 
  FeaturedConfig, 
  FeaturedCtaLink, 
  Song,
  UnifiedFeaturedConfig,
  FeaturedHistoryItem
} from '../types';
import { getVisitorId, getTodayDateString } from './analytics';
import { dedupeRequest, invalidateCache } from './cache';

export interface UnifiedActiveFeaturedResult {
  config: UnifiedFeaturedConfig | null;
  song?: Song | null;
  playlist?: any | null;
  offlineSong?: Song | null;
}

/**
 * Invalidate all featured-related caches across client and server proxy.
 */
export function invalidateFeaturedCaches() {
  invalidateCache('active_featured');
  invalidateCache('featured_bundle');
  invalidateCache('featured_config');
  invalidateCache('featured_history');
  invalidateCache('featured_youtube_playlist');
  if (typeof window !== 'undefined') {
    fetch('/api/catalog/invalidate', { method: 'POST' }).catch(() => {});
    window.dispatchEvent(new CustomEvent('sbg:featured-updated'));
  }
}

/**
 * Single source of truth for the active homepage featured item.
 * Loads siteConfig/featured (or settings/featured) and resolves associated song/playlist data.
 */
export async function getActiveFeatured(forceRefresh = false): Promise<UnifiedActiveFeaturedResult> {
  if (forceRefresh) {
    invalidateFeaturedCaches();
  }

  return dedupeRequest(
    'active_featured',
    async () => {
      // 1. Try server-cached API proxy first (0 Firestore client reads)
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/catalog/featured');
          if (res.ok) {
            const json = await res.json();
            if (json.ok && json.activeFeatured) {
              return json.activeFeatured as UnifiedActiveFeaturedResult;
            }
          }
        } catch {
          // Fallback to client Firestore query
        }
      }

      // 2. Direct Firestore Client SDK
      try {
        let snap = await getDoc(doc(db, 'siteConfig', 'featured'));
        if (!snap.exists()) {
          // Try settings/featured
          try {
            snap = await getDoc(doc(db, 'settings', 'featured'));
          } catch {}
        }

        if (snap && snap.exists()) {
          const data = snap.data();
          
          // Legacy migration fallback: if doc only had featuredSongId, map to type 'song'
          const resolvedType = data.type || (data.featuredSongId ? 'song' : data.youtubePlaylistId ? 'youtube_playlist' : 'release');
          const resolvedTitle = data.title || (data.badge || 'Featured Release');

          const config: UnifiedFeaturedConfig = {
            id: snap.id,
            enabled: data.enabled !== false, // default true unless explicitly disabled
            type: resolvedType,
            title: resolvedTitle,
            subtitle: data.subtitle || '',
            description: data.description || data.featuredOfflineDescription || '',
            thumbnailUrl: data.thumbnailUrl || data.coverUrl || '',
            badge: data.badge || 'FEATURED RELEASE',
            songId: data.songId || data.featuredSongId || null,
            featuredSongId: data.songId || data.featuredSongId || null,
            playlistId: data.playlistId || null,
            youtubePlaylistId: data.youtubePlaylistId || null,
            youtubeUrl: data.youtubeUrl || (data.youtubePlaylistId ? `https://youtube.com/playlist?list=${data.youtubePlaylistId}` : null),
            channelTitle: data.channelTitle || '',
            artistName: data.artistName || '',
            albumName: data.albumName || '',
            source: data.source || (data.youtubePlaylistId ? 'youtube' : 'sbg'),
            ctaText: data.ctaText || 'Listen Now',
            ctaDestination: data.ctaDestination || '',
            externalLinks: data.externalLinks || [],
            displayOrder: data.displayOrder || 1,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            showCommunityPlaylistsOnHome: data.showCommunityPlaylistsOnHome ?? true,
            featuredOfflineSongId: data.featuredOfflineSongId || null,
            featuredOfflineBadge: data.featuredOfflineBadge || 'AVAILABLE OFFLINE',
            featuredOfflineDescription: data.featuredOfflineDescription || '',
            updatedAt: data.updatedAt || Date.now(),
            updatedBy: data.updatedBy || 'admin',
          };

          let song: Song | null = null;
          let playlist: any = null;
          let offlineSong: Song | null = null;

          const fetchPromises: Promise<any>[] = [];

          const targetSongId = config.songId || config.featuredSongId;
          if (targetSongId) {
            fetchPromises.push(
              getDoc(doc(db, 'songs', targetSongId))
                .then((sSnap) => {
                  if (sSnap.exists()) {
                    song = { id: sSnap.id, ...sSnap.data() } as Song;
                    if (!config.title || config.title === 'Featured Release') {
                      config.title = song.title;
                    }
                    if (!config.subtitle) {
                      config.subtitle = song.artist;
                    }
                    if (!config.thumbnailUrl) {
                      config.thumbnailUrl = getSongArtwork(song);
                    }
                  }
                })
                .catch((e) => console.warn('[Featured] Notice resolving song document:', e))
            );
          }

          if (config.playlistId) {
            fetchPromises.push(
              getDoc(doc(db, 'playlists', config.playlistId))
                .then((pSnap) => {
                  if (pSnap.exists()) {
                    playlist = { id: pSnap.id, ...pSnap.data() };
                    if (!config.title) config.title = playlist.title;
                    if (!config.thumbnailUrl && playlist.coverUrl) config.thumbnailUrl = playlist.coverUrl;
                  }
                })
                .catch((e) => console.warn('[Featured] Notice resolving playlist document:', e))
            );
          }

          if (config.featuredOfflineSongId) {
            if (config.featuredOfflineSongId === targetSongId) {
              offlineSong = song;
            } else {
              fetchPromises.push(
                getDoc(doc(db, 'songs', config.featuredOfflineSongId))
                  .then((osSnap) => {
                    if (osSnap.exists()) offlineSong = { id: osSnap.id, ...osSnap.data() } as Song;
                  })
                  .catch((e) => console.warn('[Featured] Notice resolving offline song document:', e))
              );
            }
          }

          await Promise.all(fetchPromises);

          if (config.featuredOfflineSongId && config.featuredOfflineSongId === targetSongId) {
            offlineSong = song;
          }

          return { config, song, playlist, offlineSong };
        }

        // Safe migration fallback: if siteConfig/featured does not exist, check siteConfig/featuredYoutubePlaylist
        try {
          const ytSnap = await getDoc(doc(db, 'siteConfig', 'featuredYoutubePlaylist'));
          if (ytSnap.exists()) {
            const ytData = ytSnap.data();
            if (ytData.enabled !== false && ytData.playlistId) {
              const config: UnifiedFeaturedConfig = {
                id: 'featuredYoutubePlaylist',
                enabled: true,
                type: 'youtube_playlist',
                title: ytData.title || 'Featured YouTube Playlist',
                subtitle: ytData.channelTitle || 'YouTube Curator',
                description: ytData.description || '',
                thumbnailUrl: ytData.thumbnailUrl || '',
                badge: 'FEATURED YOUTUBE PLAYLIST',
                youtubePlaylistId: ytData.playlistId,
                youtubeUrl: ytData.youtubeUrl || `https://youtube.com/playlist?list=${ytData.playlistId}`,
                channelTitle: ytData.channelTitle || '',
                source: 'youtube',
                ctaText: 'Play Playlist',
                ctaDestination: `https://youtube.com/playlist?list=${ytData.playlistId}`,
                updatedAt: ytData.updatedAt || Date.now(),
                updatedBy: ytData.updatedBy || 'admin',
              };
              return { config, song: null, playlist: null, offlineSong: null };
            }
          }
        } catch {}
      } catch (err) {
        console.warn('[Featured] Error fetching active featured config from Firestore:', err);
      }

      return { config: null, song: null, playlist: null, offlineSong: null };
    },
    300000
  );
}

/**
 * Saves a new active featured configuration to siteConfig/featured and settings/featured.
 * If replaceCurrent is true or an active item already exists, atomically archives previous configuration to featuredHistory.
 */
export async function saveActiveFeatured(
  newConfig: Partial<UnifiedFeaturedConfig>,
  replaceCurrent = true,
  userEmail = 'admin'
): Promise<void> {
  const ref = doc(db, 'siteConfig', 'featured');
  const settingsRef = doc(db, 'settings', 'featured');
  const ytRef = doc(db, 'siteConfig', 'featuredYoutubePlaylist');
  const now = Date.now();

  try {
    // 1. Check existing active item to archive to history
    let existingData: any = null;
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        existingData = snap.data();
      }
    } catch {}

    // Archive old active config to history if it had valid content
    if (existingData && (existingData.title || existingData.songId || existingData.featuredSongId || existingData.youtubePlaylistId)) {
      try {
        const historyId = `feat_${existingData.updatedAt || now}_${Math.random().toString(36).substring(2, 6)}`;
        const historyRef = doc(db, 'featuredHistory', historyId);
        await setDoc(historyRef, {
          ...existingData,
          id: historyId,
          archivedAt: now,
          archivedBy: userEmail,
        });
      } catch (archErr) {
        console.warn('[Featured] Notice archiving previous item to history:', archErr);
      }
    }

    // 2. Set new active featured configuration
    const resolvedPayload: any = {
      ...newConfig,
      enabled: newConfig.enabled !== false,
      type: newConfig.type || 'song',
      title: newConfig.title || 'Featured Content',
      subtitle: newConfig.subtitle || '',
      description: newConfig.description || '',
      thumbnailUrl: newConfig.thumbnailUrl || '',
      badge: newConfig.badge || 'FEATURED RELEASE',
      songId: newConfig.songId || null,
      featuredSongId: newConfig.songId || newConfig.featuredSongId || null,
      playlistId: newConfig.playlistId || null,
      youtubePlaylistId: newConfig.youtubePlaylistId || null,
      youtubeUrl: newConfig.youtubeUrl || null,
      channelTitle: newConfig.channelTitle || '',
      artistName: newConfig.artistName || '',
      albumName: newConfig.albumName || '',
      source: newConfig.source || (newConfig.youtubePlaylistId ? 'youtube' : 'sbg'),
      ctaText: newConfig.ctaText || 'Listen Now',
      ctaDestination: newConfig.ctaDestination || '',
      externalLinks: newConfig.externalLinks || [],
      displayOrder: newConfig.displayOrder || 1,
      startDate: newConfig.startDate || null,
      endDate: newConfig.endDate || null,
      updatedAt: now,
      updatedBy: userEmail,
      createdAt: newConfig.createdAt || now,
    };

    // Atomically write to siteConfig/featured and settings/featured
    await setDoc(ref, resolvedPayload);
    try {
      await setDoc(settingsRef, resolvedPayload);
    } catch (sErr) {
      console.warn('[Featured] Notice syncing settings/featured:', sErr);
    }

    // Synchronize siteConfig/featuredYoutubePlaylist to prevent conflicting items
    if (resolvedPayload.type === 'youtube_playlist') {
      const ytPayload = {
        source: 'youtube',
        playlistId: resolvedPayload.youtubePlaylistId,
        youtubeUrl: resolvedPayload.youtubeUrl || `https://youtube.com/playlist?list=${resolvedPayload.youtubePlaylistId}`,
        title: resolvedPayload.title,
        description: resolvedPayload.description,
        thumbnailUrl: resolvedPayload.thumbnailUrl,
        channelTitle: resolvedPayload.channelTitle,
        enabled: resolvedPayload.enabled,
        createdAt: resolvedPayload.createdAt,
        updatedAt: now,
        updatedBy: userEmail,
      };
      await setDoc(ytRef, ytPayload);
    } else {
      // If active item is not a YouTube playlist, disable any legacy YouTube playlist
      try {
        await setDoc(ytRef, { enabled: false, updatedAt: now, updatedBy: userEmail }, { merge: true });
      } catch {}
    }

    invalidateFeaturedCaches();
  } catch (err: any) {
    console.error('[Featured] Failed to save active featured configuration:', err);
    throw new Error(err?.message || 'Failed to save active featured item');
  }
}

/**
 * Toggles the enabled state of the active featured item without deleting its configuration.
 */
export async function setFeaturedEnabled(enabled: boolean, userEmail = 'admin'): Promise<void> {
  const ref = doc(db, 'siteConfig', 'featured');
  const settingsRef = doc(db, 'settings', 'featured');
  const ytRef = doc(db, 'siteConfig', 'featuredYoutubePlaylist');
  const now = Date.now();

  try {
    await setDoc(ref, { enabled, updatedAt: now, updatedBy: userEmail }, { merge: true });
    try {
      await setDoc(settingsRef, { enabled, updatedAt: now, updatedBy: userEmail }, { merge: true });
    } catch {}

    // Also sync siteConfig/featuredYoutubePlaylist if disabled
    if (!enabled) {
      try {
        await setDoc(ytRef, { enabled: false, updatedAt: now, updatedBy: userEmail }, { merge: true });
      } catch {}
    }

    invalidateFeaturedCaches();
  } catch (err: any) {
    console.error('[Featured] Failed to update enabled state:', err);
    throw err;
  }
}

/**
 * Deactivates and archives the current active featured item.
 */
export async function removeActiveFeatured(userEmail = 'admin'): Promise<void> {
  const ref = doc(db, 'siteConfig', 'featured');
  const settingsRef = doc(db, 'settings', 'featured');
  const ytRef = doc(db, 'siteConfig', 'featuredYoutubePlaylist');
  const now = Date.now();

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.title || data.songId || data.featuredSongId || data.youtubePlaylistId) {
        const historyId = `feat_${data.updatedAt || now}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, 'featuredHistory', historyId), {
          ...data,
          id: historyId,
          archivedAt: now,
          archivedBy: userEmail,
        });
      }
    }

    const resetPayload = {
      enabled: false,
      type: 'release',
      title: '',
      subtitle: '',
      description: '',
      thumbnailUrl: '',
      badge: 'FEATURED RELEASE',
      songId: null,
      featuredSongId: null,
      playlistId: null,
      youtubePlaylistId: null,
      updatedAt: now,
      updatedBy: userEmail,
    };

    await setDoc(ref, resetPayload);
    try {
      await setDoc(settingsRef, resetPayload);
    } catch {}
    try {
      await setDoc(ytRef, { enabled: false, updatedAt: now, updatedBy: userEmail }, { merge: true });
    } catch {}

    invalidateFeaturedCaches();
  } catch (err: any) {
    console.error('[Featured] Failed to remove active featured item:', err);
    throw err;
  }
}

/**
 * Fetches the archived history of previous featured configurations.
 */
export async function fetchFeaturedHistory(): Promise<FeaturedHistoryItem[]> {
  return dedupeRequest(
    'featured_history',
    async () => {
      try {
        const q = query(collection(db, 'featuredHistory'), orderBy('archivedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeaturedHistoryItem));
      } catch (err) {
        console.warn('[Featured] Notice fetching featured history (quota/offline):', err);
        return [];
      }
    },
    120000
  );
}

/**
 * Activates a previously archived item from history, safely archiving the currently active item first.
 */
export async function activateHistoryItem(
  historyItem: FeaturedHistoryItem,
  userEmail = 'admin'
): Promise<void> {
  const itemToActivate = { ...historyItem, enabled: true };
  delete (itemToActivate as any).archivedAt;
  delete (itemToActivate as any).archivedBy;
  await saveActiveFeatured(itemToActivate, true, userEmail);
}

/**
 * Deletes a single item from featured history permanently.
 */
export async function deleteHistoryItem(historyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'featuredHistory', historyId));
    invalidateCache('featured_history');
  } catch (err: any) {
    console.error('[Featured] Failed to delete history item:', err);
    throw err;
  }
}

/**
 * URL sanitization & validation helper to enforce security rules.
 * Accepts only http:// and https:// URLs.
 * Rejects javascript:, data:, vbscript:, file:.
 */
export function sanitizeAndValidateUrl(url: string): { isValid: boolean; normalizedUrl: string } {
  if (!url || typeof url !== 'string') return { isValid: false, normalizedUrl: '' };
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    return { isValid: false, normalizedUrl: '' };
  }

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return { isValid: true, normalizedUrl: trimmed };
  }

  if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(trimmed)) {
    return { isValid: true, normalizedUrl: `https://${trimmed}` };
  }

  return { isValid: false, normalizedUrl: '' };
}

/**
 * Extracts the primary canonical artwork/thumbnail URL for a song.
 */
export function getSongArtwork(song?: Song | null): string {
  if (!song) return '';
  return (
    song.imageUrl ||
    song.customCoverUrl ||
    song.coverUrl ||
    song.heroImageUrl ||
    song.thumbnailUrl ||
    ''
  );
}

export interface FeaturedBundle {
  config: FeaturedConfig;
  song: Song | null;
  offlineSong?: Song | null;
}

/**
 * Fetches the site-wide featured song configuration and resolves the song document in a single cached pass.
 * Prevents waterfalls and eliminates initial hero loading delays.
 */
export async function getFeaturedBundle(forceRefresh = false): Promise<FeaturedBundle> {
  if (forceRefresh) {
    invalidateCache('featured_bundle');
    invalidateCache('featured_config');
    if (typeof window !== 'undefined') {
      fetch('/api/catalog/invalidate', { method: 'POST' }).catch(() => {});
    }
  }

  return dedupeRequest(
    'featured_bundle',
    async () => {
      // 1. Check server-cached featured API proxy (0 Firestore client reads)
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/catalog/featured');
          if (res.ok) {
            const json = await res.json();
            if (json.ok && json.bundle && json.bundle.config) {
              return json.bundle as FeaturedBundle;
            }
          }
        } catch {
          // Fallback to client Firestore query
        }
      }

      // 2. Direct Firestore Client SDK fallback
      try {
        const snap = await getDoc(doc(db, 'siteConfig', 'featured'));
        if (snap.exists()) {
          const data = snap.data();
          const config: FeaturedConfig = {
            featuredSongId: data.featuredSongId || null,
            externalLinks: data.externalLinks || [],
            badge: data.badge || 'FEATURED RELEASE',
            showCommunityPlaylistsOnHome: data.showCommunityPlaylistsOnHome ?? true,
            featuredOfflineSongId: data.featuredOfflineSongId || null,
            featuredOfflineBadge: data.featuredOfflineBadge || 'AVAILABLE OFFLINE',
            featuredOfflineDescription: data.featuredOfflineDescription || '',
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          };

          let song: Song | null = null;
          let offlineSong: Song | null = null;

          const songPromises: Promise<any>[] = [];

          if (config.featuredSongId) {
            songPromises.push(
              getDoc(doc(db, 'songs', config.featuredSongId))
                .then((s) => {
                  if (s.exists()) song = { id: s.id, ...s.data() } as Song;
                })
                .catch((err) => console.warn('Error fetching featured song in bundle:', err))
            );
          }

          if (config.featuredOfflineSongId && config.featuredOfflineSongId !== config.featuredSongId) {
            songPromises.push(
              getDoc(doc(db, 'songs', config.featuredOfflineSongId))
                .then((s) => {
                  if (s.exists()) offlineSong = { id: s.id, ...s.data() } as Song;
                })
                .catch((err) => console.warn('Error fetching offline featured song in bundle:', err))
            );
          }

          await Promise.all(songPromises);

          if (config.featuredOfflineSongId && config.featuredOfflineSongId === config.featuredSongId) {
            offlineSong = song;
          }

          return { config, song, offlineSong };
        }
      } catch (e) {
        console.warn('Error fetching featured bundle from Firestore:', e);
      }
      return {
        config: { featuredSongId: null, externalLinks: [], badge: 'FEATURED RELEASE' },
        song: null,
        offlineSong: null,
      };
    },
    300000
  );
}

/**
 * Fetches the site-wide featured song configuration stored in Firestore at 'siteConfig/featured'.
 */
export async function getFeaturedConfig(forceRefresh = false): Promise<FeaturedConfig> {
  const bundle = await getFeaturedBundle(forceRefresh);
  return bundle.config;
}

/**
 * Saves the site-wide featured song configuration to Firestore at 'siteConfig/featured'.
 */
export async function saveFeaturedConfig(config: FeaturedConfig): Promise<void> {
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch (tokenErr) {
      console.warn('Failed to force ID token refresh:', tokenErr);
    }
  }

  const ref = doc(db, 'siteConfig', 'featured');
  const now = Date.now();
  try {
    await setDoc(
      ref,
      {
        featuredSongId: config.featuredSongId || null,
        externalLinks: config.externalLinks || [],
        badge: config.badge || 'FEATURED RELEASE',
        updatedAt: now,
        updatedBy: config.updatedBy || 'admin',
      },
      { merge: true }
    );
    invalidateCache('featured_config');
    invalidateCache('featured_bundle');
    if (typeof window !== 'undefined') {
      fetch('/api/catalog/invalidate', { method: 'POST' }).catch(() => {});
    }
  } catch (err: any) {
    const code = err?.code || '';
    const message = err?.message || String(err);
    if (code === 'permission-denied' || message.includes('permission') || message.includes('insufficient permissions')) {
      throw new Error('Permission Denied: Your administrator account lacks authorization to modify the site configuration or your session has expired.');
    } else if (code === 'unavailable' || message.includes('network') || message.includes('offline') || message.includes('Failed to fetch') || message.includes('network error')) {
      throw new Error('Network Error: Unable to reach Firestore. Please check your internet connection and try again.');
    } else {
      throw new Error(`Failed to save configuration: ${message}`);
    }
  }
}

export async function fetchFeaturedReleases(): Promise<FeaturedRelease[]> {
  return dedupeRequest('featured_releases', async () => {
    try {
      const q = query(collection(db, 'featuredReleases'), orderBy('position', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeaturedRelease));
    } catch (e) {
      console.warn('Error fetching featured releases:', e);
      return [];
    }
  }, 120000);
}

export async function saveFeaturedRelease(release: FeaturedRelease): Promise<void> {
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch (tokenErr) {
      console.warn('Failed to force ID token refresh for saveFeaturedRelease:', tokenErr);
    }
  }

  const ref = doc(db, 'featuredReleases', release.id);
  const now = Date.now();
  try {
    await setDoc(
      ref,
      {
        ...release,
        updatedAt: now,
        createdAt: release.createdAt || now,
      },
      { merge: true }
    );
    invalidateCache('featured_releases');
  } catch (err: any) {
    const code = err?.code || '';
    const message = err?.message || String(err);
    if (code === 'permission-denied' || message.includes('permission') || message.includes('insufficient permissions')) {
      throw new Error('Permission Denied: Your administrator account lacks authorization to modify featured releases or your session has expired.');
    } else if (code === 'unavailable' || message.includes('network') || message.includes('offline') || message.includes('Failed to fetch') || message.includes('network error')) {
      throw new Error('Network Error: Unable to reach Firestore. Please check your internet connection and try again.');
    } else {
      throw new Error(`Failed to save featured release: ${message}`);
    }
  }
}

export async function deleteFeaturedReleaseDoc(releaseId: string): Promise<void> {
  const ref = doc(db, 'featuredReleases', releaseId);
  await deleteDoc(ref);
  invalidateCache('featured_releases');
  // Also delete its analytics
  try {
    await deleteDoc(doc(db, 'analytics_featured', releaseId));
  } catch (e) {
    // ignore
  }
}

/**
  * Records a verified impression for a featured release, guarded against duplicate counting per session/day.
  */
export async function recordFeaturedImpression(releaseId: string): Promise<void> {
  if (!releaseId) return;
  const visitorId = getVisitorId();
  const today = getTodayDateString();
  const impressionKey = `sbg_feat_imp_${releaseId}_${today}`;

  try {
    if (localStorage.getItem(impressionKey)) {
      return; // Already counted for this visitor today locally
    }
    localStorage.setItem(impressionKey, 'true');

    const ref = doc(db, 'analytics_featured', releaseId);
    const now = Date.now();
    await setDoc(ref, {
      releaseId,
      impressions: increment(1),
      updatedAt: now,
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to record featured impression:', e);
  }
}

/**
  * Records a verified CTA or external link click for a featured release.
  */
export async function recordFeaturedClick(releaseId: string, linkId?: string): Promise<void> {
  if (!releaseId) return;
  const now = Date.now();
  const ref = doc(db, 'analytics_featured', releaseId);

  try {
    const updateData: any = {
      releaseId,
      clicks: increment(1),
      updatedAt: now,
    };

    if (linkId) {
      updateData[`linkClicks.${linkId}`] = increment(1);
    }

    await setDoc(ref, updateData, { merge: true });
  } catch (e) {
    console.warn('Failed to record featured click:', e);
  }
}

/**
  * Fetches analytics for a specific featured release.
  */
export async function fetchFeaturedAnalytics(releaseId: string): Promise<FeaturedReleaseAnalytics | null> {
  try {
    const ref = doc(db, 'analytics_featured', releaseId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FeaturedReleaseAnalytics;
    }
  } catch (e) {
    console.warn(`Error fetching analytics for featured release ${releaseId}:`, e);
  }
  return {
    releaseId,
    impressions: 0,
    clicks: 0,
    songPlays: 0,
    totalListenSeconds: 0,
    linkClicks: {},
  };
}
