import React from 'react';
import { Play, Pause, ExternalLink, Music, AlertCircle, Globe, Instagram, Youtube, Loader2 } from 'lucide-react';
import { Song, FeaturedCtaLink } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getSongArtwork, sanitizeAndValidateUrl, recordFeaturedClick } from '../lib/featured';

interface FeaturedSongBannerProps {
  featuredSong?: Song | null;
  externalLinks?: FeaturedCtaLink[];
  badge?: string;
  loading?: boolean;
  isUnavailable?: boolean;
  allSongs?: Song[];
}

export default function FeaturedSongBanner({
  featuredSong,
  externalLinks = [],
  badge = 'FEATURED RELEASE',
  loading = false,
  isUnavailable = false,
  allSongs = [],
}: FeaturedSongBannerProps) {
  const { playSong, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering } = usePlayer();

  const isCurrentPlaying = featuredSong && currentSong?.id === featuredSong.id && isPlaying;
  const isCurrentLoading = featuredSong && currentSong?.id === featuredSong.id && (isLoading || isBuffering);

  const handlePlayClick = () => {
    if (!featuredSong) return;
    if (currentSong?.id === featuredSong.id) {
      togglePlayPause();
    } else {
      const queue = allSongs.length > 0 ? allSongs : [featuredSong];
      playSong(featuredSong, queue);
    }
  };

  const handleCtaClick = (linkId: string, url: string) => {
    recordFeaturedClick('featured_banner', linkId);
    const validated = sanitizeAndValidateUrl(url);
    if (validated.isValid) {
      window.open(validated.normalizedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Helper to get platform-appropriate icon
  const getCtaIcon = (label: string, url: string) => {
    const text = (label + ' ' + url).toLowerCase();
    if (text.includes('spotify')) {
      return (
        <svg className="w-4 h-4 text-[#1DB954] shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    }
    if (text.includes('instagram')) {
      return <Instagram size={15} className="text-pink-400 shrink-0" />;
    }
    if (text.includes('youtube')) {
      return <Youtube size={15} className="text-red-500 shrink-0" />;
    }
    return <Globe size={15} className="text-purple-400 shrink-0" />;
  };

  // Format song duration string if provided
  const formattedDuration = (() => {
    if (!featuredSong?.duration || isNaN(featuredSong.duration)) return null;
    const mins = Math.floor(featuredSong.duration / 60);
    const secs = Math.floor(featuredSong.duration % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  })();

  // Filter active valid external CTAs
  const activeLinks = externalLinks
    .filter((l) => l.enabled !== false && l.url && l.url.trim())
    .map((l) => ({ ...l, validated: sanitizeAndValidateUrl(l.url) }))
    .filter((l) => l.validated.isValid);

  // 1. Loading State (only display skeleton if no featured song data is available yet)
  if (loading && !featuredSong) {
    return (
      <section className="relative min-h-[360px] md:h-[420px] rounded-3xl overflow-hidden border border-white/10 bg-[#111112] p-8 flex flex-col justify-end animate-pulse">
        <div className="space-y-4 max-w-md z-10">
          <div className="h-6 w-32 bg-white/10 rounded-full" />
          <div className="h-10 w-3/4 bg-white/10 rounded-2xl" />
          <div className="h-5 w-1/2 bg-white/10 rounded-xl" />
          <div className="flex gap-3 pt-4">
            <div className="h-12 w-36 bg-white/20 rounded-full" />
            <div className="h-12 w-32 bg-white/10 rounded-full" />
          </div>
        </div>
      </section>
    );
  }

  // 2. Unavailable / Deleted Song State
  if (isUnavailable) {
    return (
      <section className="relative min-h-[300px] md:min-h-[360px] rounded-3xl overflow-hidden border border-amber-500/20 bg-[#14120e] p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
          <AlertCircle size={28} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400/80 mb-2">
          FEATURED RELEASE
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          Featured Song Unavailable
        </h2>
        <p className="text-xs sm:text-sm text-amber-200/60 max-w-md">
          The selected song is no longer available in the catalog. Please select another song in the Admin panel.
        </p>
      </section>
    );
  }

  // 3. Empty State (No song selected in Admin)
  if (!featuredSong) {
    return (
      <section className="relative min-h-[300px] md:min-h-[360px] rounded-3xl overflow-hidden border border-white/10 bg-[#111112] p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-4 shadow-lg">
          <Music size={28} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-purple-400/90 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-3">
          SBG MUSIC
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          No Featured Song Selected
        </h2>
        <p className="text-xs sm:text-sm text-white/40 max-w-md">
          Select a featured song from Admin to highlight your top track and external CTA links.
        </p>
      </section>
    );
  }

  const artworkUrl = getSongArtwork(featuredSong);

  // 4. Active Featured Banner (Desktop & Mobile Responsive)
  return (
    <section className="relative min-h-[400px] md:min-h-[440px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] bg-[#09090b] flex flex-col justify-end group">
      {/* Background Song Artwork */}
      {artworkUrl ? (
        <img
          src={artworkUrl}
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.88] transition-transform duration-700 group-hover:scale-105"
          alt={featuredSong.title}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/60 via-black to-zinc-950" />
      )}

      {/* Cinematic Legibility Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-transparent z-10" />

      {/* Hero Banner Content Layer */}
      <div className="relative z-20 h-full flex flex-col justify-end px-6 sm:px-12 py-8 sm:py-10 max-w-4xl">
        {/* Badge & Optional Duration */}
        <div className="inline-flex items-center gap-2 mb-3.5 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/90 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full backdrop-blur-md shadow-sm">
            {badge || 'FEATURED RELEASE'}
          </span>
          {formattedDuration && (
            <span className="text-[10px] font-mono text-white/60 bg-black/50 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
              {formattedDuration}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-2 leading-tight drop-shadow-md line-clamp-2">
          {featuredSong.title}
        </h1>

        {/* Artist */}
        <p className="text-white/80 text-sm sm:text-base md:text-lg font-medium mb-6">
          By <span className="text-white font-bold">{featuredSong.artist}</span>
        </p>

        {/* CTAs Row: Primary Play Button + Secondary Visit CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 w-full pt-1">
          {/* PRIMARY ACTION: PLAY BUTTON */}
          <button
            onClick={handlePlayClick}
            aria-label={`Play ${featuredSong.title} by ${featuredSong.artist}`}
            className="bg-white text-black px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:bg-zinc-100 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer shrink-0 min-h-[48px]"
          >
            {isCurrentLoading && !isPlaying ? (
              <>
                <Loader2 size={18} className="animate-spin text-black" />
                <span>LOADING...</span>
              </>
            ) : isCurrentPlaying ? (
              <>
                <Pause size={18} fill="currentColor" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" className="ml-0.5" />
                <span>PLAY NOW</span>
              </>
            )}
          </button>

          {/* SECONDARY VISIT CTAs (Scrollable row on mobile so layout stays perfectly vertical) */}
          {activeLinks.length > 0 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 max-w-full scrollbar-none pt-1 sm:pt-0">
              {activeLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleCtaClick(link.id, link.url)}
                  aria-label={`Visit ${link.label}`}
                  className="bg-black/60 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 px-5 py-3.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
                >
                  {getCtaIcon(link.label, link.url)}
                  <span>{link.label}</span>
                  <ExternalLink size={13} className="text-white/50 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
