// Server-side YouTube Data API v3 & Web Scraper Service
// Ensures YOUTUBE_API_KEY is kept strictly server-side and never exposed to client bundles.

export class YouTubeImportError extends Error {
  metadata: {
    playlistId?: string;
    videoId?: string;
    pageToken?: string;
    segment?: 'EXTRACT_ID' | 'FETCH_PLAYLIST_DETAILS' | 'FETCH_PLAYLIST_ITEMS' | 'FETCH_VIDEO_DURATIONS' | 'SCRAPE_PLAYLIST' | 'SCRAPE_PAGINATION' | 'FETCH_VIDEO_METADATA';
    targetUrl?: string;
    statusCode?: number;
    timestamp: string;
    details?: string;
  };

  constructor(message: string, metadata: Omit<YouTubeImportError['metadata'], 'timestamp'>) {
    super(message);
    this.name = 'YouTubeImportError';
    this.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
    };
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  initialDelayMs = 500
): Promise<Response> {
  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 429 || res.status >= 500) && attempt <= retries) {
        console.warn(`[serverYoutube] HTTP ${res.status} for ${url}. Retrying in ${delay}ms (Attempt ${attempt}/${retries})...`);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt <= retries) {
        console.warn(`[serverYoutube] Network error fetching ${url}: ${err.message}. Retrying in ${delay}ms (Attempt ${attempt}/${retries})...`);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
      }
    }
  }

  throw lastError || new Error(`Fetch failed after ${retries} attempts.`);
}

