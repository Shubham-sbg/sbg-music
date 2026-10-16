import { db, storage, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch, 
  increment, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { AndroidRelease } from '../types';
import { 
  validateApkFile, 
  calculateSha256, 
  formatBytes,
  isValidApkExtension,
  isValidApkMimeType,
  checkZipMagicBytes,
  ApkValidationResult,
  ApkValidationOptions 
} from './apkValidation';

export { 
  validateApkFile, 
  calculateSha256, 
  formatBytes,
  isValidApkExtension,
  isValidApkMimeType,
  checkZipMagicBytes
};
export type { ApkValidationResult, ApkValidationOptions };

export const ACTIVE_RELEASE_CACHE_KEY = 'sbg_active_android_release';
let inMemoryActiveRelease: AndroidRelease | null = null;

export const DEFAULT_STANDALONE_RELEASE: AndroidRelease = {
  id: 'default_v2_4_0',
  appName: 'SBG MUSIC',
  versionName: '2.4.0',
  versionCode: 240,
  releaseName: 'Full Official Release',
  releaseNotes: '• User Offline Storage: Download eligible tracks straight to device storage with real-time indicators\n• Dual Catalog Support: Stream YouTube discovery tracks alongside high-bitrate SBG releases\n• Synchronized LRC Lyrics: Real-time word-by-word synced lyrics\n• Persistent Media Controls: Notification tray, lock screen, and Bluetooth car integration\n• Battery & Data Saver: Intelligent local audio caching minimizes network polling',
  storagePath: 'apps/android/releases/default_v2_4_0/SBG-Music-v2.4.0.apk',
  downloadUrl: '/downloads/sbg-music.apk',
  fileName: 'SBG-Music-v2.4.0.apk',
  fileSizeBytes: 36909875,
  fileSizeFormatted: '35.2 MB',
  sha256: '5203ce7674c06c64c7c0d634496f75cdb11fcbcf1fd4b201f48f3305e7aec55f',
  minAndroidVersion: 'Android 5.0+ (Lollipop to 15)',
  targetAndroidVersion: 'Android 14 (API Level 34)',
  downloadButtonText: 'Download Android APK',
  installInstructions: '1. Download APK: Tap the "Download Android APK" button to get the official installer package.\n2. Allow Unknown Sources: If your browser prompts "File might be harmful", tap Download Anyway. In Android Settings, allow installation from your browser.\n3. Open and Install: Tap the downloaded file in your notification bar and choose Install.\n4. Sign In & Enjoy: Log in with your Google Account to automatically sync all your existing playlists, favorites, and library!',
  published: true,
  isDefault: true,
  downloadCount: 1485,
  createdAt: 1727740800000,
  updatedAt: 1727740800000,
  createdBy: 'sbg.esports07@gmail.com'
};

/**
 * Upload APK to Firebase Storage and track progress after validating package structure.
 */
export function uploadApkToStorage(
  file: File,
  releaseId: string,
  onProgress?: (progress: { bytesTransferred: number; totalBytes: number; percent: number }) => void
): {
  taskPromise: Promise<{ downloadUrl: string; storagePath: string }>;
  cancel: () => void;
} {
  // Enforce basic extension check before initializing storage reference
  if (!isValidApkExtension(file.name)) {
    throw new Error(`File ${file.name} is not a valid Android APK archive (.apk).`);
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `apps/android/releases/${releaseId}/${safeFilename}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: 'application/vnd.android.package-archive',
    customMetadata: {
      appName: 'SBG MUSIC',
      originalName: file.name,
      uploadedAt: new Date().toISOString()
    }
  });

  if (onProgress) {
    uploadTask.on('state_changed', (snapshot) => {
      const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      onProgress({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        percent: isNaN(percent) ? 0 : percent
      });
    });
  }

  const taskPromise = new Promise<{ downloadUrl: string; storagePath: string }>((resolve, reject) => {
    uploadTask.then(async (snapshot) => {
      try {
        const downloadUrl = await getDownloadURL(snapshot.ref);
        resolve({ downloadUrl, storagePath });
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });

  return {
    taskPromise,
    cancel: () => uploadTask.cancel()
  };
}

/**
 * Fetch the single active default published release.
 * Reads dynamically from Firestore androidReleases where isDefault == true.
 */
export async function getActiveRelease(forceRefresh = false): Promise<AndroidRelease | null> {
  if (!forceRefresh && inMemoryActiveRelease) {
    return inMemoryActiveRelease;
  }

  // Check localStorage cache
  try {
    const raw = localStorage.getItem(ACTIVE_RELEASE_CACHE_KEY);
    if (raw && !forceRefresh) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        inMemoryActiveRelease = parsed;
        return parsed;
      }
    }
  } catch {}

  try {
    // Query default release first
    const q = query(
      collection(db, 'androidReleases'),
      where('isDefault', '==', true),
      where('published', '==', true)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docData = snap.docs[0].data();
      const release: AndroidRelease = {
        id: snap.docs[0].id,
        ...docData
      } as AndroidRelease;

      inMemoryActiveRelease = release;
      try {
        localStorage.setItem(ACTIVE_RELEASE_CACHE_KEY, JSON.stringify(release));
      } catch {}
      return release;
    }

    // Fallback: any published release sorted by createdAt
    const qAny = query(
      collection(db, 'androidReleases'),
      where('published', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapAny = await getDocs(qAny);
    if (!snapAny.empty) {
      const docData = snapAny.docs[0].data();
      const release: AndroidRelease = {
        id: snapAny.docs[0].id,
        ...docData
      } as AndroidRelease;

      inMemoryActiveRelease = release;
      try {
        localStorage.setItem(ACTIVE_RELEASE_CACHE_KEY, JSON.stringify(release));
      } catch {}
      return release;
    }

    // Fallback 3: check if any document exists in androidReleases at all
    const snapAll = await getDocs(collection(db, 'androidReleases'));
    if (!snapAll.empty) {
      const firstDoc = snapAll.docs[0];
      const release: AndroidRelease = {
        id: firstDoc.id,
        ...firstDoc.data()
      } as AndroidRelease;
      inMemoryActiveRelease = release;
      return release;
    }
  } catch (err) {
    console.warn('Failed to query androidReleases from Firestore:', err);
  }

  return inMemoryActiveRelease || DEFAULT_STANDALONE_RELEASE;
}

/**
 * Real-time subscription to active default Android release in Firestore.
 */
export function subscribeToActiveRelease(
  onUpdate: (release: AndroidRelease) => void,
  onError?: (error: any) => void
): () => void {
  const relCollection = collection(db, 'androidReleases');
  const qDefault = query(relCollection, where('isDefault', '==', true));

  const unsubscribe = onSnapshot(
    qDefault,
    async (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs;
        const matchedDoc = docs.find((d) => d.data().published !== false) || docs[0];
        const release: AndroidRelease = {
          id: matchedDoc.id,
          ...matchedDoc.data(),
        } as AndroidRelease;

        inMemoryActiveRelease = release;
        try {
          localStorage.setItem(ACTIVE_RELEASE_CACHE_KEY, JSON.stringify(release));
        } catch {}
        onUpdate(release);
      } else {
        // If no default found via query, fallback to getActiveRelease
        const rel = await getActiveRelease(true);
        if (rel) onUpdate(rel);
      }
    },
    (err) => {
      console.warn('Realtime androidReleases snapshot failed, falling back to cache/fetch:', err);
      onError?.(err);
      getActiveRelease().then((rel) => {
        if (rel) onUpdate(rel);
      }).catch(() => {});
    }
  );

  return unsubscribe;
}

/**
 * Resolves direct download URL from Firebase Storage path or downloadUrl
 */
export async function resolveDirectDownloadUrl(release: AndroidRelease): Promise<string> {
  // If storagePath is specified, resolve fresh Firebase Storage download URL
  if (release.storagePath) {
    try {
      const storageRef = ref(storage, release.storagePath);
      const freshUrl = await getDownloadURL(storageRef);
      if (freshUrl) return freshUrl;
    } catch (err) {
      console.warn('Could not resolve fresh Firebase Storage URL for path:', release.storagePath, err);
    }
  }

  // Fallback to release.downloadUrl
  if (release.downloadUrl) {
    return release.downloadUrl;
  }

  return '/downloads/sbg-music.apk';
}

/**
 * Triggers direct browser download from Firebase Storage path or URL,
 * ensuring correct filename attribute and tracking download stats.
 */
export async function triggerDirectApkDownload(release: AndroidRelease): Promise<string> {
  const directUrl = await resolveDirectDownloadUrl(release);
  const fileName = release.fileName || `SBG-Music-v${release.versionName || '2.4.0'}.apk`;

  // Track download in analytics and increment stats
  recordApkDownload(release.id, release.versionName).catch(() => {});

  // Trigger direct browser download
  const link = document.createElement('a');
  link.href = directUrl;
  link.setAttribute('download', fileName);
  if (directUrl.startsWith('http')) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return directUrl;
}

/**
 * List all releases (published and unpublished, full version history)
 */
export async function listAllReleases(): Promise<AndroidRelease[]> {
  try {
    const snap = await getDocs(collection(db, 'androidReleases'));
    const releases: AndroidRelease[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as AndroidRelease));

    return releases.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error('Failed to list androidReleases:', err);
    return [];
  }
}

/**
 * Save / Create an APK release document.
 * If isDefault is true, deactivates previous default releases atomically.
 */
export async function saveRelease(
  release: Partial<AndroidRelease> & { id: string },
  makeDefault = false
): Promise<void> {
  const batch = writeBatch(db);
  const targetRef = doc(db, 'androidReleases', release.id);

  if (makeDefault) {
    // Find any existing default releases and deactivate them
    try {
      const q = query(collection(db, 'androidReleases'), where('isDefault', '==', true));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        if (d.id !== release.id) {
          batch.update(d.ref, { isDefault: false, updatedAt: Date.now() });
        }
      });
    } catch (e) {
      console.warn('Failed to query existing default releases:', e);
    }
  }

  const now = Date.now();
  const payload = {
    ...release,
    isDefault: makeDefault ? true : Boolean(release.isDefault),
    updatedAt: now,
  };

  batch.set(targetRef, payload, { merge: true });
  await batch.commit();

  inMemoryActiveRelease = null;
  try {
    localStorage.removeItem(ACTIVE_RELEASE_CACHE_KEY);
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg:apk-release-updated', { detail: payload }));
  }
}

/**
 * Set an existing release as the active default
 */
export async function setDefaultRelease(releaseId: string, userEmail = 'admin'): Promise<void> {
  const batch = writeBatch(db);

  // Deactivate all others
  const snap = await getDocs(collection(db, 'androidReleases'));
  snap.docs.forEach((d) => {
    if (d.id === releaseId) {
      batch.update(d.ref, { isDefault: true, published: true, updatedAt: Date.now(), updatedBy: userEmail });
    } else if (d.data().isDefault) {
      batch.update(d.ref, { isDefault: false, updatedAt: Date.now() });
    }
  });

  await batch.commit();
  inMemoryActiveRelease = null;
  try {
    localStorage.removeItem(ACTIVE_RELEASE_CACHE_KEY);
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg:apk-release-updated'));
  }
}

/**
 * Delete release: deletes Firestore record AND Firebase Storage APK file
 */
export async function deleteRelease(releaseId: string): Promise<void> {
  const refDoc = doc(db, 'androidReleases', releaseId);
  const snap = await getDoc(refDoc);

  if (snap.exists()) {
    const data = snap.data() as AndroidRelease;
    // 1. Delete associated Storage file if present
    if (data.storagePath) {
      try {
        const fileRef = ref(storage, data.storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn('Could not delete storage file or already deleted:', err);
      }
    }
    // 2. Delete Firestore document
    await deleteDoc(refDoc);
  }

  inMemoryActiveRelease = null;
  try {
    localStorage.removeItem(ACTIVE_RELEASE_CACHE_KEY);
  } catch {}
}

/**
 * Track an APK download event with aggregated lightweight counter
 */
export async function recordApkDownload(releaseId?: string, versionName?: string): Promise<void> {
  try {
    // 1. Update app_stats/downloads
    const statRef = doc(db, 'app_stats', 'downloads');
    await setDoc(statRef, {
      count: increment(1),
      lastDownloadedAt: serverTimestamp(),
      latestVersion: versionName || 'unknown'
    }, { merge: true });

    // 2. If releaseId provided, increment its specific count
    if (releaseId) {
      const relRef = doc(db, 'androidReleases', releaseId);
      await setDoc(relRef, {
        downloadCount: increment(1),
        lastDownloadedAt: serverTimestamp()
      }, { merge: true });
    }

    // 3. Lightweight notify server
    if (typeof window !== 'undefined') {
      fetch('/api/downloads/increment', { method: 'POST' }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to record download analytics:', err);
  }
}
