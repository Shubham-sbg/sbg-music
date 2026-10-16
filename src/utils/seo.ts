/**
 * Utility helper for generating valid JSON-LD schema markup for songs and playlists
 * ensuring all URLs strictly use the canonical production domain.
 */

import { toCanonicalUrl } from '../config/site';

export interface SchemaInputData {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  album?: string;
  description?: string;
  isUserPlaylist?: boolean;
  tracks?: Array<{ id: string; title: string; artist?: string }>;
}

/**
 * Generates a JSON-LD schema object for 'MusicRecording' or 'Playlist' types.
 */
export function generateSchemaMarkup(type: 'MusicRecording' | 'Playlist', data: SchemaInputData): Record<string, any> {
  const defaultImage = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
  const image = data.coverUrl || data.thumbnailUrl || defaultImage;
  const canonicalImage = toCanonicalUrl(image);

  if (type === 'MusicRecording') {
    const songUrl = toCanonicalUrl(`/song/${data.id}`);
    return {
      '@context': 'https://schema.org',
      '@type': 'MusicRecording',
      'name': data.title,
      'byArtist': {
        '@type': 'MusicGroup',
        'name': data.artist || 'SBG Artist'
      },
      ...(data.album ? {
        'inAlbum': {
          '@type': 'MusicAlbum',
          'name': data.album
        }
      } : {}),
      'image': canonicalImage,
      ...(data.duration ? { 'duration': `PT${Math.floor(data.duration)}S` } : {}),
      'url': songUrl,
      'publisher': {
        '@type': 'Organization',
        'name': 'SBG MUSIC',
        'url': toCanonicalUrl('/')
      }
    };
  }

  // Playlist (MusicPlaylist)
  const path = data.isUserPlaylist ? `/user-playlist/${data.id}` : `/playlist/${data.id}`;
  const playlistUrl = toCanonicalUrl(path);

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicPlaylist',
    'name': data.title,
    'description': data.description || `Curated music playlist on SBG MUSIC.`,
    'image': canonicalImage,
    'url': playlistUrl,
    ...(data.tracks ? {
      'numTracks': data.tracks.length,
      'track': data.tracks.slice(0, 50).map((t, idx) => ({
        '@type': 'MusicRecording',
        'position': idx + 1,
        'name': t.title,
        'byArtist': {
          '@type': 'MusicGroup',
          'name': t.artist || 'SBG Artist'
        },
        'url': toCanonicalUrl(`/song/${t.id}`)
      }))
    } : {}),
    'publisher': {
      '@type': 'Organization',
      'name': 'SBG MUSIC',
      'url': toCanonicalUrl('/')
    }
  };
}
