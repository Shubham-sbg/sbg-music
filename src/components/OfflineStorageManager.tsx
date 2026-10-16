import React, { useState, useEffect, useCallback } from 'react';
import { 
  HardDrive, 
  Trash2, 
  Download, 
  Play, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Music, 
  FileAudio, 
  Smartphone, 
  Clock, 
  Layers, 
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react';
import { 
  OfflineDownloadService, 
  StoredOfflineTrack 
} from '../services/offlineDownloadService';
import { usePlayer } from '../context/PlayerContext';
import { Song } from '../types';

export default function OfflineStorageManager() {
  const { playSong, currentSong, isPlaying } = usePlayer();

  const [tracks, setTracks] = useState<StoredOfflineTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'title'>('date');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [storageStats, setStorageStats] = useState<{
    usedBytes: number;
    trackCount: number;
    quotaBytes?: number;
    availableBytes?: number;
  }>({
    usedBytes: 0,
    trackCount: 0,
  });

  const formatBytes = (bytes: number, decimals = 1): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const loadOfflineData = useCallback(async () => {
    try {
      const [allTracks, metrics] = await Promise.all([
        OfflineDownloadService.getAllDownloadedTracks(),
        OfflineDownloadService.getStorageMetrics(),
      ]);
      setTracks(allTracks);
      setStorageStats(metrics);
    } catch (e) {
      console.error('Failed to load offline storage data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfflineData();

    const unsubscribe = OfflineDownloadService.subscribeToStateChanges(() => {
      loadOfflineData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadOfflineData]);

  const handleDeleteTrack = async (songId: string, songTitle: string) => {
    setDeletingId(songId);
    try {
      await OfflineDownloadService.removeDownload(songId);
      setActionFeedback(`Deleted "${songTitle}" from offline storage.`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (e) {
      console.error('Failed to delete offline track:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await OfflineDownloadService.removeAllDownloads();
      setShowConfirmDeleteAll(false);
      setActionFeedback('All offline tracks and cached audio assets deleted.');
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (e) {
      console.error('Failed to purge offline tracks:', e);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handlePlayOfflineTrack = async (item: StoredOfflineTrack) => {
    const offlineUrl = await OfflineDownloadService.getOfflinePlaybackUrl(item.songId);
    const songToPlay: Song = {
      ...item.song,
      audioUrl: offlineUrl || item.song.audioUrl,
    };
    playSong(songToPlay, [songToPlay], undefined, 0, 'Offline Storage');
  };

  // Filter & Sort
  const filteredTracks = tracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.song?.title || '').toLowerCase().includes(q) ||
      (t.song?.artist || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'size') {
      return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
    }
    if (sortBy === 'title') {
      return (a.song?.title || '').localeCompare(b.song?.title || '');
    }
    return (b.downloadedAt || 0) - (a.downloadedAt || 0);
  });

  // Calculate Storage Proportions
  const sbgUsedBytes = storageStats.usedBytes || 0;
  const totalDeviceQuota = storageStats.quotaBytes || 32 * 1024 * 1024 * 1024; // default estimate 32 GB
  const freeDeviceBytes = storageStats.availableBytes || Math.max(0, totalDeviceQuota - sbgUsedBytes);
  const otherDeviceUsedBytes = Math.max(0, totalDeviceQuota - freeDeviceBytes - sbgUsedBytes);

  const sbgPercent = totalDeviceQuota > 0 ? (sbgUsedBytes / totalDeviceQuota) * 100 : 0;
  const otherPercent = totalDeviceQuota > 0 ? (otherDeviceUsedBytes / totalDeviceQuota) * 100 : 0;
  const freePercent = Math.max(0, 100 - sbgPercent - otherPercent);

  return (
    <div className="bg-gradient-to-b from-[#16161a] to-[#0e0e11] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <HardDrive size={18} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Offline Storage Manager
            </h2>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Manage device-local audio files for playback without internet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadOfflineData}
            title="Refresh Storage Info"
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/10 transition-all active:scale-95"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {tracks.length > 0 && (
            <button
              onClick={() => setShowConfirmDeleteAll(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              <Trash2 size={14} />
              <span>Delete All ({tracks.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionFeedback && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-medium animate-fadeIn">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Visual Storage Breakdown */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Smartphone size={14} className="text-purple-400" />
            Device Storage Breakdown
          </span>
          <span className="text-white/40">
            Total Allocated: <strong className="text-white">{formatBytes(totalDeviceQuota)}</strong>
          </span>
        </div>

        {/* Multi-Segment Storage Bar */}
        <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex p-0.5 border border-white/10">
          {/* SBG Music segment */}
          <div
            style={{ width: `${Math.max(sbgPercent, sbgUsedBytes > 0 ? 3 : 0)}%` }}
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-l-full transition-all duration-500"
            title={`SBG Music: ${formatBytes(sbgUsedBytes)}`}
          />
          {/* Other apps segment */}
          <div
            style={{ width: `${Math.max(otherPercent, 2)}%` }}
            className="h-full bg-zinc-600/80 transition-all duration-500"
            title={`Other Apps / System: ${formatBytes(otherDeviceUsedBytes)}`}
          />
          {/* Free space segment */}
          <div
            style={{ width: `${Math.max(freePercent, 2)}%` }}
            className="h-full bg-emerald-500/20 rounded-r-full transition-all duration-500"
            title={`Free Device Space: ${formatBytes(freeDeviceBytes)}`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-white/50 block truncate">SBG Music</span>
              <strong className="text-white block truncate">{formatBytes(sbgUsedBytes)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-white/50 block truncate">Other Data</span>
              <strong className="text-white block truncate">{formatBytes(otherDeviceUsedBytes)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />
            <div className="min-w-0">
              <span className="text-white/50 block truncate">Free Space</span>
              <strong className="text-white block truncate">{formatBytes(freeDeviceBytes)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">
            Downloaded
          </span>
          <span className="text-lg font-bold text-purple-400 mt-0.5 block">
            {tracks.length} <span className="text-xs font-normal text-white/50">tracks</span>
          </span>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">
            SBG Storage
          </span>
          <span className="text-lg font-bold text-white mt-0.5 block">
            {formatBytes(sbgUsedBytes)}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">
            Available Free
          </span>
          <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
            {formatBytes(freeDeviceBytes)}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">
            Device Isolation
          </span>
          <span className="text-xs font-bold text-blue-400 mt-1.5 flex items-center justify-center gap-1">
            <ShieldCheck size={13} /> App-Specific
          </span>
        </div>
      </div>

      {/* Downloaded Tracks Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileAudio size={16} className="text-purple-400" />
            Downloaded Tracks ({filteredTracks.length})
          </h3>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search downloads..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              aria-label="Sort downloaded tracks"
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="date" className="bg-zinc-900 text-white">Latest</option>
              <option value="size" className="bg-zinc-900 text-white">Size (Largest)</option>
              <option value="title" className="bg-zinc-900 text-white">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tracks List */}
        {tracks.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/30">
              <Download size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">No Offline Tracks Downloaded</h4>
              <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
                Tap the download button on any authorized SBG track to save it to your device for offline playback.
              </p>
            </div>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/40 border border-white/5 rounded-2xl">
            No downloaded tracks match "{searchQuery}".
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredTracks.map((item) => {
              const isCurrentPlaying = currentSong?.id === item.songId && isPlaying;
              const formattedDate = new Date(item.downloadedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={item.songId}
                  className="flex items-center justify-between gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-2xl transition-all group"
                >
                  {/* Track Info & Play Action */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                      {item.song?.imageUrl || item.song?.coverUrl || item.song?.customCoverUrl ? (
                        <img
                          src={item.song.imageUrl || item.song.coverUrl || item.song.customCoverUrl}
                          alt={item.song?.title || 'Track'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music size={16} className="text-white/30" />
                      )}
                      <button
                        onClick={() => handlePlayOfflineTrack(item)}
                        title="Play Offline"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      >
                        <Play size={16} className="fill-current text-purple-400" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.song?.title || 'Untitled Track'}
                        </h4>
                        {isCurrentPlaying && (
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/50 truncate">
                        {item.song?.artist || 'SBG MUSIC'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Tags & Delete Action */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right hidden xs:block">
                      <span className="text-xs font-bold text-white/80 block">
                        {formatBytes(item.fileSizeBytes || 0)}
                      </span>
                      <span className="text-[10px] text-white/40 block">
                        {formattedDate}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-[10px] font-mono">
                      Offline
                    </span>

                    <button
                      onClick={() => handleDeleteTrack(item.songId, item.song?.title || 'Track')}
                      disabled={deletingId === item.songId}
                      title="Delete from device storage"
                      className="p-2 text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-xl border border-white/5 hover:border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} className={deletingId === item.songId ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete All Confirmation Modal */}
      {showConfirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#18181c] border border-red-500/30 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Delete All Offline Music?</h3>
              <p className="text-xs text-white/60 mt-1.5">
                This will delete all {tracks.length} downloaded tracks ({formatBytes(sbgUsedBytes)}) and purge cached audio from your device's internal storage.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmDeleteAll(false)}
                disabled={isDeletingAll}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>{isDeletingAll ? 'Deleting...' : 'Purge All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
