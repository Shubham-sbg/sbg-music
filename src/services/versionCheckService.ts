import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const CURRENT_APP_VERSION = '2.4.0';
export const CURRENT_VERSION_CODE = 20400;

export interface AppVersionInfo {
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  apkFilename: string;
  sizeFormatted: string;
  sha256?: string;
  releaseNotes: string[];
  publishedAt?: string;
  forceUpdate?: boolean;
  isUpdateAvailable: boolean;
}

const DISMISSED_KEY_PREFIX = 'sbg_dismissed_update_v';

/**
 * Compares two semantic version strings (e.g., '2.5.0' vs '2.4.0').
 * Returns 1 if vA > vB, -1 if vA < vB, 0 if vA === vB.
 */
export function compareVersions(vA: string, vB: string): number {
  const cleanA = (vA || '').replace(/^v/i, '').trim();
  const cleanB = (vB || '').replace(/^v/i, '').trim();

  const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = partsA[i] || 0;
    const b = partsB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function isNewerVersion(serverVersion: string, clientVersion: string = CURRENT_APP_VERSION): boolean {
  return compareVersions(serverVersion, clientVersion) > 0;
}

/**
 * Checks if the user dismissed this update version within the last 24 hours.
 */
export function isUpdateDismissed(version: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${version}`);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    // Dismissal lasts 24 hours
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp < ONE_DAY_MS) {
      return true;
    }
    // Expired
    localStorage.removeItem(`${DISMISSED_KEY_PREFIX}${version}`);
    return false;
  } catch {
    return false;
  }
}

/**
 * Saves a dismissal record for this version to avoid nagging the user repeatedly.
 */
export function dismissUpdate(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${DISMISSED_KEY_PREFIX}${version}`, Date.now().toString());
  } catch {
    // Non-blocking
  }
}

/**
 * Clear any previous dismissal if user wants to check again.
 */
export function resetDismissal(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${DISMISSED_KEY_PREFIX}${version}`);
  } catch {}
}

let cachedLatestUpdate: AppVersionInfo | null = null;
const listeners = new Set<(info: AppVersionInfo | null) => void>();

function notifyListeners(info: AppVersionInfo | null) {
  cachedLatestUpdate = info;
  listeners.forEach((fn) => {
    try {
      fn(info);
    } catch (e) {
      console.error('[VersionCheck] Listener error:', e);
    }
  });
}

export const VersionCheckService = {
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  },

  getCurrentVersionCode(): number {
    return CURRENT_VERSION_CODE;
  },

  getCachedUpdate(): AppVersionInfo | null {
    return cachedLatestUpdate;
  },

  subscribe(callback: (info: AppVersionInfo | null) => void): () => void {
    listeners.add(callback);
    if (cachedLatestUpdate) {
      callback(cachedLatestUpdate);
    }
    return () => listeners.delete(callback);
  },

  /**
   * Queries the server API for version updates with optional Firestore config fallback.
   */
  async checkForUpdates(options?: {
    forceCheck?: boolean;
    simulateVersion?: string;
  }): Promise<{ updateAvailable: boolean; info: AppVersionInfo | null }> {
    try {
      let queryUrl = `/api/app/version?currentVersion=${encodeURIComponent(CURRENT_APP_VERSION)}`;
      
      // Support testing & preview simulation param (e.g. ?simulate_version=2.5.0)
      if (options?.simulateVersion) {
        queryUrl += `&simulate_version=${encodeURIComponent(options.simulateVersion)}`;
      } else if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const sim = urlParams.get('simulate_update');
        if (sim) {
          queryUrl += `&simulate_version=${encodeURIComponent(sim)}`;
        }
      }

      let info: AppVersionInfo | null = null;

      try {
        const response = await fetch(queryUrl, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.ok) {
            info = {
              appName: data.appName || 'SBG MUSIC',
              packageName: data.packageName || 'com.sbg.music',
              versionName: data.versionName || '2.4.0',
              versionCode: data.versionCode || 20400,
              downloadUrl: data.downloadUrl || '/downloads/sbg-music.apk',
              apkFilename: data.apkFilename || `SBG-Music-v${data.versionName || '2.4.0'}.apk`,
              sizeFormatted: data.sizeFormatted || '0.07 MB',
              sha256: data.sha256,
              releaseNotes: Array.isArray(data.releaseNotes) && data.releaseNotes.length > 0 
                ? data.releaseNotes 
                : ['Performance and stability enhancements', 'Updated streaming audio engine'],
              publishedAt: data.publishedAt,
              forceUpdate: Boolean(data.forceUpdate),
              isUpdateAvailable: Boolean(data.isUpdateAvailable),
            };
          }
        }
      } catch (fetchError) {
        console.warn('[VersionCheck] REST API check failed, falling back to Firestore config:', fetchError);
      }

      // Optional Firestore override fallback if REST fails
      if (!info) {
        try {
          const docRef = doc(db, 'app_config', 'release');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const serverVer = data.versionName || '2.4.0';
            const isAvail = compareVersions(serverVer, CURRENT_APP_VERSION) > 0;
            info = {
              appName: data.appName || 'SBG MUSIC',
              packageName: data.packageName || 'com.sbg.music',
              versionName: serverVer,
              versionCode: data.versionCode || 20400,
              downloadUrl: data.downloadUrl || '/downloads/sbg-music.apk',
              apkFilename: data.apkFilename || `SBG-Music-v${serverVer}.apk`,
              sizeFormatted: data.sizeFormatted || '0.07 MB',
              sha256: data.sha256,
              releaseNotes: data.releaseNotes || ['New release updates'],
              publishedAt: data.publishedAt,
              forceUpdate: Boolean(data.forceUpdate),
              isUpdateAvailable: isAvail,
            };
          }
        } catch {
          // Non-blocking
        }
      }

      if (!info) {
        return { updateAvailable: false, info: null };
      }

      const updateAvailable = compareVersions(info.versionName, CURRENT_APP_VERSION) > 0;
      info.isUpdateAvailable = updateAvailable;

      // Check dismissal state unless forced
      const isDismissed = !options?.forceCheck && !info.forceUpdate && isUpdateDismissed(info.versionName);
      
      if (updateAvailable && !isDismissed) {
        notifyListeners(info);
      } else {
        notifyListeners(null);
      }

      return { updateAvailable, info };
    } catch (err) {
      console.error('[VersionCheck] Error checking for updates:', err);
      return { updateAvailable: false, info: null };
    }
  },
};
