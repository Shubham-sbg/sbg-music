import { Song } from '../types';
import { OfflineDownloadService } from './offlineDownloadService';

export interface MusicGenerationParams {
  prompt: string;
  genre: 'lofi' | 'synthwave' | 'hiphop' | 'cinematic' | 'edm' | 'ambient' | 'gaming';
  mood?: 'energetic' | 'chill' | 'epic' | 'dark' | 'uplifting' | 'melancholic';
  durationSeconds: number; // e.g. 15, 30, 45, 60, 90
  bpm?: number;
  includeDrums?: boolean;
  instrumentalOnly?: boolean;
}

export interface GeneratedTrackResult {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  audioBlob: Blob;
  audioUrl: string;
  bpm: number;
  lyrics?: string;
  generatedAt: number;
  modelUsed: string;
}

// Frequencies for standard musical notes
const NOTE_FREQS: Record<string, number> = {
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
};

// Genre scale mappings & chords
const GENRE_SCALES: Record<string, { chords: string[][]; bass: string[]; melody: string[]; defaultBpm: number }> = {
  lofi: {
    defaultBpm: 75,
    chords: [
      ['D3', 'F3', 'A3', 'C4'], // Dm7
      ['G3', 'B3', 'D4', 'F4'], // G7
      ['C3', 'E3', 'G3', 'B3'], // Cmaj7
      ['A2', 'C3', 'E3', 'G3'], // Am7
    ],
    bass: ['D2', 'G2', 'C2', 'A2'],
    melody: ['A4', 'C5', 'D5', 'E5', 'F5', 'E5', 'C5', 'A4'],
  },
  synthwave: {
    defaultBpm: 110,
    chords: [
      ['A3', 'C4', 'E4'], // Am
      ['F3', 'A3', 'C4'], // F
      ['C3', 'E3', 'G3'], // C
      ['G3', 'B3', 'D4'], // G
    ],
    bass: ['A2', 'F2', 'C2', 'G2'],
    melody: ['E4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'E4'],
  },
  hiphop: {
    defaultBpm: 90,
    chords: [
      ['C3', 'D#3', 'G3', 'A#3'], // Cm7
      ['G#2', 'C3', 'D#3', 'G3'], // G#maj7
      ['A#2', 'D3', 'F3', 'G#3'], // A#7
      ['G2', 'B2', 'D3', 'F3'],    // G7
    ],
    bass: ['C2', 'G2', 'C2', 'F2'],
    melody: ['C4', 'D#4', 'F4', 'G4', 'A#4', 'G4', 'F4', 'D#4'],
  },
  cinematic: {
    defaultBpm: 80,
    chords: [
      ['D3', 'F3', 'A3'], // Dm
      ['A#2', 'D3', 'F3'], // Bb
      ['F3', 'A3', 'C4'], // F
      ['C3', 'E3', 'G3'], // C
    ],
    bass: ['D2', 'A2', 'F2', 'C2'],
    melody: ['D4', 'F4', 'A4', 'D5', 'C5', 'A4', 'F4', 'E4'],
  },
  edm: {
    defaultBpm: 128,
    chords: [
      ['F3', 'A3', 'C4'], // F
      ['G3', 'B3', 'D4'], // G
      ['A3', 'C4', 'E4'], // Am
      ['E3', 'G3', 'B3'], // Em
    ],
    bass: ['F2', 'G2', 'A2', 'E2'],
    melody: ['A4', 'C5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4'],
  },
  ambient: {
    defaultBpm: 65,
    chords: [
      ['C3', 'E3', 'G3', 'B3', 'D4'], // Cmaj9
      ['F3', 'A3', 'C4', 'E4'],       // Fmaj7
      ['A2', 'C3', 'E3', 'G3', 'B3'], // Am9
      ['G3', 'B3', 'D4', 'F4'],       // G7
    ],
    bass: ['C2', 'F2', 'A2', 'G2'],
    melody: ['E4', 'G4', 'B4', 'D5', 'C5', 'G4', 'E4', 'D4'],
  },
  gaming: {
    defaultBpm: 135,
    chords: [
      ['E3', 'G3', 'B3'], // Em
      ['C3', 'E3', 'G3'], // C
      ['D3', 'F#3', 'A3'],// D
      ['B2', 'D#3', 'F#3'],// B
    ],
    bass: ['E2', 'C2', 'D2', 'B2'],
    melody: ['B4', 'E5', 'G5', 'F#5', 'E5', 'D5', 'B4', 'A4'],
  },
};

/**
 * Procedural Web Audio Engine to synthesize complete polyphonic audio tracks
 * without needing any paid API keys.
 */
export async function synthesizeMusicTrack(
  params: MusicGenerationParams,
  onProgress?: (percent: number, step: string) => void
): Promise<GeneratedTrackResult> {
  const sampleRate = 44100;
  const duration = Math.max(10, Math.min(params.durationSeconds || 30, 120));
  const numSamples = Math.floor(sampleRate * duration);

  onProgress?.(10, 'Initializing audio synthesis engine...');

  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    2, // Stereo
    numSamples,
    sampleRate
  );

  const genreConfig = GENRE_SCALES[params.genre] || GENRE_SCALES.lofi;
  const bpm = params.bpm || genreConfig.defaultBpm;
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const totalBars = Math.ceil(duration / barDuration);

  // Master Gain & Limiter
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);

  // Master Dynamics Compressor for punchy, polished output
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, 0);
  compressor.knee.setValueAtTime(12, 0);
  compressor.ratio.setValueAtTime(4, 0);
  compressor.attack.setValueAtTime(0.003, 0);
  compressor.release.setValueAtTime(0.25, 0);

  masterGain.connect(compressor);
  compressor.connect(offlineCtx.destination);

  // Reverb Bus (Convolver simulation via feedback delay)
  const delayNode = offlineCtx.createDelay();
  delayNode.delayTime.setValueAtTime(beatDuration * 0.75, 0);
  const delayFeedback = offlineCtx.createGain();
  delayFeedback.gain.setValueAtTime(0.35, 0);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayFeedback.connect(masterGain);

  onProgress?.(25, 'Synthesizing polyphonic harmony & chords...');

  // 1. CHORD PROGRESSIONS
  for (let bar = 0; bar < totalBars; bar++) {
    const chordIndex = bar % genreConfig.chords.length;
    const chordNotes = genreConfig.chords[chordIndex];
    const barStartTime = bar * barDuration;

    if (barStartTime >= duration) break;

    chordNotes.forEach((noteName, idx) => {
      const freq = NOTE_FREQS[noteName] || 220;
      const osc = offlineCtx.createOscillator();
      const chordGain = offlineCtx.createGain();

      // Instrument Timbre by Genre
      if (params.genre === 'synthwave' || params.genre === 'gaming') {
        osc.type = 'sawtooth';
      } else if (params.genre === 'lofi' || params.genre === 'ambient') {
        osc.type = 'triangle';
      } else {
        osc.type = 'sine';
      }

      osc.frequency.setValueAtTime(freq, barStartTime);

      // Lowpass Filter for Warmth
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(params.genre === 'synthwave' ? 1800 : 900, barStartTime);

      // ADSR Envelope
      const attack = params.genre === 'ambient' ? 0.8 : 0.08;
      const release = 0.4;
      const chordPlayDuration = Math.min(barDuration, duration - barStartTime);

      chordGain.gain.setValueAtTime(0.001, barStartTime);
      chordGain.gain.exponentialRampToValueAtTime(0.06 / chordNotes.length, barStartTime + attack);
      chordGain.gain.setValueAtTime(0.05 / chordNotes.length, barStartTime + chordPlayDuration - release);
      chordGain.gain.exponentialRampToValueAtTime(0.0001, barStartTime + chordPlayDuration);

      osc.connect(filter);
      filter.connect(chordGain);
      chordGain.connect(masterGain);
      chordGain.connect(delayNode);

      osc.start(barStartTime);
      osc.stop(barStartTime + chordPlayDuration);
    });
  }

  onProgress?.(50, 'Synthesizing bassline & low-end groove...');

  // 2. BASSLINE
  for (let bar = 0; bar < totalBars; bar++) {
    const chordIndex = bar % genreConfig.bass.length;
    const rootNote = genreConfig.bass[chordIndex];
    const freq = NOTE_FREQS[rootNote] || 55;
    const barStartTime = bar * barDuration;

    // Bass notes rhythm: 2 or 4 notes per bar
    const steps = params.genre === 'synthwave' || params.genre === 'edm' ? 8 : 4;
    const stepDuration = barDuration / steps;

    for (let s = 0; s < steps; s++) {
      const noteTime = barStartTime + s * stepDuration;
      if (noteTime >= duration) break;

      const osc = offlineCtx.createOscillator();
      const bassGain = offlineCtx.createGain();

      osc.type = params.genre === 'hiphop' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(params.genre === 'hiphop' ? 220 : 450, noteTime);

      const bassDur = stepDuration * 0.85;
      bassGain.gain.setValueAtTime(0.2, noteTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, noteTime + bassDur);

      osc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + bassDur);
    }
  }

  onProgress?.(70, 'Composing lead melody & arpeggios...');

  // 3. ARPEGGIO & MELODY
  const melodyNotes = genreConfig.melody;
  const sixteenth = beatDuration / 4;
  const totalSixteenths = Math.floor(duration / sixteenth);

  for (let step = 0; step < totalSixteenths; step++) {
    // Lead melody pattern logic
    const playNote = (step % 2 === 0) || (params.genre === 'synthwave' && step % 4 !== 3);
    if (!playNote) continue;

    const noteTime = step * sixteenth;
    if (noteTime >= duration) break;

    const noteIdx = (step + Math.floor(step / 8)) % melodyNotes.length;
    const noteName = melodyNotes[noteIdx];
    const freq = NOTE_FREQS[noteName] || 440;

    const osc = offlineCtx.createOscillator();
    const leadGain = offlineCtx.createGain();

    osc.type = params.genre === 'synthwave' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, noteTime);

    // Slight vibrato
    const lfo = offlineCtx.createOscillator();
    lfo.frequency.setValueAtTime(5, noteTime);
    const lfoGain = offlineCtx.createGain();
    lfoGain.gain.setValueAtTime(4, noteTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(noteTime);
    lfo.stop(noteTime + sixteenth * 1.5);

    const leadDur = sixteenth * 1.2;
    leadGain.gain.setValueAtTime(0.001, noteTime);
    leadGain.gain.exponentialRampToValueAtTime(0.08, noteTime + 0.02);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + leadDur);

    osc.connect(leadGain);
    leadGain.connect(masterGain);
    leadGain.connect(delayNode);

    osc.start(noteTime);
    osc.stop(noteTime + leadDur);
  }

  // 4. DRUMS & PERCUSSION (unless disabled)
  if (params.includeDrums !== false) {
    onProgress?.(85, 'Arranging beats, kicks, and crisp percussion...');

    const totalBeats = Math.floor(duration / beatDuration);
    for (let beat = 0; beat < totalBeats; beat++) {
      const beatTime = beat * beatDuration;
      if (beatTime >= duration) break;

      const beatInBar = beat % 4;

      // Kick on 1 and 3 (or 4 on the floor for EDM)
      const isKick = params.genre === 'edm' ? true : (beatInBar === 0 || beatInBar === 2);
      if (isKick) {
        const kickOsc = offlineCtx.createOscillator();
        const kickGain = offlineCtx.createGain();

        kickOsc.frequency.setValueAtTime(140, beatTime);
        kickOsc.frequency.exponentialRampToValueAtTime(38, beatTime + 0.12);

        kickGain.gain.setValueAtTime(0.4, beatTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.25);

        kickOsc.connect(kickGain);
        kickGain.connect(masterGain);

        kickOsc.start(beatTime);
        kickOsc.stop(beatTime + 0.25);
      }

      // Snare / Clap on 2 and 4
      const isSnare = beatInBar === 1 || beatInBar === 3;
      if (isSnare) {
        // Noise buffer for snappy snare
        const bufferSize = offlineCtx.sampleRate * 0.15;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = offlineCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const noiseFilter = offlineCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1000, beatTime);

        const snareGain = offlineCtx.createGain();
        snareGain.gain.setValueAtTime(0.2, beatTime);
        snareGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.18);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(snareGain);
        snareGain.connect(masterGain);

        whiteNoise.start(beatTime);
        whiteNoise.stop(beatTime + 0.18);
      }

      // Hi-Hats on 8th notes
      for (let h = 0; h < 2; h++) {
        const hatTime = beatTime + h * (beatDuration / 2);
        if (hatTime >= duration) break;

        const hatBufferSize = offlineCtx.sampleRate * 0.04;
        const hatBuffer = offlineCtx.createBuffer(1, hatBufferSize, offlineCtx.sampleRate);
        const hatData = hatBuffer.getChannelData(0);
        for (let i = 0; i < hatBufferSize; i++) {
          hatData[i] = Math.random() * 2 - 1;
        }

        const hatSource = offlineCtx.createBufferSource();
        hatSource.buffer = hatBuffer;

        const hatFilter = offlineCtx.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(6500, hatTime);

        const hatGain = offlineCtx.createGain();
        hatGain.gain.setValueAtTime(0.05, hatTime);
        hatGain.gain.exponentialRampToValueAtTime(0.0001, hatTime + 0.04);

        hatSource.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(masterGain);

        hatSource.start(hatTime);
        hatSource.stop(hatTime + 0.04);
      }
    }
  }

  onProgress?.(95, 'Rendering master WAV audio buffer...');

  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = audioBufferToWav(renderedBuffer);
  const audioUrl = URL.createObjectURL(wavBlob);

  const cleanPrompt = params.prompt.trim() || `${params.genre.toUpperCase()} ${params.mood || 'Theme'}`;
  const trackTitle = generateTrackTitle(cleanPrompt, params.genre);

  onProgress?.(100, 'Music generation complete!');

  return {
    id: `ai_music_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: trackTitle,
    artist: 'SBG AI Music Studio',
    genre: params.genre.toUpperCase(),
    durationSeconds: duration,
    audioBlob: wavBlob,
    audioUrl,
    bpm,
    generatedAt: Date.now(),
    modelUsed: 'SBG Polyphonic Audio Synthesis Engine (Free Tier)',
  };
}

/**
 * Converts AudioBuffer to uncompressed standard 16-bit PCM WAV Blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * blockAlign;
  const bufferArray = new ArrayBuffer(44 + length);
  const view = new DataView(bufferArray);

  // Write WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Interleave audio channels
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function generateTrackTitle(prompt: string, genre: string): string {
  if (prompt.length > 2 && prompt.length < 35 && !prompt.toLowerCase().includes('generate')) {
    return prompt.charAt(0).toUpperCase() + prompt.slice(1);
  }

  const adjectives = ['Neon', 'Midnight', 'Cyber', 'Chill', 'Ethereal', 'Cosmic', 'Solar', 'Velvet', 'Shadow', 'Golden'];
  const nouns = ['Groove', 'Horizon', 'Vibe', 'Echo', 'Drift', 'Pulse', 'Odyssey', 'Dimension', 'Frequency', 'Anthem'];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj} ${noun} (${genre.toUpperCase()})`;
}

/**
 * Converts a GeneratedTrackResult into a standard Song object for SBG Player.
 */
export function convertGeneratedToSong(track: GeneratedTrackResult): Song {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: 'SBG AI Studio Creations',
    audioUrl: track.audioUrl,
    duration: track.durationSeconds,
    durationSeconds: track.durationSeconds,
    genre: track.genre,
    description: 'Original track created with SBG AI Music Studio',
    published: true,
    source: 'upload',
    sourceType: 'SBG_CATALOG',
    downloadable: true,
    downloadEnabled: true,
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
  };
}
