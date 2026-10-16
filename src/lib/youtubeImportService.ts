import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  writeBatch, 
  doc, 
  serverTimestamp,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

export interface YouTubeVideoPreview {
  videoId: string;
  title: string;
  artist: string;
  rawTitle?: string;
  description?: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  duration?: number;
  selected: boolean;
  isExisting?: boolean;
  existingId?: string;
  isAlreadyInPlaylist?: boolean;
}

export interface YouTubePlaylistData {
  id: string;
  title: string;
  description: string;
  author: string;
  thumbnailUrl: string;
  totalVideos: number;
  videos: YouTubeVideoPreview[];
  source?: string;
}

export interface ImportCheckpoint {
  jobId: string; // unique identifier (e.g. yt_playlist_<playlistId>)
  playlistUrl: string;
  targetPlaylistId?: string; // If adding to an existing SBG playlist
  playlistTitle: string;
  playlistDescription: string;
  totalItems: number;
  processedCount: number;
  newCreatedCount: number;
  reusedCount: number;
  failedCount: number;
  failedVideoIds?: string[];
  failedDetails?: Array<{
    videoId: string;
    title: string;
    error: string;
    segment?: string;
    timestamp: string;
  }>;
  finalSongIds: string[];
  processedVideoIds: string[];
  lastProcessedVideoId?: string;
  videosToProcess: YouTubeVideoPreview[];
  status: 'idle' | 'importing' | 'paused' | 'rate_limited' | 'quota_exhausted' | 'completed' | 'failed' | 'cleared';
  lastError?: string;
  updatedAt: number;
}

// Custom error for Quota Exhaustion
export class YouTubeQuotaExhaustedError extends Error {
  constructor(message = 'YouTube API daily quota has been exhausted. Please try again after quota reset or configure a valid higher-quota project.') {
    super(message);
    this.name = 'YouTubeQuotaExhaustedError';
  }
}

// Custom error for Rate Limiting
export class YouTubeRateLimitError extends Error {
  constructor(message = 'Rate limit exceeded. Waiting before retrying safely...') {
    super(message);
    this.name = 'YouTubeRateLimitError';
  }
}

