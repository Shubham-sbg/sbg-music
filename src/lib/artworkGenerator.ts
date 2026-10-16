import neonBeatsCover from '../assets/images/album_cover_neon_beats_1788683811414.jpg';
import desiRapCover from '../assets/images/album_cover_desi_rap_1788683826403.jpg';
import chillLofiCover from '../assets/images/album_cover_chill_lofi_1788683843652.jpg';

export interface GeneratedArtworkResult {
  imageUrl: string;
  source: 'gemini-ai' | 'procedural' | 'preset';
  prompt?: string;
}

export const PRESET_ARTWORKS = [
  {
    id: 'neon-beats',
    title: 'Cyberpunk Neon Wave',
    url: neonBeatsCover,
    theme: 'Electronic / Synthwave',
  },
  {
    id: 'desi-rap',
    title: 'Desi Trap & Gold',
    url: desiRapCover,
    theme: 'Hip-Hop / Rap',
  },
  {
    id: 'chill-lofi',
    title: 'Midnight Ocean Lofi',
    url: chillLofiCover,
    theme: 'Lofi / Ambient',
  },
];

/**
 * Generate a deterministic hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate an ultra-sleek, procedural SVG artwork for a playlist
 */
export function createProceduralArtwork(title: string, description?: string): string {
  const hash = hashString(title || 'SBG Playlist');
  
  // Palette themes
  const colorSchemes = [
    { bg1: '#0f051d', bg2: '#3b0764', accent1: '#a855f7', accent2: '#ec4899', name: 'Neon Purple' },
    { bg1: '#022c22', bg2: '#064e3b', accent1: '#10b981', accent2: '#34d399', name: 'Emerald Wave' },
    { bg1: '#1a0500', bg2: '#450a0a', accent1: '#ef4444', accent2: '#f59e0b', name: 'Crimson Flame' },
    { bg1: '#030712', bg2: '#111827', accent1: '#6366f1', accent2: '#38bdf8', name: 'Midnight Cyan' },
    { bg1: '#18181b', bg2: '#27272a', accent1: '#eab308', accent2: '#f97316', name: 'Golden Sun' },
    { bg1: '#1e1b4b', bg2: '#312e81', accent1: '#818cf8', accent2: '#c084fc', name: 'Deep Cosmic' },
  ];
  
  const scheme = colorSchemes[hash % colorSchemes.length];
  const angle = (hash % 360);
  const displayTitle = (title || 'CURATED SOUNDS').toUpperCase().slice(0, 32);
  const initials = displayTitle
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 3)
    .join('') || 'SBG';
    
  // Soundwave bars generator
  const bars = Array.from({ length: 18 }, (_, i) => {
    const height = 20 + Math.sin((i + hash) * 0.7) * 35 + ((i % 3) * 15);
    const x = 120 + i * 32;
    const y = 520 - height / 2;
    return `<rect x="${x}" y="${y}" width="16" height="${height}" rx="8" fill="${i % 2 === 0 ? scheme.accent1 : scheme.accent2}" opacity="0.85" />`;
  }).join('');

  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${scheme.bg1}" />
      <stop offset="60%" stop-color="${scheme.bg2}" />
      <stop offset="100%" stop-color="#000000" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${scheme.accent1}" />
      <stop offset="100%" stop-color="${scheme.accent2}" />
    </linearGradient>
    <radialGradient id="glowGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${scheme.accent1}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${scheme.bg1}" stop-opacity="0" />
    </radialGradient>
    <filter id="blurFilter">
      <feGaussianBlur stdDeviation="30" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="800" height="800" fill="url(#bgGrad)" />

  <!-- Ambient Glow Orb -->
  <circle cx="400" cy="360" r="280" fill="url(#glowGrad)" filter="url(#blurFilter)" />

  <!-- Vinyl Grooves / Geometric Rings -->
  <g opacity="0.18" stroke="#ffffff" stroke-width="1.5" fill="none">
    <circle cx="400" cy="400" r="340" stroke-dasharray="10 15" />
    <circle cx="400" cy="400" r="280" />
    <circle cx="400" cy="400" r="220" stroke-dasharray="6 8" />
    <circle cx="400" cy="400" r="160" />
    <circle cx="400" cy="400" r="90" stroke-width="2" />
  </g>

  <!-- Soundwave Center Visualization -->
  <g>
    ${bars}
  </g>

  <!-- Top Badge / Header -->
  <g transform="translate(60, 70)">
    <rect width="130" height="32" rx="16" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.2" />
    <text x="65" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">SBG MUSIC</text>
  </g>

  <!-- Top Right Vinyl Tag -->
  <g transform="translate(660, 70)">
    <text x="0" y="21" font-family="monospace" font-size="13" font-weight="bold" fill="${scheme.accent1}" letter-spacing="2">HI-RES</text>
  </g>

  <!-- Central Typography Initials Emblem -->
  <g transform="translate(400, 370)">
    <circle r="75" fill="#000000" fill-opacity="0.6" stroke="url(#accentGrad)" stroke-width="3" />
    <text x="0" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">${initials}</text>
  </g>

  <!-- Bottom Title Card Section -->
  <g transform="translate(60, 680)">
    <line x1="0" y1="0" x2="680" y2="0" stroke="url(#accentGrad)" stroke-width="2" opacity="0.6" />
    <text x="0" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="800" fill="#ffffff" letter-spacing="0.5">${displayTitle}</text>
    <text x="0" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#ffffff" fill-opacity="0.5" letter-spacing="1">ORIGINAL PLAYLIST • CURATED COLLECTION</text>
  </g>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

/**
 * Generate artwork for a playlist automatically using Gemini AI with procedural fallback
 */
export async function generatePlaylistArtwork(options: {
  title: string;
  description?: string;
  genre?: string;
  style?: string;
}): Promise<GeneratedArtworkResult> {
  const { title, description, genre, style } = options;

  // 1. Attempt Server-Side Gemini Image Generation API
  try {
    const res = await fetch('/api/artwork/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        genre,
        style,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.imageUrl) {
        return {
          imageUrl: data.imageUrl,
          source: data.source || 'gemini-ai',
          prompt: data.prompt,
        };
      }
    }
  } catch (err) {
    console.warn('Network call to /api/artwork/generate failed, using procedural generation:', err);
  }

  // 2. Fallback to procedural high-res SVG artwork
  const proceduralUrl = createProceduralArtwork(title, description);
  return {
    imageUrl: proceduralUrl,
    source: 'procedural',
  };
}
