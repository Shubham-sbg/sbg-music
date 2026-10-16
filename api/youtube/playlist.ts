// Serverless Vercel API Route for YouTube Playlist Extraction
import { extractPlaylistId, fetchYouTubePlaylist } from '../lib/serverYoutube';

const serverCache = new Map<string, { data: any; timestamp: number }>();
const serverInFlight = new Map<string, Promise<any>>();
const SERVER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function dedupeServerRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = serverCache.get(key);
  if (cached && now - cached.timestamp < SERVER_CACHE_TTL_MS) {
    return cached.data as T;
  }

  if (serverInFlight.has(key)) {
    return serverInFlight.get(key) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      serverCache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      serverInFlight.delete(key);
    }
  })();

  serverInFlight.set(key, promise);
  return promise;
}

export default async function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed. Expected POST request.',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    let body: any = {};
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch {
        body = {};
      }
    } else {
      body = req.body || {};
    }

    const { url, pageToken } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Playlist URL or ID is required.',
        code: 'MISSING_URL'
      });
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid YouTube playlist URL or ID format.',
        code: 'INVALID_URL'
      });
    }

    const cacheKey = `yt_playlist_${playlistId}_${pageToken || 'first'}`;
    const playlistData = await dedupeServerRequest(cacheKey, () => fetchYouTubePlaylist(playlistId, pageToken));

    return res.status(200).json({
      ok: true,
      ...playlistData,
    });
  } catch (error: any) {
    console.error('Error in Vercel API /api/youtube/playlist:', error);
    const msg = error?.message || 'Failed to fetch YouTube playlist metadata.';
    const isQuota = msg.includes('quota') || msg.includes('quotaExhausted') || msg.includes('Quota');
    const isRateLimit = msg.includes('429') || msg.includes('Rate limit') || msg.includes('rate limit');
    
    const statusCode = isQuota ? 403 : isRateLimit ? 429 : (error?.metadata?.statusCode || 500);
    const errorCode = isQuota ? 'QUOTA_EXHAUSTED' : isRateLimit ? 'RATE_LIMITED' : 'SERVER_ERROR';

    const metadata = {
      playlistId: error?.metadata?.playlistId || extractPlaylistId(req.body?.url || '') || undefined,
      pageToken: error?.metadata?.pageToken || req.body?.pageToken || undefined,
      segment: error?.metadata?.segment || 'FETCH_PLAYLIST_ITEMS',
      timestamp: error?.metadata?.timestamp || new Date().toISOString(),
      details: error?.metadata?.details || msg,
    };

    return res.status(statusCode).json({
      ok: false,
      error: isQuota 
        ? 'YouTube API daily quota has been exhausted. Please try again after quota reset or configure a valid higher-quota project.'
        : msg,
      code: errorCode,
      isQuotaExhausted: isQuota,
      isRateLimited: isRateLimit,
      metadata,
    });
  }
}
