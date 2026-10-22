/**
 * SBG MUSIC - Service Worker Background Sync API Extension
 * Handles native Background Sync (SyncManager) and IndexedDB replay queues
 * for analytics events and playlist updates when connectivity is restored.
 */

(function () {
  'use strict';

  const DB_NAME = 'sbg_offline_sync_store';
  const DB_VERSION = 1;
  const STORE_ANALYTICS = 'pending_analytics';
  const STORE_PLAYLISTS = 'pending_playlists';

  function openSyncDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_ANALYTICS)) {
          db.createObjectStore(STORE_ANALYTICS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllRecords(storeName) {
    try {
      const db = await openSyncDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }

  async function deleteRecords(storeName, keys) {
    if (!keys || keys.length === 0) return;
    try {
      const db = await openSyncDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        keys.forEach((key) => store.delete(key));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}
  }

  async function broadcastToClients(msg) {
    try {
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });
      for (const client of clients) {
        client.postMessage(msg);
      }
    } catch (e) {}
  }

  async function replayAnalyticsQueue() {
    const records = await getAllRecords(STORE_ANALYTICS);
    if (!records || records.length === 0) return 0;

    const successfulKeys = [];
    const chunkSize = 50;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const payloadEvents = chunk.map((r) => r.payload || r);

      try {
        const response = await fetch('/api/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Background-Sync': 'true',
          },
          body: JSON.stringify({ events: payloadEvents }),
        });

        if (response.ok) {
          chunk.forEach((item) => successfulKeys.push(item.id));
        } else {
          break;
        }
      } catch (err) {
        break;
      }
    }

    if (successfulKeys.length > 0) {
      await deleteRecords(STORE_ANALYTICS, successfulKeys);
      await broadcastToClients({
        type: 'SBG_BACKGROUND_SYNC_SUCCESS',
        target: 'analytics',
        count: successfulKeys.length,
        timestamp: Date.now(),
      });
    }

    return successfulKeys.length;
  }

  async function replayPlaylistsQueue() {
    const records = await getAllRecords(STORE_PLAYLISTS);
    if (!records || records.length === 0) return 0;

    const successfulKeys = [];
    for (const item of records) {
      try {
        const response = await fetch('/api/playlists/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Background-Sync': 'true',
          },
          body: JSON.stringify({
            updates: [item.payload || item],
          }),
        });

        if (response.ok) {
          successfulKeys.push(item.id);
        } else if (response.status >= 500) {
          break;
        }
      } catch (err) {
        break;
      }
    }

    if (successfulKeys.length > 0) {
      await deleteRecords(STORE_PLAYLISTS, successfulKeys);
      await broadcastToClients({
        type: 'SBG_BACKGROUND_SYNC_SUCCESS',
        target: 'playlists',
        count: successfulKeys.length,
        timestamp: Date.now(),
      });
    }

    return successfulKeys.length;
  }

  self.addEventListener('sync', (event) => {
    if (
      event.tag === 'sync-analytics' ||
      event.tag === 'sbg-analytics-sync-queue' ||
      event.tag === 'workbox-background-sync:sbg-analytics-sync-queue'
    ) {
      event.waitUntil(replayAnalyticsQueue());
    } else if (
      event.tag === 'sync-playlists' ||
      event.tag === 'sbg-playlists-sync-queue' ||
      event.tag === 'workbox-background-sync:sbg-playlists-sync-queue'
    ) {
      event.waitUntil(replayPlaylistsQueue());
    } else if (
      event.tag === 'sbg-background-sync' ||
      event.tag === 'sbg-sync-all'
    ) {
      event.waitUntil(
        Promise.allSettled([replayAnalyticsQueue(), replayPlaylistsQueue()])
      );
    }
  });

  self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
      const target = event.data.target;
      if (target === 'analytics') {
        replayAnalyticsQueue();
      } else if (target === 'playlists') {
        replayPlaylistsQueue();
      } else {
        Promise.allSettled([replayAnalyticsQueue(), replayPlaylistsQueue()]);
      }
    }
  });
})();
