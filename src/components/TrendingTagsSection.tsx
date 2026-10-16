import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveDiscoveryTags, DiscoveryTag } from '../lib/discoveryTags';
import { Flame, Sparkles, ChevronRight } from 'lucide-react';

interface TrendingTagsSectionProps {
  onSelectTag?: (query: string) => void;
  className?: string;
  showTitle?: boolean;
}

export default function TrendingTagsSection({
  onSelectTag,
  className = '',
  showTitle = true,
}: TrendingTagsSectionProps) {
  const [tags, setTags] = useState<DiscoveryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    getActiveDiscoveryTags().then((data) => {
      if (isMounted) {
        setTags(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleClick = (tag: DiscoveryTag) => {
    if (onSelectTag) {
      onSelectTag(tag.searchQuery);
    } else {
      navigate(`/search?q=${encodeURIComponent(tag.searchQuery)}`);
    }
  };

  if (!loading && tags.length === 0) return null;

  return (
    <div className={`w-full overflow-hidden select-none ${className}`}>
      {showTitle && (
        <div className="flex items-center gap-2 mb-2.5 px-0.5">
          <Flame className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Trending Discovery
          </span>
          <span className="text-[10px] text-zinc-500 font-medium ml-auto hidden sm:inline">
            Tap to explore
          </span>
        </div>
      )}

      {/* Horizontal scrolling chip container */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-full bg-zinc-800/60 animate-pulse shrink-0"
              />
            ))
          : tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleClick(tag)}
                className="group shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-zinc-900/80 hover:bg-purple-950/40 text-zinc-300 hover:text-white border border-zinc-800 hover:border-purple-500/40 shadow-sm transition-all duration-200 active:scale-95"
              >
                {tag.image ? (
                  <img
                    src={tag.image}
                    alt={tag.name}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : tag.icon ? (
                  <span className="text-sm shrink-0 leading-none">{tag.icon}</span>
                ) : (
                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0 opacity-70 group-hover:opacity-100" />
                )}
                <span className="whitespace-nowrap">{tag.name}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
