import { Song, Playlist } from '../types';

export const FALLBACK_SONGS: Song[] = [
  {
    id: 'sbg-1',
    title: 'Neon Horizon',
    artist: 'SBG Sound Lab',
    album: 'Cyber Beats Vol. 1',
    duration: 194,
    genre: 'Synthwave',
    releaseDate: '2026',
    plays: 142000,
    likes: 8900,
    isFeatured: true,
    isPopular: true,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/sbg_anthem.wav',
    source: 'catalog',
    lyrics: `[00:10.00] Driving through the neon rain
[00:25.00] Speeding lights across the brain
[00:40.00] Electric heart that never stops
[00:55.00] We reach the summit of the drops
[01:15.00] Lost in the digital embrace
[01:30.00] Never turning from this pace`
  },
  {
    id: 'sbg-2',
    title: 'Midnight Lo-Fi Chill',
    artist: 'Aura Collective',
    album: 'Night Coffee Sessions',
    duration: 168,
    genre: 'Lo-Fi',
    releaseDate: '2026',
    plays: 289400,
    likes: 19420,
    isFeatured: true,
    isPopular: true,
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/lofi_rhodes.wav',
    source: 'catalog',
    lyrics: `[00:05.00] Soft rain outside the window pane
[00:20.00] Quiet echoes ease the pain
[00:45.00] Melodies for the sleepless mind
[01:10.00] A peaceful state of dream we find`
  },
  {
    id: 'sbg-3',
    title: 'Desi Trap Pulse',
    artist: 'Rhythm Raja & SBG',
    album: 'Bass Sutra',
    duration: 215,
    genre: 'Desi Hip-Hop',
    releaseDate: '2026',
    plays: 412000,
    likes: 31050,
    isFeatured: true,
    isPopular: true,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/trap_808.wav',
    source: 'catalog',
    lyrics: `[00:12.00] Dholak rhythm with the heavy bass
[00:28.00] Pumping energy through time and space
[00:50.00] Urban streets lighting up tonight
[01:12.00] Feel the vibration taking flight`
  },
  {
    id: 'sbg-4',
    title: 'Echoes of Eternity',
    artist: 'Celeste Vibe',
    album: 'Infinite Echoes',
    duration: 232,
    genre: 'Ambient',
    releaseDate: '2026',
    plays: 98400,
    likes: 6730,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/ambient_meditation.wav',
    source: 'catalog',
  },
  {
    id: 'sbg-5',
    title: 'Cyberpunk Drive 2088',
    artist: 'Overdrive X',
    album: 'Velocity',
    duration: 185,
    genre: 'Electronic',
    releaseDate: '2026',
    plays: 521000,
    likes: 42100,
    isFeatured: true,
    isPopular: true,
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/cyberpunk_synth.wav',
    source: 'catalog',
  },
  {
    id: 'sbg-6',
    title: 'Soulful Golden Hour',
    artist: 'Maya Lin',
    album: 'Sunset Melodies',
    duration: 204,
    genre: 'R&B / Soul',
    releaseDate: '2026',
    plays: 178000,
    likes: 12400,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
    audioUrl: '/audio/cinematic_swell.wav',
    source: 'catalog',
  }
];

export const FALLBACK_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-featured-hits',
    title: 'SBG Top Trending 2026',
    name: 'SBG Top Trending 2026',
    description: 'The hottest chart-toppers and bass anthems curated by SBG Music editors.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    songCount: 6,
    isFeatured: true,
    category: 'Trending',
    songs: FALLBACK_SONGS,
  },
  {
    id: 'pl-chill-beats',
    title: 'Deep Focus & Chill',
    name: 'Deep Focus & Chill',
    description: 'Smooth lo-fi, ambient atmospheres, and mellow beats for working and relaxing.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    songCount: 3,
    isFeatured: true,
    category: 'Chill',
    songs: [FALLBACK_SONGS[1], FALLBACK_SONGS[3], FALLBACK_SONGS[5]],
  },
  {
    id: 'pl-electronic-rush',
    title: 'High Octane Synth & Trap',
    name: 'High Octane Synth & Trap',
    description: 'Heavy 808s, driving synthwave basslines, and adrenaline-charged drops.',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    songCount: 3,
    isFeatured: true,
    category: 'Workout',
    songs: [FALLBACK_SONGS[0], FALLBACK_SONGS[2], FALLBACK_SONGS[4]],
  }
];
