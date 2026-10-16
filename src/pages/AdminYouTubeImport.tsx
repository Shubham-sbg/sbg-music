import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { 
  Youtube, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  AlertTriangle,
  Loader2, 
  ListMusic, 
  RefreshCw, 
  Check, 
  ExternalLink,
  Sparkles,
  Play,
  RotateCcw,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  YouTubeVideoPreview,
  YouTubePlaylistData,
  ImportCheckpoint,
  fetchYouTubePlaylistServer,
  bulkCheckExistingSongsInDb,
  executeResumableImport,
  loadCheckpoint,
  clearCheckpoint,
  getActiveCheckpointForUrl,
  YouTubeQuotaExhaustedError,
} from '../lib/youtubeImportService';
import { invalidateCache } from '../hooks/useCatalog';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export default function AdminYouTubeImport() {
  const { user, hasPermission } = useAuth();
  
  const [url, setUrl] = useState('https://youtube.com/playlist?list=PLrgvGoS-rzZ6IVuT1t_Oa7Gw2DONorkBY&si=e9E62goEANlJ0JmQ');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [playlistData, setPlaylistData] = useState<YouTubePlaylistData | null>(null);

  // Editable playlist fields in preview
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  // Import state & checkpoint tracking
  const [importing, setImporting] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<ImportCheckpoint | null>(null);
  const [progressStep, setProgressStep] = useState('');
  const [importResult, setImportResult] = useState<{
    playlistId: string;
    playlistTitle: string;
    totalFound: number;
    newSongsCount: number;
    existingSongsCount: number;
    failedCount: number;
    status: string;
    lastError?: string;
    failedDetails?: Array<{ videoId: string; title: string; error: string; segment?: string }>;
  } | null>(null);

  const canImport = hasPermission('importYouTubePlaylists');

  // Check for active checkpoints on mount or URL change
  useEffect(() => {
    if (!url.trim()) return;
    let mounted = true;
    (async () => {
      const existingCp = await getActiveCheckpointForUrl(url.trim());
      if (!mounted) return;
      if (existingCp && existingCp.status !== 'completed' && existingCp.status !== 'cleared') {
        setActiveCheckpoint(existingCp);
      } else {
        setActiveCheckpoint(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url]);

  const getPlaylistIdFromUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/[&?]list=([^&]+)/) || trimmed.match(/playlist\/([^?\/]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{18,50}$/.test(trimmed)) return trimmed;
    return null;
  };

  if (!canImport) {
    return (
      <div className="p-8 text-center bg-[#111112] rounded-3xl border border-white/5 max-w-2xl mx-auto">
        <AlertCircle size={48} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-white/40">You do not have permission to import YouTube playlists.</p>
      </div>
    );
  }

  // Handle fetching metadata & videos from server
  const handleFetchPlaylist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setFetching(true);
    setFetchError('');
    setIsQuotaError(false);
    setPlaylistData(null);
    setImportResult(null);

    try {
      // Step 1: Fetch playlist details with backoff
      const data = await fetchYouTubePlaylistServer(url.trim(), (statusMsg) => {
        setProgressStep(statusMsg);
      });

      // Step 2: Bulk check existing songs in Firestore ahead of preview render
      const videoIds = (data.videos || []).map((v) => v.videoId).filter(Boolean);
      const existingMap = await bulkCheckExistingSongsInDb(videoIds);

      const formattedVideos: YouTubeVideoPreview[] = (data.videos || []).map((v) => ({
        ...v,
        selected: true,
        isExisting: Boolean(existingMap[v.videoId]),
        existingId: existingMap[v.videoId]?.id,
      }));

      setPlaylistData({
        ...data,
        videos: formattedVideos,
      });
      setCustomTitle(data.title || 'Imported YouTube Playlist');
      setCustomDescription(data.description || `Curated collection with ${formattedVideos.length} tracks.`);
    } catch (err: any) {
      console.error('Fetch playlist failed:', err);
      if (err instanceof YouTubeQuotaExhaustedError || err.message?.includes('quota')) {
        setIsQuotaError(true);
        setFetchError('YouTube API daily quota has been exhausted. Please try again after quota reset or configure a valid higher-quota project.');
      } else {
        setFetchError(err.message || 'Failed to fetch YouTube playlist.');
      }
    } finally {
      setFetching(false);
    }
  };

  // Toggle single song selection
  const toggleSelectVideo = (index: number) => {
    if (!playlistData) return;
    const updated = [...playlistData.videos];
    updated[index].selected = !updated[index].selected;
    setPlaylistData({ ...playlistData, videos: updated });
  };

  // Toggle select all
  const toggleSelectAll = (select: boolean) => {
    if (!playlistData) return;
    const updated = playlistData.videos.map((v) => ({ ...v, selected: select }));
    setPlaylistData({ ...playlistData, videos: updated });
  };

  // Update track title or artist manually in preview
  const updateTrackField = (index: number, field: 'title' | 'artist', value: string) => {
    if (!playlistData) return;
    const updated = [...playlistData.videos];
    updated[index] = { ...updated[index], [field]: value };
    setPlaylistData({ ...playlistData, videos: updated });
  };

  // Start new import process with checkpoint
  const handleExecuteImport = async () => {
    if (!playlistData) return;
    const selectedVideos = playlistData.videos.filter((v) => v.selected);
    if (selectedVideos.length === 0) {
      alert('Please select at least one song to import.');
      return;
    }

    const jobId = `yt_import_${playlistData.id}`;
    const newCheckpoint: ImportCheckpoint = {
      jobId,
      playlistUrl: url.trim(),
      playlistTitle: customTitle.trim() || playlistData.title || 'Imported Playlist',
      playlistDescription: customDescription.trim() || playlistData.description || '',
      totalItems: selectedVideos.length,
      processedCount: 0,
      newCreatedCount: 0,
      reusedCount: 0,
      failedCount: 0,
      finalSongIds: [],
      processedVideoIds: [],
      videosToProcess: selectedVideos,
      status: 'importing',
      updatedAt: Date.now(),
    };

    runImportJob(newCheckpoint);
  };

  // Resume paused or failed checkpoint job
  const handleResumeCheckpoint = () => {
    if (!activeCheckpoint) return;
    runImportJob(activeCheckpoint);
  };

  // Discard checkpoint
  const handleDiscardCheckpoint = async () => {
    if (activeCheckpoint) {
      await clearCheckpoint(activeCheckpoint.jobId);
      setActiveCheckpoint(null);
    }
  };

  // Shared runner for new and resumed import jobs
  const runImportJob = async (checkpoint: ImportCheckpoint) => {
    setImporting(true);
    setActiveCheckpoint(checkpoint);
    const staffDisplayName = user?.displayName || 'Shadow';

    try {
      const finalCp = await executeResumableImport({
        checkpoint,
        staffDisplayName,
        userId: user?.id,
        onProgress: (cp) => {
          setActiveCheckpoint(cp);
          const currentVideo = cp.videosToProcess[cp.processedCount];
          const songTitle = currentVideo ? (currentVideo.title || currentVideo.rawTitle) : 'Completing import...';
          setProgressStep(`Current song: "${songTitle}"`);
        },
      });

      // Clear checkpoint on completion
      await clearCheckpoint(checkpoint.jobId);
      setActiveCheckpoint(null);

      // Invalidate catalog caches so Admin and Public views update immediately
      invalidateCache('admin_songs_list');
      invalidateCache('admin_playlists_list');
      invalidateCache('published_songs_list');
      invalidateCache('published_playlists_list');

      setImportResult({
        playlistId: finalCp.targetPlaylistId || '',
        playlistTitle: finalCp.playlistTitle,
        totalFound: finalCp.totalItems,
        newSongsCount: finalCp.newCreatedCount,
        existingSongsCount: finalCp.reusedCount,
        failedCount: finalCp.failedCount,
        status: finalCp.status,
        lastError: finalCp.lastError,
        failedDetails: finalCp.failedDetails,
      });

      // Clear preview state
      setPlaylistData(null);
    } catch (importErr: any) {
      console.error('Import execution error:', importErr);
      if (importErr instanceof YouTubeQuotaExhaustedError) {
        setIsQuotaError(true);
        setFetchError('YouTube API daily quota exhausted. Progress saved — you can click Resume Import later.');
      }
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = playlistData?.videos.filter((v) => v.selected).length || 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Informational banner about Featured Control */}
      <div className="bg-[#111112] p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="font-bold text-white">Want to feature a YouTube playlist on the homepage?</span>
            <span className="text-white/50 block sm:inline sm:ml-1.5">Manage all homepage hero features in the centralized Featured Control tab.</span>
          </div>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-[#111112] p-8 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Youtube size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import YouTube Playlist</h1>
            <p className="text-white/40 text-sm">
              Fetch any public YouTube playlist with high-speed chunked batch imports, bulk Firestore deduplication, and resumable checkpoints.
            </p>
          </div>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleFetchPlaylist} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Paste YouTube Playlist URL (e.g. https://youtube.com/playlist?list=...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={fetching || importing}
              className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-red-500/50 transition-colors text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={fetching || importing || !url.trim()}
            className="bg-white text-black font-bold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shrink-0"
          >
            {fetching ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <span>Fetch Playlist</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Error Display */}
        {fetchError && (
          <div className={`mt-4 p-4 rounded-2xl border text-sm flex items-center gap-3 ${
            isQuotaError 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            {isQuotaError ? (
              <ShieldAlert size={20} className="shrink-0 text-amber-400" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-400" />
            )}
            <span>{fetchError}</span>
          </div>
        )}
      </div>

      {/* Active Checkpoint Banner (Resume Import Feature) */}
      {activeCheckpoint && !importing && (
        <div className="bg-purple-900/20 p-6 rounded-3xl border border-purple-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw size={24} className="text-purple-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Unfinished Import Session Found</h3>
                <p className="text-xs text-white/60">
                  Import "{activeCheckpoint.playlistTitle}" was paused at <strong className="text-purple-300">{activeCheckpoint.processedCount} / {activeCheckpoint.totalItems}</strong> tracks.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDiscardCheckpoint}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold text-xs flex items-center gap-1.5 transition-colors border border-red-500/20"
              >
                <Trash2 size={14} />
                <span>Discard</span>
              </button>
              <button
                type="button"
                onClick={handleResumeCheckpoint}
                className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center gap-2 transition-transform hover:scale-105"
              >
                <Play size={14} />
                <span>Resume Import ({activeCheckpoint.processedCount}/{activeCheckpoint.totalItems})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Resumable Import Progress Overlay */}
      {importing && activeCheckpoint && (
        <div className="bg-[#111112] p-8 rounded-3xl border border-purple-500/30 shadow-2xl space-y-6 animate-in fade-in" id="import-progress-overlay">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw size={24} className="animate-spin text-purple-400" />
              <div>
                <h2 className="text-xl font-bold">Importing Playlist into SBG MUSIC</h2>
                <p className="text-xs text-white/40">High-speed chunked batch writes & automatic checkpointing active</p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-purple-300">
              {activeCheckpoint.processedCount} / {activeCheckpoint.totalItems} songs imported ({Math.round((activeCheckpoint.processedCount / (activeCheckpoint.totalItems || 1)) * 100)}%)
            </span>
          </div>

          <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${(activeCheckpoint.processedCount / (activeCheckpoint.totalItems || 1)) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-black/30 rounded-xl border border-white/5">
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider block">Imported</span>
              <span className="text-lg font-bold text-green-400 font-mono">{activeCheckpoint.newCreatedCount || 0}</span>
            </div>
            <div className="p-3 bg-black/30 rounded-xl border border-white/5">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Skipped duplicates</span>
              <span className="text-lg font-bold text-blue-400 font-mono">{activeCheckpoint.reusedCount || 0}</span>
            </div>
            <div className="p-3 bg-black/30 rounded-xl border border-white/5">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">Failed</span>
              <span className="text-lg font-bold text-red-400 font-mono">{activeCheckpoint.failedCount || 0}</span>
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 font-mono text-xs text-white/70">
            <p className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
              {progressStep || `Processing track ${activeCheckpoint.processedCount} of ${activeCheckpoint.totalItems}...`}
            </p>
          </div>
        </div>
      )}

      {/* Result Report Card (Honest Accounting Engine) */}
      {importResult && (() => {
        const isFailed = importResult.status === 'failed' || (importResult.newSongsCount === 0 && importResult.existingSongsCount === 0 && importResult.failedCount > 0);
        const isPartial = !isFailed && (importResult.failedCount > 0 || importResult.status === 'completed_with_errors');

        const borderColor = isFailed ? 'border-red-500/30' : isPartial ? 'border-amber-500/30' : 'border-green-500/20';
        const titleColor = isFailed ? 'text-red-400' : isPartial ? 'text-amber-400' : 'text-green-400';
        const iconBg = isFailed ? 'bg-red-500/10 border-red-500/30 text-red-400' : isPartial ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-green-500/10 border-green-500/30 text-green-400';

        return (
          <div className={`bg-[#111112] p-8 rounded-3xl border ${borderColor} shadow-2xl space-y-6`} id="import-result-report">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${iconBg}`}>
                {isFailed ? <XCircle size={28} /> : isPartial ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${titleColor}`}>
                  {isFailed ? 'Import Failed — No Songs Added' : isPartial ? 'Import Completed With Errors' : 'Playlist Imported Successfully!'}
                </h2>
                <p className="text-white/60 text-sm">
                  {isFailed 
                    ? 'None of the requested tracks could be added to the Firestore database. Check detailed failure reasons below.' 
                    : isPartial 
                    ? 'Some songs were successfully written, but several items encountered errors or were unavailable.' 
                    : 'Collection is now live in the SBG library and ready for public streaming.'}
                </p>
              </div>
            </div>

            {importResult.lastError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-xs font-mono">
                <strong className="block text-red-400 mb-1">Database / Service Error:</strong>
                {importResult.lastError}
              </div>
            )}

            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <h3 className="text-sm font-bold text-white">Import Summary:</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Processed <span className="font-bold text-white font-mono">{importResult.totalFound}</span> items for playlist <span className="text-white font-semibold">"{importResult.playlistTitle}"</span>:
              </p>
              <ul className="text-xs text-white/70 space-y-2 list-disc pl-5">
                <li>
                  <span className="text-green-400 font-semibold">New Songs:</span> <strong className="font-mono text-green-400 text-sm">{importResult.newSongsCount}</strong> newly created in database.
                </li>
                <li>
                  <span className="text-blue-400 font-semibold">Existing Songs:</span> <strong className="font-mono text-blue-400 text-sm">{importResult.existingSongsCount}</strong> matched and linked.
                </li>
                <li>
                  <span className="text-red-400 font-semibold">Unavailable / Failed:</span> <strong className="font-mono text-red-400 text-sm">{importResult.failedCount}</strong> video{importResult.failedCount === 1 ? '' : 's'} failed or missing.
                </li>
              </ul>
            </div>

            {/* Detailed item failure logs if available */}
            {importResult.failedDetails && importResult.failedDetails.length > 0 && (
              <div className="p-4 bg-black/50 border border-red-500/20 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>Failed Track Item Details ({importResult.failedDetails.length})</span>
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 text-xs font-mono">
                  {importResult.failedDetails.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-red-500/5 rounded-xl border border-red-500/10 space-y-1">
                      <div className="flex justify-between text-white/80">
                        <span className="font-bold truncate">{item.title}</span>
                        <span className="text-red-400 shrink-0 ml-2">ID: {item.videoId}</span>
                      </div>
                      <p className="text-red-300/80 text-[11px]">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-xs text-white/40 uppercase tracking-wider block mb-1">Total Processed</span>
                <span className="text-2xl font-bold">{importResult.totalFound}</span>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-xs text-green-400 uppercase tracking-wider block mb-1">New Songs</span>
                <span className="text-2xl font-bold text-green-400">{importResult.newSongsCount}</span>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-xs text-blue-400 uppercase tracking-wider block mb-1">Existing Songs</span>
                <span className="text-2xl font-bold text-blue-400">{importResult.existingSongsCount}</span>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-xs text-red-400 uppercase tracking-wider block mb-1">Failed Items</span>
                <span className="text-2xl font-bold text-red-400">{importResult.failedCount}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              {importResult.playlistId && !isFailed && (
                <Link
                  to={`/playlists/${importResult.playlistId}`}
                  className="bg-white text-black font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2 hover:scale-[1.02] transition-transform text-sm"
                >
                  <ExternalLink size={18} />
                  <span>View Public Playlist</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setImportResult(null);
                  setUrl('');
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-2xl transition-colors text-sm"
              >
                Import Another Playlist
              </button>
            </div>
          </div>
        );
      })()}

      {/* Playlist Preview & Selection */}
      {playlistData && !importing && (
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-[#111112] p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-56 aspect-square rounded-2xl overflow-hidden bg-black/50 border border-white/10 relative shrink-0 shadow-lg">
              {playlistData.thumbnailUrl ? (
                <img
                  src={playlistData.thumbnailUrl}
                  alt={playlistData.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ListMusic size={48} className="text-white/20" />
                </div>
              )}
              <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider shadow">
                YouTube
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/40">
                  Playlist Preview • {playlistData.totalVideos} Tracks
                </span>
                <span className="text-xs text-white/40">
                  Author: <strong className="text-white">{playlistData.author}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Playlist Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white font-bold text-lg outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Playlist Description
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  rows={2}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white/80 text-sm outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-white/50">
                  Selected: <strong className="text-white">{selectedCount}</strong> of {playlistData.videos.length} tracks
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-xs text-white/60 hover:text-white underline transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-xs text-white/60 hover:text-white underline transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between bg-[#111112] p-4 px-6 rounded-2xl border border-white/5 sticky top-4 z-20 backdrop-blur-xl">
            <div className="text-sm">
              Ready to import <strong className="text-white">{selectedCount}</strong> songs into SBG library
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPlaylistData(null)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={selectedCount === 0 || importing}
                className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>Import {selectedCount} Tracks</span>
              </button>
            </div>
          </div>

          {/* Video List Table */}
          <div className="bg-[#111112] rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Tracks in Playlist (Preserving Exact Order)</h2>
              <div className="flex items-center gap-4 text-xs text-white/40">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Already in Library
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> New Track
                </span>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {playlistData.videos.map((video, idx) => (
                <div
                  key={video.videoId + '-' + idx}
                  className={`p-4 flex items-center gap-4 transition-colors ${
                    video.selected ? 'bg-black/20 hover:bg-white/5' : 'opacity-40 bg-black/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelectVideo(idx)}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      video.selected
                        ? 'bg-white border-white text-black'
                        : 'border-white/20 bg-transparent text-transparent hover:border-white/40'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>

                  <span className="font-mono text-xs text-white/40 w-6 text-right shrink-0">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>

                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        value={video.title}
                        onChange={(e) => updateTrackField(idx, 'title', e.target.value)}
                        placeholder="Song Title"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:border-white/30 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={video.artist}
                        onChange={(e) => updateTrackField(idx, 'artist', e.target.value)}
                        placeholder="Artist / Channel"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:border-white/30 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {video.isExisting ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Linked
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                        New
                      </span>
                    )}
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/30 hover:text-white p-1.5 transition-colors"
                      title="Watch on YouTube"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
