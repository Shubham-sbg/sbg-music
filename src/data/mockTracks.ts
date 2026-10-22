import { FALLBACK_SONGS } from './fallbackCatalog';
import { Track } from '../types';

export const INITIAL_TRACKS: Track[] = FALLBACK_SONGS.map((song) => ({
  ...song,
  duration: song.duration || song.durationSeconds || 180,
  genre: song.genre || 'Electronic',
  mood: 'synthwave',
  artwork: song.coverUrl || song.imageUrl || '',
  album: song.album || 'SBG Master Collection',
}));

export default INITIAL_TRACKS;
