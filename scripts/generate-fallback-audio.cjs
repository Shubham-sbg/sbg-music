const fs = require('fs');
const path = require('path');

// Ensure public/audio directory exists
const audioDir = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Helper to write a 16-bit PCM Stereo WAV file
function writeWavFile(filepath, sampleRate, durationSeconds, generateSample) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM = 1)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = generateSample(t, i, numSamples);
    
    // Clamp to [-1, 1] and convert to 16-bit int
    const lSample = Math.max(-1, Math.min(1, left));
    const rSample = Math.max(-1, Math.min(1, right));
    const lInt = Math.floor(lSample < 0 ? lSample * 32768 : lSample * 32767);
    const rInt = Math.floor(rSample < 0 ? rSample * 32768 : rSample * 32767);

    buffer.writeInt16LE(lInt, offset);
    buffer.writeInt16LE(rInt, offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filepath, buffer);
  console.log(`Generated: ${filepath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${durationSeconds}s)`);
}

const SAMPLE_RATE = 44100;
const DURATION = 60; // 60 seconds of seamless audio

// Track 1: SBG Esports Victory Anthem (Heroic, driving synthwave with pulse and brass swell)
writeWavFile(path.join(audioDir, 'sbg_anthem.wav'), SAMPLE_RATE, DURATION, (t) => {
  const bpm = 128;
  const beat = (t * bpm) / 60;
  const chordRoots = [164.81, 130.81, 146.83, 123.47]; // E, C, D, B
  const chordIdx = Math.floor(beat / 4) % chordRoots.length;
  const root = chordRoots[chordIdx];

  // Driving Bass pulse
  const bassFreq = root / 2;
  const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.4 + (Math.sin(4 * Math.PI * bassFreq * t) * 0.2);

  // Arpeggio Lead
  const arpNotes = [1, 1.25, 1.5, 1.875];
  const arpIdx = Math.floor(beat * 4) % arpNotes.length;
  const leadFreq = root * 2 * arpNotes[arpIdx];
  const leadEnv = Math.exp(-((beat * 4) % 1) * 3);
  const lead = (Math.sin(2 * Math.PI * leadFreq * t) + 0.3 * Math.sin(4 * Math.PI * leadFreq * t)) * leadEnv * 0.25;

  // Kick / Snare beat
  const kickTime = beat % 1;
  const kick = kickTime < 0.2 ? Math.sin(2 * Math.PI * 60 * Math.exp(-kickTime * 15) * t) * Math.exp(-kickTime * 12) * 0.5 : 0;
  const snareTime = (beat + 1) % 2;
  const snare = snareTime < 0.2 ? (Math.random() * 2 - 1) * Math.exp(-snareTime * 10) * 0.25 : 0;

  const total = (bass + lead + kick + snare) * 0.8;
  return [total * 0.95, total * 1.05];
});

// Track 2: Midnight Cyberpunk Synth Drive (Deep gritty synth bass & neon arpeggios)
writeWavFile(path.join(audioDir, 'cyberpunk_synth.wav'), SAMPLE_RATE, DURATION, (t) => {
  const bpm = 112;
  const beat = (t * bpm) / 60;
  const chordRoots = [110.0, 87.31, 130.81, 98.0]; // Am, F, C, G
  const chordIdx = Math.floor(beat / 4) % chordRoots.length;
  const root = chordRoots[chordIdx];

  // Heavy sawtooth-like bass
  const bassFreq = root / 2;
  let bass = 0;
  for (let h = 1; h <= 4; h++) {
    bass += (Math.sin(2 * Math.PI * bassFreq * h * t) / h) * 0.3;
  }

  // 16th-note synth sequence
  const seqNotes = [1, 1.2, 1.5, 1.33, 1.77, 1.5, 1.2, 1];
  const seqIdx = Math.floor(beat * 4) % seqNotes.length;
  const seqFreq = root * 2 * seqNotes[seqIdx];
  const seqEnv = Math.exp(-((beat * 4) % 1) * 4);
  const seq = Math.sin(2 * Math.PI * seqFreq * t) * seqEnv * 0.2;

  // Percussion
  const kickTime = beat % 1;
  const kick = kickTime < 0.15 ? Math.sin(2 * Math.PI * 55 * Math.exp(-kickTime * 20) * t) * 0.45 : 0;
  const hihatTime = (beat * 2) % 1;
  const hihat = hihatTime < 0.05 ? (Math.random() * 2 - 1) * 0.1 : 0;

  const total = (bass + seq + kick + hihat) * 0.8;
  return [total * 1.02, total * 0.98];
});

