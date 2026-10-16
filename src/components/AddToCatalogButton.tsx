import React, { useState, useEffect } from 'react';
import { PlusCircle, CheckCircle2, ShieldCheck, Loader2, Sparkles, Clock, Send } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { 
  checkInSbgCatalog, 
  addToSbgCatalog, 
  submitSongForSbgApproval, 
  checkSongSubmissionStatus, 
  CatalogSongInput 
} from '../services/catalogService';

interface AddToCatalogButtonProps {
  song: CatalogSongInput;
  compact?: boolean;
  className?: string;
  onAdded?: (songId: string) => void;
}

export default function AddToCatalogButton({
  song,
  compact = false,
  className = '',
  onAdded,
}: AddToCatalogButtonProps) {
  const { user, hasPermission } = useAuth();
  const [inCatalog, setInCatalog] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const identifier = song.youtubeVideoId || song.songId || song.id || '';
  const isAdminOrStaff = Boolean(
    user && (
      hasPermission('add_song') ||
      hasPermission('addSongs') ||
      hasPermission('publishSongs') ||
      hasPermission('importYouTubePlaylists') ||
      (user as any).role === 'admin' ||
      (user as any).role === 'owner' ||
      (user as any).role === 'staff'
    )
  );

  useEffect(() => {
    let isMounted = true;
    if (!identifier) {
      setInCatalog(false);
      setIsPendingApproval(false);
      return;
    }

    // Check if it's already an SBG native song or in catalog
    if (song.source === 'sbg' && !song.id?.startsWith('yt_') && !song.youtubeVideoId) {
      setInCatalog(true);
      return;
    }

    // 1. Check official catalog
    checkInSbgCatalog(identifier).then((res) => {
      if (!isMounted) return;
      if (res.exists) {
        setInCatalog(true);
        setIsPendingApproval(false);
      } else if (user?.uid) {
        // 2. If not in catalog, check user submission status
        checkSongSubmissionStatus(identifier, user.uid).then((subRes) => {
          if (isMounted) {
            setIsPendingApproval(subRes.isSubmitted && subRes.status === 'pending');
          }
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [identifier, song.source, song.id, song.youtubeVideoId, user?.uid]);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // 1. If anonymous user: prompt sign-in gracefully
    if (!user) {
      setFeedback('Sign in to submit this song to SBG Music');
      setTimeout(() => setFeedback(null), 3500);
      const authBtn = document.getElementById('public-auth-trigger');
      if (authBtn) authBtn.click();
      return;
    }

    // 2. Already in catalog
    if (inCatalog) {
      setFeedback('Already in SBG Catalog');
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    // 3. Already pending approval
    if (isPendingApproval && !isAdminOrStaff) {
      setFeedback('Submitted • Pending SBG Approval');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setLoading(true);

    // 4. Admin or Staff: direct publish to catalog
    if (isAdminOrStaff) {
      const res = await addToSbgCatalog(song);
      if (res.success) {
        setInCatalog(true);
        setIsPendingApproval(false);
        setFeedback(res.alreadyExists ? 'Already in Catalog' : 'Published to SBG Catalog!');
        setTimeout(() => setFeedback(null), 3000);
        if (res.songId) {
          onAdded?.(res.songId);
        }
      } else {
        setFeedback(res.error || 'Failed to publish');
        setTimeout(() => setFeedback(null), 3000);
      }
    } else {
      // 5. Normal User: submit for SBG Music approval
      const subRes = await submitSongForSbgApproval(song, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      if (subRes.success) {
        setIsPendingApproval(true);
        setFeedback(subRes.alreadySubmitted ? 'Already submitted for review' : 'Submitted to SBG Music (Pending Approval)');
        setTimeout(() => setFeedback(null), 3500);
      } else {
        setFeedback(subRes.error || 'Submission failed. Try again.');
        setTimeout(() => setFeedback(null), 3000);
      }
    }

    setLoading(false);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleAction}
        disabled={loading}
        title={
          inCatalog
            ? 'In Official SBG Catalog'
            : isPendingApproval
            ? 'Submitted to SBG Music (Pending Review)'
            : isAdminOrStaff
            ? 'Publish to Official SBG Catalog'
            : 'Submit this song to SBG Music'
        }
        aria-label={
          inCatalog
            ? 'In SBG Catalog'
            : isPendingApproval
            ? 'Pending Approval'
            : '+ SBG Music'
        }
        className={`relative group/cat flex items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${
          inCatalog
            ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : isPendingApproval
            ? 'text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30'
            : 'text-white/70 hover:text-amber-300 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30'
        } ${className}`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-amber-400" />
        ) : inCatalog ? (
          <CheckCircle2 size={16} className="drop-shadow" />
        ) : isPendingApproval ? (
          <Clock size={16} className="text-indigo-400" />
        ) : (
          <PlusCircle size={16} />
        )}

        {feedback && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-black/95 text-amber-300 border border-amber-500/30 text-[10px] font-medium rounded-md whitespace-nowrap shadow-xl z-50 pointer-events-none">
            {feedback}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={loading}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
        inCatalog
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 shadow-sm'
          : isPendingApproval
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
          : 'bg-white/10 text-white hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 hover:border-amber-500/30'
      } ${className}`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin text-amber-400" />
      ) : inCatalog ? (
        <CheckCircle2 size={14} className="text-amber-400" />
      ) : isPendingApproval ? (
        <Clock size={14} className="text-indigo-300" />
      ) : (
        <PlusCircle size={14} className="text-amber-400/80" />
      )}
      <span>
        {inCatalog 
          ? 'In SBG Music' 
          : isPendingApproval 
          ? 'Pending Approval' 
          : isAdminOrStaff 
          ? '+ SBG Catalog' 
          : '+ SBG Music'}
      </span>

      {feedback && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-black/95 text-amber-300 border border-amber-500/30 text-[10px] font-medium rounded-md whitespace-nowrap shadow-xl z-50 pointer-events-none">
          {feedback}
        </span>
      )}
    </button>
  );
}
