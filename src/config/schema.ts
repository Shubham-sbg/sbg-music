/**
 * Helper utility for generating valid JSON-LD Schema.org markup for songs and playlists
 * ensuring all URLs are strictly canonical and referencing the production domain (https://sbg-song.vercel.app).
 */

import { toCanonicalUrl } from './site';

export interface SongSchemaInput {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  album?: string;
  genre?: string;
}

export interface PlaylistSchemaInput {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  isUserPlaylist?: boolean;
}

/**
 * Generates Schema.org MusicRecording JSON-LD for individual songs
 */
export function generateSongJsonLd(song: SongSchemaInput): Record<string, any> {
  const songUrl = toCanonicalUrl(`/song/${song.id}`);
  const image = song.coverUrl || song.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    'name': song.title,
    'byArtist': {
      '@type': 'MusicGroup',
      'name': song.artist || 'SBG Artist'
    },
    ...(song.album ? {
      'inAlbum': {
        '@type': 'MusicAlbum',
        'name': song.album
      }
    } : {}),
    'image': toCanonicalUrl(image),
    ...(song.duration ? { 'duration': `PT${Math.floor(song.duration)}S` } : {}),
    'url': songUrl,
    'publisher': {
      '@type': 'Organization',
      'name': 'SBG MUSIC',
      'url': toCanonicalUrl('/')
    }
  };
}

/**
 * Generates Schema.org MusicPlaylist JSON-LD for curated and user playlists
 */
export function generatePlaylistJsonLd(playlist: PlaylistSchemaInput): Record<string, any> {
  const path = playlist.isUserPlaylist ? `/user-playlist/${playlist.id}` : `/playlist/${playlist.id}`;
  const playlistUrl = toCanonicalUrl(path);
  const image = playlist.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicPlaylist',
    'name': playlist.title,
    'description': playlist.description || `Curated music playlist on SBG MUSIC.`,
    'image': toCanonicalUrl(image),
    'url': playlistUrl,
    'publisher': {
      '@type': 'Organization',
      'name': 'SBG MUSIC',
      'url': toCanonicalUrl('/')
    }
  };
}
