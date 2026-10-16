import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Radio, 
  Share2, 
  Smartphone, 
  Wifi, 
  Check, 
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Info, 
  Copy, 
  ExternalLink, 
  ArrowRight, 
  Send, 
  Loader2, 
  SlidersHorizontal,
  QrCode,
  Download,
  X,
  Sparkles
} from 'lucide-react';

interface NearbyShareHelperProps {
  apkUrl?: string;
  version?: string;
  filename?: string;
}

export default function NearbyShareHelper({
  apkUrl = '/downloads/sbg-music.apk',
  version = '2.4.0',
  filename = 'SBG-Music-v2.4.0.apk',
}: NearbyShareHelperProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getFullDownloadUrl = () => {
    if (apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) {
      return apkUrl;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sbg-song.vercel.app';
    return `${origin}${apkUrl}`;
  };

  // Render QR Code onto canvas whenever modal opens
  useEffect(() => {
    if (showQrModal && qrCanvasRef.current) {
      const fullUrl = getFullDownloadUrl();
      QRCode.toCanvas(
        qrCanvasRef.current,
        fullUrl,
        {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error('Failed to generate share QR code:', error);
        }
      );
    }
  }, [showQrModal, apkUrl]);

  const handleCopyDirectUrl = () => {
    navigator.clipboard.writeText(getFullDownloadUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadQrPng = () => {
    if (!qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `SBG-Music-v${version}-Download-QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareDirectUrl = async () => {
    const fullUrl = getFullDownloadUrl();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'SBG MUSIC Android App',
          text: `Download and install SBG MUSIC v${version} APK on your device:`,
          url: fullUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyDirectUrl();
        }
      }
    } else {
      handleCopyDirectUrl();
    }
  };

  const handleTriggerNearbyShare = async () => {
    setIsSharing(true);
    setFeedback({ type: 'info', message: 'Preparing SBG-Music APK for Quick Share / Nearby Share...' });

    try {
      const fullUrl = getFullDownloadUrl();

      // Check if Web Share API with File sharing is supported
      if (typeof navigator !== 'undefined' && navigator.share) {
        let apkFile: File | null = null;

        try {
          // Fetch the real APK blob to pass as a native attachment
          const response = await fetch(apkUrl);
          if (response.ok) {
            const blob = await response.blob();
            apkFile = new File([blob], filename, {
              type: 'application/vnd.android.package-archive',
            });
          }
        } catch (fetchErr) {
          console.warn('Could not bundle raw APK file blob for share intent:', fetchErr);
        }

        // 1. Try file-based sharing first (Triggers native Android Share Sheet with Quick Share at top)
        if (apkFile && navigator.canShare && navigator.canShare({ files: [apkFile] })) {
          await navigator.share({
            title: 'SBG MUSIC Android App',
            text: `Install SBG MUSIC v${version} on your Android device (Offline playback & lyrics).`,
            files: [apkFile],
          });
          setFeedback({ type: 'success', message: 'Opened Android Share Sheet! Tap Quick Share or Nearby Share to send.' });
          setTimeout(() => setFeedback(null), 5000);
          return;
        }

        // 2. Fallback to link & message sharing if file array unsupported by browser
        await navigator.share({
          title: 'SBG MUSIC Android App',
          text: `Download and install SBG MUSIC v${version} APK on your device:`,
          url: fullUrl,
        });
        setFeedback({ type: 'success', message: 'Shared installer link via Android intent.' });
        setTimeout(() => setFeedback(null), 4000);
        return;
      }

      // 3. Fallback for desktop or non-sharing browsers: Copy direct installer link
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setFeedback({ type: 'info', message: 'Share API not available on this browser. Official APK link copied to clipboard!' });
      setTimeout(() => {
        setCopiedLink(false);
        setFeedback(null), 4000;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setFeedback(null);
        return;
      }
      console.warn('Share intent error:', err);
      // Fallback copy
      navigator.clipboard.writeText(getFullDownloadUrl());
      setCopiedLink(true);
      setFeedback({ type: 'info', message: 'Official APK download URL copied! Paste into Quick Share or messaging apps.' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#16161e] via-[#101016] to-[#0c0c10] border border-purple-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Decorative ambient radar wave */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Radio size={14} className="text-indigo-400 animate-pulse" />
            <span>Peer-to-Peer Android Transfer</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Nearby Share & Quick Share</span>
          </h3>
          <p className="text-xs sm:text-sm text-white/60 max-w-xl">
            Send the SBG MUSIC APK file directly to a friend's phone or nearby tablet with <strong>zero mobile data usage</strong>.
          </p>
        </div>

        {/* Action Trigger Buttons (Nearby + QR) */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/15 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
            title="Generate direct QR Code & Link for remote sharing"
          >
            <QrCode size={16} className="text-purple-300" />
            <span>Share App via QR</span>
          </button>

          <button
            onClick={handleTriggerNearbyShare}
            disabled={isSharing}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 disabled:opacity-75"
          >
            {isSharing ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Preparing Quick Share...</span>
              </>
            ) : (
              <>
                <Share2 size={16} className="text-white" />
                <span>Share APK to Nearby Devices</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Feedback Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fadeIn ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : feedback.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
        }`}>
          <Check size={16} className="shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Quick Transfer Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 text-xs">
        <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
            <Zap size={18} />
          </div>
          <div>
            <span className="font-bold text-white block">High-Speed Wi-Fi Direct</span>
            <span className="text-white/40 text-[11px]">Transfers in under 2 seconds (~25 MB/s)</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Wifi size={18} />
          </div>
          <div>
            <span className="font-bold text-white block">Zero Cellular Data</span>
            <span className="text-white/40 text-[11px]">Works offline without internet connection</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="font-bold text-white block">Official Verified Binary</span>
            <span className="text-white/40 text-[11px]">Direct signed package: {filename}</span>
          </div>
        </div>
      </div>

      {/* Step-by-Step Nearby Share Instructions */}
      <div className="space-y-3 relative z-10">
        <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
          3-Step Instructions for Sending to Another Android Phone:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1 */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                1
              </span>
              <span className="text-[10px] font-mono text-white/40">Sender Phone</span>
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white">Tap "Share APK" Above</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Tap the purple button above. In your Android Share Sheet, select <strong>Quick Share</strong> (or <strong>Nearby Share</strong>).
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center border border-purple-500/30">
                2
              </span>
              <span className="text-[10px] font-mono text-white/40">Receiver Phone</span>
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white">Turn On Quick Share</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              On the other phone, swipe down the notification shade and tap the <strong>Quick Share</strong> tile. Set visibility to <strong>Everyone</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                3
              </span>
              <span className="text-[10px] font-mono text-white/40">Instant Install</span>
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white">Accept & Install</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              The phone will appear on your screen. Tap it to send. The receiver taps <strong>Accept</strong> and immediately opens the APK to install!
            </p>
          </div>
        </div>
      </div>

      {/* Pro Troubleshooting Note */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-white/60 relative z-10">
        <Info size={15} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Receiver phone not appearing? </strong>
          <span>Make sure both Bluetooth and Location are switched ON on both devices, and the receiving phone screen is unlocked.</span>
        </div>
      </div>

      {/* SHARE APP VIA QR MODAL (Remote / Distance Sharing) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#15151a] border border-purple-500/30 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header & Close Button */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <QrCode size={14} className="text-purple-400" />
                <span>Remote / Distance Sharing</span>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5 text-left sm:text-center">
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                Share App via QR Code
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Scan with any phone camera or share the direct installer link with friends across the world outside of Bluetooth or Nearby range.
              </p>
            </div>

            {/* High-Contrast QR Code Display */}
            <div className="p-4 bg-white rounded-2xl shadow-2xl border-2 border-white/20 inline-block mx-auto relative group">
              <canvas ref={qrCanvasRef} className="rounded-xl block mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-[11px] font-black text-white tracking-tighter">SBG</span>
                </div>
              </div>
            </div>

            {/* Direct URL Input & 1-Click Copy */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Direct APK Download Link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullDownloadUrl()}
                  className="flex-1 px-3.5 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white/80 font-mono select-all focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleCopyDirectUrl}
                  className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow active:scale-95 cursor-pointer"
                  title="Copy direct download link"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Modal Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={handleShareDirectUrl}
                className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95 cursor-pointer"
              >
                <Send size={14} className="text-purple-400" />
                <span>Send to Friends</span>
              </button>

              <button
                onClick={handleDownloadQrPng}
                className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95 cursor-pointer"
              >
                <Download size={14} className="text-emerald-400" />
                <span>Save QR Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
