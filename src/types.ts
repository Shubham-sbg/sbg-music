export type SynthesizerMood = 'synthwave' | 'cyberpunk' | 'ambient' | 'hiphop' | 'acoustic' | 'anthem';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // in seconds
  audioUrl?: string;
  genre: string;
  mood: SynthesizerMood;
  bpm?: number;
  isLiked?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Track[];
  queueIndex: number;
}