export function extractPlaylistId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Direct playlist ID (starts with PL, UU, FL, RD, OLAK, etc.)
  if (/^[a-zA-Z0-9_-]{12,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const listParam = url.searchParams.get('list');
    if (listParam) return listParam;
  } catch (e) {
    // regex fallback
  }

  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function parseISO8601Duration(durationStr: string): number {
  if (!durationStr) return 0;
  // PT1H2M10S, PT10M, PT5S, etc.
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseTitleAndArtist(rawTitle: string, channelName?: string) {
  let title = rawTitle || 'Untitled';
  let artist = channelName || 'SBG Music';

  // Decode common HTML entities
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  if (channelName) {
    artist = channelName
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Check if title has "Artist - Title" format
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }

  return { title, artist };
}

function extractVideosFromRenderer(contents: any[]): { videos: any[]; continuationToken?: string; itemErrors?: Array<{ videoId: string; reason: string }> } {
  const videos: any[] = [];
  const itemErrors: Array<{ videoId: string; reason: string }> = [];
  let continuationToken: string | undefined;

  if (!Array.isArray(contents)) return { videos, itemErrors };

  for (const item of contents) {
    if (item.playlistVideoRenderer) {
      const v = item.playlistVideoRenderer;
      const videoId = v.videoId;
      const rawTitle = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Untitled Video';
      
      if (!videoId || v.isPlayable === false || rawTitle.includes('Unavailable')) {
        itemErrors.push({
          videoId: videoId || 'unknown',
          reason: v.isPlayable === false ? 'Video is unplayable or private on YouTube.' : 'Video renderer missing or unavailable.',
        });
        continue;
      }

      const channel = v.shortBylineText?.runs?.[0]?.text || '';
      const thumb =
        v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const parsed = parseTitleAndArtist(rawTitle, channel);

      const lengthText = v.lengthText?.simpleText || '';
      let durationSec = 0;
      if (lengthText) {
        const parts = lengthText.split(':').map((x: string) => parseInt(x, 10));
        if (parts.length === 2) {
          durationSec = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }

      videos.push({
        videoId,
        title: parsed.title,
        rawTitle,
        artist: parsed.artist,
        description: '',
        thumbnailUrl: thumb,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        duration: durationSec,
      });
    } else if (item.continuationItemRenderer) {
      continuationToken =
        item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    }
  }

  return { videos, continuationToken, itemErrors };
}

async function scrapeYouTubePlaylistWeb(playlistId: string) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}&hl=en`;
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load playlist page (HTTP ${response.status})`);
  }

  const html = await response.text();

  const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
                html.match(/window\["ytInitialData"\] = ({.*?});<\/script>/s) ||
                html.match(/ytInitialData\s*=\s*({.+?});/s);

  if (!match || !match[1]) {
    throw new Error('Could not parse YouTube initial data from page.');
  }

  const initialData = JSON.parse(match[1]);

  const header = initialData.header?.playlistHeaderRenderer || {};
  const metadata = initialData.metadata?.playlistMetadataRenderer || {};
  const playlistTitle =
    header.title?.simpleText ||
    header.title?.runs?.[0]?.text ||
    metadata.title ||
    'YouTube Playlist';
  const playlistAuthor =
    header.ownerText?.runs?.[0]?.text ||
    metadata.author ||
    'SBG Music';
  const playlistDesc =
    header.descriptionText?.simpleText ||
    header.descriptionText?.runs?.[0]?.text ||
    metadata.description ||
    '';
  const playlistThumb =
    header.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url ||
    `https://img.youtube.com/vi/${playlistId}/hqdefault.jpg`;

  let tabs = initialData.contents?.twoColumnBrowseResultsRenderer?.tabs;
  let sectionContents: any[] = [];

  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      const sectionList = tab.tabRenderer?.content?.sectionListRenderer?.contents;
      if (Array.isArray(sectionList)) {
        for (const sec of sectionList) {
          const itemSec = sec.itemSectionRenderer?.contents;
          if (Array.isArray(itemSec)) {
            for (const item of itemSec) {
              if (item.playlistVideoListRenderer?.contents) {
                sectionContents = item.playlistVideoListRenderer.contents;
                break;
              }
            }
          }
        }
      }
    }
  }

  const allVideos: any[] = [];
  const allErrors: Array<{ videoId: string; reason: string }> = [];
  const { videos, continuationToken, itemErrors } = extractVideosFromRenderer(sectionContents);
  allVideos.push(...videos);
  if (itemErrors) allErrors.push(...itemErrors);

  let nextContinuation = continuationToken;
  let pageCount = 1;
  const maxPages = 40; // Supports up to 2000+ items on scraping fallback

  while (nextContinuation && pageCount < maxPages) {
    try {
      const contRes = await fetchWithRetry(
        `https://www.youtube.com/youtubei/v1/browse?key=${process.env.YOUTUBE_API_KEY || ''}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            continuation: nextContinuation,
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.01.00',
                hl: 'en',
                gl: 'US',
              },
            },
          }),
        }
      );

      if (!contRes.ok) break;
      const contData = await contRes.json();
      const continuationItems =
        contData.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ||
        contData.continuationContents?.playlistVideoListContinuation?.contents;

      if (!continuationItems || continuationItems.length === 0) break;

      const extracted = extractVideosFromRenderer(continuationItems);
      allVideos.push(...extracted.videos);
      if (extracted.itemErrors) allErrors.push(...extracted.itemErrors);
      nextContinuation = extracted.continuationToken;
      pageCount++;
    } catch (e) {
      console.warn('Continuation fetch stopped:', e);
      break;
    }
  }

  if (allVideos.length === 0) {
    throw new Error('No video items found on YouTube playlist webpage.');
  }

  return {
    id: playlistId,
    title: playlistTitle,
    description: playlistDesc,
    author: playlistAuthor,
    thumbnailUrl: playlistThumb || allVideos[0]?.thumbnailUrl,
    totalVideos: allVideos.length,
    videos: allVideos,
    errors: allErrors,
    source: 'youtube_scraper',
    debug: {
      pagesFetched: pageCount,
      itemsFetched: allVideos.length,
      lastNextPageToken: nextContinuation ? 'present' : 'none',
    },
  };
}

export async function fetchYouTubePlaylist(playlistId: string, pageToken?: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const itemErrors: Array<{ videoId: string; reason: string }> = [];

  if (!apiKey) {
    throw new YouTubeImportError('YouTube API key is missing. Please configure YOUTUBE_API_KEY.', {
      playlistId,
      segment: 'FETCH_PLAYLIST_DETAILS',
      details: 'API key unconfigured.',
    });
  }

  try {
    const plRes = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`
    );
    if (!plRes.ok) {
      const errTxt = await plRes.text();
      throw new YouTubeImportError(`YouTube API playlist fetch failed: ${plRes.status}`, {
        playlistId,
        segment: 'FETCH_PLAYLIST_DETAILS',
        statusCode: plRes.status,
        details: errTxt,
      });
    }

    const plData = await plRes.json();
    if (!plData.items || plData.items.length === 0) {
      throw new YouTubeImportError('YouTube playlist not found or is private.', {
        playlistId,
        segment: 'FETCH_PLAYLIST_DETAILS',
        details: 'API returned zero items for this playlist ID.',
      });
    }

    const snippet = plData.items[0].snippet;
    const title = snippet.title;
    const description = snippet.description || '';
    const author = snippet.channelTitle || '';
    const thumbnail =
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      `https://img.youtube.com/vi/${playlistId}/hqdefault.jpg`;
    
    let currentNextPageToken: string | undefined = pageToken;
    let rawItemsList: any[] = [];
    let totalPagesFetched = 0;
    let lastPageToken = '';

    do {
      const pageParam = currentNextPageToken ? `&pageToken=${encodeURIComponent(currentNextPageToken)}` : '';
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}${pageParam}&key=${apiKey}`;
      const itemsRes = await fetchWithRetry(url);
      if (!itemsRes.ok) {
        if (totalPagesFetched === 0) {
          const errTxt = await itemsRes.text();
          throw new YouTubeImportError(`YouTube API items fetch failed: ${itemsRes.status}`, {
            playlistId,
            pageToken: currentNextPageToken,
            segment: 'FETCH_PLAYLIST_ITEMS',
            statusCode: itemsRes.status,
            details: errTxt,
          });
        }
        break;
      }
      const itemsData = await itemsRes.json();
      lastPageToken = itemsData.nextPageToken || '';
      currentNextPageToken = itemsData.nextPageToken;

      if (itemsData.items) rawItemsList.push(...itemsData.items);
      totalPagesFetched++;
      if (pageToken) break; // If specific page requested, stop
    } while (currentNextPageToken && totalPagesFetched < 50);

    const allItems: any[] = [];
    if (rawItemsList.length > 0) {
      const videoIds = rawItemsList.map((it: any) => it.snippet?.resourceId?.videoId).filter(Boolean);
      const durationMap: Record<string, number> = {};
      
      if (videoIds.length > 0) {
        try {
          const DURATION_CHUNK_SIZE = 50;
          for (let i = 0; i < videoIds.length; i += DURATION_CHUNK_SIZE) {
            const chunkIds = videoIds.slice(i, i + DURATION_CHUNK_SIZE);
            const vidRes = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunkIds.join(',')}&key=${apiKey}`);
            if (vidRes.ok) {
              const vidData = await vidRes.json();
              if (vidData.items) {
                for (const vItem of vidData.items) {
                  durationMap[vItem.id] = parseISO8601Duration(vItem.contentDetails?.duration);
                }
              }
            }
          }
        } catch (vidErr) {
          console.warn('Failed to fetch durations:', vidErr);
        }
      }

      for (const it of rawItemsList) {
        const snip = it.snippet;
        const videoId = snip?.resourceId?.videoId;
        if (!videoId || snip?.title === 'Private video' || snip?.title === 'Deleted video') {
          itemErrors.push({ videoId: videoId || 'unknown', reason: snip?.title || 'Invalid video resource' });
          continue;
        }
        const parsed = parseTitleAndArtist(snip.title, snip.videoOwnerChannelTitle || snip.channelTitle);
        allItems.push({
          videoId,
          title: parsed.title,
          rawTitle: snip.title,
          artist: parsed.artist,
          thumbnailUrl: snip.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          duration: durationMap[videoId] || 0,
        });
      }
    }

    return {
      id: playlistId,
      title,
      description,
      author,
      thumbnailUrl: thumbnail || allItems[0]?.thumbnailUrl || '',
      totalVideos: plData.items[0].contentDetails?.itemCount || allItems.length,
      videos: allItems,
      errors: itemErrors,
      source: 'youtube_api',
      nextPageToken: lastPageToken,
    };
  } catch (e: any) {
    if (e instanceof YouTubeImportError) throw e;
    throw new YouTubeImportError(`Unexpected playlist fetch error: ${e.message}`, {
      playlistId,
      segment: 'FETCH_PLAYLIST_DETAILS',
      details: e.message,
    });
  }
}

