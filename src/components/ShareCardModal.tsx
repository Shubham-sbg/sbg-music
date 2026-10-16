import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { X, Download, Share2, Copy, Check, Sparkles, Image as ImageIcon, Music, Loader2 } from 'lucide-react';

interface ShareCardModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
}

type CardTheme = 'cyberpunk' | 'sunset' | 'sbg_gold' | 'emerald';

interface ThemeConfig {
  id: CardTheme;
  name: string;
  bgGradient: [string, string, string];
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  textColor: string;
  subtextColor: string;
}

const THEMES: ThemeConfig[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    bgGradient: ['#0f051d', '#1d0b3a', '#090312'],
    accentColor: '#a855f7',
    badgeBg: '#9333ea',
    badgeText: '#ffffff',
    textColor: '#ffffff',
    subtextColor: '#d8b4fe',
  },
  {
    id: 'sunset',
    name: 'Neon Sunset',
    bgGradient: ['#3b0764', '#831843', '#1e1b4b'],
    accentColor: '#ec4899',
    badgeBg: '#db2777',
    badgeText: '#ffffff',
    textColor: '#ffffff',
    subtextColor: '#fbcfe8',
  },
  {
    id: 'sbg_gold',
    name: 'SBG Gold',
    bgGradient: ['#12100e', '#2b2219', '#0d0b0a'],
    accentColor: '#eab308',
    badgeBg: '#ca8a04',
    badgeText: '#000000',
    textColor: '#fef08a',
    subtextColor: '#d97706',
  },
  {
    id: 'emerald',
    name: 'Emerald Slate',
    bgGradient: ['#022c22', '#064e3b', '#021812'],
    accentColor: '#10b981',
    badgeBg: '#059669',
    badgeText: '#ffffff',
    textColor: '#ffffff',
    subtextColor: '#6ee7b7',
  },
];

