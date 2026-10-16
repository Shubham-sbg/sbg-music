// Serverless Vercel API Route for YouTube Video Metadata
import { fetchYouTubeVideoMetadata } from '../lib/serverYoutube';

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
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { url } = body;

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: 'Video URL or ID is required.',
        code: 'MISSING_URL',
        metadata: {
          segment: 'EXTRACT_ID',
          timestamp: new Date().toISOString(),
        },
      });
    }

    const cacheKey = `yt_video_${url.trim()}`;
    const videoData = await dedupeServerRequest(cacheKey, () => fetchYouTubeVideoMetadata(url));
    return res.status(200).json({
      ok: true,
      ...videoData,
    });
  } catch (error: any) {
    console.error('Error in Vercel API /api/youtube/video:', error);
    const msg = error?.message || 'Failed to fetch YouTube video metadata.';
    const isQuota = msg.includes('quota') || msg.includes('quotaExhausted') || msg.includes('Quota');
    const isRateLimit = msg.includes('429') || msg.includes('Rate limit') || msg.includes('rate limit');

    const statusCode = isQuota ? 403 : isRateLimit ? 429 : (error?.metadata?.statusCode || 500);
    const errorCode = isQuota ? 'QUOTA_EXHAUSTED' : isRateLimit ? 'RATE_LIMITED' : 'VIDEO_FETCH_FAILED';

    const metadata = {
      videoId: error?.metadata?.videoId || req.body?.url || undefined,
      segment: error?.metadata?.segment || 'FETCH_VIDEO_METADATA',
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
