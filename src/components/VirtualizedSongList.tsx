import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { 
  Play, 
  Pause, 
  Music, 
  Volume2, 
  ExternalLink, 
  ListPlus, 
  Clock,
  Radio,
  Check,
  Share2
} from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ShareSongButton from './ShareSongButton';
import AddToLibraryButton from './AddToLibraryButton';
import AddToCatalogButton from './AddToCatalogButton';
import { Song } from '../types';

interface VirtualizedSongListProps {
  songs: Song[];
  viewMode: 'list' | 'grid';
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onPlaySong: (song: Song, index: number) => void;
  onAddToQueue: (song: Song) => void;
}

export default function VirtualizedSongList({
  songs,
  viewMode,
  currentSong,
  isPlaying,
  isLoading,
  onPlaySong,
  onAddToQueue,
}: VirtualizedSongListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parentOffset, setParentOffset] = useState<number>(0);
  const [copiedQueueId, setCopiedQueueId] = useState<string | null>(null);

  // Responsive column calculation for virtualized grid mode
  const [columnsCount, setColumnsCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 640) return 2;
    if (width < 768) return 3;
    if (width < 1024) return 4;
    return 5;
  });

  // Keep columns responsive on resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let cols = 5;
      if (width < 640) cols = 2;
      else if (width < 768) cols = 3;
      else if (width < 1024) cols = 4;
      setColumnsCount(cols);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track parentOffset to ensure window virtualizer offsets are accurate relative to the viewport
  useEffect(() => {
    const updateOffset = () => {
      if (containerRef.current) {
        setParentOffset(containerRef.current.offsetTop);
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);

    // Re-check offset in case banners or layout elements shift
    const t1 = setTimeout(updateOffset, 100);
    const t2 = setTimeout(updateOffset, 500);

    return () => {
      window.removeEventListener('resize', updateOffset);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [songs.length, viewMode]);

  // Format seconds to mm:ss
  const formatTime = useCallback((time?: number) => {
    if (typeof time !== 'number' || isNaN(time) || time <= 0) return null;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Group songs into rows for grid virtualization
  const gridRows = useMemo(() => {
    if (viewMode !== 'grid') return [];
    const rows: Song[][] = [];
    for (let i = 0; i < songs.length; i += columnsCount) {
      rows.push(songs.slice(i, i + columnsCount));
    }
    return rows;
  }, [songs, viewMode, columnsCount]);

  // Window Virtualizer for List Mode (estimate ~64px per track row)
  const listVirtualizer = useWindowVirtualizer({
    count: viewMode === 'list' ? songs.length : 0,
    estimateSize: () => 64,
    overscan: 8,
    scrollMargin: parentOffset,
  });

  // Window Virtualizer for Grid Mode (estimate ~310px per grid row)
  const gridVirtualizer = useWindowVirtualizer({
    count: viewMode === 'grid' ? gridRows.length : 0,
    estimateSize: () => 310,
    overscan: 4,
    scrollMargin: parentOffset,
  });

  const handleQueueClick = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    onAddToQueue(song);
    setCopiedQueueId(song.id);
    setTimeout(() => setCopiedQueueId(null), 1500);
  };

  if (songs.length === 0) {
    return null;
  }

  // LIST VIEW VIRTUALIZATION
  if (viewMode === 'list') {
    const virtualItems = listVirtualizer.getVirtualItems();

    return (
      <div ref={containerRef} className="w-full">
        {/* Sticky Table Header */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40 border-b border-white/5 mb-2 select-none">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 md:col-span-5">Title & Artist</div>
          <div className="hidden md:block md:col-span-3">Genre / Source</div>
          <div className="col-span-2 text-right">Duration</div>
          <div className="col-span-3 md:col-span-1 text-right">Actions</div>
        </div>

        {/* Virtualized Container */}
        <div
          style={{
            height: `${listVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const song = songs[virtualItem.index];
            if (!song) return null;

            const isCurrentPlaying = currentSong?.id === song.id;
            const displayImage =
              song.imageUrl ||
              song.customCoverUrl ||
              song.coverUrl ||
              song.heroImageUrl ||
              song.thumbnailUrl;
            const externalUrl = song.externalUrl || song.externalLinkUrl;
            const formattedDuration = formatTime(song.duration);

            return (
              <div
                key={song.id || virtualItem.key}
                data-index={virtualItem.index}
                ref={listVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start - listVirtualizer.options.scrollMargin}px)`,
                }}
                className="pb-2"
              >
                <div
                  onClick={() => onPlaySong(song, virtualItem.index)}
                  className={`group flex items-center justify-between px-3 md:px-4 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isCurrentPlaying
                      ? 'bg-purple-600/15 border-purple-500/30 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                      : 'bg-[#111112]/90 hover:bg-[#18181B] border-white/5 hover:border-white/15 text-white/80'
                  }`}
                >
                  {/* Left: Index / Play Icon, Artwork, Title & Artist */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Index / Play / Equalizer */}
                    <div className="w-7 text-center shrink-0">
                      {isCurrentPlaying && isPlaying ? (
                        <Volume2 size={16} className="mx-auto text-purple-400 animate-pulse" />
                      ) : isCurrentPlaying && !isPlaying ? (
                        <Play size={15} fill="currentColor" className="mx-auto text-purple-400" />
                      ) : (
                        <>
                          <span className="text-white/30 font-mono text-xs group-hover:hidden">
                            {(virtualItem.index + 1).toString().padStart(2, '0')}
                          </span>
                          <Play
                            size={14}
                            fill="currentColor"
                            className="mx-auto hidden group-hover:block text-white"
                          />
                        </>
                      )}
                    </div>

                    {/* Artwork Thumbnail */}
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden shrink-0 shadow-md border border-white/5 relative">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          className="w-full h-full object-cover"
                          alt={song.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <Music size={16} />
                        </div>
                      )}

                      {/* Admin-enabled badge ONLY if showYoutubeSourceBadge is explicitly true */}
                      {song.showYoutubeSourceBadge && song.source === 'youtube' && (
                        <div className="absolute top-0.5 left-0.5 bg-red-600/90 text-white text-[8px] font-bold px-1 rounded uppercase tracking-wider">
                          YT
                        </div>
                      )}
                    </div>

                    {/* Title & Artist */}
                    <div className="min-w-0 pr-2">
                      <div
                        className={`font-semibold text-sm truncate ${
                          isCurrentPlaying ? 'text-white' : 'text-white/90 group-hover:text-white'
                        }`}
                      >
                        {song.title}
                      </div>
                      <div className="text-xs text-white/40 truncate flex items-center gap-2">
                        <span>{song.artist || 'Unknown Artist'}</span>
                        {song.genre && (
                          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/50 border border-white/5">
                            {song.genre}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column (Source / Badges on wider screens) */}
                  <div className="hidden md:flex items-center gap-2 w-40 shrink-0 text-xs text-white/40 truncate">
                    {song.genre ? (
                      <span className="truncate">{song.genre}</span>
                    ) : song.source === 'youtube' ? (
                      <span className="flex items-center gap-1 text-red-400/80 text-[11px] font-semibold">
                        <Radio size={12} /> SBG YT
                      </span>
                    ) : (
                      <span className="text-white/30 font-mono text-[11px]">SBG Catalog</span>
                    )}
                  </div>

                  {/* Right: Duration & Actions */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {formattedDuration && (
                      <span className="text-xs font-mono text-white/50 mr-1 hidden sm:inline-block">
                        {formattedDuration}
                      </span>
                    )}

                    {/* External Link */}
                    {externalUrl && (
                      <a
                        href={externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Open External URL"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}

                    {/* Share Track Button */}
                    <ShareSongButton 
                      song={song} 
                      size={14} 
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" 
                    />

                    {/* Add to SBG Library Button */}
                    <div className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                      <AddToLibraryButton song={song} compact className="!p-1.5 !rounded-lg" />
                    </div>

                    {/* Add to SBG Catalog Button */}
                    <div className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                      <AddToCatalogButton song={song} compact className="!p-1.5 !rounded-lg" />
                    </div>

                    {/* Add to Queue */}
                    <button
                      onClick={(e) => handleQueueClick(e, song)}
                      title={copiedQueueId === song.id ? 'Added to queue' : 'Add to queue'}
                      className={`p-1.5 rounded-lg transition-all ${
                        copiedQueueId === song.id
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100'
                      }`}
                    >
                      {copiedQueueId === song.id ? <Check size={14} /> : <ListPlus size={14} />}
                    </button>

                    {/* Favorite Button */}
                    <FavoriteButton
                      songId={song.id}
                      size={14}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // GRID VIEW VIRTUALIZATION (Card Grid Rows)
  const virtualRows = gridVirtualizer.getVirtualItems();

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{
          height: `${gridVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowSongs = gridRows[virtualRow.index];
          if (!rowSongs) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={gridVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - gridVirtualizer.options.scrollMargin}px)`,
              }}
              className="pb-4 md:pb-6"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {rowSongs.map((song, colIdx) => {
                  const songIndex = virtualRow.index * columnsCount + colIdx;
                  const isCurrentPlaying = currentSong?.id === song.id;
                  const displayImage =
                    song.imageUrl ||
                    song.customCoverUrl ||
                    song.coverUrl ||
                    song.heroImageUrl ||
                    song.thumbnailUrl;
                  const externalUrl = song.externalUrl || song.externalLinkUrl;
                  const formattedDuration = formatTime(song.duration);

                  return (
                    <div
                      key={song.id}
                      className="group bg-[#111112] p-3.5 md:p-4 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-[#18181A] transition-all shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-3.5 shadow-md bg-zinc-900 border border-white/5">
                          {displayImage ? (
                            <img
                              src={displayImage}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              alt={song.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music size={32} className="text-white/20" />
                            </div>
                          )}

                          {/* Top Right Actions */}
                          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                            <FavoriteButton songId={song.id} size={14} />

                            <AddToLibraryButton song={song} compact className="!p-1.5 !rounded-lg bg-black/60 backdrop-blur-md" />

                            <AddToCatalogButton song={song} compact className="!p-1.5 !rounded-lg bg-black/60 backdrop-blur-md" />

                            <ShareSongButton song={song} size={12} variant="card" />

                            {externalUrl && (
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all shadow flex items-center justify-center"
                                title="Open External URL"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {/* Source badge */}
                          {song.source === 'youtube' && (
                            <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow">
                              SBG YT
                            </div>
                          )}

                          {/* Track Duration Badge */}
                          {formattedDuration && (
                            <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md text-white/90 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md border border-white/10 shadow pointer-events-none">
                              {formattedDuration}
                            </div>
                          )}

                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => onPlaySong(song, songIndex)}
                              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl translate-y-3 group-hover:translate-y-0 transition-all hover:scale-105"
                            >
                              {isCurrentPlaying && isPlaying ? (
                                <Pause size={20} fill="currentColor" />
                              ) : (
                                <Play size={20} fill="currentColor" className="ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <h3 className="font-bold text-sm md:text-base truncate text-white mb-0.5">
                          {song.title}
                        </h3>
                        <p className="text-white/40 text-xs md:text-sm truncate">
                          {song.artist || 'Unknown Artist'}
                        </p>
                      </div>

                      {isCurrentPlaying && (
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-300 font-mono mt-2 pt-2 border-t border-white/5">
                          <Volume2 size={12} className="animate-pulse text-purple-400" />
                          <span>Now Playing</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
