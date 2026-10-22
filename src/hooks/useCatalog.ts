import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  documentId,
  limit
} from 'firebase/firestore';
import { Song, Playlist, StaffUser } from '../types';
import { dedupeRequest, invalidateCache, formatErrorMessage, getCachedData } from '../lib/cache';
import { FALLBACK_SONGS, FALLBACK_PLAYLISTS } from '../data/fallbackCatalog';
export { invalidateCache };

const DEFAULT_TTL = 300000; // 5 minutes cached local state

/**
 * Single unified service function to fetch all songs directly from the Firestore 'songs' collection.
 * Routes through high-speed server caching proxy to save daily Firestore quotas.
 * Eliminates query abstraction differences and prevents document omission from missing indexes or fields.
 */
export async function fetchAllFirestoreSongs(forceRefresh = false): Promise<Song[]> {
  if (forceRefresh) {
    invalidateCache('all_firestore_songs');
    invalidateCache('admin_songs_list');
    invalidateCache('published_songs_list');
    if (typeof window !== 'undefined') {
      fetch('/api/catalog/invalidate', { method: 'POST' }).catch(() => {});
    }
  }

  return dedupeRequest(
    'all_firestore_songs',
    async () => {
      // 1. First attempt high-speed server-cached API proxy (0 Firestore client reads)
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/catalog/songs');
          if (res.ok) {
            const json = await res.json();
            if (json.ok && Array.isArray(json.songs) && json.songs.length > 0) {
              return json.songs as Song[];
            }
          }
        } catch {
          // Non-critical network/proxy fallback
        }
      }

      // 2. Direct Firestore Client SDK fallback
      try {
        // Apply a safety limit of 1000 to prevent total quota exhaustion on large catalogs
        // Ordering by createdAt descending ensures we get the newest content first
        const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'), limit(1000));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Song));

        if (docs.length > 0) {
          const existingIds = new Set(docs.map((d) => d.id));
          const combined = [...docs];
          for (const fb of FALLBACK_SONGS) {
            if (!existingIds.has(fb.id)) {
              combined.push(fb);
            }
          }
          return combined;
        }
        return FALLBACK_SONGS;
      } catch (e: any) {
        console.warn('[Catalog] Firestore fetch notice (e.g. quota limit or offline). Serving fallback catalog:', e?.message || e);
        const localCached = getCachedData<Song[]>('all_firestore_songs');
        if (localCached && localCached.length > 0) {
          return localCached;
        }
        return FALLBACK_SONGS;
      }
    },
    DEFAULT_TTL
  );
}

/**
 * Invalidate all song-related catalog caches.
 */
export function invalidateSongCache() {
  invalidateCache('all_firestore_songs');
  invalidateCache('admin_songs_list');
  invalidateCache('published_songs_list');
  if (typeof window !== 'undefined') {
    fetch('/api/catalog/invalidate', { method: 'POST' }).catch(() => {});
  }
}

/**
 * Custom hook for paginated published songs with cached local state.
 */
