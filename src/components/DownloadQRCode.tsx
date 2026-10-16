import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Smartphone, Copy, Check, Info, HelpCircle, ExternalLink, Camera, Sparkles, ChevronDown } from 'lucide-react';
import ApkDownloadButton from './ApkDownloadButton';
import { AndroidRelease } from '../types';

interface DownloadQRCodeProps {
  apkPath?: string;
  size?: number;
  filename?: string;
  version?: string;
  release?: AndroidRelease | null;
}

export default function DownloadQRCode({ 
  apkPath = '/downloads/sbg-music.apk', 
  size = 200,
  filename = 'SBG-Music-v2.4.0.apk',
  version = '2.4.0',
  release
}: DownloadQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [showScannerTips, setShowScannerTips] = useState(false);

  const effectiveFilename = release?.fileName || filename;
  const effectiveVersion = release?.versionName || version;

  useEffect(() => {
    let fullUrl = apkPath;
    if (!apkPath.startsWith('http://') && !apkPath.startsWith('https://')) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sbg-song.vercel.app';
      fullUrl = `${origin}${apkPath}`;
    }
    setDownloadUrl(fullUrl);

    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        fullUrl,
        {
          width: size,
          margin: 1.5,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error('QR code generation failed:', error);
        }
      );
    }
  }, [apkPath, size]);

  const handleCopyLink = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-[#141418] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center text-center space-y-3 sm:space-y-4 shadow-2xl relative w-full max-w-sm mx-auto min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
        <QrCode size={16} />
        <span>Scan to Install on Android</span>
      </div>

      <p className="text-xs text-white/60 max-w-xs">
        Open your phone camera or QR scanner to download <span className="text-white font-semibold">{effectiveFilename}</span> directly to your Android device.
      </p>

      {/* QR Code Container with white high-contrast background */}
      <div className="p-3 bg-white rounded-2xl shadow-xl border border-white/20 relative group">
        <canvas ref={canvasRef} className="rounded-xl block" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg border-2 border-white">
            <span className="text-[10px] font-black text-white tracking-tighter">SBG</span>
          </div>
        </div>
      </div>

      {/* Instructional Tooltip & Scanner Help Section */}
      <div className="w-full relative">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-purple-300/80 hover:text-purple-200 transition-colors">
          <Info size={13} className="text-purple-400 shrink-0" />
          <span>Having trouble scanning?</span>
          
          {/* Hover Tooltip trigger for Desktop */}
          <div className="relative group/tooltip inline-block">
            <button
              type="button"
              onClick={() => setShowScannerTips(!showScannerTips)}
              className="inline-flex items-center gap-0.5 underline font-medium cursor-pointer text-purple-400 hover:text-purple-300"
              aria-label="Scanning help tips"
            >
              <span>Scanner tips</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${showScannerTips ? 'rotate-180' : ''}`} />
            </button>

            {/* Desktop Hover Floating Popover */}
            <div className="hidden md:group-hover/tooltip:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3.5 bg-[#1a1a22] border border-purple-500/30 rounded-2xl shadow-2xl text-left text-xs z-50 pointer-events-none backdrop-blur-xl">
              <div className="flex items-center gap-1.5 font-bold text-white mb-2 pb-1.5 border-b border-white/10">
                <Camera size={13} className="text-purple-400" />
                <span>Native Android QR Scanning</span>
              </div>
              <ul className="space-y-1.5 text-white/80 text-[11px] leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">Android Quick Settings:</strong> Swipe down from top of screen & tap <em>"Scan QR code"</em> tile.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">Google Lens:</strong> Tap the camera icon in your Google Search bar or Google Photos.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">Native Camera App:</strong> Ensure "Scan QR codes" is enabled in Camera settings.</span>
                </li>
              </ul>
              <div className="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-white/50">
                No extra apps needed — standard on all Android 9.0+ devices.
              </div>
              {/* Tooltip caret */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a22]" />
            </div>
          </div>
        </div>

        {/* Mobile / Click Expandable Details */}
        {showScannerTips && (
          <div className="mt-2 p-3 bg-purple-950/30 border border-purple-500/20 rounded-2xl text-left text-[11px] text-white/80 space-y-1.5 animate-fadeIn">
            <div className="font-bold text-purple-300 flex items-center gap-1.5 text-xs mb-1">
              <Camera size={13} />
              <span>Native Android Scanner Guide:</span>
            </div>
            <p>1. <strong>Quick Settings:</strong> Swipe down from top status bar and tap <em>"Scan QR code"</em>.</p>
            <p>2. <strong>Google Lens:</strong> Tap the camera icon on the Google search widget on your home screen.</p>
            <p>3. <strong>Direct Link:</strong> If scanner permissions fail, simply copy the download URL below into Chrome.</p>
          </div>
        )}
      </div>

      {/* Direct Link Actions */}
      <div className="w-full space-y-2 pt-2 border-t border-white/10 min-w-0">
        <div className="flex items-center gap-2 w-full min-w-0">
          <input
            type="text"
            readOnly
            value={downloadUrl}
            className="min-w-0 flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-[11px] text-white/70 font-mono select-all focus:outline-none truncate"
          />
          <button
            onClick={handleCopyLink}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            title="Copy download link"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <ApkDownloadButton
          release={release}
          apkUrl={downloadUrl || apkPath}
          filename={effectiveFilename}
          version={effectiveVersion}
          size="compact"
        />
      </div>
    </div>
  );
}
