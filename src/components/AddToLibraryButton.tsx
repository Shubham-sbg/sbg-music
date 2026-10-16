import React, { useState, useEffect } from 'react';
import { BookmarkPlus, BookmarkCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { addToUserLibrary, checkInUserLibrary, removeFromUserLibrary } from '../services/libraryService';

interface AddToLibraryButtonProps {
  song: {
    id?: string;
    songId?: string;
    youtubeVideoId?: string;
    youtubeUrl?: string;
    title: string;
    artist: string;
    thumbnail?: string;
    thumbnailUrl?: string;
    coverUrl?: string;
    audioUrl?: string;
    duration?: number;
    source?: 'youtube' | 'sbg' | 'upload' | 'catalog' | string;
  };
  compact?: boolean;
  className?: string;
  onAdded?: () => void;
  onRemoved?: () => void;
  onAuthRequired?: () => void;
}

export default function AddToLibraryButton({
  song,
  compact = false,
  className = '',
  onAdded,
  onRemoved,
  onAuthRequired,
}: AddToLibraryButtonProps) {
  const { user } = useAuth();
  const [inLibrary, setInLibrary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const identifier = song.youtubeVideoId || song.songId || song.id || '';

  useEffect(() => {
    let isMounted = true;
    if (!user || !identifier) {
      setInLibrary(false);
      return;
    }

    checkInUserLibrary(user.uid || (user as any).id, identifier).then((res) => {
      if (isMounted) {
        setInLibrary(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, identifier]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      if (onAuthRequired) {
        onAuthRequired();
      } else {
        const authBtn = document.getElementById('public-auth-trigger');
        if (authBtn) authBtn.click();
      }
      return;
    }

    const userId = user.uid || (user as any).id;
    setLoading(true);

    if (inLibrary) {
      // Remove from library
      const success = await removeFromUserLibrary(userId, song.youtubeVideoId ? `yt_${song.youtubeVideoId}` : `sbg_${song.id}`);
      if (success) {
        setInLibrary(false);
        setFeedback('Removed');
        setTimeout(() => setFeedback(null), 2000);
        onRemoved?.();
      }
    } else {
      // Add to library
      const res = await addToUserLibrary(userId, {
        songId: song.songId || song.id,
        youtubeVideoId: song.youtubeVideoId,
        youtubeUrl: song.youtubeUrl,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail || song.thumbnailUrl || song.coverUrl,
        thumbnailUrl: song.thumbnailUrl || song.thumbnail || song.coverUrl,
        coverUrl: song.coverUrl || song.thumbnail || song.thumbnailUrl,
        audioUrl: song.audioUrl,
        duration: song.duration,
        source: song.source || (song.youtubeVideoId ? 'youtube' : 'sbg'),
      });

      if (res.success) {
        setInLibrary(true);
        setFeedback(res.alreadyExists ? 'Already in Library' : 'Added to Library!');
        setTimeout(() => setFeedback(null), 2500);
        onAdded?.();
      }
    }

    setLoading(false);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={inLibrary ? 'In Your SBG Library (Click to remove)' : 'Add to SBG Library'}
        aria-label={inLibrary ? 'In Your SBG Library' : 'Add to SBG Library'}
        className={`relative group/lib flex items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${
          inLibrary
            ? 'text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
            : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'
        } ${className}`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-purple-400" />
        ) : inLibrary ? (
          <BookmarkCheck size={16} className="drop-shadow" />
        ) : (
          <BookmarkPlus size={16} />
        )}

        {feedback && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-black/90 text-purple-300 border border-purple-500/30 text-[10px] font-medium rounded-md whitespace-nowrap shadow-lg z-50 pointer-events-none">
            {feedback}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
        inLibrary
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 shadow-sm'
          : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
      } ${className}`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin text-purple-400" />
      ) : inLibrary ? (
        <BookmarkCheck size={14} className="text-purple-400" />
      ) : (
        <BookmarkPlus size={14} className="text-white/70" />
      )}
      <span>{inLibrary ? 'In SBG Library' : 'Add to SBG Library'}</span>

      {feedback && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-black/90 text-purple-300 border border-purple-500/30 text-[10px] font-medium rounded-md whitespace-nowrap shadow-lg z-50 pointer-events-none">
          {feedback}
        </span>
      )}
    </button>
  );
}
