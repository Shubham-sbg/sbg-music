import React, { useState, useEffect } from 'react';
import { WifiOff, CloudUpload, Check, X, RefreshCw } from 'lucide-react';
import { getPendingSyncSummary, triggerImmediateSync, SyncCountSummary } from '../services/backgroundSyncService';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState<SyncCountSummary>({ analyticsCount: 0, playlistsCount: 0, total: 0 });
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerImmediateSync('all');
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getPendingSyncSummary().then(setPendingSync).catch(() => {});

    const handlePendingChange = (e: any) => {
      if (e.detail) setPendingSync(e.detail);
    };

    const handleSyncComplete = (e: any) => {
      setSyncToast('Offline updates reliably synced via Background Sync!');
      getPendingSyncSummary().then(setPendingSync).catch(() => {});
      setTimeout(() => setSyncToast(null), 3500);
    };

    window.addEventListener('sbg_pending_sync_changed', handlePendingChange);
    window.addEventListener('sbg_sync_completed', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sbg_pending_sync_changed', handlePendingChange);
      window.removeEventListener('sbg_sync_completed', handleSyncComplete);
    };
  }, []);

  if (syncToast) {
    return (
      <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-200 px-4 py-2 text-xs font-semibold backdrop-blur-md sticky top-16 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{syncToast}</span>
        </div>
        <button onClick={() => setSyncToast(null)} className="p-1 hover:bg-white/10 rounded cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!isOffline && pendingSync.total === 0) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 px-4 py-2 text-xs font-medium backdrop-blur-md sticky top-16 z-30 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 overflow-hidden">
        {isOffline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-white">Offline Mode Active</span>
            <span className="hidden sm:inline text-amber-200/80">
              — Cached songs and static assets remain fully playable without connection.
            </span>
          </>
        ) : (
          <>
            <CloudUpload className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="font-bold text-white">Background Sync Queue</span>
          </>
        )}
        {pendingSync.total > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-[10px]">
            {pendingSync.total} update{pendingSync.total > 1 ? 's' : ''} queued
          </span>
        )}
      </div>

      {pendingSync.total > 0 && (
        <button
          onClick={() => triggerImmediateSync('all')}
          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync Now</span>
        </button>
      )}
    </div>
  );
}
