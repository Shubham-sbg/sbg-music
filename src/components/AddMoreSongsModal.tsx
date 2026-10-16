import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Song, UserPlaylistItem, UserPlaylist } from '../types';
import { useFavorites } from '../context/FavoritesContext';
import { X, Search, Plus, Check, Loader2, Youtube, Music, Heart } from 'lucide-react';

interface AddMoreSongsModalProps {
  isOpen?: boolean;
  playlistId?: string;
  existingItems?: UserPlaylistItem[];
  playlist?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddMoreSongsModal({
  isOpen,
  playlistId,
  existingItems = [],
  playlist,
  onClose,
  onSuccess,
}: AddMoreSongsModalProps) {
  const targetPlaylistId = playlistId || playlist?.id;
  const initialItems: UserPlaylistItem[] = existingItems.length > 0 ? existingItems : (playlist?.songs || playlist?.items || []);

  const { favorites, favoriteMeta } = useFavorites();
  const [tab, setTab] = useState<'favorites' | 'youtube' | 'sbg'>(favorites.size > 0 ? 'favorites' : 'youtube');
  const [searchQuery, setSearchQuery] = useState('');
  const [sbgSongs, setSbgSongs] = useState<Song[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [currentItems, setCurrentItems] = useState<UserPlaylistItem[]>(initialItems);

  useEffect(() => {
    setCurrentItems(initialItems);
  }, [playlistId, playlist]);

  if (isOpen === false || !targetPlaylistId) return null;

  // Load initial SBG songs
  useEffect(() => {
    const loadSbgSongs = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'songs'));
        const list: Song[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Song));
        setSbgSongs(list.filter((s) => s.published !== false));
      } catch (err) {
        console.error('Error loading SBG songs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSbgSongs();
  }, []);

