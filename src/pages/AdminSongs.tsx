import React, { useState, useEffect } from 'react';
import { db, storage, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../context/AuthProvider';
import { 
  Music, 
  Youtube, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Check, 
  Tag, 
  Sparkles, 
  Globe, 
  BarChart2,
  Loader2,
  ShieldAlert,
  AlertCircle,
  Plus,
  HardDrive
} from 'lucide-react';
import { fetchSongAnalytics, formatListenTime } from '../lib/analytics';
import { 
  extractYoutubeVideoId, 
  normalizeYoutubeUrl, 
  getYoutubeThumbnailUrl 
} from '../lib/youtube';
import { Song } from '../types';
import { getReadableError, handleFirestoreError, OperationType } from '../utils/errorUtils';
import { getSongSourceType, isSongDownloadable } from '../utils/catalogUtils';
import EditFeaturedModal from '../components/EditFeaturedModal';
import ImageUploadInput from '../components/ImageUploadInput';
import { useAdminSongs, invalidateSongCache } from '../hooks/useCatalog';

export default function AdminSongs({ onSwitchToImport }: { onSwitchToImport?: () => void }) {
  const { user, hasPermission } = useAuth();
  const { songs, setSongs, loading: adminSongsLoading, errorMsg: adminSongsErrorMsg, refetch: refetchSongs } = useAdminSongs();

  // Form & UI States
  const [uploadMode, setUploadMode] = useState<'youtube' | 'search_yt' | 'mp3'>('search_yt');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number>(180);
  const [explicitContent, setExplicitContent] = useState<boolean>(false);
  const [published, setPublished] = useState(true);
  const [showYoutubeSourceBadge, setShowYoutubeSourceBadge] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Song Deletion States
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // YouTube Single Track state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const detectedVideoId = extractYoutubeVideoId(youtubeUrl);

  // YouTube Search Mode States
  const [ytAdminQuery, setYtAdminQuery] = useState('');
  const [ytAdminResults, setYtAdminResults] = useState<any[]>([]);
  const [ytAdminLoading, setYtAdminLoading] = useState(false);
  const [ytAdminError, setYtAdminError] = useState<string | null>(null);
  const [ytAdminQuotaExhausted, setYtAdminQuotaExhausted] = useState(false);
  const [fetchingYtInfo, setFetchingYtInfo] = useState(false);
  const [addingYtId, setAddingYtId] = useState<string | null>(null);
  const [addedYtIds, setAddedYtIds] = useState<Set<string>>(new Set());

  // Track existing youtubeVideoIds from songs catalog
  useEffect(() => {
    if (songs && songs.length > 0) {
      const existing = new Set<string>();
      songs.forEach((s) => {
        if (s.youtubeVideoId) existing.add(s.youtubeVideoId);
      });
      setAddedYtIds((prev) => {
        const next = new Set(prev);
        existing.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [songs]);

  // Notice when admin enters a playlist link in single track mode
  useEffect(() => {
    if (uploadMode === 'youtube' && (youtubeUrl.includes('list=') || youtubeUrl.includes('/playlist'))) {
      setStatus('Notice: You entered a YouTube playlist link. To import entire playlists, use the "Import Playlist" tool above.');
    }
  }, [youtubeUrl, uploadMode]);

  // Auto-fetch song info when a valid YouTube ID is detected in single track mode
  const handleAutoFetchYtInfo = async (vidId?: string) => {
    const idToFetch = vidId || detectedVideoId;
    if (!idToFetch) return;
    setFetchingYtInfo(true);
    setStatus('Fetching song details from YouTube...');
    try {
      const res = await fetch('/api/youtube/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: idToFetch }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch video info');
      }
      if (data.title) setTitle(data.title);
      if (data.artist) setArtist(data.artist);
      if (data.duration) setDurationSeconds(Number(data.duration) || 180);
      if (data.thumbnailUrl && !customCoverUrl) setCustomCoverUrl(data.thumbnailUrl);
      if (!releaseDate) setReleaseDate(new Date().toISOString().split('T')[0]);
      setStatus(`Loaded details for "${data.title || 'YouTube Track'}"!`);
    } catch (err: any) {
      console.warn('Could not auto-fetch YouTube video info:', err);
      setStatus('Could not auto-fetch metadata. You can enter title and artist manually.');
    } finally {
      setFetchingYtInfo(false);
    }
  };

  // Edit Featured Modal State
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Song Analytics Modal State
  const [selectedSongAnalytics, setSelectedSongAnalytics] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const handleOpenSongAnalytics = async (songId: string) => {
    setLoadingAnalytics(true);
    const data = await fetchSongAnalytics(songId);
    setSelectedSongAnalytics(data || {
      songId,
      title: 'Song',
      totalPlays: 0,
      totalListenSeconds: 0,
      completedCount: 0,
      uniqueVisitorsCount: 0,
      lastPlayedAt: null
    });
    setLoadingAnalytics(false);
  };

  // MP3 state
  const [file, setFile] = useState<File | null>(null);
  const [artwork, setArtwork] = useState<File | null>(null);
  const [downloadEnabled, setDownloadEnabled] = useState(false);

  const canAdd = hasPermission('addSongs');
  const canEdit = hasPermission('editSongs');
  const canDelete = hasPermission('deleteSongs');
  const canPublish = hasPermission('publishSongs');

  const handleAddYoutube = async () => {
    if (youtubeUrl.includes('list=') || youtubeUrl.includes('/playlist')) {
      setStatus('Save failed: That is a YouTube Playlist URL. To import entire playlists, use the "Import Playlist" button.');
      setLoading(false);
      return;
    }

    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      setStatus('Save failed: Please provide a valid YouTube video URL or ID.');
      setLoading(false);
      return;
    }

    setStatus('Saving YouTube track to catalog...');
    try {
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch (tokenErr) {
          console.warn('Could not refresh ID token:', tokenErr);
        }
      }

      const normalizedUrl = normalizeYoutubeUrl(youtubeUrl) || `https://www.youtube.com/watch?v=${videoId}`;
      const ytThumbnail = getYoutubeThumbnailUrl(videoId, 'hq') || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const finalCoverUrl = customCoverUrl.trim() || ytThumbnail;
      const staffName = user?.displayName || 'Admin';
      const staffId = user?.id || user?.uid || 'staff';
      const cleanTitle = (title || 'Untitled Track').trim();
      const cleanArtist = (artist || 'SBG Artist').trim();
      const cleanDesc = (description || '').trim();
      const cleanGenre = (genre || 'Hip-Hop').trim();
      const cleanReleaseDate = releaseDate || new Date().toISOString().split('T')[0];
      const cleanDuration = Number(durationSeconds) || 0;

      await addDoc(collection(db, 'songs'), {
        title: cleanTitle,
        artist: cleanArtist,
        description: cleanDesc,
        genre: cleanGenre,
        releaseDate: cleanReleaseDate,
        youtubeUrl: normalizedUrl,
        youtubeVideoId: videoId,
        coverUrl: finalCoverUrl,
        customCoverUrl: finalCoverUrl,
        imageUrl: finalCoverUrl,
        thumbnailUrl: finalCoverUrl,
        heroImageUrl: (heroImageUrl.trim() || finalCoverUrl),
        externalUrl: normalizedUrl,
        externalLinkUrl: normalizedUrl,
        audioUrl: normalizedUrl,
        duration: cleanDuration,
        durationSeconds: cleanDuration,
        explicitContent: Boolean(explicitContent),
        downloadEnabled: false,
        published: Boolean(published),
        showYoutubeSourceBadge: Boolean(showYoutubeSourceBadge),
        source: 'youtube',
        createdBy: staffName,
        createdById: staffId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setStatus('YouTube track saved successfully!');
      resetForm();
      invalidateSongCache();
      refetchSongs();
    } catch (e: any) {
      console.error('Save YouTube song error:', e);
      setStatus('Add failed: ' + (e.message || String(e)));
    }
  };

  const handleUploadMp3 = async () => {
    if (!file) {
      setStatus('Upload failed: Please select an MP3 audio file.');
      setLoading(false);
      return;
    }

    setStatus('Uploading audio file to storage...');
    try {
      const songId = Date.now().toString();
      const audioRef = ref(storage, `songs/${songId}/${file.name}`);
      const audioUploadTask = uploadBytesResumable(audioRef, file);

      await new Promise<void>((resolve, reject) => {
        audioUploadTask.on('state_changed', null, reject, () => resolve());
      });

      const audioUrl = await getDownloadURL(audioRef);

      let finalCoverUrl = customCoverUrl.trim();
      if (artwork) {
        setStatus('Uploading cover artwork...');
        const artworkRef = ref(storage, `songs/${songId}/cover_${artwork.name}`);
        const artworkUploadTask = uploadBytesResumable(artworkRef, artwork);

        await new Promise<void>((resolve, reject) => {
          artworkUploadTask.on('state_changed', null, reject, () => resolve());
        });
        finalCoverUrl = await getDownloadURL(artworkRef);
      }

      setStatus('Saving song to database...');
      const staffName = user?.displayName || 'Shadow';

      await addDoc(collection(db, 'songs'), {
        title: title.trim() || 'Untitled Track',
        artist: artist.trim() || 'SBG Artist',
        description: description.trim(),
        genre: genre.trim() || 'Music',
        releaseDate: releaseDate || new Date().toISOString().split('T')[0],
        audioUrl,
        coverUrl: finalCoverUrl,
        customCoverUrl: finalCoverUrl,
        imageUrl: finalCoverUrl,
        thumbnailUrl: finalCoverUrl,
        heroImageUrl: heroImageUrl.trim() || finalCoverUrl,
        duration: durationSeconds || 0,
        durationSeconds: durationSeconds || 0,
        explicitContent: explicitContent || false,
        downloadEnabled,
        published,
        showYoutubeSourceBadge: false,
        source: 'upload',
        createdBy: staffName,
        createdById: user?.id || 'staff',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setStatus('MP3 track uploaded successfully!');
      resetForm();
      invalidateSongCache();
      refetchSongs();
    } catch (e: any) {
      console.error(e);
      setStatus('Upload failed: ' + (e.message || String(e)));
    }
  };

  const handleAdminSearchYoutube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ytAdminQuery.trim()) return;

    setYtAdminLoading(true);
    setYtAdminError(null);
    setYtAdminQuotaExhausted(false);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(ytAdminQuery.trim())}&filter=songs`);
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.isQuotaExhausted || data.code === 'QUOTA_EXHAUSTED' || (data.error && data.error.toLowerCase().includes('quota'))) {
          setYtAdminQuotaExhausted(true);
        }
        throw new Error(getReadableError(data.error || data.message || 'YouTube search failed.'));
      }
      // ONLY SHOW SONGS: Filter out any playlist items or items without valid video ID
      const songsOnly = (data.items || []).filter((item: any) => !item.isPlaylist && item.videoId && !item.videoId.startsWith('PL'));
      setYtAdminResults(songsOnly);
      if (songsOnly.length === 0) {
        setYtAdminError('No individual songs found. Try a more specific song title or artist name.');
      }
    } catch (err: any) {
      console.error('Admin YouTube search error:', err);
      setYtAdminError(getReadableError(err, 'YouTube search error.'));
    } finally {
      setYtAdminLoading(false);
    }
  };

  const handleAdminAddYtSong = async (item: any) => {
    if (!item?.videoId || addedYtIds.has(item.videoId)) return;

    setAddingYtId(item.videoId);
    try {
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch (tokenErr) {
          console.warn('Could not refresh ID token:', tokenErr);
        }
      }

      // 1. Verify deduplication in Firestore query
      const dupQuery = query(collection(db, 'songs'), where('youtubeVideoId', '==', item.videoId));
      const dupSnap = await getDocs(dupQuery);

      const songTitle = (item.title || item.rawTitle || 'Untitled Track').trim();
      const songArtist = (item.artist || item.channelTitle || 'YouTube Artist').trim();
      const songDesc = (item.description || '').trim();
      const cleanUrl = item.youtubeUrl || `https://www.youtube.com/watch?v=${item.videoId}`;
      const fallbackThumb = item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
      const durationNum = typeof item.duration === 'number' && !isNaN(item.duration) ? item.duration : 0;
      const releaseDateVal = item.releaseDate || new Date().toISOString().split('T')[0];
      const staffName = user?.displayName || 'Admin';
      const staffId = user?.id || user?.uid || 'admin';

      let docId = '';
      if (dupSnap.empty) {
        const docRef = await addDoc(collection(db, 'songs'), {
          title: songTitle,
          artist: songArtist,
          description: songDesc,
          genre: 'YouTube Music',
          releaseDate: releaseDateVal,
          youtubeUrl: cleanUrl,
          youtubeVideoId: item.videoId,
          coverUrl: fallbackThumb,
          customCoverUrl: fallbackThumb,
          imageUrl: fallbackThumb,
          thumbnailUrl: fallbackThumb,
          heroImageUrl: fallbackThumb,
          externalUrl: cleanUrl,
          externalLinkUrl: cleanUrl,
          audioUrl: cleanUrl,
          duration: durationNum,
          durationSeconds: durationNum,
          explicitContent: false,
          downloadEnabled: false,
          published: true,
          showYoutubeSourceBadge: false,
          source: 'youtube',
          createdBy: staffName,
          createdById: staffId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        docId = docRef.id;
      } else {
        docId = dupSnap.docs[0].id;
      }

      // 2. Immediate optimistic state update
      setAddedYtIds((prev) => new Set(prev).add(item.videoId));
      
      const newSongItem: Song = {
        id: docId,
        title: songTitle,
        artist: songArtist,
        description: songDesc,
        genre: 'YouTube Music',
        releaseDate: releaseDateVal,
        youtubeUrl: cleanUrl,
        youtubeVideoId: item.videoId,
        coverUrl: fallbackThumb,
        customCoverUrl: fallbackThumb,
        thumbnailUrl: fallbackThumb,
        audioUrl: cleanUrl,
        duration: durationNum,
        durationSeconds: durationNum,
        explicitContent: false,
        source: 'youtube',
        published: true,
        createdAt: new Date().toISOString(),
      };

      setSongs((prev) => {
        if (prev.some((s) => s.youtubeVideoId === item.videoId || s.id === docId)) {
          return prev;
        }
        return [newSongItem, ...prev];
      });

      setStatus(`Added "${songTitle}" to catalog!`);
      invalidateSongCache();
      refetchSongs();
    } catch (err: any) {
      console.error('Failed to add YouTube track to catalog:', err);
      setStatus('Add failed: ' + (err.message || String(err)));
      alert('Error adding song: ' + (err.message || String(err)));
    } finally {
      setAddingYtId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    if (uploadMode === 'youtube') {
      await handleAddYoutube();
    } else if (uploadMode === 'mp3') {
      await handleUploadMp3();
    }

    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setArtist('');
    setDescription('');
    setGenre('');
    setReleaseDate('');
    setYoutubeUrl('');
    setShowYoutubeSourceBadge(false);
    setCustomCoverUrl('');
    setHeroImageUrl('');
    setFile(null);
    setArtwork(null);
    if (document.getElementById('audio-upload')) {
      (document.getElementById('audio-upload') as HTMLInputElement).value = '';
    }
    if (document.getElementById('artwork-upload')) {
      (document.getElementById('artwork-upload') as HTMLInputElement).value = '';
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    if (!canPublish && user?.role !== 'owner') {
      alert('You do not have permission to change song visibility.');
      return;
    }
    await updateDoc(doc(db, 'songs', id), { published: !currentStatus });
    invalidateSongCache();
    refetchSongs();
  };

  const toggleSourceBadge = async (id: string, currentStatus?: boolean) => {
    if (!canEdit && user?.role !== 'owner') {
      alert('You do not have permission to edit song settings.');
      return;
    }
    await updateDoc(doc(db, 'songs', id), { showYoutubeSourceBadge: !currentStatus });
    invalidateSongCache();
    refetchSongs();
  };

  const toggleDownloadable = async (id: string, currentVal?: boolean) => {
    if (!canEdit && user?.role !== 'owner') {
      alert('You do not have permission to edit song settings.');
      return;
    }
    const newVal = !currentVal;
    try {
      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, downloadable: newVal, downloadEnabled: newVal } : s))
      );
      await updateDoc(doc(db, 'songs', id), {
        downloadable: newVal,
        downloadEnabled: newVal,
        updatedAt: serverTimestamp(),
      });
      invalidateSongCache();
    } catch (e: any) {
      console.error('Failed to toggle downloadable status:', e);
      refetchSongs();
    }
  };

  const executeDeleteSong = async () => {
    if (!songToDelete) return;

    if (!canDelete && user?.role !== 'owner') {
      setDeleteError('Delete failed: Missing or insufficient permissions.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(null);

    const songId = songToDelete.id;

    try {
      // 1. Delete the song document from the Firestore 'songs' collection
      try {
        await deleteDoc(doc(db, 'songs', songId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `songs/${songId}`);
      }

      // 2. Clean up associated Firebase Storage files if applicable
      const storageBucketName = storage.app.options.storageBucket || '';

      // Delete audio file
      if (songToDelete.audioUrl && (
        songToDelete.audioUrl.includes('firebasestorage.googleapis.com') ||
        songToDelete.audioUrl.includes(storageBucketName)
      )) {
        try {
          const audioRef = ref(storage, songToDelete.audioUrl);
          await deleteObject(audioRef);
          console.log('[Storage Cleanup] Audio file deleted successfully.');
        } catch (audioErr) {
          console.warn('[Storage Cleanup] Failed to delete audio file (non-critical):', audioErr);
        }
      }

      // Delete custom cover artwork
      if (songToDelete.customCoverUrl && (
        songToDelete.customCoverUrl.includes('firebasestorage.googleapis.com') ||
        songToDelete.customCoverUrl.includes(storageBucketName)
      )) {
        try {
          const coverRef = ref(storage, songToDelete.customCoverUrl);
          await deleteObject(coverRef);
          console.log('[Storage Cleanup] Cover artwork file deleted successfully.');
        } catch (coverErr) {
          console.warn('[Storage Cleanup] Failed to delete cover artwork (non-critical):', coverErr);
        }
      }

      // 3. Cascading references cleanup (non-blocking)
      try {
        // Remove from official playlists
        const playlistsQuery = query(collection(db, 'playlists'));
        const playlistsSnap = await getDocs(playlistsQuery);
        for (const plDoc of playlistsSnap.docs) {
          const plData = plDoc.data();
          const songIds = plData.songIds || [];
          if (songIds.includes(songId)) {
            const updatedSongIds = songIds.filter((id: string) => id !== songId);
            await updateDoc(doc(db, 'playlists', plDoc.id), {
              songIds: updatedSongIds,
              updatedAt: serverTimestamp()
            });
          }
        }

        // Remove from featuredReleases
        const featuredQuery = query(collection(db, 'featuredReleases'), where('targetSongId', '==', songId));
        const featuredSnap = await getDocs(featuredQuery);
        for (const fDoc of featuredSnap.docs) {
          await deleteDoc(doc(db, 'featuredReleases', fDoc.id));
        }
        
        console.log('[Cascading Cleanup] Cleaned up playlists and featured releases referencing song:', songId);
      } catch (cascadeErr) {
        console.warn('[Cleanup References] Non-critical cascading clean failed:', cascadeErr);
      }

      // Optimistic update of local states in UI immediately
      setSongs((prev) => prev.filter((s) => s.id !== songId));

      // 4. Invalidate frontend cache and refresh list
      invalidateSongCache();
      refetchSongs();

      setDeleteSuccess('Song deleted successfully.');
      setTimeout(() => {
        setSongToDelete(null);
        setDeleteSuccess(null);
      }, 1500);

    } catch (e: any) {
      console.error('Delete song failed:', e);
      let errMsg = e?.message || String(e);
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed && parsed.error) {
          errMsg = parsed.error;
        }
      } catch {}
      setDeleteError('Delete failed: ' + errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.createdBy?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      {/* Add New Song Section */}
      {canAdd && (
        <div className="bg-[#111112] p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Add Individual Track</h1>
              <p className="text-xs text-white/40">Add a track via YouTube URL or upload an audio file.</p>
            </div>
            <div className="flex items-center gap-2">
              {onSwitchToImport && hasPermission('importYouTubePlaylists') && (
                <button
                  type="button"
                  onClick={onSwitchToImport}
                  className="bg-red-500/10 border border-red-500/20 text-red-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-500/20 transition-colors"
                >
                  <Youtube size={14} />
                  <span>Import Playlist</span>
                </button>
              )}
              <div className="flex bg-black/50 rounded-xl p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('youtube');
                    setStatus('');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    uploadMode === 'youtube'
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  YouTube URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('search_yt');
                    setStatus('');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    uploadMode === 'search_yt'
                      ? 'bg-red-600/20 text-red-300 border border-red-500/30'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  Search YouTube
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('mp3');
                    setStatus('');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    uploadMode === 'mp3'
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  MP3 File
                </button>
              </div>
            </div>
          </div>

          {uploadMode === 'search_yt' ? (
            <div className="space-y-6">
              <form onSubmit={handleAdminSearchYoutube} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                  <input
                    type="text"
                    value={ytAdminQuery}
                    onChange={(e) => setYtAdminQuery(e.target.value)}
                    placeholder="Search songs or artists on YouTube..."
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 text-sm outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ytAdminLoading || !ytAdminQuery.trim()}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shrink-0"
                >
                  {ytAdminLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>Search</span>
                </button>
              </form>

              {ytAdminQuotaExhausted && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-300">YouTube API Daily Search Quota Reached</p>
                    <p className="text-amber-200/80">
                      You can switch to the <button type="button" onClick={() => setUploadMode('youtube')} className="underline font-bold text-amber-100 hover:text-white">YouTube URL</button> tab to add any song directly using its link without using search API quota.
                    </p>
                  </div>
                </div>
              )}

              {ytAdminError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                  {ytAdminError}
                </div>
              )}

              {ytAdminLoading ? (
                <div className="p-10 text-center text-white/40 flex items-center justify-center gap-2 bg-black/30 rounded-2xl border border-white/5">
                  <Loader2 size={18} className="animate-spin text-red-500" />
                  <span className="text-xs">Searching YouTube...</span>
                </div>
              ) : ytAdminResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {ytAdminResults.map((item) => {
                    const isAdded = addedYtIds.has(item.videoId);
                    const isAdding = addingYtId === item.videoId;

                    return (
                      <div
                        key={item.videoId}
                        className="bg-black/40 border border-white/10 hover:border-white/20 p-3 rounded-2xl flex items-center gap-3 transition-all justify-between"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-16 h-12 object-cover rounded-lg shrink-0 bg-zinc-900"
                          />
                          <div className="overflow-hidden">
                            <h4 className="text-xs font-bold text-white truncate" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-white/40 truncate">
                              {item.artist || item.channelTitle}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdminAddYtSong(item)}
                          disabled={isAdded || isAdding}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                            isAdded
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                              : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                        >
                          {isAdding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isAdded ? (
                            <>
                              <Check size={12} />
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
                  })}
                </div>
              ) : null}
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {uploadMode === 'youtube' ? (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                    YouTube URL or Video ID *
                  </label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    required={uploadMode === 'youtube'}
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm font-mono"
                  />
                </div>

                {detectedVideoId && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <img
                        src={getYoutubeThumbnailUrl(detectedVideoId, 'mq')}
                        alt="Preview"
                        className="w-20 h-14 object-cover rounded-xl shadow-md shrink-0 bg-black"
                      />
                      <div className="text-xs text-white/60">
                        <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                          <Check size={14} className="text-green-400" />
                          <span>Valid YouTube Video Detected</span>
                        </p>
                        <p className="font-mono text-white/40">ID: {detectedVideoId}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAutoFetchYtInfo(detectedVideoId)}
                      disabled={fetchingYtInfo}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors shrink-0"
                    >
                      {fetchingYtInfo ? <Loader2 size={13} className="animate-spin text-purple-400" /> : <Sparkles size={13} className="text-purple-400" />}
                      <span>{fetchingYtInfo ? 'Fetching...' : 'Auto-fill Track Details'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                    Audio File (MP3/WAV) *
                  </label>
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*"
                    required={uploadMode === 'mp3'}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                    Cover Artwork (Optional)
                  </label>
                  <input
                    id="artwork-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setArtwork(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Track Title *
                </label>
                <input
                  type="text"
                  placeholder="Song Title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Artist / Performer *
                </label>
                <input
                  type="text"
                  placeholder="Artist Name"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Genre
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rap, Hip-Hop, Lo-Fi"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Release Date *
                </label>
                <input
                  type="date"
                  required
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Duration (Seconds) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="180"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="block w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-white/30 outline-none text-sm"
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explicitContent}
                    onChange={(e) => setExplicitContent(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/50 text-purple-600"
                  />
                  <span className="font-bold text-white/80">Explicit Content (E Badge)</span>
                </label>
              </div>
            </div>

            {/* Visibility & Toggles */}
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-black/50"
                />
                <span>Published (Visible to public)</span>
              </label>

              {uploadMode === 'youtube' && (
                <label className="flex items-center gap-2 text-xs cursor-pointer text-white/70 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showYoutubeSourceBadge}
                    onChange={(e) => setShowYoutubeSourceBadge(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/50"
                  />
                  <span>Show YouTube Source Badge in Public UI (Default: Off)</span>
                </label>
              )}

              {uploadMode === 'mp3' && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadEnabled}
                    onChange={(e) => setDownloadEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/50"
                  />
                  <span>Enable Public MP3 Download</span>
                </label>
              )}
            </div>

            {/* Custom Song Cover Artwork Field */}
            <div className="pt-2">
              <ImageUploadInput
                label="Custom Song Cover Artwork (Optional)"
                value={customCoverUrl}
                onChange={setCustomCoverUrl}
                storageFolder="songs/cover"
                placeholder="https://... or upload custom 1:1 square artwork"
                recommendedSize="Recommended: Square 1:1 artwork (500x500 or 1000x1000px) for player, song cards & playlists"
              />
            </div>

            {/* Custom Hero / Banner Image Field */}
            <div className="pt-2">
              <ImageUploadInput
                label="Hero / Banner Artwork (Optional)"
                value={heroImageUrl}
                onChange={setHeroImageUrl}
                storageFolder="songs/hero"
                placeholder="https://images.unsplash.com/... or upload hero banner"
                recommendedSize="Recommended: 16:9 banner (1200x630 or 1920x1080) for home hero display (saved as heroImageUrl)"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 p-3.5 bg-white text-black rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (status || 'Saving Track...') : 'Save Track'}
            </button>

            {status && (
              <div
                className={`p-3.5 rounded-xl text-xs ${
                  status.includes('failed')
                    ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                    : 'bg-green-500/20 text-green-200 border border-green-500/30'
                }`}
              >
                {status}
              </div>
            )}
          </form>
          )}
        </div>
      )}

      {/* Song Library Management */}
      <div className="bg-[#111112] p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Song Catalog</h2>
            <p className="text-xs text-white/40">
              {songs.length} total tracks in the SBG database.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {adminSongsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-black/20 rounded-2xl border border-white/5 space-y-3">
              <Loader2 className="animate-spin text-purple-500" size={28} />
              <p className="text-xs text-white/40 font-medium">Retrieving song library...</p>
            </div>
          ) : adminSongsErrorMsg ? (
            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-xs flex items-center gap-3">
              <ShieldAlert size={20} className="shrink-0 text-red-400" />
              <div>
                <h4 className="font-bold text-sm text-white mb-0.5">Database Error</h4>
                <p className="text-white/60">{adminSongsErrorMsg}</p>
              </div>
            </div>
          ) : (
            <>
              {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/30 rounded-2xl border transition-colors gap-3 ${
                    song.isFeatured ? 'border-purple-500/30 bg-purple-950/10' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/10 relative shadow-md">
                      {song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl ? (
                        <img
                          src={song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl}
                          className="w-full h-full object-cover"
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music size={20} className="text-white/30" />
                        </div>
                      )}
                      {song.heroImageUrl && (
                        <span className="absolute bottom-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1 rounded shadow">
                          HERO
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">{song.title}</span>
                        {song.explicitContent && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-[9px] font-black uppercase tracking-wider" title="Explicit Content">
                            E
                          </span>
                        )}
                        {song.isFeatured && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <Sparkles size={10} />
                            <span>Home Hero</span>
                          </span>
                        )}
                        {song.externalLinkEnabled && (song.externalLinkUrl || (song.externalLinks && song.externalLinks.length > 0)) && (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-[9px] font-bold flex items-center gap-1" title="External website link enabled">
                            <Globe size={10} />
                            <span>Link</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap mt-0.5">
                        {/* Source Tag Badge */}
                        {(() => {
                          const srcType = getSongSourceType(song);
                          if (srcType === 'YOUTUBE') {
                            return (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold font-mono">
                                YOUTUBE
                              </span>
                            );
                          }
                          return (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold font-mono">
                              SBG_CATALOG
                            </span>
                          );
                        })()}
                        <span>•</span>
                        <span>{song.artist}</span>
                        <span>•</span>
                        <span className="text-white/30">{song.genre || 'Various'}</span>
                        <span>•</span>
                        {(song.durationSeconds || song.duration) ? (
                          <span className="text-white/40 font-mono">
                            {Math.floor(((song.durationSeconds || song.duration) as number) / 60)}:{String(((song.durationSeconds || song.duration) as number) % 60).padStart(2, '0')}
                          </span>
                        ) : null}
                        {(song.durationSeconds || song.duration) ? <span>•</span> : null}
                        {song.releaseDate ? (
                          <span className="text-white/40 font-mono">
                            {song.releaseDate}
                          </span>
                        ) : null}
                        {song.releaseDate ? <span>•</span> : null}
                        <span className="text-white/40">By {song.createdBy || 'Shadow'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    {/* Offline Download Toggle / Indicator */}
                    {(() => {
                      const srcType = getSongSourceType(song);
                      if (srcType === 'YOUTUBE') {
                        return (
                          <span
                            className="px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/40 text-zinc-500 text-[11px] font-mono cursor-not-allowed"
                            title="YouTube content is streaming-only under platform terms."
                          >
                            Offline: N/A
                          </span>
                        );
                      }
                      const isDl = song.downloadable ?? song.downloadEnabled ?? true;
                      return (
                        <button
                          type="button"
                          onClick={() => toggleDownloadable(song.id, isDl)}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all ${
                            isDl
                              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                              : 'border-zinc-700 text-zinc-400 bg-zinc-800/50 hover:bg-zinc-700/50'
                          }`}
                          title="Toggle offline downloading for this SBG catalog song"
                        >
                          <HardDrive size={12} className={isDl ? 'text-emerald-400' : 'text-zinc-400'} />
                          <span>Offline DL: {isDl ? 'ON' : 'OFF'}</span>
                        </button>
                      );
                    })()}

                    {/* Edit Song & Hero Banner Button */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSong(song);
                          setIsEditModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02] active:scale-95"
                        title="Edit Song Details, Hero/Banner Image, External Links & Featured Badges"
                      >
                        <Sparkles size={13} className="text-purple-300" />
                        <span>Edit Song & Hero</span>
                      </button>
                    )}

                    {/* Song Analytics Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenSongAnalytics(song.id)}
                      className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      title="View Song Listening Analytics"
                    >
                      <BarChart2 size={13} className="text-blue-300" />
                      <span>Analytics</span>
                    </button>

                    {/* YouTube Source Badge Admin Toggle */}
                    {song.source === 'youtube' && (
                      <button
                        onClick={() => toggleSourceBadge(song.id, song.showYoutubeSourceBadge)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                          song.showYoutubeSourceBadge
                            ? 'border-red-500/30 text-red-300 bg-red-500/10'
                            : 'border-zinc-700 text-zinc-400 bg-zinc-800/50'
                        }`}
                        title="Toggle public YouTube badge visibility for this song"
                      >
                        <Tag size={11} />
                        <span>Badge: {song.showYoutubeSourceBadge ? 'ON' : 'OFF'}</span>
                      </button>
                    )}

                    {/* Published Toggle */}
                    <button
                      onClick={() => togglePublish(song.id, song.published)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                        song.published
                          ? 'border-green-500/30 text-green-400 bg-green-500/10'
                          : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
                      }`}
                    >
                      {song.published ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{song.published ? 'Live' : 'Hidden'}</span>
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteSuccess(null);
                          setSongToDelete(song);
                        }}
                        className="p-2 text-red-400/80 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
                        title="Delete Song"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredSongs.length === 0 && (
                <div className="text-center text-white/40 py-12 text-sm">
                  {searchQuery ? 'No songs matching search query.' : 'No songs in the library yet.'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Featured Section Modal */}
      <EditFeaturedModal
        song={editingSong}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSong(null);
        }}
        onSaved={(updatedSong) => {
          setSongs((prev) => prev.map((s) => (s.id === updatedSong.id ? { ...s, ...updatedSong } : s)));
        }}
      />

      {/* Song Analytics Modal */}
      {selectedSongAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Song Listening Analytics</span>
                <h3 className="text-lg font-bold text-white">{selectedSongAnalytics.title || 'Track Analytics'}</h3>
              </div>
              <button
                onClick={() => setSelectedSongAnalytics(null)}
                className="p-2 text-white/40 hover:text-white rounded-xl bg-white/5 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="py-12 text-center text-white/40 text-xs">Loading analytics data...</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-white/40 font-mono uppercase">Total Plays</span>
                  <p className="text-2xl font-bold text-white">{selectedSongAnalytics.totalPlays || 0}</p>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-white/40 font-mono uppercase">Listening Time</span>
                  <p className="text-xl font-bold text-blue-400">{formatListenTime(selectedSongAnalytics.totalListenSeconds || 0)}</p>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-white/40 font-mono uppercase">Average Time</span>
                  <p className="text-xl font-bold text-purple-400">
                    {selectedSongAnalytics.totalPlays > 0 
                      ? formatListenTime(selectedSongAnalytics.totalListenSeconds / selectedSongAnalytics.totalPlays) 
                      : '0s'}
                  </p>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs text-white/40 font-mono uppercase">Completion Rate</span>
                  <p className="text-xl font-bold text-emerald-400">
                    {selectedSongAnalytics.totalPlays > 0 
                      ? ((selectedSongAnalytics.completedCount / selectedSongAnalytics.totalPlays) * 100).toFixed(1) + '%' 
                      : '0.0%'}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedSongAnalytics(null)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Song Confirmation Modal */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111112] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertCircle size={28} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Delete this song permanently?</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-medium">"{songToDelete.title}"</span>? This action is permanent and cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs text-left">
                {deleteError}
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-300 text-xs">
                {deleteSuccess}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteSong}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
