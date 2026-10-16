import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  HardDrive, 
  WifiOff, 
  Music, 
  Copy, 
  Check, 
  Sparkles, 
  Cpu, 
  FileCode, 
  Layers, 
  Headphones,
  ArrowRight,
  QrCode,
  TrendingUp,
  Activity,
  FolderArchive,
  CloudDownload
} from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AndroidRelease } from '../types';
import { 
  DEFAULT_STANDALONE_RELEASE, 
  subscribeToActiveRelease, 
  getActiveRelease, 
  triggerDirectApkDownload,
  formatBytes
} from '../lib/apkReleaseService';
import SBGMusicLogo from '../components/SBGMusicLogo';
import DownloadQRCode from '../components/DownloadQRCode';
import ApkDownloadButton from '../components/ApkDownloadButton';
import NearbyShareHelper from '../components/NearbyShareHelper';
import InstallFaqSection from '../components/InstallFaqSection';
import { useSeo } from '../hooks/useSeo';

export default function DownloadApp() {
  const [activeRelease, setActiveRelease] = useState<AndroidRelease>(DEFAULT_STANDALONE_RELEASE);
  const [loadingRelease, setLoadingRelease] = useState<boolean>(true);
  const [copiedChecksum, setCopiedChecksum] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadCount, setDownloadCount] = useState<number>(1485);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  const BASELINE_DOWNLOADS = 1485;

  // 1. DYNAMICALLY FETCH & SUBSCRIBE TO DEFAULT ANDROID RELEASE
  useEffect(() => {
    let isMounted = true;

    // Load initial cached or fetched release
    getActiveRelease(false)
      .then((rel) => {
        if (isMounted && rel) {
          setActiveRelease(rel);
          setLoadingRelease(false);
        }
      })
      .catch((err) => console.warn('[DownloadApp] Initial release load error:', err));

    // Subscribe in real-time to active default release in Firestore
    const unsubscribeRelease = subscribeToActiveRelease((updatedRelease) => {
      if (isMounted && updatedRelease) {
        setActiveRelease(updatedRelease);
        setLoadingRelease(false);
      }
    });

    // Also listen to app-wide release update events
    const handleReleaseEvent = () => {
      getActiveRelease(true).then((fresh) => {
        if (isMounted && fresh) {
          setActiveRelease(fresh);
        }
      });
    };
    window.addEventListener('sbg:apk-release-updated', handleReleaseEvent);

    return () => {
      isMounted = false;
      unsubscribeRelease();
      window.removeEventListener('sbg:apk-release-updated', handleReleaseEvent);
    };
  }, []);

  // 2. REALTIME DOWNLOAD COUNTER STATS
  useEffect(() => {
    const statDocRef = doc(db, 'app_stats', 'downloads');
    const unsubscribeStats = onSnapshot(
      statDocRef,
      (snapshot) => {
        setIsLiveConnected(true);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const count = typeof data?.count === 'number' ? data.count : 0;
          setDownloadCount(Math.max(BASELINE_DOWNLOADS, count));
        } else {
          setDoc(statDocRef, { count: BASELINE_DOWNLOADS, lastDownloadedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        }
      },
      (error) => {
        console.warn('[Firestore Live Downloads] Fallback to REST API sync:', error?.message || error);
        setIsLiveConnected(false);
        fetch('/api/downloads/count')
          .then((res) => res.json())
          .then((data) => {
            if (data && typeof data.totalDownloads === 'number') {
              setDownloadCount(Math.max(BASELINE_DOWNLOADS, data.totalDownloads));
            }
          })
          .catch(() => {});
      }
    );

    return () => unsubscribeStats();
  }, []);

  useSeo({
    title: `Download Official SBG MUSIC Android APK v${activeRelease.versionName} | Free & Offline Streaming`,
    description: `Download the official signed SBG MUSIC Android App (v${activeRelease.versionName}). Enjoy offline music downloads, lyrics sync, background playback, and curated playlists on your mobile device.`,
    canonicalUrl: `${typeof window !== 'undefined' ? window.location.origin : 'https://sbg-songs.ai.studio'}/download`,
  });

  const handleCopyChecksum = () => {
    if (!activeRelease.sha256) return;
    navigator.clipboard.writeText(activeRelease.sha256);
    setCopiedChecksum(true);
    setTimeout(() => setCopiedChecksum(false), 2500);
  };

  const handleManualDirectDownload = async () => {
    setIsDownloading(true);
    setDownloadCount((prev) => prev + 1);

    try {
      await triggerDirectApkDownload(activeRelease);
    } catch (err) {
      console.warn('Manual direct APK download failed:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 2500);
    }
  };

  // Format release date into readable string
  const formatReleaseDate = (timestamp?: number): string => {
    if (!timestamp) return 'October 2026';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'October 2026';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' });
  };

  // Dynamic release notes list
  const releaseNotesList = (() => {
    if (!activeRelease.releaseNotes || !activeRelease.releaseNotes.trim()) {
      return [
        'User Offline Storage: Download eligible SBG catalog songs straight to your device storage with real-time progress indicators.',
        'Dual Catalog Support: Stream YouTube discovery songs alongside official high-bitrate SBG Music audio releases.',
        'Synchronized LRC Lyrics: Sing along with accurate word-by-word synced lyrics powered by automated catalog analysis.',
        'Persistent Media Controls: Notification tray media controls, lock screen metadata, and Bluetooth car integration.',
        'Battery & Data Saver: Intelligent audio caching minimizes network polling when you are on limited cellular data.'
      ];
    }
    return activeRelease.releaseNotes
      .split('\n')
      .map((s) => s.replace(/^[•\-\*]\s*/, '').trim())
      .filter(Boolean);
  })();

  // Dynamic install instructions
  const installInstructionsList = (() => {
    if (!activeRelease.installInstructions || !activeRelease.installInstructions.trim()) {
      return [
        {
          title: 'Download the APK',
          text: 'Tap the "Download Android APK" button above to get the official installer package directly from official cloud storage.'
        },
        {
          title: 'Allow Unknown Sources',
          text: 'If your browser prompts "File might be harmful", tap Download Anyway. In Android Settings, allow installation from your browser.'
        },
        {
          title: 'Open and Install',
          text: 'Tap the downloaded file in your notification bar and choose Install.'
        },
        {
          title: 'Sign In & Enjoy',
          text: 'Log in with your Google Account to automatically sync all your existing playlists, favorites, and library!'
        }
      ];
    }
    return activeRelease.installInstructions
      .split('\n')
      .map((line) => line.replace(/^[0-9]+[\.\)]\s*/, '').trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(':');
        if (parts.length > 1) {
          return { title: parts[0].trim(), text: parts.slice(1).join(':').trim() };
        }
        return { title: '', text: line };
      });
  })();

  const effectiveFileSize = activeRelease.fileSizeFormatted || formatBytes(activeRelease.fileSizeBytes) || '35.2 MB';

  return (
    <div className="flex-1 flex flex-col gap-6 sm:gap-10 max-w-6xl mx-auto w-full px-3.5 sm:px-6 md:px-8 py-4 sm:py-8 pb-36 overflow-x-hidden min-w-0">
      
      {/* 1. HERO DOWNLOAD SHOWCASE (Refactored mobile vertical stack prioritizing ApkDownloadButton & DownloadQRCode within first scroll-length) */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#181820] to-[#0e0e12] border border-white/10 p-3.5 xs:p-4 sm:p-8 md:p-12 shadow-2xl min-w-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-5 sm:gap-6 lg:gap-12 min-w-0 w-full">
          
          {/* Main Info Column (Full width on mobile below 1024px) */}
          <div className="w-full flex-1 space-y-2.5 sm:space-y-4 md:space-y-5 text-center lg:text-left min-w-0">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={13} className="text-purple-400 shrink-0" />
              <span className="truncate">Official Signed Release • v{activeRelease.versionName}</span>
            </div>

            <h1 className="text-xl xs:text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              SBG MUSIC for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">Android</span>
            </h1>

            <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed line-clamp-2 sm:line-clamp-none">
              Carry your entire music world everywhere. Download songs to your device storage, stream seamlessly with zero data cost, read synchronized lyrics, and sync your playlists across devices.
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-3 text-[11px] sm:text-xs text-white/80 pt-0.5">
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl">
                <Smartphone size={12} className="text-purple-400" />
                <span>v{activeRelease.versionName}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl">
                <HardDrive size={12} className="text-emerald-400" />
                <span>{effectiveFileSize}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl">
                <WifiOff size={12} className="text-amber-400" />
                <span>Offline Storage</span>
              </div>
            </div>

            {/* PRIMARY ACTION BLOCK (Full width vertical stack below 1024px) */}
            <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2 w-full min-w-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-2.5 sm:gap-3 w-full min-w-0">
                <div className="w-full sm:flex-1 lg:flex-initial min-w-0">
                  <ApkDownloadButton
                    release={activeRelease}
                    apkUrl={activeRelease.downloadUrl}
                    filename={activeRelease.fileName || `SBG-Music-v${activeRelease.versionName}.apk`}
                    version={activeRelease.versionName}
                    buttonText={activeRelease.downloadButtonText}
                    size="large"
                    className="w-full sm:w-auto"
                    onDownloadStarted={() => {
                      setDownloadCount((prev) => prev + 1);
                    }}
                  />
                </div>

                <a
                  href="#checksum-section"
                  className="w-full sm:w-auto px-4 py-3 sm:py-4 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shrink-0"
                >
                  <FileCode size={15} className="text-white/60" />
                  <span>Verify SHA-256</span>
                </a>
              </div>

              {/* Real-Time Live Download Counter */}
              <div className="flex items-center justify-center lg:justify-start gap-2 text-xs text-white/80 pt-0.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-emerald-500/20 shadow-inner">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-white/60">Live Installs:</span>
                  <span className="font-extrabold font-mono text-emerald-400 text-[11px] sm:text-xs tracking-wide">
                    {downloadCount.toLocaleString()}+ verified
                  </span>
                  {isLiveConnected && (
                    <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.2 rounded">
                      Live
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-white/40 truncate">
              Direct cloud install package: <span className="font-mono text-white/60">{activeRelease.fileName || `SBG-Music-v${activeRelease.versionName}.apk`}</span>
            </p>
          </div>

          {/* Integrated QR Scanner Card (Stacked vertically on mobile below 1024px, occupying full width) */}
          <div className="w-full max-w-full lg:max-w-sm shrink-0 min-w-0 mx-auto lg:mx-0 pt-2 lg:pt-0">
            <DownloadQRCode 
              release={activeRelease}
              apkPath={activeRelease.downloadUrl}
              filename={activeRelease.fileName || `SBG-Music-v${activeRelease.versionName}.apk`}
              version={activeRelease.versionName}
              size={160} 
            />
          </div>

        </div>
      </section>

      {/* 2. SPECIFICATIONS & SYSTEM REQUIREMENTS (Zero horizontal overflow on 360px) */}
      <section className="bg-[#111116] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
          <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-purple-400" />
            <span>Release Specifications & Compatibility</span>
          </h2>
          {activeRelease.storagePath && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-[11px] font-mono">
              <CloudDownload size={12} />
              <span>Direct Cloud Storage</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs min-w-0">
          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">Package Name</span>
            <span className="font-mono text-white text-xs sm:text-sm font-semibold truncate block">{activeRelease.appName || 'com.sbg.music'}</span>
          </div>

          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">Current Version</span>
            <span className="font-mono text-purple-300 text-xs sm:text-sm font-semibold truncate block">
              v{activeRelease.versionName} {activeRelease.versionCode ? `(Build ${activeRelease.versionCode})` : ''}
            </span>
          </div>

          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">File Size</span>
            <span className="font-mono text-emerald-400 text-xs sm:text-sm font-semibold truncate block">{effectiveFileSize}</span>
          </div>

          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">Release Date</span>
            <span className="text-white text-xs sm:text-sm font-semibold truncate block">{formatReleaseDate(activeRelease.createdAt)}</span>
          </div>

          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">Minimum Android OS</span>
            <span className="text-white text-xs sm:text-sm font-semibold truncate block">{activeRelease.minAndroidVersion || 'Android 5.0+ (Lollipop)'}</span>
          </div>

          <div className="bg-white/5 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
            <span className="text-white/40 font-bold uppercase tracking-wider block mb-1 text-[10px]">Architecture</span>
            <span className="text-white text-xs sm:text-sm font-semibold truncate block">Universal (arm64-v8a, armeabi-v7a, x86_64)</span>
          </div>
        </div>
      </section>

      {/* 3. DYNAMIC CHANGELOG & INSTALL INSTRUCTIONS (Safe text wrapping on 360px) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <div className="bg-[#111116] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-3 sm:space-y-4 min-w-0 overflow-hidden">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400 shrink-0" />
            <span>What's New in v{activeRelease.versionName}</span>
          </h3>
          <ul className="space-y-2.5 text-xs sm:text-sm text-white/70 min-w-0">
            {releaseNotesList.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2.5 min-w-0 break-words">
                <CheckCircle2 size={15} className="text-purple-400 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#111116] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-3 sm:space-y-4 min-w-0 overflow-hidden">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Layers size={16} className="text-pink-400 shrink-0" />
            <span>How to Install on Android</span>
          </h3>
          <ol className="space-y-2.5 text-xs sm:text-sm text-white/70 list-decimal list-inside min-w-0">
            {installInstructionsList.map((item, idx) => (
              <li key={idx} className="leading-relaxed min-w-0 break-words">
                {item.title ? <strong className="text-white">{item.title}: </strong> : null}
                <span className="break-words">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. NEARBY SHARE / QUICK SHARE HELPER */}
      <NearbyShareHelper
        apkUrl={activeRelease.downloadUrl}
        version={activeRelease.versionName}
        filename={activeRelease.fileName || `SBG-Music-v${activeRelease.versionName}.apk`}
      />

      {/* 5. TROUBLESHOOTING & INSTALLATION FAQ SECTION */}
      <InstallFaqSection />

      {/* 6. SHA-256 INTEGRITY VERIFICATION (Safe break-all wrapping on 360px mobile viewports) */}
      <section id="checksum-section" className="bg-[#111116] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-3 sm:space-y-4 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
              <span>Cryptographic Integrity Verification</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Verify that your downloaded APK matches the official build signature.
            </p>
          </div>
          <button
            onClick={handleCopyChecksum}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            {copiedChecksum ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedChecksum ? 'Checksum Copied' : 'Copy SHA-256'}</span>
          </button>
        </div>

        <div className="bg-black/60 border border-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl max-w-full overflow-hidden">
          <span className="text-[10px] sm:text-xs font-mono text-emerald-400 select-all break-all break-words leading-relaxed block w-full">
            {activeRelease.sha256}
          </span>
        </div>
      </section>

    </div>
  );
}
