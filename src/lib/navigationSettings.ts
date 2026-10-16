import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { NavigationVisibilitySettings } from '../types';

export type { NavigationVisibilitySettings };

export const DEFAULT_NAVIGATION_VISIBILITY: NavigationVisibilitySettings = {
  showHome: true,
  showSongs: true,
  showAiStudio: false, // Hidden per user directive
  showLibrary: true,
  showPlaylists: true,
  showYouTube: true,
  showFavorites: true,
  showGetApp: false, // Hidden per user directive
  showSearch: true,
  showQuickAiButton: false, // Hidden per user directive
  showQuickAppButton: false, // Hidden per user directive
  showCreatePlaylistButton: true,
  showCommunityPlaylistsOnHome: true,
  showAiPromoBannerOnHome: false, // Hidden per user directive
  showApkDownloadSectionOnHome: false, // Hidden per user directive
};

const CACHE_KEY = 'sbg_navigation_visibility_settings';
let inMemoryCache: NavigationVisibilitySettings | null = null;

/**
 * Fetch navigation visibility settings from cache or Firestore settings/navigationVisibility
 */
export async function getNavigationVisibility(forceRefresh = false): Promise<NavigationVisibilitySettings> {
  if (!forceRefresh && inMemoryCache) {
    return inMemoryCache;
  }

  // Check localStorage cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw && !forceRefresh) {
      const parsed = JSON.parse(raw);
      inMemoryCache = { ...DEFAULT_NAVIGATION_VISIBILITY, ...parsed };
      return inMemoryCache;
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'navigationVisibility'));
    if (snap.exists()) {
      const data = snap.data();
      inMemoryCache = { ...DEFAULT_NAVIGATION_VISIBILITY, ...data };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(inMemoryCache));
      } catch {}
      return inMemoryCache;
    }
  } catch (err) {
    console.warn('Failed to load navigation visibility from Firestore, using defaults:', err);
  }

  inMemoryCache = { ...DEFAULT_NAVIGATION_VISIBILITY };
  return inMemoryCache;
}

/**
 * Save navigation visibility settings to Firestore settings/navigationVisibility
 */
export async function saveNavigationVisibility(
  settings: Partial<NavigationVisibilitySettings>,
  updatedBy: string = 'admin'
): Promise<NavigationVisibilitySettings> {
  const payload: NavigationVisibilitySettings = {
    ...DEFAULT_NAVIGATION_VISIBILITY,
    ...(inMemoryCache || {}),
    ...settings,
    updatedAt: Date.now(),
    updatedBy,
  };

  const ref = doc(db, 'settings', 'navigationVisibility');
  await setDoc(ref, payload, { merge: true });

  inMemoryCache = payload;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg:navigation-updated', { detail: payload }));
  }

  return payload;
}

/**
 * React hook to observe navigation visibility settings across the app
 */
export function useNavigationVisibility() {
  const [settings, setSettings] = useState<NavigationVisibilitySettings>(() => {
    if (inMemoryCache) return inMemoryCache;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return { ...DEFAULT_NAVIGATION_VISIBILITY, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_NAVIGATION_VISIBILITY;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Load initial settings
    getNavigationVisibility().then((res) => {
      if (isMounted) {
        setSettings(res);
        setLoading(false);
      }
    });

    // Subscribe to Firestore updates for real-time synchronization
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'navigationVisibility'),
      (snap) => {
        if (!isMounted) return;
        if (snap.exists()) {
          const fresh = { ...DEFAULT_NAVIGATION_VISIBILITY, ...snap.data() };
          inMemoryCache = fresh;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
          } catch {}
          setSettings(fresh);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Realtime navigation listener fallback:', err);
        setLoading(false);
      }
    );

    // Listen to local dispatch events
    const handleLocalUpdate = (e: any) => {
      if (isMounted && e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('sbg:navigation-updated', handleLocalUpdate);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('sbg:navigation-updated', handleLocalUpdate);
    };
  }, []);

  return { settings, loading };
}