export function usePaginatedSongs(pageSize = 24) {
  const ssrInitial = typeof window !== 'undefined' && Array.isArray((window as any).__INITIAL_SSR_DATA__?.songs)
    ? (window as any).__INITIAL_SSR_DATA__.songs
    : null;
  const cachedInitial = getCachedData<Song[]>('all_firestore_songs') || ssrInitial;
  const [songs, setSongs] = useState<Song[]>(() => {
    if (cachedInitial && cachedInitial.length > 0) {
      return cachedInitial.filter((s: Song) => s.published !== false);
    }
    return [];
  });
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loading, setLoading] = useState(() => !cachedInitial || cachedInitial.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSongs = useCallback(async (forceRefresh = false) => {
    // Only show full loading spinner if we don't have cached songs already rendering
    if (forceRefresh || songs.length === 0) {
      setLoading(true);
    }
    try {
      const allSongs = await fetchAllFirestoreSongs(forceRefresh);
      // Public view: Include songs unless explicitly marked as published === false
      const publishedSongs = allSongs.filter((s) => s.published !== false);
      setSongs(publishedSongs);
      setErrorMsg(null);
    } catch (e: any) {
      console.error('Error fetching songs catalog:', e);
      setErrorMsg(formatErrorMessage(e, false, 'Failed to load songs catalog.'));
    } finally {
      setLoading(false);
    }
  }, [songs.length]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  const visibleSongs = useMemo(() => songs.slice(0, visibleCount), [songs, visibleCount]);
  const hasMore = visibleCount < songs.length;

  return {
    songs,
    visibleSongs,
    hasMore,
    loading,
    errorMsg,
    loadMore,
    refetch: () => fetchSongs(true),
  };
}

/**
 * Custom hook for paginated published playlists with cached local state.
 */
export function usePaginatedPlaylists(pageSize = 12) {
  const ssrPlaylists = typeof window !== 'undefined' && Array.isArray((window as any).__INITIAL_SSR_DATA__?.playlists)
    ? (window as any).__INITIAL_SSR_DATA__.playlists
    : null;
  const cachedInitial = getCachedData<Playlist[]>('published_playlists_list') || ssrPlaylists;
  const [playlists, setPlaylists] = useState<Playlist[]>(() => cachedInitial || []);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loading, setLoading] = useState(() => !cachedInitial || cachedInitial.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      invalidateCache('published_playlists_list');
    }
    if (playlists.length === 0) {
      setLoading(true);
    }
    try {
      const fetched = await dedupeRequest(
        'published_playlists_list',
        async () => {
          // 1. Try server-cached playlists proxy (0 Firestore client reads)
          if (typeof window !== 'undefined') {
            try {
              const res = await fetch('/api/catalog/playlists');
              if (res.ok) {
                const json = await res.json();
                if (json.ok && Array.isArray(json.playlists) && json.playlists.length > 0) {
                  return json.playlists as Playlist[];
                }
              }
            } catch {
              // Non-critical network/proxy fallback
            }
          }

          // 2. Direct Firestore Client SDK fallback
          try {
            const q = query(
              collection(db, 'playlists'),
              where('published', '==', true)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Playlist));
            
            if (docs.length > 0) {
              return docs.sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });
            }
            return FALLBACK_PLAYLISTS;
          } catch (err: any) {
            console.warn('[Playlists] Firestore query notice (quota/offline). Serving fallback playlists:', err?.message || err);
            return FALLBACK_PLAYLISTS;
          }
        },
        DEFAULT_TTL
      );
      setPlaylists(fetched);
      setErrorMsg(null);
    } catch (e: any) {
      console.error('Error fetching playlists catalog:', e);
      setErrorMsg(formatErrorMessage(e, false, 'Failed to load playlists.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  const visiblePlaylists = useMemo(() => playlists.slice(0, visibleCount), [playlists, visibleCount]);
  const hasMore = visibleCount < playlists.length;

  return {
    playlists,
    visiblePlaylists,
    hasMore,
    loading,
    errorMsg,
    loadMore,
    refetch: () => fetchPlaylists(true),
  };
}

/**
 * Custom hook for single playlist detail and its songs with cached local state.
 * Eliminates direct Firestore listeners and nested getDocs loops inside snapshot listeners.
 */
export function usePlaylistDetail(playlistId: string | undefined) {
  const ssrPlaylist = typeof window !== 'undefined' && (window as any).__INITIAL_SSR_DATA__?.playlist?.id === playlistId
    ? (window as any).__INITIAL_SSR_DATA__.playlist
    : null;
  const ssrSongs = typeof window !== 'undefined' && (window as any).__INITIAL_SSR_DATA__?.playlist?.id === playlistId && Array.isArray((window as any).__INITIAL_SSR_DATA__?.playlistSongs)
    ? (window as any).__INITIAL_SSR_DATA__.playlistSongs
    : [];

  const [playlist, setPlaylist] = useState<Playlist | null>(() => ssrPlaylist);
  const [songs, setSongs] = useState<Song[]>(() => ssrSongs);
  const [loading, setLoading] = useState(() => !ssrPlaylist);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDetail = useCallback(async (forceRefresh = false) => {
    if (!playlistId) {
      setLoading(false);
      return;
    }
    if (forceRefresh) {
      invalidateCache(`playlist_detail_${playlistId}`);
    }

    setLoading(true);
    try {
      // 1. Fetch Playlist Document from Firestore, fallback, or localStorage
      const plData = await dedupeRequest(
        `playlist_detail_${playlistId}`,
        async () => {
          // Check server API or direct Firestore first
          try {
            const snap = await getDoc(doc(db, 'playlists', playlistId));
            if (snap.exists()) {
              return { id: snap.id, ...snap.data() } as Playlist;
            }
          } catch (e) {
            console.warn('[usePlaylistDetail] Firestore fetch error:', e);
          }

          // Check FALLBACK_PLAYLISTS
          const fb = FALLBACK_PLAYLISTS.find((p) => p.id === playlistId);
          if (fb) return fb;

          // Check localStorage for custom playlists
          if (typeof window !== 'undefined') {
            try {
              const custom = JSON.parse(localStorage.getItem('sbg_user_custom_playlists') || '[]');
              const matched = custom.find((p: any) => p.id === playlistId);
              if (matched) return matched;
            } catch {}
          }

          return null;
        },
        DEFAULT_TTL
      );

      if (!plData) {
        setPlaylist(null);
        setSongs([]);
        setLoading(false);
        return;
      }

      setPlaylist(plData);

      // If songs are directly embedded on playlist object
      if (plData.songs && plData.songs.length > 0) {
        setSongs(plData.songs);
        setLoading(false);
        return;
      }

      // 2. Fetch Playlist Songs by resolving songIds against the full catalog
      const songIds = plData.songIds || [];
      if (songIds.length === 0) {
        setSongs([]);
        setLoading(false);
        return;
      }

      try {
        const allSongs = await fetchAllFirestoreSongs(forceRefresh);
        const songMap = new Map(allSongs.map((s) => [s.id, s]));
        const orderedSongs = songIds.map((id: string) => songMap.get(id)).filter(Boolean) as Song[];

        if (orderedSongs.length > 0) {
          setSongs(orderedSongs);
          setErrorMsg(null);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[usePlaylistDetail] Fast song resolution notice:', err);
      }

      // Fallback: chunked query
      const chunks: string[][] = [];
      for (let i = 0; i < songIds.length; i += 10) {
        chunks.push(songIds.slice(i, i + 10));
      }

      const chunkPromises = chunks.map(async (chunk) => {
        const chunkKey = `playlist_songs_chunk_${chunk.join('_')}`;
        if (forceRefresh) invalidateCache(chunkKey);

        return dedupeRequest(
          chunkKey,
          async () => {
            const q = query(collection(db, 'songs'), where(documentId(), 'in', chunk));
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Song[];
          },
          DEFAULT_TTL
        );
      });

      const results = await Promise.all(chunkPromises);
      const fetchedSongs = results.flat();

      const orderedSongs = songIds
        .map((id: string) => fetchedSongs.find((s: Song) => s.id === id))
        .filter(Boolean) as Song[];

      setSongs(orderedSongs);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error in usePlaylistDetail:', err);
      setErrorMsg(formatErrorMessage(err, false, 'Failed to load playlist tracks.'));
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return {
    playlist,
    songs,
    loading,
    errorMsg,
    refetch: () => loadDetail(true),
  };
}

/**
 * Helper to fetch a playlist's song list by its songIds array.
 */
export async function fetchPlaylistSongs(songIds: string[] | undefined, forceRefresh = false): Promise<Song[]> {
  if (!songIds || songIds.length === 0) return [];
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < songIds.length; i += 10) {
      chunks.push(songIds.slice(i, i + 10));
    }

    const chunkPromises = chunks.map(async (chunk) => {
      const chunkKey = `playlist_songs_chunk_${chunk.join('_')}`;
      if (forceRefresh) invalidateCache(chunkKey);
      return dedupeRequest(
        chunkKey,
        async () => {
          const q = query(collection(db, 'songs'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Song[];
        },
        DEFAULT_TTL
      );
    });

    const results = await Promise.all(chunkPromises);
    const fetched = results.flat();

    const ordered = songIds
      .map((id) => fetched.find((s) => s.id === id))
      .filter(Boolean) as Song[];

    return ordered;
  } catch (err) {
    console.error('Error fetching playlist songs helper:', err);
    return [];
  }
}

/**
 * Custom hook to fetch a list of songs by array of songIds without re-triggering loops.
 * Memoizes based on songIds key.
 */
export function usePlaylistSongs(songIds: string[] | undefined) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  const songIdsKey = useMemo(() => (songIds ? songIds.join(',') : ''), [songIds]);

  const fetchSongs = useCallback(async () => {
    if (!songIds || songIds.length === 0) {
      setSongs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ordered = await fetchPlaylistSongs(songIds);
      setSongs(ordered);
    } catch (err) {
      console.error('Error fetching playlist songs in hook:', err);
    } finally {
      setLoading(false);
    }
  }, [songIdsKey]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  return { songs, setSongs, loading, refetch: fetchSongs };
}

/**
 * Custom hook for Admin songs catalog management with cached local state.
 * Replaces direct onSnapshot listeners on entire songs collection.
 */
export function useAdminSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAdminSongs = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const fetched = await fetchAllFirestoreSongs(forceRefresh);
      setSongs(fetched);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error fetching admin songs:', err);
      setErrorMsg(formatErrorMessage(err, true, 'Failed to fetch song catalog.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminSongs();
  }, [fetchAdminSongs]);

  const invalidateAndRefetch = useCallback(() => {
    invalidateSongCache();
    fetchAdminSongs(true);
  }, [fetchAdminSongs]);

  return {
    songs,
    setSongs,
    loading,
    errorMsg,
    refetch: invalidateAndRefetch,
  };
}

/**
 * Custom hook for Admin playlists management with cached local state.
 * Replaces direct onSnapshot listeners on entire playlists collection.
 */
export function useAdminPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAdminPlaylists = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      invalidateCache('admin_playlists_list');
    }
    setLoading(true);
    try {
      const fetched = await dedupeRequest(
        'admin_playlists_list',
        async () => {
          const q = query(collection(db, 'playlists'));
          const snapshot = await getDocs(q);
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Playlist));
          
          // Sort client side to ensure playlists without createdAt are not filtered out by Firestore
          return docs.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
        },
        DEFAULT_TTL
      );
      setPlaylists(fetched);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error fetching admin playlists:', err);
      setErrorMsg(formatErrorMessage(err, true, 'Failed to fetch playlists catalog.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminPlaylists();
  }, [fetchAdminPlaylists]);

  const invalidateAndRefetch = useCallback(() => {
    invalidateCache('admin_playlists_list');
    invalidateCache('published_playlists_list');
    fetchAdminPlaylists(true);
  }, [fetchAdminPlaylists]);

  return {
    playlists,
    setPlaylists,
    loading,
    errorMsg,
    refetch: invalidateAndRefetch,
  };
}

/**
 * Custom hook for Admin Staff management with cached local state & request queue.
 * Replaces direct onSnapshot listener on staff collection.
 */
export function useAdminStaff(enabled = true) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStaff = useCallback(async (forceRefresh = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (forceRefresh) {
      invalidateCache('admin_staff_list');
    }
    setLoading(true);
    try {
      const fetched = await dedupeRequest(
        'admin_staff_list',
        async () => {
          const q = query(collection(db, 'staff'), orderBy('createdAt', 'desc'));
          const snapshot = await getDocs(q);
          return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StaffUser));
        },
        DEFAULT_TTL
      );
      setStaffList(fetched);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error fetching staff list:', err);
      setErrorMsg(formatErrorMessage(err, true, 'Failed to fetch staff list.'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const invalidateAndRefetch = useCallback(() => {
    invalidateCache('admin_staff_list');
    fetchStaff(true);
  }, [fetchStaff]);

  return {
    staffList,
    setStaffList,
    loading,
    errorMsg,
    refetch: invalidateAndRefetch,
  };
}


export function useRecentlyAddedSongs(limitCount = 5) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRecent = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const allSongs = await fetchAllFirestoreSongs(forceRefresh);
      const publishedSongs = allSongs.filter((s) => s.published !== false);
      setSongs(publishedSongs.slice(0, limitCount));
      setErrorMsg(null);
    } catch (e: any) {
      console.error('Failed to fetch recent songs:', e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [limitCount]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  return { songs, loading, errorMsg, refresh: () => fetchRecent(true) };
}
