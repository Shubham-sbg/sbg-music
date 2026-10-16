import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const MAX_WEEKLY_GENERATIONS = 5;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_STORAGE_QUOTA_KEY = 'sbg_ai_music_weekly_quota_v1';

export interface UserQuotaInfo {
  used: number;
  max: number;
  remaining: number;
  resetDate: Date;
  resetsInText: string;
  isLimitReached: boolean;
}

/**
 * Gets a persistent device identifier for anonymous visitors.
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_guest';
  let deviceId = localStorage.getItem('sbg_device_guest_id');
  if (!deviceId) {
    deviceId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('sbg_device_guest_id', deviceId);
  }
  return deviceId;
}

/**
 * Formats time remaining until rolling week reset.
 */
function formatResetTime(resetDate: Date): string {
  const now = Date.now();
  const diff = resetDate.getTime() - now;

  if (diff <= 0) return 'Available now (Resetting...)';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

/**
 * Checks local storage backup quota for instantaneous offline/optimistic reading.
 */
function getLocalQuota(effectiveId: string): { used: number; weekStart: number } {
  if (typeof window === 'undefined') return { used: 0, weekStart: Date.now() };
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_QUOTA_KEY}_${effectiveId}`);
    if (!raw) return { used: 0, weekStart: Date.now() };
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.weekStart > WEEK_IN_MS) {
      // 7 days elapsed, reset
      const fresh = { used: 0, weekStart: Date.now() };
      localStorage.setItem(`${LOCAL_STORAGE_QUOTA_KEY}_${effectiveId}`, JSON.stringify(fresh));
      return fresh;
    }
    return parsed;
  } catch {
    return { used: 0, weekStart: Date.now() };
  }
}

function saveLocalQuota(effectiveId: string, used: number, weekStart: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_QUOTA_KEY}_${effectiveId}`,
      JSON.stringify({ used, weekStart, lastUpdated: Date.now() })
    );
  } catch {
    // Non-blocking
  }
}

/**
 * Retrieves the current user's weekly AI generation quota status.
 */
export async function getUserWeeklyQuota(userId?: string): Promise<UserQuotaInfo> {
  const effectiveId = userId || getDeviceId();
  const local = getLocalQuota(effectiveId);

  try {
    const quotaDocRef = doc(db, 'user_ai_quotas', effectiveId);
    const snap = await getDoc(quotaDocRef);

    let used = local.used;
    let weekStart = local.weekStart;

    if (snap.exists()) {
      const data = snap.data();
      const docWeekStart = typeof data.weekStartDate === 'number' ? data.weekStartDate : Date.now();
      const docUsed = typeof data.usedThisWeek === 'number' ? data.usedThisWeek : 0;

      // Check if 7 days have passed
      if (Date.now() - docWeekStart > WEEK_IN_MS) {
        used = 0;
        weekStart = Date.now();
        // Reset in background
        setDoc(quotaDocRef, {
          userId: effectiveId,
          usedThisWeek: 0,
          weekStartDate: weekStart,
          lastUpdated: Date.now(),
        }, { merge: true }).catch(() => {});
      } else {
        used = Math.max(docUsed, local.used);
        weekStart = docWeekStart;
      }
    } else {
      // Initialize first document
      setDoc(quotaDocRef, {
        userId: effectiveId,
        usedThisWeek: local.used,
        weekStartDate: local.weekStart,
        lastUpdated: Date.now(),
      }, { merge: true }).catch(() => {});
    }

    saveLocalQuota(effectiveId, used, weekStart);

    const resetDate = new Date(weekStart + WEEK_IN_MS);
    const remaining = Math.max(0, MAX_WEEKLY_GENERATIONS - used);

    return {
      used,
      max: MAX_WEEKLY_GENERATIONS,
      remaining,
      resetDate,
      resetsInText: formatResetTime(resetDate),
      isLimitReached: used >= MAX_WEEKLY_GENERATIONS,
    };
  } catch (err) {
    console.warn('[AI Quota] Firestore fetch error, falling back to local storage:', err);
    const resetDate = new Date(local.weekStart + WEEK_IN_MS);
    const remaining = Math.max(0, MAX_WEEKLY_GENERATIONS - local.used);
    return {
      used: local.used,
      max: MAX_WEEKLY_GENERATIONS,
      remaining,
      resetDate,
      resetsInText: formatResetTime(resetDate),
      isLimitReached: local.used >= MAX_WEEKLY_GENERATIONS,
    };
  }
}

/**
 * Increments the weekly count after a song is successfully generated.
 */
export async function recordGeneration(userId?: string): Promise<UserQuotaInfo> {
  const effectiveId = userId || getDeviceId();
  const current = await getUserWeeklyQuota(userId);

  const newUsed = current.used + 1;
  const weekStart = current.resetDate.getTime() - WEEK_IN_MS;

  saveLocalQuota(effectiveId, newUsed, weekStart);

  try {
    const quotaDocRef = doc(db, 'user_ai_quotas', effectiveId);
    await setDoc(quotaDocRef, {
      userId: effectiveId,
      usedThisWeek: newUsed,
      weekStartDate: weekStart,
      lastGeneratedAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.warn('[AI Quota] Firestore record update notice:', e);
  }

  const resetDate = new Date(weekStart + WEEK_IN_MS);
  const remaining = Math.max(0, MAX_WEEKLY_GENERATIONS - newUsed);

  // Dispatch global window event for real-time UI synchrony
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg_ai_quota_updated', {
      detail: { used: newUsed, remaining, max: MAX_WEEKLY_GENERATIONS }
    }));
  }

  return {
    used: newUsed,
    max: MAX_WEEKLY_GENERATIONS,
    remaining,
    resetDate,
    resetsInText: formatResetTime(resetDate),
    isLimitReached: newUsed >= MAX_WEEKLY_GENERATIONS,
  };
}

/**
 * Subscribes to live quota changes in Firestore.
 */
export function subscribeToQuota(
  userId: string | undefined,
  callback: (quota: UserQuotaInfo) => void
): () => void {
  const effectiveId = userId || getDeviceId();
  const quotaDocRef = doc(db, 'user_ai_quotas', effectiveId);

  const unsubscribe = onSnapshot(quotaDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const weekStart = typeof data.weekStartDate === 'number' ? data.weekStartDate : Date.now();
      let used = typeof data.usedThisWeek === 'number' ? data.usedThisWeek : 0;

      if (Date.now() - weekStart > WEEK_IN_MS) {
        used = 0;
      }

      const resetDate = new Date(weekStart + WEEK_IN_MS);
      const remaining = Math.max(0, MAX_WEEKLY_GENERATIONS - used);

      callback({
        used,
        max: MAX_WEEKLY_GENERATIONS,
        remaining,
        resetDate,
        resetsInText: formatResetTime(resetDate),
        isLimitReached: used >= MAX_WEEKLY_GENERATIONS,
      });
    } else {
      getUserWeeklyQuota(userId).then(callback);
    }
  }, () => {
    getUserWeeklyQuota(userId).then(callback);
  });

  const handleCustomEvent = () => {
    getUserWeeklyQuota(userId).then(callback);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('sbg_ai_quota_updated', handleCustomEvent);
  }

  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('sbg_ai_quota_updated', handleCustomEvent);
    }
  };
}
