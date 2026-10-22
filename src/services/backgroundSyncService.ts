export interface SyncCountSummary {
  analyticsCount: number;
  playlistsCount: number;
  total: number;
}

const STORAGE_PLAYLISTS_QUEUE = 'sbg_sync_queue_playlists';
const STORAGE_ANALYTICS_QUEUE = 'sbg_sync_queue_analytics';

function getQueue(key: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setQueue(key: string, items: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    emitPendingChange();
  } catch (e) {
    console.warn('Failed to update sync queue in localStorage:', e);
  }
}

function emitPendingChange() {
  if (typeof window === 'undefined') return;
  getPendingSyncSummary().then((summary) => {
    window.dispatchEvent(new CustomEvent('sbg_pending_sync_changed', { detail: summary }));
  });
}

export async function getPendingSyncSummary(): Promise<SyncCountSummary> {
  const playlists = getQueue(STORAGE_PLAYLISTS_QUEUE);
  const analytics = getQueue(STORAGE_ANALYTICS_QUEUE);
  return {
    playlistsCount: playlists.length,
    analyticsCount: analytics.length,
    total: playlists.length + analytics.length,
  };
}

export async function queueAndSyncPlaylistUpdate(payload: any): Promise<void> {
  const current = getQueue(STORAGE_PLAYLISTS_QUEUE);
  current.push({ ...payload, queuedAt: Date.now() });
  setQueue(STORAGE_PLAYLISTS_QUEUE, current);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await triggerImmediateSync('playlists');
  }
}

export async function queueAndSyncAnalytics(payload: any): Promise<void> {
  const current = getQueue(STORAGE_ANALYTICS_QUEUE);
  current.push({ ...payload, queuedAt: Date.now() });
  setQueue(STORAGE_ANALYTICS_QUEUE, current);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await triggerImmediateSync('analytics');
  }
}

export async function triggerImmediateSync(scope: 'all' | 'playlists' | 'analytics' = 'all'): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    if (scope === 'all' || scope === 'playlists') {
      const playlists = getQueue(STORAGE_PLAYLISTS_QUEUE);
      if (playlists.length > 0) {
        // Replay/process offline playlist operations if needed
        setQueue(STORAGE_PLAYLISTS_QUEUE, []);
      }
    }

    if (scope === 'all' || scope === 'analytics') {
      const analytics = getQueue(STORAGE_ANALYTICS_QUEUE);
      if (analytics.length > 0) {
        setQueue(STORAGE_ANALYTICS_QUEUE, []);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sbg_sync_completed', { detail: { scope } }));
    }
  } catch (err) {
    console.warn('Background sync encountered issue:', err);
  }
}
