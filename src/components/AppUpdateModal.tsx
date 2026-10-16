import React, { useState } from 'react';
import { 
  Sparkles, 
  Download, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Smartphone, 
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';
import { AppVersionInfo, CURRENT_APP_VERSION } from '../services/versionCheckService';
import { useNavigate } from 'react-router-dom';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppVersionInfo | null;
}

export default function AppUpdateModal({
  isOpen,
  onClose,
  updateInfo,
}: AppUpdateModalProps) {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  if (!isOpen || !updateInfo) return null;

  const targetVersion = updateInfo.versionName || '2.4.0';
  const downloadUrl = updateInfo.downloadUrl || '/downloads/sbg-music.apk';
  const sizeText = updateInfo.sizeFormatted || '0.07 MB';
  const releaseNotes = updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0
    ? updateInfo.releaseNotes
    : [
        'New Offline Storage manager with 1-tap device storage cleaner',
        'Free Polyphonic AI Music Studio (Zero-cost client audio synthesis)',
        'Streaming APK downloader with real-time speed (MB/s) and remaining ETA',
        'Nearby Share & Quick Share QR Code Generator',
        'Android 14/15 Media permissions troubleshooting guides',
      ];

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(10);

    try {
      // Simulate/trigger fast streaming download
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev === null || prev >= 90) {
            clearInterval(interval);
            return 95;
          }
          return prev + 25;
        });
      }, 150);

      // Trigger native browser download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `SBG-Music-v${targetVersion}.apk`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        clearInterval(interval);
        setDownloadProgress(100);
        setIsDownloading(false);
      }, 1000);
    } catch {
      setIsDownloading(false);
      setDownloadProgress(null);
      // Fallback: navigate directly to download center
      navigate('/download');
      onClose();
    }
  };

  const handleGoToDownloadPage = () => {
    onClose();
    navigate('/download');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[#121216] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={13} className="text-purple-400" />
              <span>New Update Available</span>
            </div>
            <h2 id="update-modal-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight pt-1">
              SBG MUSIC v{targetVersion}
            </h2>
          </div>

          {!updateInfo.forceUpdate && (
            <button
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Dismiss update dialog"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Version Comparison Card */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 relative z-10">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Installed</span>
            <span className="text-sm font-semibold text-white/70 font-mono">v{CURRENT_APP_VERSION}</span>
          </div>

          <div className="flex items-center gap-2 text-purple-400">
            <div className="h-0.5 w-6 bg-purple-500/30" />
            <ArrowRight size={16} />
            <div className="h-0.5 w-6 bg-purple-500/30" />
          </div>

          <div className="text-center sm:text-right">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Latest Release</span>
            <span className="text-sm font-bold text-white font-mono flex items-center justify-end gap-1">
              v{targetVersion}
              <CheckCircle2 size={13} className="text-emerald-400" />
            </span>
          </div>
        </div>

        {/* Release Notes */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="font-bold uppercase tracking-wider text-[11px] text-white/70">What's New in This Version:</span>
            <span className="font-mono text-purple-300">{sizeText}</span>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-2.5 custom-scrollbar text-xs text-white/80">
            {releaseNotes.map((note, index) => (
              <div key={index} className="flex items-start gap-2.5 leading-relaxed">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Download Progress Bar (if active) */}
        {isDownloading && (
          <div className="space-y-1.5 bg-purple-950/30 border border-purple-500/20 p-3 rounded-2xl relative z-10 animate-fadeIn">
            <div className="flex justify-between text-[11px] font-bold text-purple-300">
              <span>Fetching update package...</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress || 20}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 relative z-10">
          <button
            onClick={handleStartDownload}
            disabled={isDownloading}
            className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Downloading APK...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Download Update (v{targetVersion})</span>
              </>
            )}
          </button>

          <button
            onClick={handleGoToDownloadPage}
            className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Download Center</span>
            <ExternalLink size={13} className="text-white/40" />
          </button>

          {!updateInfo.forceUpdate && (
            <button
              onClick={onClose}
              className="w-full sm:w-auto py-3 px-4 text-xs font-semibold text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              Remind Later
            </button>
          )}
        </div>

        {/* Security / Verification Badge */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-white/40 pt-1 relative z-10">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-400" />
            Official Signed Package
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Smartphone size={12} className="text-purple-400" />
            Compatible with Android 5.0 - 15
          </span>
        </div>
      </div>
    </div>
  );
}
