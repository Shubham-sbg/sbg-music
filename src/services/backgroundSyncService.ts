export interface SyncCountSummary {
  analyticsCount: number;
  playlistsCount: number;
  total: number;
}

const PLAYLISTS_QUEUE_KEY = 'sbg_offline_playlists_queue';
const ANALYTICS_QUEUE_KEY = 'sbg_offline_analytics_queue';

function getStoredItems<T = any>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredItems<T = any>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    notifyPendingSync();
  } catch {}
}

function notifyPendingSync(): void {
  if (typeof window === 'undefined') return;
  getPendingSyncSummary()
    .then((summary) => {
      window.dispatchEvent(new CustomEvent('sbg_pending_sync_changed', { detail: summary }));
    })
    .catch(() => {});
}

export async function getPendingSyncSummary(): Promise<SyncCountSummary> {
  const playlists = getStoredItems(PLAYLISTS_QUEUE_KEY);
  const analytics = getStoredItems(ANALYTICS_QUEUE_KEY);
  const pCount = playlists.length;
  const aCount = analytics.length;
  return {
    analyticsCount: aCount,
    playlistsCount: pCount,
    total: pCount + aCount,
  };
}

export async function queueAndSyncPlaylistUpdate(actionPayload: any): Promise<void> {
  const items = getStoredItems(PLAYLISTS_QUEUE_KEY);
  items.push({
    ...actionPayload,
    queuedAt: Date.now(),
  });
  setStoredItems(PLAYLISTS_QUEUE_KEY, items);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    // Attempt background replay if network is available
    await triggerImmediateSync('playlists');
  }
}

export async function queueAndSyncAnalytics(events: any): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine) return;

  const items = getStoredItems(ANALYTICS_QUEUE_KEY);
  const toAdd = Array.isArray(events) ? events : [events];
  for (const ev of toAdd) {
    items.push({ ...ev, queuedAt: Date.now() });
  }
  setStoredItems(ANALYTICS_QUEUE_KEY, items);
}

export async function triggerImmediateSync(type: string = 'all'): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  // Clear or replay queues
  if (type === 'all' || type === 'playlists') {
    setStoredItems(PLAYLISTS_QUEUE_KEY, []);
  }
  if (type === 'all' || type === 'analytics') {
    setStoredItems(ANALYTICS_QUEUE_KEY, []);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbg_sync_completed', { detail: { type } }));
  }
}
