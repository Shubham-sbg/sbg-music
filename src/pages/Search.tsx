import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthProvider';
import { 
  Play, 
  Pause, 
  Search as SearchIcon, 
  Music, 
  Youtube,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Database,
  X,
  Sparkles,
  ListPlus,
  RotateCcw,
  Radio,
  ExternalLink
} from 'lucide-react';
import { Song } from '../types';
import AdPlacementBanner from '../components/AdPlacementBanner';
import { fetchAllFirestoreSongs } from '../hooks/useCatalog';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import FavoriteButton from '../components/FavoriteButton';
import AddToLibraryButton from '../components/AddToLibraryButton';
import ShareSongButton from '../components/ShareSongButton';
import { addToUserLibrary } from '../services/libraryService';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { invalidateCache } from '../lib/cache';
import { useSeo } from '../hooks/useSeo';
import { getReadableError } from '../utils/errorUtils';

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  rawTitle?: string;
  artist: string;
  channelTitle?: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  duration?: number;
  description?: string;
}

type SearchSource = 'all' | 'sbg' | 'youtube';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const { playSong, currentSong, isPlaying, isLoading, isBuffering } = usePlayer();

  const isStaffOrAdmin = Boolean(
    user && (
      user.role === 'owner' || 
      user.role === 'admin' || 
      user.role === 'staff' || 
      (typeof hasPermission === 'function' && hasPermission('addSongs'))
    )
  );

  // URL state synchronization
  const urlQuery = searchParams.get('q') || '';
  const rawSource = searchParams.get('source');
  const urlSource: SearchSource = (rawSource === 'sbg' || rawSource === 'youtube') ? rawSource : 'all';

  // Unified State Management
  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(urlQuery);
  const [activeSource, setActiveSource] = useState<SearchSource>(urlSource);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // SBG Music Firestore catalog state
  const ssrSongs = typeof window !== 'undefined' && Array.isArray((window as any).__INITIAL_SSR_DATA__?.songs)
    ? (window as any).__INITIAL_SSR_DATA__.songs
    : [];
  const [sbgSongs, setSbgSongs] = useState<Song[]>(() => ssrSongs);
  const [sbgLoading, setSbgLoading] = useState(() => ssrSongs.length === 0);

  // YouTube search state
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [ytLoadingMore, setYtLoadingMore] = useState(false);
  const [inlineYtTrack, setInlineYtTrack] = useState<{ videoId: string; title: string; channelTitle: string } | null>(null);

  // In-memory query result cache to reuse results when toggling tabs (e.g. YOUTUBE -> SBG -> YOUTUBE)
  const ytQueryCacheRef = useRef<Map<string, { items: YouTubeSearchResult[]; nextPageToken: string | null }>>(new Map());
  
  // AbortController to cancel stale/superseded network requests when query updates rapidly
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Saved YouTube songs in SBG Catalog tracking
  const [savedYtSongIds, setSavedYtSongIds] = useState<Set<string>>(new Set());
  const [savingSongId, setSavingSongId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Add to Playlist Modal state
  const [playlistModalItem, setPlaylistModalItem] = useState<(Partial<Song> & { title: string; artist: string; youtubeVideoId?: string }) | null>(null);

  useSeo({
    title: debouncedTerm ? `Search: ${debouncedTerm} | SBG MUSIC` : 'Search Songs & YouTube Music | SBG MUSIC',
    description: 'Search official songs and YouTube music streams directly on SBG MUSIC.',
    noIndex: true,
    canonicalUrl: `${window.location.origin}/search`,
  });

  // Sync state if URL search parameters change externally (e.g. Back/Forward browser navigation)
  useEffect(() => {
    if (urlQuery !== searchTerm && urlQuery !== debouncedTerm) {
      setSearchTerm(urlQuery);
      setDebouncedTerm(urlQuery);
    }
    if (urlSource !== activeSource) {
      setActiveSource(urlSource);
    }
  }, [urlQuery, urlSource]);

  // Debounce search term and sync cleanly to URL without resetting active tab
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedTerm(trimmed);
      
      const currentQ = searchParams.get('q') || '';
      const currentSrc = searchParams.get('source') || 'all';
      const targetSrc = activeSource === 'all' ? 'all' : activeSource;

      if (trimmed !== currentQ || targetSrc !== currentSrc) {
        const params = new URLSearchParams();
        if (trimmed) {
          params.set('q', trimmed);
        }
        if (activeSource !== 'all') {
          params.set('source', activeSource);
        }
        setSearchParams(params, { replace: true });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, activeSource, searchParams, setSearchParams]);

  // Handle switching source tab without losing search query or navigating away
  const handleTabChange = (source: SearchSource) => {
    setActiveSource(source);
    const params = new URLSearchParams();
    const currentQuery = searchTerm.trim() || debouncedTerm.trim();
    if (currentQuery) {
      params.set('q', currentQuery);
    }
    if (source !== 'all') {
      params.set('source', source);
    }
    setSearchParams(params, { replace: true });
  };

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sbg_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to parse recent searches:', err);
    }
  }, []);

  // Save query to recent searches
  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const clean = term.trim();
    setRecentSearches((prev) => {
      const filtered = prev.filter((t) => t.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('sbg_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving recent search:', e);
      }
      return updated;
    });
  };

  // Load SBG library songs once on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSongs = async () => {
      setSbgLoading(true);
      try {
        const allSongs = await fetchAllFirestoreSongs();
        const publishedSongs = allSongs.filter((s) => s.published !== false);
        if (isMounted) {
          setSbgSongs(publishedSongs);
          const existingYtIds = new Set<string>();
          publishedSongs.forEach((s) => {
            if (s.youtubeVideoId) existingYtIds.add(s.youtubeVideoId);
          });
          setSavedYtSongIds(existingYtIds);
        }
      } catch (e) {
        console.error('Error fetching SBG catalog:', e);
      } finally {
        if (isMounted) setSbgLoading(false);
      }
    };
    fetchSongs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter SBG Library songs based on search query
  const filteredSbgSongs = useMemo(() => {
    if (activeSource === 'youtube') {
      return [];
    }
    if (!debouncedTerm.trim()) {
      return sbgSongs;
    }
    const lowerSearch = debouncedTerm.toLowerCase();
    return sbgSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(lowerSearch) ||
        song.artist.toLowerCase().includes(lowerSearch) ||
        (song.genre && song.genre.toLowerCase().includes(lowerSearch))
    );
  }, [debouncedTerm, sbgSongs, activeSource]);

  // Standalone function to execute YouTube search
  const executeYtSearch = async (queryOverride?: string, forceRefresh = false) => {
    const trimmedQuery = (queryOverride || debouncedTerm).trim();
    if (!trimmedQuery) {
      setYtResults([]);
      setYtError(null);
      setNextPageToken(null);
      return;
    }

    saveRecentSearch(trimmedQuery);

    if (activeSource === 'sbg') return;

    const cacheKey = trimmedQuery.toLowerCase();
    
    // Check component-level cache first unless forcing refresh
    if (!forceRefresh) {
      const cachedData = ytQueryCacheRef.current.get(cacheKey);
      if (cachedData && cachedData.items.length > 0) {
        setYtResults(cachedData.items);
        setNextPageToken(cachedData.nextPageToken);
        setYtError(null);
        setYtLoading(false);
        return;
      }
    }

    // Abort previous in-flight fetch
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setYtLoading(true);
    setYtError(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: abortController.signal,
        headers: { 'Accept': 'application/json' },
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        console.warn('[Search] Failed to parse JSON response');
      }

      if (data.ok === false || !res.ok) {
        const rawErr = data.error || data.message || 'YouTube search is temporarily unavailable. Please try again.';
        const cleanError = typeof rawErr === 'string' && rawErr.trim() && rawErr !== '[object Object]'
          ? rawErr
          : 'YouTube search is temporarily unavailable. Please try again.';
        setYtError(cleanError);
        setYtResults([]);
        setNextPageToken(null);
        return;
      }

      const items: YouTubeSearchResult[] = Array.isArray(data.items) 
        ? data.items 
        : (Array.isArray(data) ? data : []);
      const token: string | null = typeof data.nextPageToken === 'string' ? data.nextPageToken : null;
      
      setYtResults(items);
      setNextPageToken(token);
      setYtError(null);
      
      if (items.length > 0) {
        ytQueryCacheRef.current.set(cacheKey, { items, nextPageToken: token });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('YouTube search request encountered an error:', err);
      
      const cleanError = typeof err?.message === 'string' && err.message.trim() && err.message !== '[object Object]'
        ? err.message
        : 'YouTube search is temporarily unavailable. Please try again.';
      setYtError(cleanError);
    } finally {
      setYtLoading(false);
    }
  };

  // 3. YouTube Search Effect (Consolidated Unified Flow)
  useEffect(() => {
    executeYtSearch();
    
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [debouncedTerm, activeSource]);

  // Pagination: Load more YouTube results
  const handleLoadMoreYt = async () => {
    if (!nextPageToken || ytLoadingMore || ytLoading || !debouncedTerm.trim()) return;
    setYtLoadingMore(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(debouncedTerm.trim())}&pageToken=${encodeURIComponent(
          nextPageToken
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        const newItems = (data.items || []).filter(
          (it: YouTubeSearchResult) => !ytResults.some((p) => p.videoId === it.videoId)
        );
        const updatedList = [...ytResults, ...newItems];
        const nextToken = data.nextPageToken || null;

        setYtResults(updatedList);
        setNextPageToken(nextToken);

        // Update component cache with loaded pages
        const cacheKey = debouncedTerm.trim().toLowerCase();
        ytQueryCacheRef.current.set(cacheKey, { items: updatedList, nextPageToken: nextToken });
      }
    } catch (e) {
      console.error('Failed to load more YouTube results:', e);
    } finally {
      setYtLoadingMore(false);
    }
  };

  // Intersection observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastResultElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (ytLoading || ytLoadingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && nextPageToken) {
          handleLoadMoreYt();
        }
      });
      if (node) observer.current.observe(node);
    },
    [ytLoading, ytLoadingMore, nextPageToken]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Robust YouTube API response parser without throwing
  const handleYouTubeResponse = (data: any, res: Response) => {
    if (!res.ok || data?.ok === false) {
      const rawErr = data?.error || data?.message || data;
      const cleanError = typeof rawErr === 'string' && rawErr.trim() && rawErr !== '[object Object]'
        ? rawErr
        : 'YouTube search is temporarily unavailable. Please try again.';
      return { items: [], nextPageToken: null, error: cleanError };
    }

    const items: YouTubeSearchResult[] = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.data?.items)
      ? data.data.items
      : [];
      
    const token: string | null = typeof data.nextPageToken === 'string' ? data.nextPageToken : null;
    
    return { items, nextPageToken: token, error: null };
  };

  // Retry YouTube search manually
  const handleRetryYtSearch = () => {
    executeYtSearch(debouncedTerm, true);
  };

  // Convert YouTubeSearchResult to a Song object for PlayerContext
  const convertYtToSong = (yt: YouTubeSearchResult): Song => {
    if (!yt) return {} as Song;
    const videoId = yt.videoId || 'unknown';
    return {
      id: `yt_${videoId}`,
      title: yt.title || 'Untitled YouTube Video',
      artist: yt.artist || yt.channelTitle || 'YouTube Artist',
      description: yt.description || '',
      genre: 'YouTube Music',
      youtubeVideoId: videoId,
      youtubeUrl: yt.youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`,
      coverUrl: yt.thumbnailUrl || '',
      thumbnailUrl: yt.thumbnailUrl || '',
      audioUrl: yt.youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`,
      duration: yt.duration || 0,
      source: 'youtube',
      published: true,
      showYoutubeSourceBadge: false,
      createdAt: new Date().toISOString(),
    };
  };

  // Add YouTube Result to SBG Music Catalog (Admin/Staff only)
  const handleAddToSbgCatalog = async (yt: YouTubeSearchResult) => {
    // Normal listeners must not add songs to the public SBG Music catalog.
    // Instead, route safely to their personal SBG Library.
    if (!isStaffOrAdmin) {
      if (!user?.uid) {
        showToast('Sign in to save this YouTube song to your SBG Library.');
        return;
      }
      setSavingSongId(yt.videoId);
      try {
        const songObj = convertYtToSong(yt);
        await addToUserLibrary(user.uid, songObj);
        setSavedYtSongIds((prev) => new Set(prev).add(yt.videoId));
        showToast(`Saved "${yt.title}" to your SBG Library!`);
      } catch (err: any) {
        console.error('Failed to add to library:', err);
        showToast('Failed to save to library: ' + (err.message || 'Error occurred'));
      } finally {
        setSavingSongId(null);
      }
      return;
    }

    if (savedYtSongIds.has(yt.videoId)) return;

    setSavingSongId(yt.videoId);
    try {
      // Force refresh auth token for admin to prevent stale token permission-denied errors
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch (tokenErr) {
          console.warn('Could not force refresh token:', tokenErr);
        }
      }

      const q = query(collection(db, 'songs'), where('youtubeVideoId', '==', yt.videoId));
      const snap = await getDocs(q);

      if (snap.empty) {
        const staffName = user?.displayName || 'Admin';
        const docRef = await addDoc(collection(db, 'songs'), {
          title: yt.title,
          artist: yt.artist || yt.channelTitle || 'YouTube Artist',
          description: yt.description || '',
          genre: 'YouTube Music',
          releaseDate: new Date().toISOString().split('T')[0],
          youtubeUrl: yt.youtubeUrl,
          youtubeVideoId: yt.videoId,
          coverUrl: yt.thumbnailUrl,
          customCoverUrl: yt.thumbnailUrl,
          imageUrl: yt.thumbnailUrl,
          thumbnailUrl: yt.thumbnailUrl,
          audioUrl: yt.youtubeUrl,
          duration: yt.duration || 0,
          durationSeconds: yt.duration || 0,
          explicitContent: false,
          downloadEnabled: false,
          published: true,
          showYoutubeSourceBadge: false,
          source: 'youtube',
          createdBy: staffName,
          createdById: user?.uid || user?.id || 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Add to local state immediately
        const newSong: Song = {
          id: docRef.id,
          title: yt.title,
          artist: yt.artist || yt.channelTitle || 'YouTube Artist',
          description: yt.description || '',
          genre: 'YouTube Music',
          releaseDate: new Date().toISOString().split('T')[0],
          youtubeUrl: yt.youtubeUrl,
          youtubeVideoId: yt.videoId,
          coverUrl: yt.thumbnailUrl,
          customCoverUrl: yt.thumbnailUrl,
          thumbnailUrl: yt.thumbnailUrl,
          audioUrl: yt.youtubeUrl,
          duration: yt.duration || 0,
          durationSeconds: yt.duration || 0,
          explicitContent: false,
          source: 'youtube',
          published: true,
          createdAt: new Date().toISOString(),
        };

        setSbgSongs((prev) => [newSong, ...prev]);
        invalidateCache('published_songs_list');
        invalidateCache('admin_songs_list');

        // If admin is logged in, also add to personal library for convenience
        if (user?.uid) {
          try {
            await addToUserLibrary(user.uid, newSong);
          } catch (libErr) {
            console.warn('Could not sync to user library:', libErr);
          }
        }
      } else if (user?.uid) {
        // Already in catalog, ensure it is added to user library
        const existingData = snap.docs[0].data();
        try {
          await addToUserLibrary(user.uid, {
            id: snap.docs[0].id,
            title: existingData.title || yt.title,
            artist: existingData.artist || yt.artist || 'YouTube Artist',
            coverUrl: existingData.coverUrl || yt.thumbnailUrl,
            imageUrl: existingData.imageUrl || yt.thumbnailUrl,
            thumbnailUrl: yt.thumbnailUrl,
            audioUrl: yt.youtubeUrl,
            youtubeUrl: yt.youtubeUrl,
            youtubeVideoId: yt.videoId,
            duration: yt.duration || 0,
            source: 'youtube',
            genre: existingData.genre || 'YouTube Music',
          });
        } catch (libErr) {
          console.warn('Could not sync to user library:', libErr);
        }
      }

      setSavedYtSongIds((prev) => new Set(prev).add(yt.videoId));
      showToast(`Added "${yt.title}" to SBG Catalog!`);
    } catch (err: any) {
      console.error('Failed to save to SBG Catalog:', err);
      showToast('Failed to save song: ' + (err.message || 'Error occurred'));
    } finally {
      setSavingSongId(null);
    }
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full pb-24">
      {/* 1. PRIMARY UNIFIED SEARCH HEADER */}
      <div className="bg-[#111114] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
          Music Discovery
        </h1>
        <p className="text-white/50 text-xs md:text-sm max-w-md mx-auto mb-6">
          Find your favorite tracks, artists, and albums across SBG MUSIC and YouTube.
        </p>

        {/* The ONLY search input on the entire page */}
        <div className="relative w-full max-w-2xl mx-auto mb-5">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/70 z-10 pointer-events-none">
            <SearchIcon size={20} />
          </div>
          <input
            type="text"
            placeholder="Search songs, artists, playlists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDebouncedTerm(searchTerm.trim());
                saveRecentSearch(searchTerm.trim());
                e.currentTarget.blur();
              }
            }}
            aria-label="Search songs, artists, playlists"
            className="relative z-10 w-full bg-[#18181c] border border-white/20 rounded-2xl pl-13 pr-11 py-4 text-base md:text-lg text-[#ffffff] font-semibold outline-none placeholder:text-zinc-300 placeholder:opacity-90 focus:border-red-500/80 focus:ring-2 focus:ring-red-500/30 transition-all shadow-inner"
          />

          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDebouncedTerm('');
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}

          {/* Recent Searches Dropdown */}
          {isSearchFocused && !searchTerm && recentSearches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181B] border border-white/10 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-30 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider flex justify-between items-center mb-1">
                <span>Recent Searches</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setRecentSearches([]);
                    localStorage.removeItem('sbg_recent_searches');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onMouseDown={() => {
                    setSearchTerm(term);
                    setDebouncedTerm(term);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-3 text-sm text-white/90"
                >
                  <SearchIcon size={14} className="text-white/40" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Unified Tab Filters: ALL | SBG MUSIC | YOUTUBE */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSource === 'all'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>ALL</span>
            {debouncedTerm.trim() && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSource === 'all' ? 'bg-black/10 text-black font-semibold' : 'bg-white/10 text-white/60'}`}>
                {filteredSbgSongs.length + ytResults.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('sbg')}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSource === 'sbg'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Database size={14} />
            <span>SBG MUSIC</span>
            {debouncedTerm.trim() && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-semibold">
                {filteredSbgSongs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('youtube')}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSource === 'youtube'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Radio size={14} className={ytLoading ? 'animate-pulse text-red-300' : ''} />
            <span>SBG YT</span>
            {debouncedTerm.trim() && ytResults.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-semibold">
                {ytResults.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AdPlacementBanner placement="search_page" />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 right-6 z-50 bg-white text-black font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-6 h-6 rounded-full bg-green-500 text-black flex items-center justify-center">
            <Check size={14} className="stroke-[3]" />
          </div>
          <span className="text-xs">{toastMsg}</span>
        </div>
      )}

      {/* 2. SEARCH / DISCOVERY RESULTS VIEW */}
      <div className="space-y-10">
        
        {/* Quick trending suggestions when search is empty */}
        {!debouncedTerm.trim() && (
          <div className="bg-[#111114] p-6 rounded-3xl border border-white/5 space-y-4">
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-red-400" />
              <span>Trending Discovery Tags</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {['Arijit Singh', 'Desi Hip-Hop', 'Chill Lofi', 'Alan Walker', 'Bhakti Song', 'Punjabi Pop', 'Romantic Hits', 'Party Anthems'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSearchTerm(tag);
                    setDebouncedTerm(tag);
                  }}
                  className="text-xs px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={12} className="text-red-400" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION A: SBG MUSIC CATALOG RESULTS / MAXIMUM SONGS DISCOVERY */}
        {(activeSource === 'all' || activeSource === 'sbg') && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Database size={20} className="text-purple-400" />
                <span>{!debouncedTerm.trim() ? 'Maximum Song Discovery Catalog' : 'SBG Catalog'}</span>
                <span className="text-xs text-white/50 font-mono font-normal bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                  {filteredSbgSongs.length} tracks
                </span>
              </h2>
            </div>

              {sbgLoading ? (
                <div className="p-10 text-center text-white/40 flex items-center justify-center gap-2 bg-[#111114] rounded-3xl border border-white/5">
                  <Loader2 size={20} className="animate-spin text-purple-500" />
                  <span className="text-sm">Searching catalog...</span>
                </div>
              ) : filteredSbgSongs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredSbgSongs.map((song) => {
                    const isCurrentPlaying = currentSong?.id === song.id;
                    const isCurrentLoading = isCurrentPlaying && (isLoading || isBuffering);
                    const displayImage =
                      song.imageUrl ||
                      song.customCoverUrl ||
                      song.coverUrl ||
                      song.heroImageUrl ||
                      song.thumbnailUrl;
                    
                    return (
                      <div
                        key={song.id}
                        className="group bg-[#111114] p-3.5 rounded-2xl border border-white/5 hover:border-purple-500/30 hover:bg-[#18181c] transition-all shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-900 border border-white/5">
                            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                              <FavoriteButton songId={song.id} size={14} />
                              <ShareSongButton song={song} size={13} variant="card" />
                            </div>

                            {displayImage ? (
                              <img
                                src={displayImage}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                alt={song.title}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music size={32} className="text-white/20" />
                              </div>
                            )}

                            {/* Play Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={() => playSong(song, filteredSbgSongs)}
                                className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                              >
                                {isCurrentLoading && !isPlaying ? (
                                  <Loader2 size={20} className="animate-spin text-black" />
                                ) : isCurrentPlaying && isPlaying ? (
                                  <Pause size={20} fill="currentColor" />
                                ) : (
                                  <Play size={20} fill="currentColor" className="ml-0.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <h3 className="font-bold text-sm truncate text-white mb-0.5">{song.title}</h3>
                          <p className="text-white/40 text-xs truncate">{song.artist}</p>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5 mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`play-sbg-${song.id}`}
                              onClick={() => playSong(song, filteredSbgSongs)}
                              className="flex-1 py-2 bg-white/10 hover:bg-white text-white hover:text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Play size={12} fill="currentColor" />
                              <span>Play</span>
                            </button>
                            <AddToLibraryButton song={song} compact className="w-9 h-9 shrink-0" />
                          </div>
                          <button
                            id={`add-to-playlist-sbg-${song.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistModalItem(song);
                            }}
                            title="Add to Playlist"
                            className="w-full py-2 px-2 bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            <ListPlus size={14} />
                            <span>Add to Playlist</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 bg-[#111114] rounded-3xl border border-white/5">
                  <p className="text-sm">No matches found in SBG Catalog.</p>
                </div>
              )}
            </section>
          )}

          {/* SECTION B: YOUTUBE MUSIC RESULTS */}
          {(activeSource === 'all' || activeSource === 'youtube') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Youtube size={22} className="text-red-500" />
                  <span>YouTube Results</span>
                  {ytResults.length > 0 && !ytLoading && (
                    <span className="text-xs text-white/50 font-mono font-normal bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                      {ytResults.length} tracks
                    </span>
                  )}
                </h2>
              </div>

              {/* COMPLIANT INLINE YOUTUBE SECTION PLAYER */}
              {inlineYtTrack && (
                <div className="p-4 sm:p-5 bg-[#121216] border border-red-500/30 rounded-3xl shadow-2xl mb-4 relative overflow-hidden animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                        <Youtube size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-white truncate" title={inlineYtTrack.title}>
                          {inlineYtTrack.title}
                        </h3>
                        <p className="text-[11px] text-white/50 truncate">
                          Official YouTube Playback • {inlineYtTrack.channelTitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://www.youtube.com/watch?v=${inlineYtTrack.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => setInlineYtTrack(null)}
                        title="Close player"
                        aria-label="Close player"
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${inlineYtTrack.videoId}?autoplay=1&enablejsapi=1`}
                      title={inlineYtTrack.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-2 text-center">
                    Official embedded YouTube stream with required attribution and advertisements. Never displayed as a floating overlay.
                  </p>
                </div>
              )}

              {/* SKELETON LOADING STATE FOR YOUTUBE */}
              {ytLoading && ytResults.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-white/60 px-1">
                    <Loader2 size={16} className="animate-spin text-red-500" />
                    <span>Searching YouTube for &quot;{debouncedTerm}&quot;...</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="bg-[#111114] p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
                        <div>
                          <div className="relative aspect-video rounded-xl bg-white/5 mb-3"></div>
                          <div className="h-4 bg-white/10 rounded-md w-3/4 mb-2"></div>
                          <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
                        </div>
                        <div className="pt-2 border-t border-white/5 mt-3 space-y-1.5">
                          <div className="h-8 bg-white/5 rounded-xl"></div>
                          <div className="h-7 bg-white/5 rounded-xl"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : ytError ? (
                <div className="space-y-4">
                  <div className="p-6 bg-[#18181c] border border-amber-500/20 rounded-3xl text-white/80 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-amber-400">
                        <AlertCircle size={20} />
                        <span>YouTube Results Notice</span>
                      </div>
                      <button
                        onClick={handleRetryYtSearch}
                        disabled={ytLoading}
                        className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        <RotateCcw size={13} className={ytLoading ? 'animate-spin' : ''} />
                        <span>Retry YouTube Search</span>
                      </button>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {typeof ytError === 'string' && ytError.trim() && ytError !== '[object Object]' 
                        ? ytError 
                        : 'YouTube search is temporarily unavailable. Please try again.'}
                    </p>
                    <p className="text-[11px] text-white/40">
                      You can continue exploring SBG Catalog results above without interruption.
                    </p>
                  </div>
                </div>
              ) : ytResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {ytResults.map((yt, index) => {
                    const songObj = convertYtToSong(yt);
                    const isSaved = savedYtSongIds.has(yt.videoId);
                    const isSaving = savingSongId === yt.videoId;
                    const isLastResult = index === ytResults.length - 1;

                    return (
                      <div
                        key={yt.videoId + index}
                        ref={isLastResult ? lastResultElementRef : null}
                        className="group bg-[#111114] p-3.5 rounded-2xl border border-white/5 hover:border-red-500/30 hover:bg-[#18181c] transition-all shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          {/* Thumbnail */}
                          <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-zinc-900 border border-white/10">
                            <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1">
                              <FavoriteButton songId={songObj.id} song={songObj} size={13} />
                              <ShareSongButton song={songObj} size={12} variant="card" />
                            </div>

                            <img
                              src={yt.thumbnailUrl}
                              alt={yt.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />

                            {/* Duration Badge */}
                            {yt.duration ? (
                              <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/10 backdrop-blur-md">
                                {formatDuration(yt.duration)}
                              </div>
                            ) : null}

                            {/* YouTube Badge */}
                            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow">
                              YouTube
                            </div>

                            {/* Play Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={() => setInlineYtTrack({ videoId: yt.videoId, title: yt.title, channelTitle: yt.channelTitle || yt.artist })}
                                title="Play in YouTube Section"
                                className="w-11 h-11 bg-white hover:bg-white/90 rounded-full flex items-center justify-center text-black shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                              >
                                <Play size={18} fill="currentColor" className="ml-0.5" />
                              </button>
                              <a
                                href={yt.youtubeUrl || `https://www.youtube.com/watch?v=${yt.videoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open on YouTube"
                                className="w-11 h-11 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                              >
                                <Youtube size={18} fill="currentColor" />
                              </a>
                            </div>
                          </div>

                          {/* Real YouTube Title & Artist */}
                          <h3 className="font-bold text-sm text-white line-clamp-2 mb-1 group-hover:text-red-400 transition-colors" title={yt.title}>
                            {yt.title}
                          </h3>
                          <p className="text-white/40 text-xs truncate mb-2">
                            {yt.artist || yt.channelTitle}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-white/5 mt-auto flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`preview-yt-${yt.videoId}`}
                              onClick={() => setInlineYtTrack({ videoId: yt.videoId, title: yt.title, channelTitle: yt.channelTitle || yt.artist })}
                              className="flex-1 py-2 bg-white/10 hover:bg-white text-white hover:text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Play size={12} fill="currentColor" />
                              <span>Play</span>
                            </button>
                            <a
                              href={yt.youtubeUrl || `https://www.youtube.com/watch?v=${yt.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Watch on YouTube"
                              className="px-2.5 py-2 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
                            >
                              <Youtube size={13} />
                              <ExternalLink size={10} />
                            </a>
                            <AddToLibraryButton song={songObj} compact className="w-9 h-9 shrink-0" />
                          </div>

                          <button
                            id={`add-to-playlist-yt-${yt.videoId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistModalItem(songObj);
                            }}
                            title="Add to Playlist"
                            className="w-full py-2 px-2 bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            <ListPlus size={14} />
                            <span>Add to Playlist</span>
                          </button>
                          
                          {/* Staff / Admin Import to Catalog */}
                          {isStaffOrAdmin && (
                            <div className="flex items-center gap-1.5 w-full pt-0.5">
                              <button
                                onClick={() => handleAddToSbgCatalog(yt)}
                                disabled={isSaved || isSaving}
                                title="Add to SBG Catalog (Admin Only)"
                                className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                  isSaved
                                    ? 'bg-green-500/15 text-green-400 border border-green-500/30 cursor-default'
                                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                                }`}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 size={11} className="animate-spin text-white" />
                                    <span>Saving...</span>
                                  </>
                                ) : isSaved ? (
                                  <>
                                    <Check size={11} />
                                    <span>In Catalog</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={11} />
                                    <span>Add to Catalog</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !debouncedTerm.trim() ? (
                <div className="text-center py-10 px-4 text-white/50 bg-[#111114] rounded-2xl sm:rounded-3xl border border-white/5 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/25 flex items-center justify-center mx-auto text-red-500">
                    <Youtube size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Search YouTube Music</h3>
                    <p className="text-xs text-white/60 max-w-sm mx-auto">
                      Search and stream any music video, gaming beat, or remix directly on SBG MUSIC.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-1">
                    {['Trending Songs', 'Gaming Battle', 'Lo-Fi Chill', 'Synthwave', 'Trap 808', 'Phonk'].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          setSearchTerm(chip);
                          setDebouncedTerm(chip);
                          executeYtSearch(chip);
                        }}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-red-600/20 hover:text-white border border-white/10 hover:border-red-500/40 text-xs font-semibold text-white/80 transition-all cursor-pointer active:scale-95"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 bg-[#111114] rounded-3xl border border-white/5">
                  <p className="text-sm text-white/70">No YouTube results found for "{debouncedTerm}".</p>
                </div>
              )}

              {/* Infinite Scroll Loader */}
              {ytLoadingMore && (
                <div className="py-6 flex justify-center items-center gap-2 text-white/40">
                  <Loader2 size={20} className="animate-spin text-red-500" />
                  <span className="text-xs font-medium">Loading more YouTube tracks...</span>
                </div>
              )}
            </section>
          )}
        </div>

      {/* Add To Playlist Modal */}
      {playlistModalItem && (
        <AddToPlaylistModal
          isOpen={Boolean(playlistModalItem)}
          onClose={() => setPlaylistModalItem(null)}
          songItem={playlistModalItem}
          onSuccess={(playlistTitle) => {
            showToast(`Added "${playlistModalItem.title}" to ${playlistTitle}!`);
          }}
        />
      )}
    </div>
  );
}