// --- CHECKPOINT STORAGE UTILS ---
export async function saveCheckpoint(checkpoint: ImportCheckpoint): Promise<void> {
  try {
    const cpRef = doc(db, 'import_checkpoints', checkpoint.jobId);
    await setDoc(cpRef, {
      ...checkpoint,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('Failed to save import checkpoint to Firestore:', e);
  }
}

export async function loadCheckpoint(jobId: string): Promise<ImportCheckpoint | null> {
  try {
    const cpRef = doc(db, 'import_checkpoints', jobId);
    const snap = await getDoc(cpRef);
    if (snap.exists()) {
      return snap.data() as ImportCheckpoint;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load import checkpoint from Firestore:', e);
    return null;
  }
}

export async function clearCheckpoint(jobId: string): Promise<void> {
  try {
    const cpRef = doc(db, 'import_checkpoints', jobId);
    await deleteDoc(cpRef);
  } catch (e) {
    console.warn('Failed to clear checkpoint in Firestore:', e);
  }
}

export async function getActiveCheckpointForUrl(urlOrId: string): Promise<ImportCheckpoint | null> {
  try {
    const q = query(
      collection(db, 'import_checkpoints'),
      where('playlistUrl', '==', urlOrId)
    );
    const snap = await getDocs(q);
    
    let activeCp: ImportCheckpoint | null = null;
    snap.forEach((docSnap) => {
      const cp = docSnap.data() as ImportCheckpoint;
      if (cp.status !== 'completed' && cp.status !== 'cleared') {
        activeCp = cp;
      }
    });
    return activeCp;
  } catch (e) {
    console.warn('Error reading checkpoints from Firestore:', e);
  }
  return null;
}

// --- RATE-LIMITED & BACKOFF FETCH WRAPPER ---
async function fetchWithBackoff<T>(
  fetcher: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    onStatusUpdate?: (statusMessage: string) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  let delayMs = options.initialDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fetcher();
    } catch (err: any) {
      const errMsg = err.message || String(err);
      
      // 1. Quota Exhaustion Check -> Non-retryable
      if (
        err instanceof YouTubeQuotaExhaustedError ||
        errMsg.includes('quotaExhausted') || 
        errMsg.includes('quota has been exhausted') || 
        errMsg.includes('QUOTA_EXHAUSTED') ||
        err.status === 403
      ) {
        throw new YouTubeQuotaExhaustedError(err.message);
      }

      // 2. Non-retryable HTTP client errors (400 Bad Request, 404 Not Found, 401 Unauthorized, 405 Method Not Allowed)
      if (err.status === 400 || err.status === 404 || err.status === 401 || err.status === 405) {
        throw err;
      }

      // 3. Retryable Error (429 Rate Limit, Network error, 500+, etc.)
      if (attempt > maxRetries) {
        throw err;
      }

      // Add random jitter (100-500ms) to avoid synchronized retry spikes
      const jitter = Math.floor(Math.random() * 400) + 100;
      const totalWait = delayMs + jitter;

      if (options.onStatusUpdate) {
        const isRateLimit = err instanceof YouTubeRateLimitError || err.status === 429 || errMsg.toLowerCase().includes('rate limit');
        const reasonStr = isRateLimit ? 'Rate limited by YouTube server' : 'Network/server glitch';
        options.onStatusUpdate(`${reasonStr}. Waiting ${Math.round(totalWait / 1000)}s before retrying safely (Attempt ${attempt}/${maxRetries})...`);
      }

      console.warn(`[YouTubeImportService] Attempt ${attempt} failed with "${errMsg}". Retrying in ${totalWait}ms...`);
      await new Promise((resolve) => setTimeout(resolve, totalWait));

      delayMs = Math.min(delayMs * 2, 16000); // Exponential backoff capped at 16 seconds
    }
  }

  throw new Error('Maximum retries exceeded.');
}

// --- BULK FIRESTORE DEDUPLICATION ---
export async function bulkCheckExistingSongsInDb(videoIds: string[]): Promise<Record<string, { id: string; title: string; artist: string }>> {
  const existingMap: Record<string, { id: string; title: string; artist: string }> = {};
  if (!videoIds || videoIds.length === 0) return existingMap;

  // Deduplicate input video IDs
  const uniqueVideoIds = Array.from(new Set(videoIds.filter(Boolean)));

  // Firestore 'in' queries allow a maximum of 10 elements per array
  const CHUNK_SIZE = 10;
  for (let i = 0; i < uniqueVideoIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueVideoIds.slice(i, i + CHUNK_SIZE);

    // Query 1: Direct match on youtubeVideoId
    try {
      const q1 = query(collection(db, 'songs'), where('youtubeVideoId', 'in', chunk));
      const snap1 = await getDocs(q1);
      snap1.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.youtubeVideoId) {
          existingMap[data.youtubeVideoId] = {
            id: docSnap.id,
            title: data.title || '',
            artist: data.artist || '',
          };
        }
      });
    } catch (err) {
      console.warn('Error during bulk Firestore song check (youtubeVideoId chunk):', err);
    }

    // Query 2: Fallback match on youtubeUrl for legacy documents missing youtubeVideoId
    const missingInChunk = chunk.filter((id) => !existingMap[id]);
    if (missingInChunk.length > 0) {
      try {
        const urls = missingInChunk.map((id) => `https://www.youtube.com/watch?v=${id}`);
        const q2 = query(collection(db, 'songs'), where('youtubeUrl', 'in', urls));
        const snap2 = await getDocs(q2);
        snap2.forEach((docSnap) => {
          const data = docSnap.data();
          const matchedVid = data.youtubeVideoId || missingInChunk.find((id) => (data.youtubeUrl || '').includes(id));
          if (matchedVid && !existingMap[matchedVid]) {
            existingMap[matchedVid] = {
              id: docSnap.id,
              title: data.title || '',
              artist: data.artist || '',
            };
          }
        });
      } catch (err) {
        // Fallback query might fail if missing index, ignore safely
      }
    }

    // Small controlled delay between Firestore read chunks to prevent bursts
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  return existingMap;
}

