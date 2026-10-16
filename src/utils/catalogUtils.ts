import { Song } from '../types';

export type SongSourceType = 'SBG_CATALOG' | 'YOUTUBE' | 'OTHER';

/**
 * Determines the explicit sourceType of any catalog song item.
 */
export function getSongSourceType(song?: Partial<Song> | null): SongSourceType {
  if (!song) return 'OTHER';

  if (song.sourceType === 'SBG_CATALOG' || song.sourceType === 'YOUTUBE' || song.sourceType === 'OTHER') {
    return song.sourceType;
  }

  // Explicit YouTube flags or YouTube IDs
  if (
    song.source === 'youtube' ||
    (typeof song.youtubeVideoId === 'string' && song.youtubeVideoId.length > 5) ||
    (typeof song.youtubeUrl === 'string' && song.youtubeUrl.includes('youtu'))
  ) {
    return 'YOUTUBE';
  }

  // SBG-catalog direct tracks
  if (
    song.source === 'sbg' ||
    song.source === 'upload' ||
    (typeof song.audioUrl === 'string' && !song.audioUrl.includes('youtu') && song.audioUrl.length > 5)
  ) {
    return 'SBG_CATALOG';
  }

  return 'OTHER';
}

/**
 * Verifies whether a song is legally and technically eligible for offline download.
 * Rule:
 * - SBG_CATALOG tracks with downloadable/audioUrl -> Eligible (true)
 * - YOUTUBE streaming-only -> Not Eligible (false, restricted by YouTube terms)
 * - OTHER -> Only if explicitly enabled
 */
export function isSongDownloadable(song?: Partial<Song> | null): boolean {
  if (!song) return false;

  const sourceType = getSongSourceType(song);

  // YouTube content is streaming only unless separately licensed
  if (sourceType === 'YOUTUBE') {
    return false;
  }

  // Explicit flag check
  if (typeof song.downloadable === 'boolean') {
    return song.downloadable;
  }

  if (typeof song.downloadEnabled === 'boolean') {
    return song.downloadEnabled;
  }

  // SBG catalog with audio stream is eligible by default
  if (sourceType === 'SBG_CATALOG' && Boolean(song.audioUrl)) {
    return true;
  }

  return false;
}

/**
 * Returns human-readable label and style configuration for song source badges.
 */
export function getSourceBadgeInfo(song?: Partial<Song> | null): {
  type: SongSourceType;
  label: string;
  badgeClass: string;
  isDownloadable: boolean;
  unavailabilityNotice?: string;
} {
  const type = getSongSourceType(song);
  const downloadable = isSongDownloadable(song);

  switch (type) {
    case 'SBG_CATALOG':
      return {
        type: 'SBG_CATALOG',
        label: 'SBG MUSIC',
        badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        isDownloadable: downloadable,
      };
    case 'YOUTUBE':
      return {
        type: 'YOUTUBE',
        label: 'YouTube',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        isDownloadable: false,
        unavailabilityNotice: 'Offline download unavailable for this source.',
      };
    case 'OTHER':
    default:
      return {
        type: 'OTHER',
        label: 'External Track',
        badgeClass: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
        isDownloadable: downloadable,
        unavailabilityNotice: !downloadable ? 'Offline download unavailable for this track.' : undefined,
      };
  }
}
