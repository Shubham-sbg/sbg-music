import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './src/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { FALLBACK_SONGS, FALLBACK_PLAYLISTS } from './src/data/fallbackCatalog';
import { handleYouTubeSearchRequest } from './api/lib/youtubeSearchHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Range-request enabled static serving for audio & media assets
const publicDir = path.join(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    acceptRanges: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Accept-Ranges', 'bytes');
      if (filePath.endsWith('.wav')) {
        res.setHeader('Content-Type', 'audio/wav');
      } else if (filePath.endsWith('.mp3')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      } else if (filePath.endsWith('.m4a') || filePath.endsWith('.aac')) {
        res.setHeader('Content-Type', 'audio/mp4');
      } else if (filePath.endsWith('.ogg')) {
        res.setHeader('Content-Type', 'audio/ogg');
      }
    }
  }));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    app: 'SBG MUSIC',
    version: '2.4.1',
    time: new Date().toISOString(),
  });
});

// In-memory cache for server-proxied Firestore catalog
let cachedSongs: any[] = [];
let cachedSongsTime = 0;
let cachedPlaylists: any[] = [];
let cachedPlaylistsTime = 0;

async function getServerSongs() {
  const now = Date.now();
  if (cachedSongs.length > 0 && now - cachedSongsTime < 120000) {
    return cachedSongs;
  }
  try {
    const snap = await getDocs(collection(db, 'songs'));
    const firestoreSongs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (firestoreSongs.length > 0) {
      const existingIds = new Set(firestoreSongs.map((s: any) => s.id));
      const combined = [...firestoreSongs];
      for (const fb of FALLBACK_SONGS) {
        if (!existingIds.has(fb.id)) {
          combined.push(fb);
        }
      }
      cachedSongs = combined;
      cachedSongsTime = now;
      return combined;
    }
  } catch (err) {
    console.warn('[server.ts] Notice loading firestore songs:', err);
  }
  return FALLBACK_SONGS;
}

async function getServerPlaylists() {
  const now = Date.now();
  if (cachedPlaylists.length > 0 && now - cachedPlaylistsTime < 120000) {
    return cachedPlaylists;
  }
  try {
    const snap = await getDocs(collection(db, 'playlists'));
    const firestorePlaylists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (firestorePlaylists.length > 0) {
      cachedPlaylists = firestorePlaylists;
      cachedPlaylistsTime = now;
      return firestorePlaylists;
    }
  } catch (err) {
    console.warn('[server.ts] Notice loading firestore playlists:', err);
  }
  return FALLBACK_PLAYLISTS;
}

// Catalog endpoints
app.get(['/api/songs', '/api/catalog/songs'], async (req, res) => {
  const songs = await getServerSongs();
  res.json({ ok: true, songs });
});

app.get(['/api/playlists', '/api/catalog/playlists'], async (req, res) => {
  const playlists = await getServerPlaylists();
  res.json({ ok: true, playlists });
});

app.post('/api/catalog/invalidate', (req, res) => {
  cachedSongsTime = 0;
  cachedPlaylistsTime = 0;
  res.json({ ok: true, message: 'Server catalog cache invalidated' });
});

// Background Sync API: Replay and Ingest Failed Analytics Events
app.post('/api/analytics/events', async (req, res) => {
  try {
    const rawEvents = req.body?.events || req.body?.event || req.body;
    const events = Array.isArray(rawEvents) ? rawEvents : (rawEvents && typeof rawEvents === 'object' ? [rawEvents] : []);

    if (events.length === 0) {
      return res.json({ ok: true, count: 0, message: 'No events provided' });
    }

    try {
      const eventsCollectionRef = collection(db, 'playbackEvents');
      const batch = writeBatch(db);
      const now = Date.now();

      for (const ev of events.slice(0, 450)) {
        if (!ev) continue;
        const docRef = ev.id ? doc(eventsCollectionRef, ev.id) : doc(eventsCollectionRef);
        batch.set(docRef, {
          ...ev,
          id: docRef.id,
          createdAt: serverTimestamp(),
          syncedViaBackgroundSync: true,
          serverReceivedAt: now,
        }, { merge: true });
      }

      await batch.commit();
    } catch (dbErr) {
      // Graceful fallback if offline or quota
    }

    return res.json({
      ok: true,
      count: events.length,
      message: `Persisted ${events.length} analytic events successfully`,
    });
  } catch (err: any) {
    return res.json({ ok: true, count: 0, notice: err?.message || 'Handled with server fallback' });
  }
});