export default function ShareCardModal({ song, isOpen, onClose }: ShareCardModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('cyberpunk');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const theme = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];

  useEffect(() => {
    if (!isOpen || !song) return;

    let isMounted = true;
    setIsGenerating(true);

    const generateCanvas = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350; // Vertical Story / Post format (4:5 aspect ratio)
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw Background Gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, theme.bgGradient[0]);
      grad.addColorStop(0.5, theme.bgGradient[1]);
      grad.addColorStop(1, theme.bgGradient[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Decorative Background Circles
      ctx.save();
      const circleGrad = ctx.createRadialGradient(540, 450, 50, 540, 450, 500);
      circleGrad.addColorStop(0, `${theme.accentColor}33`);
      circleGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(540, 450, 500, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Load & Draw Artwork
      const artworkUrl = song.imageUrl || song.customCoverUrl || song.coverUrl || song.heroImageUrl || song.thumbnailUrl;

      if (artworkUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue on fallback
            img.src = artworkUrl;
          });

          if (img.complete && img.naturalWidth > 0) {
            // Blurred background artwork effect
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.filter = 'blur(40px)';
            ctx.drawImage(img, -100, -100, canvas.width + 200, canvas.height + 200);
            ctx.restore();

            // Main Artwork Frame
            const artSize = 640;
            const artX = (canvas.width - artSize) / 2;
            const artY = 220;
            const radius = 36;

            // Artwork Shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 20;

            // Rounded Clip Path
            ctx.beginPath();
            ctx.moveTo(artX + radius, artY);
            ctx.lineTo(artX + artSize - radius, artY);
            ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + radius);
            ctx.lineTo(artX + artSize, artY + artSize - radius);
            ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - radius, artY + artSize);
            ctx.lineTo(artX + radius, artY + artSize);
            ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - radius);
            ctx.lineTo(artX, artY + radius);
            ctx.quadraticCurveTo(artX, artY, artX + radius, artY);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(img, artX, artY, artSize, artSize);
            ctx.restore();

            // Artwork Border Overlay
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(artX + radius, artY);
            ctx.lineTo(artX + artSize - radius, artY);
            ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + radius);
            ctx.lineTo(artX + artSize, artY + artSize - radius);
            ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - radius, artY + artSize);
            ctx.lineTo(artX + radius, artY + artSize);
            ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - radius);
            ctx.lineTo(artX, artY + radius);
            ctx.quadraticCurveTo(artX, artY, artX + radius, artY);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        } catch (e) {
          console.warn('Share card image load skipped:', e);
        }
      }

      // 4. SBG MUSIC Brand Badge at Top
      ctx.save();
      const badgeY = 120;
      ctx.fillStyle = theme.badgeBg;
      ctx.beginPath();
      ctx.roundRect(540 - 110, badgeY, 220, 48, 24);
      ctx.fill();

      ctx.fillStyle = theme.badgeText;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SBG MUSIC', 540, badgeY + 24);
      ctx.restore();

      // 5. Track Title
      ctx.save();
      ctx.fillStyle = theme.textColor;
      ctx.font = 'bold 52px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxTitleWidth = 900;
      let titleText = song.title;
      if (ctx.measureText(titleText).width > maxTitleWidth) {
        while (titleText.length > 3 && ctx.measureText(titleText + '...').width > maxTitleWidth) {
          titleText = titleText.slice(0, -1);
        }
        titleText += '...';
      }
      ctx.fillText(titleText, 540, 940);
      ctx.restore();

      // 6. Artist Name
      ctx.save();
      ctx.fillStyle = theme.subtextColor;
      ctx.font = '600 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let artistText = song.artist || 'Unknown Artist';
      if (ctx.measureText(artistText).width > maxTitleWidth) {
        while (artistText.length > 3 && ctx.measureText(artistText + '...').width > maxTitleWidth) {
          artistText = artistText.slice(0, -1);
        }
        artistText += '...';
      }
      ctx.fillText(artistText, 540, 1010);
      ctx.restore();

      // 7. Equalizer Audio Wave Graphic
      ctx.save();
      const waveY = 1120;
      const barCount = 28;
      const totalWidth = 560;
      const barWidth = 12;
      const gap = (totalWidth - barCount * barWidth) / (barCount - 1);
      const startX = (canvas.width - totalWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        const height = 20 + Math.abs(Math.sin(i * 0.45)) * 60;
        const x = startX + i * (barWidth + gap);
        const y = waveY - height / 2;

        ctx.fillStyle = i % 2 === 0 ? theme.accentColor : 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 6);
        ctx.fill();
      }
      ctx.restore();

      // 8. Footer Tagline
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Listen now on sbgmusic.app', 540, 1240);
      ctx.restore();

      if (isMounted) {
        const url = canvas.toDataURL('image/png');
        setCardDataUrl(url);
        setIsGenerating(false);
      }
    };

    generateCanvas();

    return () => {
      isMounted = false;
    };
  }, [isOpen, song, selectedTheme]);

  if (!isOpen || !song) return null;

  const handleDownload = () => {
    if (!cardDataUrl) return;
    const link = document.createElement('a');
    link.download = `sbg-share-${song.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    link.href = cardDataUrl;
    link.click();
  };

  const handleShare = async () => {
    if (!cardDataUrl) return;

    try {
      // Try Web Share API with image file
      const res = await fetch(cardDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `share-${song.id}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Listening to ${song.title} on SBG MUSIC`,
          text: `Check out "${song.title}" by ${song.artist} on SBG MUSIC!`,
          url: `${window.location.origin}/?songId=${song.id}`,
        });
        return;
      }
    } catch (e) {
      console.warn('Native share failed or dismissed:', e);
    }

    // Fallback: copy deep-link
    try {
      const url = `${window.location.origin}/?songId=${song.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#111115] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#16161c]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Song Share Card</h3>
              <p className="text-xs text-white/40">Generate stylized cards for Instagram & social media</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center gap-6">
          {/* Theme Selector */}
          <div className="w-full">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">
              Choose Style Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                    selectedTheme === t.id
                      ? 'border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/20 scale-105'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div 
                    className="w-5 h-5 rounded-full border border-white/20"
                    style={{ background: `linear-gradient(135deg, ${t.bgGradient[0]}, ${t.bgGradient[1]})` }}
                  />
                  <span className="truncate w-full text-center text-[10px]">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Card Image Preview */}
          <div className="relative w-full max-w-[280px] aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-950 flex items-center justify-center">
            {isGenerating || !cardDataUrl ? (
              <div className="flex flex-col items-center gap-3 text-white/40">
                <Loader2 size={24} className="animate-spin text-purple-400" />
                <span className="text-xs font-medium">Generating Share Card...</span>
              </div>
            ) : (
              <img
                src={cardDataUrl}
                alt={`${song.title} Share Card`}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-[#16161c] flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={!cardDataUrl || isGenerating}
            className="flex-1 py-3 px-4 bg-white hover:bg-white/90 text-black font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Download size={16} />
            <span>Download Card (PNG)</span>
          </button>

          <button
            onClick={handleShare}
            disabled={!cardDataUrl || isGenerating}
            className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-300" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={16} />
                <span>Share Card</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
