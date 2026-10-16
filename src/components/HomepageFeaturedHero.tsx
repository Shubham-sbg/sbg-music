import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  ArrowUpRight, 
  Music, 
  Youtube, 
  Instagram, 
  Globe, 
  Radio, 
  ListMusic, 
  User, 
  Disc, 
  Sparkles, 
  Loader2 
} from 'lucide-react';
import { UnifiedFeaturedConfig, Song, FeaturedCtaLink } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthProvider';
import { getSongArtwork, recordFeaturedClick } from '../lib/featured';
import { fetchYouTubePlaylistServer } from '../lib/youtubeImportService';

interface HomepageFeaturedHeroProps {
  activeFeatured: UnifiedFeaturedConfig | null;
  song?: Song | null;
  playlist?: any | null;
  loading?: boolean;
}

// Default prominent brand links when admin hasn't customized external links yet
const DEFAULT_BRAND_LINKS: FeaturedCtaLink[] = [
  {
    id: 'sbg_esports',
    label: 'SBG ESPORTS',
    url: 'https://www.youtube.com/@SBGESPORTS',
    enabled: true,
    order: 1,
    icon: 'youtube',
    description: 'Official Gaming & Esports Hub'
  },
  {
    id: 'sbg_instagram',
    label: 'Instagram',
    url: 'https://instagram.com/sbg_esports_official',
    enabled: true,
    order: 2,
    icon: 'instagram',
    description: 'Updates, Reels & Highlights'
  },
  {
    id: 'sbg_song_backup',
    label: 'SBG SONG Backup',
    url: 'https://sbgsongs.vercel.app',
    enabled: true,
    order: 3,
    icon: 'globe',
    description: 'Fast Mirror & Catalog Server'
  },
];

