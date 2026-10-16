import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { invalidateCache } from '../hooks/useCatalog';

export interface CatalogSongInput {
  id?: string;
  songId?: string;
  title: string;
  artist: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  audioUrl?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  durationSeconds?: number;
  genre?: string;
  album?: string;
  source?: 'youtube' | 'sbg' | 'upload';
}

/**
 * Checks if a song exists in the official SBG catalog by ID or YouTube video ID.
 */
export async function checkInSbgCatalog(songIdentifier: string): Promise<{ exists: boolean; songId?: string }> {
  if (!songIdentifier) return { exists: false };

  try {
    // 1. Direct document check
    if (!songIdentifier.startsWith('yt_') && songIdentifier.length >= 10) {
      const docRef = doc(db, 'songs', songIdentifier);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { exists: true, songId: snap.id };
      }
    }

    // 2. Check by youtubeVideoId
    const ytVideoId = songIdentifier.replace(/^yt_/, '');
    if (ytVideoId) {
      const q = query(
        collection(db, 'songs'),
        where('youtubeVideoId', '==', ytVideoId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { exists: true, songId: snap.docs[0].id };
      }
    }

    // 3. Fallback check by id field
    const qId = query(
      collection(db, 'songs'),
      where('id', '==', songIdentifier)
    );
    const snapId = await getDocs(qId);
    if (!snapId.empty) {
      return { exists: true, songId: snapId.docs[0].id };
    }

    return { exists: false };
  } catch (error) {
    console.warn('[CatalogService] checkInSbgCatalog error:', error);
    return { exists: false };
  }
}

/**
 * Adds or registers a song directly into the official SBG catalog (Admin & Staff authorized).
 */
export async function addToSbgCatalog(input: CatalogSongInput): Promise<{ success: boolean; alreadyExists?: boolean; songId?: string; error?: string }> {
  try {
    const rawYtId = input.youtubeVideoId || (input.id?.startsWith('yt_') ? input.id.replace(/^yt_/, '') : undefined);
    
    // Check if already in catalog
    const checkRes = await checkInSbgCatalog(rawYtId || input.songId || input.id || '');
    if (checkRes.exists) {
      return { success: true, alreadyExists: true, songId: checkRes.songId };
    }

    const durationSec = Number(input.durationSeconds || input.duration || 180);
    const thumb = input.coverUrl || input.thumbnailUrl || (rawYtId ? `https://img.youtube.com/vi/${rawYtId}/hqdefault.jpg` : '');

    const newSongData: Record<string, any> = {
      title: input.title?.trim() || 'Untitled Track',
      artist: input.artist?.trim() || 'Unknown Artist',
      album: input.album?.trim() || 'SBG Single',
      genre: input.genre?.trim() || 'Official',
      duration: durationSec,
      durationSeconds: durationSec,
      coverUrl: thumb,
      thumbnailUrl: thumb,
      heroImageUrl: thumb,
      published: true,
      downloadEnabled: false,
      isAvailableOffline: false,
      source: input.source || (rawYtId ? 'youtube' : 'sbg'),
      sourceType: rawYtId ? 'YOUTUBE' : 'SBG_CATALOG',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (rawYtId) {
      newSongData.youtubeVideoId = rawYtId;
      newSongData.youtubeUrl = input.youtubeUrl || `https://www.youtube.com/watch?v=${rawYtId}`;
    }

    if (input.audioUrl) {
      newSongData.audioUrl = input.audioUrl;
    }

    const docRef = await addDoc(collection(db, 'songs'), newSongData);
    
    // Invalidate local in-memory catalog cache so new song immediately surfaces in catalog
    invalidateCache();

    return { success: true, alreadyExists: false, songId: docRef.id };
  } catch (error: any) {
    console.error('[CatalogService] addToSbgCatalog failed:', error);
    return { success: false, error: error?.message || 'Failed to add song to SBG catalog' };
  }
}

/**
 * Submits a song for SBG Music catalog approval (Public listeners & authenticated users).
 */
export async function submitSongForSbgApproval(
  input: CatalogSongInput, 
  user: { uid: string; email?: string | null; displayName?: string | null }
): Promise<{ success: boolean; alreadySubmitted?: boolean; submissionId?: string; error?: string }> {
  try {
    if (!user || !user.uid) {
      return { success: false, error: 'Sign in required to submit songs to SBG Music.' };
    }

    const rawYtId = input.youtubeVideoId || (input.id?.startsWith('yt_') ? input.id.replace(/^yt_/, '') : undefined);
    const thumb = input.coverUrl || input.thumbnailUrl || (rawYtId ? `https://img.youtube.com/vi/${rawYtId}/hqdefault.jpg` : '');

    // 1. Check if already in official catalog
    const checkCatalog = await checkInSbgCatalog(rawYtId || input.songId || input.id || '');
    if (checkCatalog.exists) {
      return { success: true, alreadySubmitted: true, submissionId: checkCatalog.songId };
    }

    // 2. Check if user already submitted this
    if (rawYtId) {
      const q = query(
        collection(db, 'submitted_songs'),
        where('youtubeVideoId', '==', rawYtId),
        where('submittedByUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { success: true, alreadySubmitted: true, submissionId: snap.docs[0].id };
      }
    }

    const submissionData = {
      title: input.title?.trim() || 'Untitled Track',
      artist: input.artist?.trim() || 'Unknown Artist',
      youtubeVideoId: rawYtId || null,
      youtubeUrl: input.youtubeUrl || (rawYtId ? `https://www.youtube.com/watch?v=${rawYtId}` : null),
      thumbnailUrl: thumb,
      duration: Number(input.durationSeconds || input.duration || 180),
      submittedByUid: user.uid,
      submittedByEmail: user.email || null,
      submittedByName: user.displayName || null,
      status: 'pending',
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, 'submitted_songs'), submissionData);
    return { success: true, alreadySubmitted: false, submissionId: docRef.id };
  } catch (error: any) {
    console.error('[CatalogService] submitSongForSbgApproval error:', error);
    return { success: false, error: error?.message || 'Failed to submit song for SBG approval' };
  }
}

/**
 * Checks if a song has already been submitted by the user.
 */
export async function checkSongSubmissionStatus(identifier: string, userId?: string): Promise<{ isSubmitted: boolean; status?: string }> {
  if (!identifier || !userId) return { isSubmitted: false };

  try {
    const rawYtId = identifier.replace(/^yt_/, '');
    const q = query(
      collection(db, 'submitted_songs'),
      where('youtubeVideoId', '==', rawYtId),
      where('submittedByUid', '==', userId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return { isSubmitted: true, status: data.status || 'pending' };
    }
    return { isSubmitted: false };
  } catch (e) {
    return { isSubmitted: false };
  }
}