// --- FETCH PLAYLIST METADATA & VIDEOS VIA SERVER PROXY ---
export async function fetchYouTubePlaylistServer(
  playlistUrlOrId: string,
  onStatusUpdate?: (status: string) => void
): Promise<YouTubePlaylistData> {
  if (onStatusUpdate) onStatusUpdate('Contacting server to fetch playlist metadata...');

  let allVideos: YouTubeVideoPreview[] = [];
  let pageToken: string | undefined = undefined;
  let masterData: YouTubePlaylistData | null = null;
  let pageCount = 0;

  do {
    pageCount++;
    if (onStatusUpdate) onStatusUpdate(`Fetching page ${pageCount} of playlist...`);

    const data = await fetchWithBackoff(async () => {
      const res = await fetch('/api/youtube/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlistUrlOrId.trim(), pageToken }),
      });

      const text = await res.text();
      let parsedData: any = {};
      try {
        parsedData = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error('[YouTubeImportService] Failed to parse JSON from response. Status:', res.status, 'Raw Body:', text.substring(0, 200));
        const error: any = new Error(`Server returned an invalid response (Status ${res.status}).`);
        error.status = res.status;
        throw error;
      }

      if (!res.ok) {
        if (res.status === 403 || parsedData.isQuotaExhausted || parsedData.code === 'QUOTA_EXHAUSTED' || parsedData.error?.includes('quota')) {
          const quotaErr: any = new YouTubeQuotaExhaustedError(parsedData.error);
          quotaErr.metadata = parsedData.metadata;
          throw quotaErr;
        }
        if (res.status === 429 || parsedData.isRateLimited || parsedData.code === 'RATE_LIMITED') {
          const rateErr: any = new YouTubeRateLimitError(parsedData.error || 'Rate limit exceeded.');
          rateErr.status = 429;
          rateErr.metadata = parsedData.metadata;
          throw rateErr;
        }
        const error: any = new Error(parsedData.error || `Failed to fetch YouTube playlist (Status ${res.status})`);
        error.status = res.status;
        error.metadata = parsedData.metadata || {
          segment: 'FETCH_PLAYLIST_ITEMS',
          pageToken,
          timestamp: new Date().toISOString(),
        };
        throw error;
      }

      return parsedData as YouTubePlaylistData & { nextPageToken?: string };
    }, { onStatusUpdate });

    if (!masterData) {
      masterData = data;
    }
    
    if (data.videos) {
      allVideos = allVideos.concat(data.videos);
    }
    
    pageToken = data.nextPageToken;
    
  } while (pageToken);

  if (!masterData) {
    throw new Error('Failed to fetch playlist data.');
  }

  masterData.videos = allVideos;
  masterData.totalVideos = allVideos.length; // Ensure accurate count
  
  if (onStatusUpdate) onStatusUpdate(`Found ${allVideos.length} videos. Preparing import...`);

  return masterData;
}