export default function HomepageFeaturedHero({
  activeFeatured,
  song,
  playlist,
  loading = false,
}: HomepageFeaturedHeroProps) {
  const { user } = useAuth();
  const userId = user?.uid || (user as any)?.id;
  const { playSong, currentSong, isPlaying, togglePlayPause, playPlaylist } = usePlayer();

  // YouTube Playlist action state
  const [loadingYtPlaylist, setLoadingYtPlaylist] = useState(false);

  // If loading and no cache present, show clean loading skeleton matching hero dimensions
  if (loading && !activeFeatured) {
    return (
      <div className="w-full bg-[#111116] border border-purple-500/20 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 animate-pulse flex flex-col md:flex-row items-center gap-4 sm:gap-6 min-h-[140px] md:min-h-[240px]">
        <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-52 md:h-52 rounded-2xl bg-white/5 shrink-0" />
        <div className="space-y-3 flex-1 w-full">
          <div className="w-28 h-5 rounded-full bg-purple-500/20" />
          <div className="w-3/4 h-6 sm:h-8 rounded-xl bg-white/10" />
          <div className="w-1/2 h-4 rounded-lg bg-white/5" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <div className="h-10 rounded-xl bg-white/5" />
            <div className="h-10 rounded-xl bg-white/5" />
            <div className="h-10 rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // If no active feature, or explicitly disabled: DO NOT display featured section
  if (!activeFeatured || activeFeatured.enabled === false) {
    return null;
  }

  const isCurrentSongPlaying = song && currentSong?.id === song.id && isPlaying;
  const thumbnail = activeFeatured.thumbnailUrl || (song ? getSongArtwork(song) : playlist?.coverUrl || '');
  const badgeLabel = activeFeatured.badge || (
    activeFeatured.type === 'youtube_playlist' ? 'YOUTUBE PLAYLIST' :
    activeFeatured.type === 'playlist' ? 'FEATURED PLAYLIST' :
    activeFeatured.type === 'artist' ? 'ARTIST SPOTLIGHT' :
    activeFeatured.type === 'album' ? 'FEATURED ALBUM' :
    'FEATURED RELEASE'
  );

  // Handle Play for Featured Song directly over the artwork
  const handlePlaySong = () => {
    if (!song) return;
    if (currentSong?.id === song.id) {
      togglePlayPause();
    } else {
      playSong(song, [song]);
    }
  };

  // Handle Opening / Playing YouTube Playlist
  const handleOpenYoutubePlaylist = async () => {
    if (!activeFeatured.youtubePlaylistId) return;
    setLoadingYtPlaylist(true);
    try {
      try {
        const { recordPlaylistInteraction } = await import('../services/analyticsService');
        recordPlaylistInteraction(activeFeatured.youtubePlaylistId, 'playlist_open', {
          playlistTitle: activeFeatured.title,
        });
      } catch {}

      const data = await fetchYouTubePlaylistServer(activeFeatured.youtubePlaylistId);
      if (data && data.videos && data.videos.length > 0) {
        const playlistSongs: Song[] = data.videos.map((video: any) => ({
          id: `yt_${video.videoId}`,
          title: video.title,
          artist: video.artist || data.author || activeFeatured.channelTitle || 'YouTube Curator',
          thumbnailUrl: video.thumbnailUrl,
          coverUrl: video.thumbnailUrl,
          youtubeVideoId: video.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
          audioUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
          source: 'youtube',
          published: true,
        }));
        playPlaylist(playlistSongs, 0, activeFeatured.youtubePlaylistId);
      } else if (activeFeatured.youtubeUrl) {
        window.open(activeFeatured.youtubeUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.warn('Failed to load YouTube playlist videos:', err);
      if (activeFeatured.youtubeUrl) {
        window.open(activeFeatured.youtubeUrl, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setLoadingYtPlaylist(false);
    }
  };

  // Link click handler with lightweight analytics
  const handleLinkClick = (link: FeaturedCtaLink) => {
    try {
      recordFeaturedClick(activeFeatured.id || 'featured_hero', link.id);
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent('sbg:featured-link-click', {
          detail: {
            linkId: link.id,
            linkTitle: link.label,
            destination: link.url,
            timestamp: Date.now(),
            userId: userId || 'anonymous',
          },
        })
      );
    } catch {}
  };

  // Determine active display links (Admin dynamic links, with default fallback)
  const displayLinks: FeaturedCtaLink[] = (() => {
    if (activeFeatured.externalLinks && activeFeatured.externalLinks.length > 0) {
      const active = activeFeatured.externalLinks
        .filter((l) => l.enabled !== false && l.url && l.url.trim())
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      if (active.length > 0) return active;
    }
    return DEFAULT_BRAND_LINKS;
  })();

  // Platform/Brand Icon Resolver
  const getLinkIcon = (label: string, iconKey?: string) => {
    const key = (iconKey || label).toLowerCase();
    if (key.includes('youtube')) {
      return <Youtube size={15} className="text-red-400 shrink-0" />;
    }
    if (key.includes('instagram')) {
      return <Instagram size={15} className="text-pink-400 shrink-0" />;
    }
    if (key.includes('discord')) {
      return <Radio size={15} className="text-indigo-400 shrink-0" />;
    }
    if (key.includes('music') || key.includes('song')) {
      return <Music size={15} className="text-purple-400 shrink-0" />;
    }
    return <Globe size={15} className="text-purple-300 shrink-0" />;
  };

  return (
    <section 
      aria-label="Featured Release"
      className="w-full bg-gradient-to-r from-purple-950/75 via-[#131024] to-black rounded-2xl md:rounded-3xl border border-purple-500/25 p-3.5 sm:p-5 md:p-8 shadow-[0_15px_45px_rgba(0,0,0,0.6)] relative overflow-hidden transition-all duration-300"
    >
      {/* Background ambient lighting for depth and cinematic presence */}
      <div className="absolute -right-12 -top-12 w-64 h-64 md:w-96 md:h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-64 h-64 md:w-80 md:h-80 bg-purple-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full flex flex-col gap-3.5 sm:gap-4 md:gap-6">
        
        {/* TOP ROW / HERO LOCKUP (Horizontal on mobile to save vertical viewport space) */}
        <div className="flex items-center md:items-center gap-3.5 sm:gap-5 md:gap-8 w-full">
          
          {/* 1. SONG ARTWORK with Centered Circular Play Button */}
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-52 md:h-52 rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden bg-black/80 border border-white/15 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.7)] group transition-transform duration-300">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={activeFeatured.title}
                loading="eager"
                fetchPriority="high"
                className={`w-full h-full object-cover transition-transform duration-500 ${isCurrentSongPlaying ? 'scale-105' : 'group-hover:scale-105'}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 bg-zinc-900">
                {activeFeatured.type === 'youtube_playlist' ? <Youtube size={28} /> :
                 activeFeatured.type === 'playlist' ? <ListMusic size={28} /> :
                 activeFeatured.type === 'artist' ? <User size={28} /> :
                 activeFeatured.type === 'album' ? <Disc size={28} /> :
                 <Music size={28} />}
              </div>
            )}

            {/* Vignette overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors pointer-events-none" />

            {/* CENTERED CIRCULAR PLAY BUTTON ON ARTWORK */}
            {activeFeatured.type === 'song' && song && (
              <button
                onClick={handlePlaySong}
                aria-label={isCurrentSongPlaying ? 'Pause Featured Song' : 'Play Featured Song'}
                className={`absolute inset-0 m-auto w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 z-20 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black ${
                  isCurrentSongPlaying
                    ? 'bg-purple-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.9)] scale-100 ring-2 sm:ring-4 ring-purple-400/30'
                    : 'bg-black/75 hover:bg-black/95 text-white backdrop-blur-md border border-white/30 hover:border-white/70 shadow-lg hover:scale-110 active:scale-95'
                }`}
              >
                {isCurrentSongPlaying ? (
                  <Pause size={18} fill="currentColor" className="md:w-6 md:h-6" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5 md:w-6 md:h-6 md:ml-1" />
                )}
              </button>
            )}

            {activeFeatured.type === 'youtube_playlist' && (
              <button
                onClick={handleOpenYoutubePlaylist}
                disabled={loadingYtPlaylist}
                aria-label="Play YouTube Playlist"
                className="absolute inset-0 m-auto w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 z-20"
              >
                {loadingYtPlaylist ? <Loader2 size={16} className="animate-spin md:w-6 md:h-6" /> : <Play size={18} fill="currentColor" className="ml-0.5 md:w-6 md:h-6 md:ml-1" />}
              </button>
            )}
          </div>

          {/* 2. SONG METADATA / INFORMATION */}
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5 md:space-y-2.5">
            {/* Badges / Category row */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm shadow-purple-900/40">
                {badgeLabel}
              </span>

              {activeFeatured.type === 'song' && (
                <span className="text-[10px] md:text-xs text-white/50 font-mono tracking-wider uppercase bg-white/5 px-2 py-0.5 rounded-full border border-white/10 hidden xs:inline-block">
                  Official Release
                </span>
              )}

              {activeFeatured.type === 'youtube_playlist' && activeFeatured.channelTitle && (
                <span className="text-[10px] md:text-xs text-red-300/90 font-mono bg-red-950/40 px-2 py-0.5 rounded-full border border-red-500/20 truncate max-w-[180px]">
                  Curated by {activeFeatured.channelTitle}
                </span>
              )}
            </div>

            {/* Song / Feature Title */}
            <h1 className="text-base sm:text-xl md:text-3xl font-extrabold text-white tracking-tight leading-snug line-clamp-1 sm:line-clamp-2 drop-shadow-sm">
              {activeFeatured.title}
            </h1>

            {/* Artist / Subtitle */}
            {activeFeatured.subtitle && (
              <p className="text-xs sm:text-sm md:text-base font-semibold text-purple-300 tracking-wide truncate">
                {activeFeatured.subtitle}
              </p>
            )}

            {/* Description (Visible on tablets & desktop, hidden on compact mobile to keep hero tight) */}
            {activeFeatured.description && (
              <p className="text-xs text-white/60 max-w-2xl line-clamp-1 md:line-clamp-2 leading-relaxed hidden sm:block">
                {activeFeatured.description}
              </p>
            )}
          </div>
        </div>

        {/* 3. PROMINENT BUT COMPACT DESTINATIONS & BRAND LINKS */}
        <div className="w-full pt-1 border-t border-white/5">
          <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1.5 font-bold flex items-center gap-1.5">
            <Sparkles size={10} className="text-purple-400" />
            <span>Featured Links & Destinations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2.5 w-full">
            {displayLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick(link)}
                className="group relative flex items-center justify-between gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl bg-white/[0.05] hover:bg-purple-950/40 border border-white/10 hover:border-purple-500/50 text-white transition-all duration-200 shadow-sm hover:shadow-purple-900/30 active:scale-[0.98] cursor-pointer min-h-[38px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/5 border border-white/10 group-hover:border-purple-500/30 flex items-center justify-center shrink-0 text-white/70 group-hover:text-purple-300 transition-colors">
                    {getLinkIcon(link.label, link.icon)}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold truncate text-white group-hover:text-purple-200 transition-colors">
                      {link.label}
                    </span>
                    {link.description && (
                      <span className="hidden md:block text-[10px] text-white/40 truncate font-normal">
                        {link.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-5 h-5 rounded-md bg-white/5 group-hover:bg-purple-500/20 text-white/40 group-hover:text-purple-300 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-purple-500/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={12} />
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