// Track 3: Lo-Fi Chill Rhodes Chords (Warm Rhodes electric piano, vinyl crackle & mellow groove)
writeWavFile(path.join(audioDir, 'lofi_rhodes.wav'), SAMPLE_RATE, DURATION, (t) => {
  const bpm = 75;
  const beat = (t * bpm) / 60;
  // Dm7 -> G7 -> Cmaj7 -> Am7
  const chords = [
    [146.83, 174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66, 349.23],
    [130.81, 164.81, 196.0, 246.94],
    [110.0, 130.81, 164.81, 196.0]
  ];
  const chord = chords[Math.floor(beat / 4) % chords.length];

  // Rhodes chord decay
  const chordEnv = Math.exp(-((beat % 4) * 0.6));
  let rhodes = 0;
  chord.forEach(f => {
    rhodes += (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t)) * 0.12;
  });
  rhodes *= chordEnv;

  // Sub bass
  const bassFreq = chord[0] / 2;
  const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.25;

  // Vinyl tape warmth
  const vinyl = (Math.random() * 2 - 1) * 0.02;

  const total = (rhodes + bass + vinyl) * 0.85;
  return [total * 0.98, total * 1.02];
});

// Track 4: Dark 808 Trap Bass Anthem (Sub slide, trap hi-hat rolls & atmospheric pad)
writeWavFile(path.join(audioDir, 'trap_808.wav'), SAMPLE_RATE, DURATION, (t) => {
  const bpm = 140;
  const beat = (t * bpm) / 60;
  const root = 43.65; // F1 Sub (43 Hz)

  // 808 distorted sub bass
  const subTime = beat % 2;
  const subPitch = root * (subTime < 0.1 ? 1.5 : 1.0);
  const subEnv = Math.exp(-subTime * 0.8);
  const sub = Math.sin(2 * Math.PI * subPitch * t) * subEnv * 0.55;

  // Trap hi-hat rolls
  const rollSpeed = Math.floor(beat) % 4 === 3 ? 8 : 4;
  const hatTime = (beat * rollSpeed) % 1;
  const hat = hatTime < 0.05 ? (Math.random() * 2 - 1) * 0.15 : 0;

  // Dark minor lead
  const leadFreq = 349.23 * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t));
  const lead = Math.sin(2 * Math.PI * leadFreq * t) * 0.12;

  const total = (sub + hat + lead) * 0.8;
  return [total, total];
});

// Track 5: Cinematic Orchestral Swell (Rich harmonic strings & crescendo)
writeWavFile(path.join(audioDir, 'cinematic_swell.wav'), SAMPLE_RATE, DURATION, (t) => {
  const roots = [146.83, 116.54, 174.61, 130.81]; // Dm, Bb, F, C
  const chordIdx = Math.floor(t / 8) % roots.length;
  const root = roots[chordIdx];

  // Strings section (rich multi-oscillator detuned harmonic stack)
  let strings = 0;
  const partials = [1, 1.2, 1.5, 2, 2.4, 3];
  partials.forEach((p, idx) => {
    const detune = 1 + 0.003 * Math.sin(t * 1.5 + idx);
    strings += (Math.sin(2 * Math.PI * root * p * detune * t) / (idx + 1)) * 0.12;
  });

  // Slow swell envelope
  const swell = 0.5 + 0.5 * Math.sin((t / 4) * Math.PI);
  const total = strings * swell * 0.8;
  return [total * 1.05, total * 0.95];
});

// Track 6: Ambient Serene Meditation (Calming 432Hz ambient frequency & gentle chimes)
writeWavFile(path.join(audioDir, 'ambient_meditation.wav'), SAMPLE_RATE, DURATION, (t) => {
  const baseFreq = 108.0; // 432 Hz / 4

  // Warm gentle drone
  const osc1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.25;
  const osc2 = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.18;
  const osc3 = Math.sin(2 * Math.PI * (baseFreq * 2) * t) * 0.12;

  // Modulating overtone shimmer
  const shimmer = Math.sin(2 * Math.PI * 432.0 * t) * (0.05 + 0.04 * Math.sin(t * 0.5));

  const total = (osc1 + osc2 + osc3 + shimmer) * 0.75;
  return [total * 0.99, total * 1.01];
});

console.log('All 6 fallback audio tracks successfully generated!');