  // Search YouTube or Direct Link
  const handleYouTubeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setLoading(true);
    try {
      const isYtUrl = query.includes('youtube.com') || query.includes('youtu.be');
      if (isYtUrl) {
        const res = await fetch('/api/youtube/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();
        if (data.ok && data.video) {
          setYoutubeResults([data.video]);
          return;
        }
      }

      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setYoutubeResults(data.items);
      } else {
        setYoutubeResults([]);
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setYoutubeResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrack = async (item: UserPlaylistItem) => {
    if (!targetPlaylistId) return;
    setAddingId(item.id);
    try {
      const plRef = doc(db, 'userPlaylists', targetPlaylistId);
      const snap = await getDoc(plRef);
      if (!snap.exists()) return;

      const data = snap.data() as UserPlaylist;
      const updated = [...(data.items || []), item];
      const newCover = data.coverUrl || item.coverUrl || item.thumbnailUrl || '';

      await updateDoc(plRef, {
        items: updated,
        songCount: updated.length,
        coverUrl: newCover,
        updatedAt: serverTimestamp(),
      });

      setCurrentItems(updated);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to add track:', err);
    } finally {
      setAddingId(null);
    }
  };

  const isAlreadyAdded = (songId?: string, youtubeVideoId?: string) => {
    return currentItems.some(
      (it) =>
        (songId && it.songId === songId) ||
        (youtubeVideoId && it.youtubeVideoId === youtubeVideoId)
    );
  };

  // Convert Favorites into items
  const favoriteItems: UserPlaylistItem[] = Array.from(favorites).map((favId) => {
    const meta = favoriteMeta.get(favId);
    const sbgMatch = sbgSongs.find((s) => s.id === favId);

    const title = meta?.title || sbgMatch?.title || 'Unknown Track';
    const artist = meta?.artist || sbgMatch?.artist || 'Unknown Artist';
    const coverUrl = meta?.coverUrl || meta?.thumbnailUrl || sbgMatch?.coverUrl || sbgMatch?.thumbnailUrl || '';
    const isYt = favId.startsWith('yt_') || Boolean(meta?.youtubeVideoId);
    const ytId = meta?.youtubeVideoId || (favId.startsWith('yt_') ? favId.replace('yt_', '') : undefined);

    return {
      id: isYt && ytId ? `yt_${ytId}` : favId,
      songId: !isYt ? favId : undefined,
      youtubeVideoId: ytId,
      title,
      artist,
      coverUrl,
      thumbnailUrl: coverUrl,
      audioUrl: meta?.audioUrl || sbgMatch?.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : ''),
      duration: meta?.duration || sbgMatch?.duration || 0,
      source: isYt ? 'youtube' : 'sbg',
      addedAt: new Date().toISOString(),
    };
  });

  const filteredFavorites = favoriteItems.filter(
    (item) =>
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSbg = sbgSongs.filter(
    (s) =>
      !searchQuery.trim() ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">Add Songs to Playlist</h3>
            <p className="text-xs text-white/40">Select from favorites, discover on YouTube, or catalog</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-Tab Switcher */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0 gap-1">
          <button
            onClick={() => setTab('favorites')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'favorites' ? 'bg-pink-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
            }`}
          >
            <Heart size={14} fill={tab === 'favorites' ? 'currentColor' : 'none'} />
            <span>Your Favorites ({favorites.size})</span>
          </button>

          <button
            onClick={() => setTab('youtube')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'youtube' ? 'bg-red-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
            }`}
          >
            <Youtube size={14} />
            <span>YouTube Music</span>
          </button>

          <button
            onClick={() => setTab('sbg')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'sbg' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
            }`}
          >
            <Music size={14} />
            <span>Catalog</span>
          </button>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tab === 'youtube') handleYouTubeSearch();
          }}
          className="relative shrink-0"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder={
              tab === 'favorites'
                ? 'Filter your favorites...'
                : tab === 'youtube'
                ? 'Search song title or paste YouTube video link...'
                : 'Search catalog songs by title or artist...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-2xl pl-10 pr-24 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          {tab === 'youtube' && (
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
            >
              Search
            </button>
          )}
        </form>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {loading ? (
            <div className="py-12 text-center text-white/40 text-xs flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span>Loading tracks...</span>
            </div>
          ) : tab === 'favorites' ? (
            filteredFavorites.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-xs">
                {favorites.size === 0
                  ? 'You have not favorited any songs yet. Heart songs across the app to add them here!'
                  : 'No favorite songs match your search.'}
              </div>
            ) : (
              filteredFavorites.map((item) => {
                const added = isAlreadyAdded(item.songId, item.youtubeVideoId);
                const isAdding = addingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.coverUrl || item.thumbnailUrl || ''}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover bg-zinc-900 border border-white/10 shrink-0"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-white truncate">{item.title}</p>
                          {item.youtubeVideoId && (
                            <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 text-[9px] font-bold rounded shrink-0">YT</span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 truncate">{item.artist}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => !added && handleAddTrack(item)}
                      disabled={added || isAdding}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                        added
                          ? 'bg-white/5 text-white/40 cursor-default'
                          : 'bg-pink-600 hover:bg-pink-500 text-white shadow-md'
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : added ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )
          ) : tab === 'sbg' ? (
            filteredSbg.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-xs">No SBG songs found matching search.</div>
            ) : (
              filteredSbg.map((s) => {
                const added = isAlreadyAdded(s.id, undefined);
                const isAdding = addingId === s.id;

                const item: UserPlaylistItem = {
                  id: s.id,
                  songId: s.id,
                  title: s.title,
                  artist: s.artist,
                  coverUrl: s.coverUrl || s.thumbnailUrl || s.imageUrl || '',
                  thumbnailUrl: s.thumbnailUrl || s.coverUrl || '',
                  audioUrl: s.audioUrl || s.youtubeUrl || '',
                  duration: s.duration || 0,
                  source: 'sbg',
                  addedAt: new Date().toISOString(),
                };

                return (
                  <div
                    key={s.id}
                    className="p-2.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={s.coverUrl || s.thumbnailUrl || s.imageUrl || ''}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover bg-zinc-900 border border-white/10 shrink-0"
                      />
                      <div className="truncate">
                        <p className="font-bold text-xs text-white truncate">{s.title}</p>
                        <p className="text-[11px] text-white/40 truncate">{s.artist}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => !added && handleAddTrack(item)}
                      disabled={added || isAdding}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                        added
                          ? 'bg-white/5 text-white/40 cursor-default'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : added ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )
          ) : youtubeResults.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-xs">
              {searchQuery.trim() ? 'No YouTube results found.' : 'Enter a search term or paste a YouTube link to find songs.'}
            </div>
          ) : (
            youtubeResults.map((yt) => {
              const videoId = yt.videoId || yt.id;
              const added = isAlreadyAdded(undefined, videoId);
              const isAdding = addingId === `yt_${videoId}`;

              const item: UserPlaylistItem = {
                id: `yt_${videoId}`,
                youtubeVideoId: videoId,
                title: yt.title || 'YouTube Track',
                artist: yt.channelTitle || yt.artist || 'YouTube',
                thumbnailUrl: yt.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                coverUrl: yt.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
                duration: yt.duration || 0,
                source: 'youtube',
                addedAt: new Date().toISOString(),
              };

              return (
                <div
                  key={videoId}
                  className="p-2.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={yt.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt=""
                      className="w-12 h-8 rounded-lg object-cover bg-zinc-900 border border-white/10 shrink-0"
                    />
                    <div className="truncate">
                      <p className="font-bold text-xs text-white truncate">{yt.title}</p>
                      <p className="text-[11px] text-white/40 truncate">{yt.channelTitle || yt.artist}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => !added && handleAddTrack(item)}
                    disabled={added || isAdding}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                      added
                        ? 'bg-white/5 text-white/40 cursor-default'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-md'
                    }`}
                  >
                    {isAdding ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : added ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