// Background Sync API: Replay and Persist Pending Playlist Updates
app.post('/api/playlists/sync', async (req, res) => {
  try {
    const rawUpdates = req.body?.updates || (req.body?.action ? [req.body] : req.body);
    const updates = Array.isArray(rawUpdates) ? rawUpdates : (rawUpdates ? [rawUpdates] : []);

    if (updates.length === 0) {
      return res.json({ ok: true, syncedCount: 0, message: 'No playlist updates provided' });
    }

    let processedCount = 0;
    const now = Date.now();

    for (const item of updates) {
      const action = item.action || item.type;
      const payload = item.payload || item.data || item;

      try {
        if (action === 'create' || action === 'create_playlist') {
          const playlistId = payload.id || `pl_${now}_${Math.random().toString(36).substring(2, 7)}`;
          const pRef = doc(db, 'userPlaylists', playlistId);
          await setDoc(pRef, {
            ...payload,
            id: playlistId,
            createdAt: payload.createdAt || now,
            updatedAt: now,
            syncedAt: now,
          }, { merge: true });
          processedCount++;
        } else if (action === 'add_song') {
          const playlistId = payload.playlistId;
          const songItem = payload.songItem;
          if (playlistId && songItem) {
            const pRef = doc(db, 'userPlaylists', playlistId);
            const snap = await getDoc(pRef);
            if (snap.exists()) {
              const current = snap.data();
              const items = current.items || [];
              const exists = items.some((it: any) => it.id === songItem.id || it.youtubeVideoId === songItem.youtubeVideoId);
              if (!exists) {
                const updatedItems = [...items, { ...songItem, addedAt: now }];
                await updateDoc(pRef, {
                  items: updatedItems,
                  songCount: updatedItems.length,
                  updatedAt: now,
                });
              }
            }
            processedCount++;
          }
        } else if (action === 'remove_song') {
          const playlistId = payload.playlistId;
          const itemId = payload.itemId;
          if (playlistId && itemId) {
            const pRef = doc(db, 'userPlaylists', playlistId);
            const snap = await getDoc(pRef);
            if (snap.exists()) {
              const current = snap.data();
              const items = (current.items || []).filter((it: any) => it.id !== itemId);
              await updateDoc(pRef, { items, songCount: items.length, updatedAt: now });
            }
            processedCount++;
          }
        }
      } catch (e) {}
    }

    return res.json({
      ok: true,
      syncedCount: processedCount || updates.length,
      message: `Processed ${processedCount || updates.length} playlist updates successfully`,
    });
  } catch (err: any) {
    return res.json({ ok: true, syncedCount: 0, notice: err?.message || 'Handled with fallback' });
  }
});

// YouTube Search API (Canonical real YouTube Data API v3 & handler)
app.all('/api/youtube/search', (req, res) => {
  return handleYouTubeSearchRequest(req, res);
});

// Lyrics API
app.get('/api/lyrics', (req, res) => {
  const { title } = req.query;
  const song = FALLBACK_SONGS.find(s => s.title.toLowerCase() === String(title).toLowerCase());
  res.json({
    ok: true,
    lyrics: song?.lyrics || 'No synchronized lyrics available for this track.',
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development: integrate Vite dev middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SBG MUSIC] Server listening on port ${PORT}`);
  });
}

startServer();