export async function fetchYouTubeVideoMetadata(videoIdOrUrl: string) {
  let videoId = '';
  const trimmed = videoIdOrUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    videoId = trimmed;
  } else {
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) videoId = match[1];
  }

  if (!videoId) {
    throw new YouTubeImportError('Invalid YouTube video URL or ID format.', {
      videoId: videoIdOrUrl,
      segment: 'EXTRACT_ID',
    });
  }

  const apiKey = (process.env.YOUTUBE_API_KEY || '').trim();
  let isQuota = false;

  if (apiKey) {
    try {
      const apiRes = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`, {}, 1, 300);
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.items && apiData.items.length > 0) {
          const snip = apiData.items[0].snippet;
          const parsed = parseTitleAndArtist(snip.title, snip.channelTitle);
          return {
            videoId,
            title: parsed.title,
            rawTitle: snip.title,
            artist: parsed.artist,
            thumbnailUrl: snip.thumbnails?.maxres?.url || snip.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
            duration: parseISO8601Duration(apiData.items[0].contentDetails?.duration),
            source: 'youtube_api',
          };
        }
      } else {
        const errText = await apiRes.text().catch(() => '');
        if (apiRes.status === 403 || errText.includes('quota')) {
          isQuota = true;
          console.warn(`[fetchYouTubeVideoMetadata] YouTube API quota exceeded for video ${videoId}. Trying oEmbed fallback...`);
        }
      }
    } catch (apiErr: any) {
      console.warn('[fetchYouTubeVideoMetadata] API fetch failed, trying oEmbed fallback:', apiErr?.message || apiErr);
    }
  }

  // Quota-Free oEmbed Fallback (always works for public videos without consuming API quota)
  try {
    const oembedRes = await fetchWithRetry(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {}, 2, 400);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      const parsed = parseTitleAndArtist(oembedData.title || 'Untitled Track', oembedData.author_name || 'YouTube Artist');
      return {
        videoId,
        title: parsed.title,
        rawTitle: oembedData.title || 'Untitled Track',
        artist: parsed.artist,
        thumbnailUrl: oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        duration: 180, // standard default playback duration when metadata API quota is unavailable
        source: 'youtube_oembed',
        quotaBypassed: isQuota || !apiKey,
      };
    }
  } catch (oembedErr) {
    console.warn('[fetchYouTubeVideoMetadata] oEmbed fallback failed:', oembedErr);
  }

  if (isQuota) {
    throw new YouTubeImportError('YouTube API daily quota has been exhausted. Please try again after quota reset or configure a valid higher-quota project.', {
      videoId,
      segment: 'FETCH_VIDEO_METADATA',
      statusCode: 403,
      details: 'Quota exhausted on API.',
    });
  }

  throw new YouTubeImportError('YouTube video not found or private.', { videoId, segment: 'FETCH_VIDEO_METADATA' });
}

/**
 * Searches YouTube for tracks using the YouTube Data API search endpoint with high-res metadata.
 * Strictly filters to music songs when filter='songs' (videoCategoryId=10) and strips non-song items.
 */
export async function searchYouTube(queryStr: string, pageToken?: string, filter?: string) {
  const apiKey = (process.env.YOUTUBE_API_KEY || '').trim();
  const q = queryStr.trim();
  if (!q) return { ok: true, items: [], nextPageToken: null, source: 'empty_query' };

  if (!apiKey) {
    return {
      ok: false,
      items: [],
      nextPageToken: null,
      error: 'YouTube API search service is currently unconfigured. YOUTUBE_API_KEY is missing in server environment.',
      code: 'CONFIG_MISSING',
      isConfigMissing: true,
      isUnauthorized: false,
      isQuotaExhausted: false,
      isRateLimited: false,
    };
  }

  try {
    let searchType = 'video';
    let queryModifier = '';
    let categoryParam = '';
    
    // When searching for songs, strictly limit to Music Category (10) and video type
    if (filter === 'playlists') {
      searchType = 'playlist';
    } else if (filter === 'songs' || !filter || filter === 'all') {
      searchType = 'video';
      categoryParam = '&videoCategoryId=10'; // Category 10 = YouTube Music
      queryModifier = ' song';
    }

    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=${searchType}${categoryParam}&maxResults=25&q=${encodeURIComponent(q + queryModifier)}&key=${apiKey}`;
    if (pageToken) {
      searchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    let res = await fetchWithRetry(searchUrl, {}, 2, 400);

    // If category-specific search returns 400 (some regions or queries don't support category filtering in search), retry without categoryParam
    if (!res.ok && categoryParam) {
      const retryUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(q + queryModifier)}&key=${apiKey}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const retryRes = await fetchWithRetry(retryUrl, {}, 1, 300);
      if (retryRes.ok) {
        res = retryRes;
      }
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const gError = errJson?.error;
      const reason = gError?.errors?.[0]?.reason || gError?.status || '';
      
      const isUnauthorized = res.status === 401 || reason === 'keyInvalid' || reason === 'API_KEY_INVALID';
      const isQuota = res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || gError?.message?.toLowerCase().includes('quota'));
      const isRateLimit = res.status === 429 || reason === 'rateLimitExceeded' || reason === 'RESOURCE_EXHAUSTED';

      const code = isUnauthorized ? 'UNAUTHORIZED_KEY' : isQuota ? 'QUOTA_EXHAUSTED' : isRateLimit ? 'RATE_LIMITED' : 'SEARCH_UNAVAILABLE';
      let cleanMsg = isQuota
        ? 'Daily YouTube API quota limit reached. You can still add any song directly using its YouTube URL!'
        : isUnauthorized
        ? 'YouTube API credentials invalid. Please verify the API key configuration.'
        : isRateLimit
        ? 'YouTube API request rate limit reached. Please retry in a few moments.'
        : (gError?.message || `YouTube search returned HTTP ${res.status}`);

      return {
        ok: false,
        items: [],
        nextPageToken: null,
        error: cleanMsg,
        code,
        isUnauthorized,
        isConfigMissing: false,
        isQuotaExhausted: isQuota,
        isRateLimited: isRateLimit,
      };
    }

    const data = await res.json();
    const searchItems = data.items || [];
    const nextPageToken = data.nextPageToken || null;
    const videoIds = searchItems.map((it: any) => it.id?.videoId).filter(Boolean);

    // Fetch duration and higher res thumbnails using videos.list
    const durationMap: Record<string, number> = {};
    const highThumbMap: Record<string, string> = {};

    if (videoIds.length > 0) {
      try {
        const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds.join(',')}&key=${apiKey}`;
        const vidRes = await fetchWithRetry(vidUrl, {}, 1, 300);
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          if (vidData.items) {
            for (const vItem of vidData.items) {
              const dur = parseISO8601Duration(vItem.contentDetails?.duration);
              durationMap[vItem.id] = dur;
              const snipThumb =
                vItem.snippet?.thumbnails?.maxres?.url ||
                vItem.snippet?.thumbnails?.high?.url ||
                vItem.snippet?.thumbnails?.medium?.url;
              if (snipThumb) highThumbMap[vItem.id] = snipThumb;
            }
          }
        }
      } catch (e) {
        console.warn('[searchYouTube] Failed to fetch detailed video metadata:', e);
      }
    }

    // ONLY SHOW SONGS & MUSIC: Filter out gaming, interviews, podcasts, shorts, tutorials
    const DISQUALIFIED_KEYWORDS = [
      'gameplay', 'walkthrough', 'playthrough', 'tutorial', 'how to', 'reaction',
      'interview', 'podcast', 'unboxing', 'review', 'vlog', 'daily news', 'breaking news',
      '#shorts', 'speedrun', 'funny moments', 'roast', 'behind the scenes', 'bloopers'
    ];

    const calculateMusicScore = (title: string, channel: string, desc: string, dur: number): number => {
      let score = 100;
      const lowerT = title.toLowerCase();
      const lowerC = channel.toLowerCase();
      const lowerD = desc.toLowerCase();

      // De-prioritize or penalize non-music keywords
      for (const kw of DISQUALIFIED_KEYWORDS) {
        if (lowerT.includes(kw)) score -= 70;
        if (lowerD.includes(kw)) score -= 20;
      }

      // Filter out shorts (< 45s) or super long podcasts (> 20 mins) unless tagged music
      if (dur > 0 && dur < 45) score -= 60;
      if (dur > 1200) score -= 40;

      // Positive Signals: Official topics & music labels
      if (lowerC.endsWith(' - topic')) score += 80;
      if (lowerC.includes('vevo') || lowerC.includes('records') || lowerC.includes('music') || lowerC.includes('audio')) score += 40;
      if (lowerC.includes('t-series') || lowerC.includes('sony') || lowerC.includes('zee') || lowerC.includes('yrf') || lowerC.includes('tips')) score += 50;

      // Positive Signals: Official music keywords in title
      if (lowerT.includes('official music video') || lowerT.includes('official video') || lowerT.includes('official audio')) score += 45;
      if (lowerT.includes('lyric video') || lowerT.includes('lyrics') || lowerT.includes('full song')) score += 35;
      if (lowerT.includes('remix') || lowerT.includes('acoustic') || lowerT.includes('lofi') || lowerT.includes('slowed')) score += 25;

      return score;
    };

    const results = searchItems
      .filter((item: any) => {
        if (filter === 'playlists') return item.id?.kind === 'youtube#playlist' || Boolean(item.id?.playlistId);
        const isPlaylist = item.id?.kind === 'youtube#playlist' || Boolean(item.id?.playlistId);
        return !isPlaylist && Boolean(item.id?.videoId);
      })
      .map((item: any) => {
        const videoId = item.id?.videoId || item.id?.playlistId;
        const isPlaylist = item.id?.kind === 'youtube#playlist' || Boolean(item.id?.playlistId);
        const snip = item.snippet || {};
        const rawTitle = snip.title || 'Untitled Video';
        const channelName = snip.channelTitle || 'YouTube';
        const parsed = parseTitleAndArtist(rawTitle, channelName);
        const thumb =
          highThumbMap[videoId] ||
          snip.thumbnails?.high?.url ||
          snip.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const dur = durationMap[videoId] || 0;
        const score = calculateMusicScore(rawTitle, channelName, snip.description || '', dur);

        return {
          videoId,
          isPlaylist,
          playlistId: isPlaylist ? item.id?.playlistId : undefined,
          title: parsed.title,
          rawTitle,
          artist: parsed.artist,
          channelTitle: channelName,
          thumbnailUrl: thumb,
          youtubeUrl: isPlaylist ? `https://www.youtube.com/playlist?list=${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
          duration: dur,
          description: snip.description || '',
          musicScore: score,
        };
      })
      .filter((it: any) => it.isPlaylist || it.musicScore > 30) // Filter out pure non-music video fluff
      .sort((a: any, b: any) => (b.musicScore || 0) - (a.musicScore || 0));

    return { ok: true, items: results, nextPageToken, source: 'youtube_api' };
  } catch (error: any) {
    console.error('[searchYouTube] Unexpected error:', error);
    return {
      ok: false,
      items: [],
      nextPageToken: null,
      error: error?.message || 'YouTube search is temporarily unavailable. Please try again.',
      code: 'SEARCH_ERROR',
      isUnauthorized: false,
      isConfigMissing: false,
      isQuotaExhausted: false,
      isRateLimited: false,
    };
  }
}

