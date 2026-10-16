import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useSeo } from '../hooks/useSeo';
import { generateSongJsonLd } from '../config/schema';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  Music, 
  Clock, 
  Share2, 
  ListPlus, 
  Check, 
  Sparkles, 
  Mic2,
  Disc,
  Info,
  Layers,
  Radio,
  FileText,
  Download,
  WifiOff
} from 'lucide-react';
import FavoriteButton from '../components/FavoriteButton';
import AddToLibraryButton from '../components/AddToLibraryButton';
import AddToCatalogButton from '../components/AddToCatalogButton';
import BackButton from '../components/BackButton';
import AdPlacementBanner from '../components/AdPlacementBanner';
import SongLyricsTab from '../components/SongLyricsTab';
import ShareSongModal from '../components/ShareSongModal';
import ShareCardModal from '../components/ShareCardModal';
import ShareSongButton from '../components/ShareSongButton';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export default function SongDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const ssrSong = typeof window !== 'undefined' && (window as any).__INITIAL_SSR_DATA__?.song?.id === id
    ? (window as any).__INITIAL_SSR_DATA__.song
    : null;
  const [song, setSong] = useState<Song | null>(() => ssrSong);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(() => !ssrSong);
  const [copied, setCopied] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const { isDownloaded, downloadSong, deleteDownloadedSong } = useOfflineStatus();

  // Tab State: 'overview' | 'lyrics' | 'related'
  const initialTab = searchParams.get('tab') === 'lyrics' ? 'lyrics' : (searchParams.get('tab') === 'related' ? 'related' : 'overview');
  const [activeTab, setActiveTab] = useState<'overview' | 'lyrics' | 'related'>(initialTab);

  const { playSong, currentSong, isPlaying, togglePlayPause, addToQueue, toggleLyrics } = usePlayer();

  const handleTabChange = (tab: 'overview' | 'lyrics' | 'related') => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchSongData() {
      if (!id) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'songs', id);
        const snap = await getDoc(docRef);

        if (snap.exists() && isMounted) {
          const sData = { id: snap.id, ...snap.data() } as Song;
          setSong(sData);

          // Fetch related songs for internal linking & recommendations
          const songsRef = collection(db, 'songs');
          const q = query(songsRef, limit(8));
          const relSnap = await getDocs(q);
          const relList = relSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Song))
            .filter(s => s.id !== id);
          
          if (isMounted) {
            setRelatedSongs(relList.slice(0, 6));
          }
        } else if (isMounted) {
          setSong(null);
        }
      } catch (err) {
        console.error('Error fetching song details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSongData();
    return () => { isMounted = false; };
  }, [id]);

  const isCurrentPlaying = currentSong?.id === song?.id;
  const artwork = song?.coverUrl || song?.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80';

  // Format Duration helper
  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // SEO Integration
  useSeo({
    title: song ? `${song.title} — ${song.artist}` : 'Song Details',
    description: song 
      ? `Listen to "${song.title}" by ${song.artist} on SBG MUSIC. High quality audio streaming, lyrics, and music discovery.`
      : 'Explore official track details and lyrics on SBG MUSIC.',
    ogImage: artwork,
    ogType: 'music.song',
    canonicalUrl: song ? `/song/${song.id}` : undefined,
    jsonLd: song ? generateSongJsonLd({
      id: song.id,
      title: song.title,
      artist: song.artist,
      coverUrl: artwork,
      duration: song.duration
    }) : undefined
  });

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-white/50 gap-3 animate-pulse">
        <Disc size={36} className="animate-spin text-purple-500" />
        <span className="text-sm font-medium">Loading song details...</span>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="text-center py-20 bg-[#111112] rounded-3xl border border-white/5 max-w-xl mx-auto my-12 p-8">
        <Music size={48} className="mx-auto text-purple-400 mb-4 opacity-60" />
        <h1 className="text-2xl font-bold mb-3 text-white">Song Not Found</h1>
        <p className="text-white/50 text-sm mb-6">
          The requested track does not exist or may have been removed from the SBG MUSIC library.
        </p>
        <Link
          to="/songs"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-all"
        >
          <ArrowLeft size={18} />
          <span>Browse Song Library</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 max-w-6xl mx-auto w-full pb-24 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <BackButton fallbackPath="/songs" label="Back to Songs" />
      </div>

      {/* Hero Song Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/40 via-[#121216] to-[#0A0A0D] border border-white/10 p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-8 shadow-2xl">
        {/* Background Blur */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 blur-3xl pointer-events-none scale-125"
          style={{ backgroundImage: `url(${artwork})` }}
        />

        {/* Artwork */}
        <div className="relative shrink-0 w-48 h-48 md:w-60 md:h-60 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
          <img 
            src={artwork} 
            alt={`${song.title} — ${song.artist}`}
            width={240}
            height={240}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
        </div>

        {/* Main Info */}
        <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold tracking-wide">
            <Sparkles size={12} />
            <span>Official Track • SBG MUSIC</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {song.title}
          </h1>

          <p className="text-lg md:text-xl font-medium text-white/70">
            {song.artist}
          </p>

          <div className="flex items-center gap-4 text-xs font-medium text-white/50 pt-1">
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-purple-400" />
              {formatDuration(song.duration)}
            </span>
            <span>•</span>
            <span>High Quality Audio</span>
            {song.genre && (
              <>
                <span>•</span>
                <span className="text-purple-300 font-medium">{song.genre}</span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
            <button
              onClick={() => {
                if (isCurrentPlaying) {
                  togglePlayPause();
                } else {
                  playSong(song, [song, ...relatedSongs]);
                }
              }}
              className="flex items-center gap-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold px-7 py-3.5 rounded-2xl shadow-lg shadow-purple-600/30 hover:scale-105 transition-all"
            >
              {isCurrentPlaying && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              <span>{isCurrentPlaying && isPlaying ? 'Pause Track' : 'Play Now'}</span>
            </button>

            <button
              onClick={() => addToQueue(song)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-4 py-3.5 rounded-2xl border border-white/10 transition-colors"
              title="Add to Queue"
            >
              <ListPlus size={18} />
              <span className="hidden sm:inline">Add to Queue</span>
            </button>

            {/* Lyrics Tab Action Button */}
            <button
              onClick={() => {
                handleTabChange('lyrics');
                const lyricsEl = document.getElementById('song-tabs-section');
                if (lyricsEl) {
                  lyricsEl.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className={`flex items-center gap-2 font-semibold px-4 py-3.5 rounded-2xl border transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-md shadow-purple-900/20'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
              }`}
              title="View & Follow Lyrics"
            >
              <Mic2 size={18} className="text-purple-400" />
              <span className="hidden sm:inline">Lyrics</span>
            </button>

            <AddToLibraryButton song={song} className="p-3.5 !py-3.5 !rounded-2xl" />

            <AddToCatalogButton song={song} className="p-3.5 !py-3.5 !rounded-2xl" />

            <FavoriteButton song={song} className="p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10" />

            {/* Offline Cache Download Button */}
            <button
              onClick={async () => {
                if (!song) return;
                if (isDownloaded(song.id)) {
                  await deleteDownloadedSong(song.id);
                  setDownloadMsg('Removed from offline cache');
                } else {
                  const ok = await downloadSong(song);
                  setDownloadMsg(ok ? 'Downloaded for offline playback!' : 'Could not cache track');
                }
                setTimeout(() => setDownloadMsg(null), 3000);
              }}
              className={`flex items-center gap-2 font-semibold px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                isDownloaded(song.id)
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-950/30'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
              }`}
              title={isDownloaded(song.id) ? "Saved in offline cache" : "Download for offline listening"}
            >
              {isDownloaded(song.id) ? (
                <>
                  <Check size={18} className="text-emerald-400 stroke-[3]" />
                  <span className="hidden sm:inline text-xs font-bold text-emerald-300">Saved Offline</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="hidden sm:inline text-xs">Save Offline</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white font-semibold px-4 py-3.5 rounded-2xl border border-purple-500/30 transition-all cursor-pointer shadow-lg active:scale-95"
              title="Share Track Deep Link & Social Media"
            >
              <Share2 size={18} className="text-purple-400" />
              <span className="text-xs font-bold">Share Song</span>
            </button>
          </div>
        </div>
      </div>

      <AdPlacementBanner slot="song_detail_top" />

      {/* Tabs Navigation Header */}
      <div id="song-tabs-section" className="flex items-center border-b border-white/10 gap-2 md:gap-4 overflow-x-auto pb-1 scrollbar-none">
        <button
          id="tab-overview"
          onClick={() => handleTabChange('overview')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shrink-0 border ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/30'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-transparent'
          }`}
        >
          <Info size={16} />
          <span>Overview</span>
        </button>

        <button
          id="tab-lyrics"
          onClick={() => handleTabChange('lyrics')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 transition-all shrink-0 border ${
            activeTab === 'lyrics'
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/30'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-transparent'
          }`}
        >
          <Mic2 size={16} className={activeTab === 'lyrics' ? 'text-white' : 'text-purple-400'} />
          <span>Lyrics</span>
          {isCurrentPlaying && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live
            </span>
          )}
        </button>

        <button
          id="tab-related"
          onClick={() => handleTabChange('related')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shrink-0 border ${
            activeTab === 'related'
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/30'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-transparent'
          }`}
        >
          <Music size={16} />
          <span>Related Tracks</span>
          {relatedSongs.length > 0 && (
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70">
              {relatedSongs.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'lyrics' && (
        <div className="animate-in fade-in duration-300">
          <SongLyricsTab song={song} relatedSongs={relatedSongs} />
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
          {/* Description / Metadata card */}
          {song.description ? (
            <section className="bg-[#111114] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-3">About {song.title}</h2>
              <p className="text-white/70 leading-relaxed text-sm md:text-base whitespace-pre-line">
                {song.description}
              </p>
            </section>
          ) : (
            <section className="bg-[#111114] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">Track Overview</h2>
              <p className="text-white/60 text-sm leading-relaxed">
                Stream "{song.title}" by {song.artist} in full high-definition audio on SBG MUSIC. Check out the Lyrics tab to sing along with real-time synchronized playback.
              </p>
            </section>
          )}

          {/* Quick Track Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#111114] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono uppercase tracking-wider">Artist</span>
              <span className="text-sm font-bold text-white truncate">{song.artist}</span>
            </div>
            <div className="bg-[#111114] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono uppercase tracking-wider">Duration</span>
              <span className="text-sm font-bold text-white font-mono">{formatDuration(song.duration)}</span>
            </div>
            <div className="bg-[#111114] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono uppercase tracking-wider">Genre</span>
              <span className="text-sm font-bold text-purple-400">{song.genre || 'General'}</span>
            </div>
            <div className="bg-[#111114] border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono uppercase tracking-wider">Audio Quality</span>
              <span className="text-sm font-bold text-emerald-400">Lossless 320kbps</span>
            </div>
          </div>

          {/* Quick Lyrics Preview Teaser on Overview */}
          <div className="bg-gradient-to-r from-purple-950/30 via-[#131318] to-[#111115] border border-purple-500/20 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Mic2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sing Along with Lyrics</h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Follow synchronized karaoke lines or view plain lyrics for "{song.title}".
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('lyrics')}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md shrink-0 flex items-center gap-2"
            >
              <span>Open Lyrics Tab</span>
              <span>→</span>
            </button>
          </div>

          {/* Related Tracks preview */}
          {relatedSongs.length > 0 && (
            <section className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  More Tracks You Might Like
                </h2>
                <button
                  onClick={() => handleTabChange('related')}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                >
                  View All ({relatedSongs.length}) →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedSongs.slice(0, 3).map((rel) => (
                  <div 
                    key={rel.id}
                    className="group relative bg-[#121215] hover:bg-[#18181f] border border-white/5 hover:border-purple-500/30 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all shadow-md"
                  >
                    <Link to={`/song/${rel.id}`} className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden">
                      <img 
                        src={rel.coverUrl || rel.thumbnailUrl} 
                        alt={rel.title}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/song/${rel.id}`} 
                        className="text-sm font-bold text-white truncate block hover:text-purple-400 transition-colors"
                      >
                        {rel.title}
                      </Link>
                      <p className="text-xs text-white/50 truncate mt-0.5">{rel.artist}</p>
                    </div>

                    <button
                      onClick={() => playSong(rel, [rel, ...relatedSongs])}
                      className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white transition-all shrink-0"
                      title="Play"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'related' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Recommended & Related Tracks
            </h2>
            <Link to="/songs" className="text-xs font-semibold text-purple-400 hover:text-purple-300">
              Browse Entire Catalog →
            </Link>
          </div>

          {relatedSongs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedSongs.map((rel) => (
                <div 
                  key={rel.id}
                  className="group relative bg-[#121215] hover:bg-[#18181f] border border-white/5 hover:border-purple-500/30 p-3.5 rounded-2xl flex items-center gap-3.5 transition-all shadow-md"
                >
                  <Link to={`/song/${rel.id}`} className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden">
                    <img 
                      src={rel.coverUrl || rel.thumbnailUrl} 
                      alt={rel.title}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link 
                      to={`/song/${rel.id}`} 
                      className="text-sm font-bold text-white truncate block hover:text-purple-400 transition-colors"
                    >
                      {rel.title}
                    </Link>
                    <p className="text-xs text-white/50 truncate mt-0.5">{rel.artist}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <ShareSongButton 
                      song={rel} 
                      size={14} 
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
                    />
                    <button
                      onClick={() => playSong(rel, [rel, ...relatedSongs])}
                      className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white transition-all shrink-0 cursor-pointer"
                      title="Play"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-[#111114] border border-white/5 rounded-3xl p-8">
              <Music size={36} className="mx-auto text-white/40 mb-3" />
              <p className="text-white/60 text-sm">No additional recommendations found for this track.</p>
            </div>
          )}
        </div>
      )}

      {/* Share Track Modal */}
      {isShareModalOpen && song && (
        <ShareSongModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          song={song}
          onOpenCardModal={() => setIsCardModalOpen(true)}
        />
      )}

      {/* Stylized Story Card Modal */}
      {isCardModalOpen && song && (
        <ShareCardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          song={song}
        />
      )}

      {/* Download Status Toast */}
      {downloadMsg && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#16161a] border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 fade-in">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check size={14} className="stroke-[3]" />
          </div>
          <span className="text-xs font-semibold">{downloadMsg}</span>
        </div>
      )}
    </div>
  );
}

