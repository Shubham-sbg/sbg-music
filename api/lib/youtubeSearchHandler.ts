import { searchYouTube } from './serverYoutube';

const serverSearchCache = new Map<string, { data: any; timestamp: number }>();
const serverSearchInFlight = new Map<string, Promise<any>>();
const SERVER_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function dedupeSearchRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = serverSearchCache.get(key);
  if (cached && now - cached.timestamp < SERVER_SEARCH_CACHE_TTL_MS) {
    return cached.data as T;
  }

  if (serverSearchInFlight.has(key)) {
    return serverSearchInFlight.get(key) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      serverSearchCache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      serverSearchInFlight.delete(key);
    }
  })();

  serverSearchInFlight.set(key, promise);
  return promise;
}

/**
 * Shared YouTube Search Handler Logic
 * Used by both Express (server.ts) and Vercel Serverless (api/youtube/search.ts)
 */
export async function handleYouTubeSearchRequest(req: any, res: any) {
  // Ensure JSON-only response headers for all environments
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  try {
    let q = '';
    let pageToken = '';
    let filter = 'all';

    // Handle both Vercel (req.query) and Express (req.query)
    const query = req.query || {};
    const body = req.body || {};

    if (req.method === 'POST') {
      const b = typeof body === 'string' ? JSON.parse(body) : body;
      q = (b.q || b.query || '').trim();
      pageToken = (b.pageToken || '').trim();
      filter = (b.filter || 'all').trim();
    } else {
      q = (query.q as string || query.query as string || '').trim();
      pageToken = (query.pageToken as string || '').trim();
      filter = (query.filter as string || 'all').trim();
    }

    if (!q) {
      return res.status(200).json({ ok: true, query: '', items: [], nextPageToken: null });
    }

    const cacheKey = `yt_search_${q.toLowerCase()}_${filter || 'all'}_${pageToken || 'first'}`;

    // Call core search logic with deduplication
    const searchData = await dedupeSearchRequest(cacheKey, async () => {
      return await searchYouTube(q, pageToken, filter);
    });

    if (searchData.ok === false) {
      return res.status(200).json({
        ok: false,
        query: q,
        items: [],
        nextPageToken: null,
        error: searchData.error || 'YouTube search is temporarily unavailable.',
        code: searchData.code || 'SEARCH_ERROR',
        isUnauthorized: Boolean(searchData.isUnauthorized),
        isConfigMissing: Boolean(searchData.isConfigMissing),
        isQuotaExhausted: Boolean(searchData.isQuotaExhausted),
        isRateLimited: Boolean(searchData.isRateLimited),
      });
    }

    return res.status(200).json({
      ok: true,
      query: q,
      ...searchData,
    });
  } catch (error: any) {
    console.error('[handleYouTubeSearchRequest] Error:', error);
    
    // Normalize error message to string to prevent [object Object] in UI
    let msg = 'YouTube search is temporarily unavailable. Please try again.';
    if (typeof error === 'string') {
      msg = error;
    } else if (error instanceof Error) {
      msg = error.message;
    } else if (error && typeof error === 'object') {
      msg = error.userFriendlyMessage || error.message || (typeof error.error === 'string' ? error.error : JSON.stringify(error));
    }
    
    if (!msg || msg === '[object Object]') {
      msg = 'YouTube search is temporarily unavailable. Please try again.';
    }

    const isUnauthorized = error?.isUnauthorized || error?.code === 'UNAUTHORIZED_KEY' || error?.code === 'INVALID_API_KEY';
    const isConfigMissing = error?.isConfigMissing || Boolean(!process.env.YOUTUBE_API_KEY && (error?.code === 'CONFIG_MISSING' || msg.includes('configuration')));
    const isQuota = error?.isQuotaExhausted || msg.includes('quota') || msg.includes('quotaExhausted') || msg.includes('Quota');
    const isRateLimit = error?.isRateLimited || msg.includes('429') || msg.includes('Rate limit') || msg.includes('rate limit');

    const errorCode = error?.code || (isUnauthorized ? 'UNAUTHORIZED_KEY' : isQuota ? 'QUOTA_EXHAUSTED' : isRateLimit ? 'RATE_LIMITED' : isConfigMissing ? 'CONFIG_MISSING' : 'SEARCH_UNAVAILABLE');

    return res.status(200).json({
      ok: false,
      error: String(msg),
      code: String(errorCode),
      items: [],
      nextPageToken: null,
      isUnauthorized: Boolean(isUnauthorized),
      isConfigMissing: Boolean(isConfigMissing),
      isQuotaExhausted: Boolean(isQuota),
      isRateLimited: Boolean(isRateLimit),
      details: typeof error?.metadata?.details === 'string' ? error.metadata.details : undefined,
    });
  }
}
