/**
 * YouTube Utility functions for SBG MUSIC
 * Handles reliable video ID extraction, URL normalization, and thumbnail fetching.
 */

export function extractYoutubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle standard full URLs and short URLs
  // Matches:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtube.com/watch?v=VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://music.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/v/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Fallback URL parser for query params
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      return v;
    }
  } catch (e) {
    // Ignore URL parse error
  }

  return null;
}

export function normalizeYoutubeUrl(input: string): string | null {
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYoutubeThumbnailUrl(videoId: string, quality: 'maxres' | 'hq' | 'mq' | 'default' = 'hq'): string {
  const qualityMap = {
    maxres: 'maxresdefault.jpg',
    hq: 'hqdefault.jpg',
    mq: 'mqdefault.jpg',
    default: 'default.jpg',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
}

export function isYoutubeSource(url?: string, videoId?: string): boolean {
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return true;
  if (!url) return false;
  return Boolean(extractYoutubeVideoId(url));
}
