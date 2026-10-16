import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { dedupeRequest, invalidateCache } from './cache';

export interface BrandingConfig {
  appLogo: string;
  websiteLogo: string;
  favicon: string;
  appIcon: string;
  splashLogo: string;
  loginLogo: string;
  defaultMusicArtwork: string;
  defaultUserAvatar: string;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  appLogo: '/assets/branding/sbg-music-logo.png',
  websiteLogo: '/assets/branding/sbg-music-logo.png',
  favicon: '/favicon.png',
  appIcon: '/assets/branding/sbg-music-icon.png',
  splashLogo: '/assets/branding/sbg-music-splash.png',
  loginLogo: '/assets/branding/sbg-music-logo.png',
  defaultMusicArtwork: '/assets/branding/sbg-default-artwork.png',
  defaultUserAvatar: '/assets/branding/sbg-default-avatar.png',
};

const BRANDING_CACHE_KEY = 'sbg_site_branding_v1';
const BRANDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getBrandingConfig(forceRefresh = false): Promise<BrandingConfig> {
  if (forceRefresh) {
    invalidateCache(BRANDING_CACHE_KEY);
  }

  return dedupeRequest(
    BRANDING_CACHE_KEY,
    async () => {
      try {
        const snap = await getDoc(doc(db, 'siteConfig', 'branding'));
        if (snap.exists()) {
          const data = snap.data();
          return {
            ...DEFAULT_BRANDING,
            ...data,
          } as BrandingConfig;
        }
      } catch (err) {
        console.warn('[Branding] Error fetching remote branding:', err);
      }
      return DEFAULT_BRANDING;
    },
    BRANDING_CACHE_TTL
  );
}

export async function saveBrandingConfig(config: Partial<BrandingConfig>): Promise<void> {
  const current = await getBrandingConfig(true);
  const updated: BrandingConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || 'admin',
  };

  await setDoc(doc(db, 'siteConfig', 'branding'), updated, { merge: true });
  invalidateCache(BRANDING_CACHE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg_branding_updated', { detail: updated }));
  }
}

export function useBranding(): { branding: BrandingConfig; loading: boolean; refresh: () => void } {
  const [branding, setBranding] = useState<BrandingConfig>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_SSR_DATA__?.branding) {
      return (window as any).__INITIAL_SSR_DATA__.branding;
    }
    return DEFAULT_BRANDING;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const load = async (force = false) => {
    try {
      const data = await getBrandingConfig(force);
      setBranding(data);
    } catch {
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setBranding(e.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('sbg_branding_updated', handleUpdate);
      return () => window.removeEventListener('sbg_branding_updated', handleUpdate);
    }
  }, []);

  return { branding, loading, refresh: () => load(true) };
}
