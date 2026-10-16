import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, ArrowDown } from 'lucide-react';

interface ScrollDiscoveryIndicatorProps {
  /** The container or element that holds the results */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Total count of results */
  totalResults: number;
  label?: string;
  className?: string;
}

export default function ScrollDiscoveryIndicator({
  containerRef,
  totalResults,
  label = 'More results below',
  className = '',
}: ScrollDiscoveryIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);
  const [hasDismissedByScroll, setHasDismissedByScroll] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset dismissal when new search results arrive
    setHasDismissedByScroll(false);
  }, [totalResults]);

  useEffect(() => {
    if (totalResults <= 0 || hasDismissedByScroll) {
      setShowIndicator(false);
      return;
    }

    const checkVisibility = () => {
      if (!containerRef.current || hasDismissedByScroll) {
        setShowIndicator(false);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;

      // Check if container extends significantly below the visible viewport (> 120px below fold)
      const isOverflowingBelow = rect.bottom > windowHeight + 80;
      // Also ensure container top is near or within view (not scrolled way past)
      const isContainerAccessible = rect.top < windowHeight - 40;

      if (isOverflowingBelow && isContainerAccessible) {
        setShowIndicator(true);
      } else {
        setShowIndicator(false);
      }
    };

    // Check immediately and on next paint
    checkVisibility();
    const raf = requestAnimationFrame(checkVisibility);

    const handleScroll = () => {
      // If user has scrolled down > 150px from initial position, dismiss indicator
      if (window.scrollY > 150) {
        setHasDismissedByScroll(true);
        setShowIndicator(false);
      } else {
        checkVisibility();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [containerRef, totalResults, hasDismissedByScroll]);

  const handleScrollDown = () => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setHasDismissedByScroll(true);
      setShowIndicator(false);
    }
  };

  if (!showIndicator) return null;

  return (
    <div 
      ref={indicatorRef}
      className={`fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 pointer-events-auto ${className}`}
    >
      <button
        onClick={handleScrollDown}
        aria-label="Scroll down to see more results"
        className="group bg-gradient-to-r from-purple-900/95 via-black/95 to-indigo-900/95 hover:from-purple-800 hover:to-indigo-800 border border-purple-500/40 text-white px-4 py-2 rounded-full shadow-[0_8px_25px_rgba(168,85,247,0.4)] flex items-center gap-2 text-xs font-bold tracking-wide backdrop-blur-md cursor-pointer transition-all active:scale-95 animate-bounce motion-reduce:animate-none"
      >
        <ArrowDown size={14} className="text-purple-300 group-hover:translate-y-0.5 transition-transform" />
        <span className="text-white/90 group-hover:text-white">{label}</span>
        <ChevronDown size={13} className="text-purple-400 opacity-75" />
      </button>
    </div>
  );
}
