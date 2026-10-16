import React, { useState, useEffect, useRef } from 'react';
import { AdCampaign, AdPlacement } from '../types';
import { fetchActiveCampaigns, recordAdImpression, recordAdClick } from '../lib/ads';
import { ExternalLink, Sparkles } from 'lucide-react';

interface AdPlacementBannerProps {
  placement?: AdPlacement;
  slot?: AdPlacement;
  className?: string;
}

export default function AdPlacementBanner({ placement, slot, className = '' }: AdPlacementBannerProps) {
  const activePlacement = placement || slot || 'home_hero';
  const [ad, setAd] = useState<AdCampaign | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const hasRecordedImpression = useRef(false);

  useEffect(() => {
    let isMounted = true;
    fetchActiveCampaigns(activePlacement).then((ads) => {
      if (isMounted && ads.length > 0) {
        // Pick active ad (random or first)
        const selected = ads[Math.floor(Math.random() * ads.length)];
        setAd(selected);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activePlacement]);

  useEffect(() => {
    if (!ad || !bannerRef.current || hasRecordedImpression.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !hasRecordedImpression.current) {
          hasRecordedImpression.current = true;
          recordAdImpression(ad.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(bannerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [ad]);

  if (!ad) return null;

  const handleClick = (e: React.MouseEvent) => {
    recordAdClick(ad.id);
  };

  return (
    <div
      ref={bannerRef}
      id={`ad-banner-${placement}-${ad.id}`}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#121214] via-[#1a1a1f] to-[#121214] p-4 md:p-6 shadow-xl transition-all hover:border-white/20 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left side: Image and details */}
        <div className="flex items-center gap-4">
          {ad.imageUrl && (
            <img
              src={ad.imageUrl}
              alt={ad.title}
              referrerPolicy="no-referrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border border-white/10 shadow-md shrink-0"
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Sparkles size={10} />
                <span>Featured Promo</span>
              </span>
            </div>
            <h4 className="text-base md:text-lg font-bold text-white tracking-tight">{ad.title}</h4>
            {ad.description && (
              <p className="text-xs md:text-sm text-white/60 line-clamp-2 max-w-xl mt-0.5">
                {ad.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Action button */}
        <a
          href={ad.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs md:text-sm hover:scale-[1.03] active:scale-95 transition-all shadow-lg shrink-0"
        >
          <span>{ad.buttonLabel || 'Learn More'}</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