// --- CHUNKED EXECUTION ENGINE FOR PLAYLIST IMPORT ---
export async function executeResumableImport(options: {
  checkpoint: ImportCheckpoint;
  staffDisplayName: string;
  userId?: string;
  onProgress: (checkpoint: ImportCheckpoint) => void;
}): Promise<ImportCheckpoint> {
  const { staffDisplayName, userId, onProgress } = options;
  let cp: ImportCheckpoint = { ...options.checkpoint, status: 'importing' };
  await saveCheckpoint(cp);
  onProgress(cp);

  const selectedVideos = cp.videosToProcess;
  const processedSet = new Set(cp.processedVideoIds || []);
  const finalSongIds = [...(cp.finalSongIds || [])];

  // Step 1: Bulk check existing songs in Firestore ahead of execution
  const unprocessedVideos = selectedVideos.filter((v) => !processedSet.has(v.videoId));
  const videoIdsToCheck = unprocessedVideos.map((v) => v.videoId);
  
  let existingDbMap: Record<string, { id: string; title: string; artist: string }> = {};
  if (videoIdsToCheck.length > 0) {
    existingDbMap = await bulkCheckExistingSongsInDb(videoIdsToCheck);
  }

  // Step 2: Chunked batch processing to make it 10x faster and extremely reliable
  const CHUNK_SIZE = 25; // 25 songs per chunk batch
  for (let c = 0; c < selectedVideos.length; c += CHUNK_SIZE) {
    const chunk = selectedVideos.slice(c, c + CHUNK_SIZE);
    
    // Filter videos in this chunk that haven't been processed yet
    const unprocessedInChunk = chunk.filter(video => !processedSet.has(video.videoId));
    if (unprocessedInChunk.length === 0) {
      continue;
    }

    const batch = writeBatch(db);
    let hasNewSongs = false;
    let chunkNewCount = 0;
    let chunkReusedCount = 0;
    const chunkNewSongIds: string[] = [];
    const chunkProcessedVids: string[] = [];

    for (const video of unprocessedInChunk) {
      try {
        let targetSongId = '';

        // Check if song already exists in Firestore (via bulk map or video object)
        let existingInDb = existingDbMap[video.videoId] || (video.isExisting && video.existingId ? { id: video.existingId } : null);

        // Secondary validation safeguard: On-the-fly single document check by youtubeVideoId
        if (!existingInDb && video.videoId) {
          try {
            const singleQ = query(collection(db, 'songs'), where('youtubeVideoId', '==', video.videoId));
            const singleSnap = await getDocs(singleQ);
            if (!singleSnap.empty) {
              const matchedDoc = singleSnap.docs[0];
              existingInDb = {
                id: matchedDoc.id,
                title: matchedDoc.data().title || '',
                artist: matchedDoc.data().artist || '',
              };
              existingDbMap[video.videoId] = existingInDb;
            }
          } catch (e) {
            // Ignore single lookup error
          }
        }

        if (existingInDb && existingInDb.id) {
          targetSongId = existingInDb.id;
          chunkReusedCount += 1;
        } else {
          // Pre-generate doc reference to get ID before committing the batch
          const newSongDocRef = doc(collection(db, 'songs'));
          targetSongId = newSongDocRef.id;

          batch.set(newSongDocRef, {
            title: video.title || video.rawTitle || 'Untitled Video',
            artist: video.artist || cp.playlistTitle || 'SBG Music',
            description: video.description || '',
            genre: 'Various',
            releaseDate: new Date().toISOString().split('T')[0],
            youtubeUrl: video.youtubeUrl,
            youtubeVideoId: video.videoId,
            coverUrl: video.thumbnailUrl,
            thumbnailUrl: video.thumbnailUrl,
            audioUrl: video.youtubeUrl,
            duration: video.duration || 0,
            durationSeconds: video.duration || 0,
            explicitContent: false,
            downloadEnabled: false,
            published: true,
            showYoutubeSourceBadge: false,
            source: 'youtube',
            sourcePlaylistId: cp.jobId,
            createdBy: staffDisplayName,
            createdById: userId || 'staff',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          hasNewSongs = true;
          chunkNewCount += 1;

          // Cache targetSongId immediately to prevent duplicate song creations for repeated tracks within the same playlist
          existingDbMap[video.videoId] = {
            id: targetSongId,
            title: video.title || '',
            artist: video.artist || '',
          };
        }

        if (targetSongId && !chunkNewSongIds.includes(targetSongId)) {
          chunkNewSongIds.push(targetSongId);
        }

        chunkProcessedVids.push(video.videoId);
      } catch (itemErr: any) {
        console.error(`Error preparing song in batch [Track: "${video.title}" (ID: ${video.videoId})]:`, itemErr);
        cp.failedCount += 1;
        if (!cp.failedVideoIds) cp.failedVideoIds = [];
        if (!cp.failedDetails) cp.failedDetails = [];
        cp.failedVideoIds.push(video.videoId);
        cp.failedDetails.push({
          videoId: video.videoId,
          title: video.title || video.rawTitle || 'Untitled Video',
          error: itemErr.message || 'Failed to process track metadata.',
          segment: itemErr.metadata?.segment || 'SONG_DOCUMENT_PREPARATION',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Commit any new songs in this chunk
    if (hasNewSongs) {
      try {
        await batch.commit();
      } catch (commitErr: any) {
        console.error(`Failed to commit Firestore batch write for chunk starting at index ${c}:`, commitErr);
        cp.failedCount += unprocessedInChunk.length;
        cp.lastError = `[Batch Commit Error @ Segment: FIRESTORE_BATCH_COMMIT] ${commitErr.message || 'Failed to write tracks batch.'}`;
        if (!cp.failedDetails) cp.failedDetails = [];
        for (const unp of unprocessedInChunk) {
          cp.failedDetails.push({
            videoId: unp.videoId,
            title: unp.title || 'Untitled Video',
            error: commitErr.message || 'Firestore batch write failed',
            segment: 'FIRESTORE_BATCH_COMMIT',
            timestamp: new Date().toISOString(),
          });
        }
        await saveCheckpoint(cp);
        onProgress(cp);
        throw commitErr;
      }
    }

    // Update checkpoint counts ONLY after successful commit
    cp.newCreatedCount += chunkNewCount;
    cp.reusedCount += chunkReusedCount;
    for (const sid of chunkNewSongIds) {
      if (!finalSongIds.includes(sid)) finalSongIds.push(sid);
    }
    for (const vid of chunkProcessedVids) {
      processedSet.add(vid);
    }

    cp.processedCount = processedSet.size;
    cp.processedVideoIds = Array.from(processedSet);
    cp.finalSongIds = finalSongIds;
    cp.status = 'importing';
    
    await saveCheckpoint(cp);
    onProgress(cp);

    // Optional tiny delay between chunks to let UI render and balance Firestore throughput
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Step 3: Finalize SBG Playlist (Create new playlist or update existing)
  try {
    if (cp.targetPlaylistId) {
      // Append song IDs to existing SBG Playlist
      const plDocRef = doc(db, 'playlists', cp.targetPlaylistId);
      const plSnap = await getDoc(plDocRef);
      if (plSnap.exists()) {
        const existingPlaylistSongs: string[] = plSnap.data().songIds || [];
        const combined = Array.from(new Set([...existingPlaylistSongs, ...finalSongIds]));
        await updateDoc(plDocRef, {
          songIds: combined,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Create new SBG Playlist document
      const playlistCover = cp.videosToProcess[0]?.thumbnailUrl || '';
      const plRef = await addDoc(collection(db, 'playlists'), {
        title: cp.playlistTitle.trim() || 'Imported Playlist',
        description: cp.playlistDescription.trim() || '',
        coverUrl: playlistCover,
        songIds: finalSongIds,
        published: true,
        source: 'youtube',
        createdBy: staffDisplayName,
        createdById: userId || 'staff',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      cp.targetPlaylistId = plRef.id;
    }

    cp.status = (cp.newCreatedCount === 0 && cp.reusedCount === 0 && cp.failedCount > 0)
      ? 'failed'
      : (cp.failedCount > 0 ? 'completed_with_errors' as any : 'completed');

    if (cp.status === 'failed' && !cp.lastError) {
      cp.lastError = `Import failed: All ${cp.failedCount} requested tracks failed to process or save to Firestore.`;
    }

    // Verification step: Read back playlist document from Firestore to guarantee write persistence
    if (cp.targetPlaylistId && cp.status !== 'failed') {
      try {
        const verifySnap = await getDoc(doc(db, 'playlists', cp.targetPlaylistId));
        if (!verifySnap.exists()) {
          cp.status = 'failed';
          cp.lastError = `Firestore verification failed: Playlist document ${cp.targetPlaylistId} does not exist after write.`;
        }
      } catch (verifyErr: any) {
        console.warn('[youtubeImportService] Firestore read-back verification warning:', verifyErr);
      }
    }

    await saveCheckpoint(cp);
    onProgress(cp);
    return cp;
  } catch (finalErr: any) {
    console.error('Failed to finalize playlist document:', finalErr);
    cp.status = 'failed';
    cp.lastError = finalErr.message || 'Failed to save playlist in database';
    await saveCheckpoint(cp);
    onProgress(cp);
    throw finalErr;
  }
}
