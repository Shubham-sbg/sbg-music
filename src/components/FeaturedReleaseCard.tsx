import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, ExternalLink, Sparkles, Loader2, ListPlus } from 'lucide-react';
import { FeaturedRelease, Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { recordFeaturedImpression, recordFeaturedClick } from '../lib/featured';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface FeaturedReleaseCardProps {
  release: FeaturedRelease;
  songs: Song[];
}

// URL validation helper (security constraint 9)
export function sanitizeAndValidateUrl(url: string): { isValid: boolean; normalizedUrl: string } {
  if (!url || typeof url !== 'string') return { isValid: false, normalizedUrl: '' };
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    return { isValid: false, normalizedUrl: '' };
  }

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return { isValid: true, normalizedUrl: trimmed };
  }

  // If starts with www or domain, prepend https://
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(trimmed)) {
    return { isValid: true, normalizedUrl: `https://${trimmed}` };
  }

  return { isValid: false, normalizedUrl: '' };
}

export default function FeaturedReleaseCard({ release, songs }: FeaturedReleaseCardProps) {
  const { playSong, currentSong, isPlaying, togglePlayPause, playPlaylist, isLoading, isBuffering, addToQueue } = usePlayer();
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionRecordedRef = useRef(false);

  // Impression tracking via IntersectionObserver
  useEffect(() => {
    if (!cardRef.current || impressionRecordedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !impressionRecordedRef.current) {
            impressionRecordedRef.current = true;
            recordFeaturedImpression(release.id);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 } // triggers when 50% visible
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [release.id]);

  const [fetchedSong, setFetchedSong] = useState<Song | null>(null);

  const targetSongId = release.primaryCta?.songId || release.targetSongId;
  const targetSong = songs.find((s) => s.id === targetSongId) || fetchedSong;

  useEffect(() => {
    if (!targetSong && targetSongId) {
      getDoc(doc(db, 'songs', targetSongId)).then((snap) => {
        if (snap.exists()) {
          setFetchedSong({ id: snap.id, ...snap.data() } as Song);
        }
      }).catch((err) => console.warn('Failed to fetch target song for featured release:', err));
    }
  }, [targetSongId, targetSong]);

  const isPlayingThis = targetSong && currentSong?.id === targetSong.id && isPlaying;
  const isLoadingThis = targetSong && currentSong?.id === targetSong.id && (isLoading || isBuffering);

  const handlePrimaryCtaClick = () => {
    recordFeaturedClick(release.id);

    if (release.primaryCta?.actionType === 'play_song') {
      if (targetSong) {
        if (currentSong?.id === targetSong.id) {
          togglePlayPause();
        } else {
          playSong(targetSong, songs);
        }
      }
    } else if (release.primaryCta?.actionType === 'open_url' && release.primaryCta?.url) {
      const validated = sanitizeAndValidateUrl(release.primaryCta.url);
      if (validated.isValid) {
        window.open(validated.normalizedUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleExternalLinkClick = (linkId: string, url: string) => {
    recordFeaturedClick(release.id, linkId);
    const validated = sanitizeAndValidateUrl(url);
    if (validated.isValid) {
      window.open(validated.normalizedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      ref={cardRef}
      className="relative min-h-[380px] md:h-[440px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] bg-[#09090b] flex flex-col justify-end"
    >
      {/* Background Hero Image */}
      {release.imageUrl ? (
        <img
          src={release.imageUrl}
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90 transition-transform duration-700 hover:scale-105"
          alt={release.title}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/40 via-black to-zinc-950" />
      )}

      {/* Cinematic Vignettes */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent z-10" />

      {/* Compact Right-Side CTA Button */}
      {release.compactCtaEnabled && release.compactCtaUrl && (
        <div className="absolute top-6 right-6 z-35">
          <button
            onClick={(e) => {
              e.stopPropagation();
              recordFeaturedClick(release.id);
              const validated = sanitizeAndValidateUrl(release.compactCtaUrl!);
              if (validated.isValid) {
                window.open(validated.normalizedUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-md px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>{release.compactCtaLabel || 'Visit'}</span>
            <ExternalLink size={12} className="text-white/70" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col justify-center px-6 sm:px-12 py-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-[11px] font-black uppercase tracking-[0.35em] text-white/90 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full backdrop-blur-md shadow-sm">
            {release.badge || 'Featured Release'}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles size={11} />
            <span>SBG Music</span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-2 drop-shadow-md">
          {release.title}
        </h1>

        {release.description && (
          <p className="text-white/70 text-xs sm:text-sm line-clamp-3 mb-6 max-w-xl">
            {release.description}
          </p>
        )}

        {/* Primary Action + Secondary Official Website CTAs */}
        <div className="flex flex-wrap items-center gap-3.5 pt-1">
          <button
            onClick={handlePrimaryCtaClick}
            className="bg-white text-black px-8 sm:px-10 py-3.5 rounded-full font-extrabold text-xs sm:text-sm flex items-center gap-3 shadow-[0_8px_25px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {release.primaryCta?.actionType === 'play_song' && (
              isLoadingThis && !isPlaying ? <Loader2 size={16} className="animate-spin text-black" /> : isPlayingThis ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />
            )}
            <span>{release.primaryCta?.text || 'Listen Now'}</span>
          </button>

          {/* Secondary Official Website Links */}
          {release.externalLinks?.filter((l) => l.enabled && l.url).map((link) => {
            const validated = sanitizeAndValidateUrl(link.url);
            if (!validated.isValid) return null;
            return (
              <button
                key={link.id}
                onClick={() => handleExternalLinkClick(link.id, link.url)}
                className="px-5 py-3.5 rounded-full font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>{link.buttonText || link.name}</span>
                <ExternalLink size={13} className="text-white/60" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
