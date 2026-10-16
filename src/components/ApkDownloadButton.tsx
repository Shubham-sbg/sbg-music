import React, { useState, useRef } from 'react';
import { Download, CheckCircle2, AlertCircle, RefreshCw, X, Clock, Zap, Smartphone } from 'lucide-react';
import { AndroidRelease } from '../types';
import { resolveDirectDownloadUrl, recordApkDownload } from '../lib/apkReleaseService';

interface ApkDownloadButtonProps {
  release?: AndroidRelease | null;
  apkUrl?: string;
  filename?: string;
  version?: string;
  buttonText?: string;
  className?: string;
  size?: 'normal' | 'large' | 'compact';
  onDownloadStarted?: () => void;
  onDownloadFinished?: () => void;
}

export default function ApkDownloadButton({
  release,
  apkUrl = '/downloads/sbg-music.apk',
  filename = 'SBG-Music-v2.4.0.apk',
  version = '2.4.0',
  buttonText,
  className = '',
  size = 'large',
  onDownloadStarted,
  onDownloadFinished,
}: ApkDownloadButtonProps) {
  const effectiveVersion = release?.versionName || version;
  const effectiveFilename = release?.fileName || filename;
  const effectiveButtonText = release?.downloadButtonText || buttonText || `Download Android APK (v${effectiveVersion})`;
  const [status, setStatus] = useState<'idle' | 'connecting' | 'downloading' | 'completed' | 'error'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [loadedBytes, setLoadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [speedMBps, setSpeedMBps] = useState<string>('0.0 MB/s');
  const [remainingTimeText, setRemainingTimeText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(0);
  const lastLoadedBytesRef = useRef<number>(0);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format remaining seconds into human readable ETA
  const formatEta = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '< 1s remaining';
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s remaining`;
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setProgressPercent(0);
    setLoadedBytes(0);
    setErrorMessage(null);
  };

  const triggerDirectBrowserDownload = (targetUrl: string, targetFilename: string) => {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.setAttribute('download', targetFilename);
    if (targetUrl.startsWith('http')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatus('completed');
    setRemainingTimeText('Download started');
    setSpeedMBps('Finished');
    onDownloadFinished?.();

    setTimeout(() => {
      setStatus('idle');
      setProgressPercent(0);
    }, 5000);
  };

  const handleStartDownload = async () => {
    if (status === 'downloading' || status === 'connecting') return;

    setStatus('connecting');
    setProgressPercent(2);
    setLoadedBytes(0);
    setErrorMessage(null);
    setSpeedMBps('Connecting...');
    setRemainingTimeText('Calculating...');

    onDownloadStarted?.();

    // 1. Resolve fresh direct download URL (from Firebase Storage if storagePath present)
    let directUrl = apkUrl;
    if (release) {
      try {
        directUrl = await resolveDirectDownloadUrl(release);
      } catch (e) {
        console.warn('Could not resolve direct URL for release:', e);
      }
    }

    // Record download event in background
    if (release) {
      recordApkDownload(release.id, release.versionName).catch(() => {});
    } else {
      recordApkDownload(undefined, effectiveVersion).catch(() => {});
    }

    // 2. If it is an external Firebase Storage URL or CDN, initiate direct browser download
    // to avoid cross-origin CORS restriction on in-memory streaming
    if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
      triggerDirectBrowserDownload(directUrl, effectiveFilename);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(directUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: Failed to download APK.`);
      }

      setStatus('downloading');
      const contentLengthHeader = response.headers.get('content-length');
      const parsedTotal = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (release?.fileSizeBytes || 36000000);
      setTotalBytes(parsedTotal);

      startTimeRef.current = Date.now();
      lastSampleTimeRef.current = Date.now();
      lastLoadedBytesRef.current = 0;

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            setLoadedBytes(receivedBytes);

            const now = Date.now();
            const timeSinceStart = (now - startTimeRef.current) / 1000;
            const timeSinceLastSample = (now - lastSampleTimeRef.current) / 1000;

            // Update speed calculations every 150ms for smooth reading
            if (timeSinceLastSample > 0.15 || receivedBytes === parsedTotal) {
              const bytesDiff = receivedBytes - lastLoadedBytesRef.current;
              const instantBps = timeSinceLastSample > 0 ? bytesDiff / timeSinceLastSample : 0;
              const overallBps = timeSinceStart > 0 ? receivedBytes / timeSinceStart : 0;
              // Blended speed
              const effectiveBps = instantBps > 0 ? (instantBps * 0.6 + overallBps * 0.4) : overallBps;

              // Format MB/s or KB/s
              const speedInMBps = effectiveBps / (1024 * 1024);
              if (speedInMBps >= 0.1) {
                setSpeedMBps(`${speedInMBps.toFixed(2)} MB/s`);
              } else {
                setSpeedMBps(`${(effectiveBps / 1024).toFixed(0)} KB/s`);
              }

              // Calculate ETA
              if (parsedTotal > receivedBytes && effectiveBps > 0) {
                const remainingBytes = parsedTotal - receivedBytes;
                const etaSeconds = remainingBytes / effectiveBps;
                setRemainingTimeText(formatEta(etaSeconds));
              } else {
                setRemainingTimeText('Finishing up...');
              }

              lastSampleTimeRef.current = now;
              lastLoadedBytesRef.current = receivedBytes;
            }

            const pct = parsedTotal > 0 
              ? Math.min(99, Math.round((receivedBytes / parsedTotal) * 100))
              : Math.min(95, Math.round(receivedBytes / 50000 * 100));

            setProgressPercent(pct);
          }
        }
      } else {
        // Fallback for environments without stream reader
        const blobData = await response.blob();
        receivedBytes = blobData.size;
        chunks.push(new Uint8Array(await blobData.arrayBuffer()));
      }

      // Reconstruct complete APK blob
      const apkBlob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      setProgressPercent(100);
      setStatus('completed');
      setRemainingTimeText('Download Complete!');
      setSpeedMBps('Finished');

      // Trigger automatic save to device
      const blobUrl = URL.createObjectURL(apkBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.setAttribute('download', effectiveFilename);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up object URL after delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 30000);

      onDownloadFinished?.();

      // Reset to idle after 6 seconds
      setTimeout(() => {
        setStatus('idle');
        setProgressPercent(0);
      }, 6000);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      console.warn('In-browser stream encountered issue, initiating direct browser download:', err);
      triggerDirectBrowserDownload(directUrl, effectiveFilename);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // 1. DOWNLOADING / CONNECTING ACTIVE STATE
  if (status === 'downloading' || status === 'connecting') {
    return (
      <div className={`w-full max-w-md bg-[#16161c] border border-purple-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn ${className}`}>
        {/* Top Header Row with Status & Cancel */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
            </div>
            <span className="font-extrabold text-white truncate">
              {status === 'connecting' ? 'Connecting to Official Mirror...' : 'Downloading APK...'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-extrabold text-purple-400 text-sm">
              {progressPercent}%
            </span>
            <button
              onClick={handleCancel}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Cancel download"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="relative h-3 w-full bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full transition-all duration-200 shadow-[0_0_12px_rgba(168,85,247,0.5)] relative"
          >
            {/* Shimmer sweep animation */}
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </div>
        </div>

        {/* Metrics Row: Speed, Remaining Time, Downloaded vs Total */}
        <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] font-mono">
          {/* Download Speed */}
          <div className="flex items-center gap-1.5 text-white/80">
            <Zap size={13} className="text-yellow-400 shrink-0" />
            <span className="truncate">{speedMBps}</span>
          </div>

          {/* Remaining Time */}
          <div className="flex items-center justify-center gap-1.5 text-white/80">
            <Clock size={13} className="text-purple-300 shrink-0" />
            <span className="truncate">{remainingTimeText}</span>
          </div>

          {/* Bytes count */}
          <div className="text-right text-white/60 truncate">
            {formatBytes(loadedBytes)} / {formatBytes(totalBytes || 72000)}
          </div>
        </div>
      </div>
    );
  }

  // 2. COMPLETED STATE
  if (status === 'completed') {
    return (
      <div className={`w-full max-w-md bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 text-xs animate-fadeIn ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-extrabold text-white text-sm">Download Finished!</div>
            <div className="text-[11px] text-emerald-300/80 truncate">
              {filename} ({formatBytes(loadedBytes)}) saved to device.
            </div>
          </div>
        </div>

        <button
          onClick={handleStartDownload}
          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          Re-download
        </button>
      </div>
    );
  }

  // 3. ERROR STATE
  if (status === 'error') {
    return (
      <div className={`w-full max-w-md bg-red-950/40 border border-red-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 text-xs animate-fadeIn ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white">Download Interrupted</div>
            <div className="text-[11px] text-red-300/80 truncate">{errorMessage}</div>
          </div>
        </div>

        <button
          onClick={handleStartDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow"
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 4. DEFAULT IDLE BUTTON (Compact vs Large Hero)
  if (size === 'compact') {
    return (
      <button
        onClick={handleStartDownload}
        className={`w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${className}`}
      >
        <Download size={15} />
        <span>Direct Download APK</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleStartDownload}
      className={`w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer ${className}`}
    >
      <Download size={20} className="animate-bounce" />
      <span>{effectiveButtonText}</span>
    </button>
  );
}
