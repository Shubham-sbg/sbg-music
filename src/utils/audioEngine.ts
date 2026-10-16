import { Track } from '../types';

type TimeCallback = (time: number) => void;
type EndCallback = () => void;

class AudioEngine {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private onTimeUpdateCallback: TimeCallback | null = null;
  private onEndedCallback: EndCallback | null = null;
  private volume: number = 0.8;
  private isMuted: boolean = false;
  private visualizerDataArray: Uint8Array = new Uint8Array(64);
  private currentTrack: Track | null = null;
  private synthGain: GainNode | null = null;
  private synthOscillators: OscillatorNode[] = [];
  private isSynthPlaying: boolean = false;
  private synthInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    if (this.audio) return;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = this.volume;

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.audio.currentTime);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio element error, falling back to synth engine:', e);
      // If direct audio streaming hits CORS or network error, switch to procedural audio synthesis
      if (this.currentTrack) {
        this.startSynthPlayback(this.currentTrack);
      }
    });
  }

  private initAudioContext() {
    if (this.audioContext || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.visualizerDataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Connect media element if possible
      if (this.audio) {
        try {
          this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
          this.sourceNode.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
        } catch {
          // In some browsers or cross-origins createMediaElementSource can throw if already connected
        }
      }
    } catch (err) {
      console.warn('Web Audio API initialization failed:', err);
    }
  }

  public setCallbacks(onTimeUpdate?: TimeCallback, onEnded?: EndCallback) {
    if (onTimeUpdate) this.onTimeUpdateCallback = onTimeUpdate;
    if (onEnded) this.onEndedCallback = onEnded;
  }

  public playTrack(track: Track, offset: number = 0) {
    this.initAudioElement();
    this.initAudioContext();
    this.stopSynth();

    this.currentTrack = track;

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (this.audio) {
      if (track.audioUrl) {
        this.audio.src = track.audioUrl;
        this.audio.currentTime = offset;
        this.audio.volume = this.isMuted ? 0 : this.volume;

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Playback error, engaging synthesized audio mode:', err);
            this.startSynthPlayback(track);
          });
        }
      } else {
        // Procedural synthetic track
        this.startSynthPlayback(track);
      }
    }
  }

  public resume() {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (this.isSynthPlaying && this.currentTrack) {
      this.startSynthPlayback(this.currentTrack);
      return;
    }

    if (this.audio && this.audio.src) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (this.currentTrack) this.startSynthPlayback(this.currentTrack);
        });
      }
    } else if (this.currentTrack) {
      this.startSynthPlayback(this.currentTrack);
    }
  }

  public pause() {
    if (this.audio) {
      this.audio.pause();
    }
    this.stopSynth();
  }

  public seek(seconds: number) {
    if (this.audio && !this.isSynthPlaying) {
      try {
        this.audio.currentTime = seconds;
      } catch (e) {
        console.warn('Seek error:', e);
      }
    }
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds);
    }
  }

  public setVolume(volume: number, isMuted: boolean = false) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.isMuted = isMuted;

    const actualVol = isMuted ? 0 : this.volume;
    if (this.audio) {
      this.audio.volume = actualVol;
    }
    if (this.synthGain) {
      this.synthGain.gain.setValueAtTime(actualVol * 0.15, this.audioContext?.currentTime || 0);
    }
  }

  public getVisualizerData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.visualizerDataArray);
      // Check if we have active signal
      let sum = 0;
      for (let i = 0; i < 16; i++) {
        sum += this.visualizerDataArray[i];
      }
      if (sum > 0) {
        return this.visualizerDataArray;
      }
    }

    // Organic fallback waveform when audio source is cross-origin or synthesizing
    const now = performance.now() / 1000;
    const isPlaying = (this.audio && !this.audio.paused) || this.isSynthPlaying;

    for (let i = 0; i < this.visualizerDataArray.length; i++) {
      if (isPlaying) {
        const wave1 = Math.sin(now * 3.5 + i * 0.45) * 0.5 + 0.5;
        const wave2 = Math.cos(now * 5.2 + i * 0.25) * 0.5 + 0.5;
        const bassBoost = i < 8 ? (8 - i) / 8 * 0.4 : 0;
        const val = Math.floor(Math.min(255, (wave1 * 0.6 + wave2 * 0.4 + bassBoost) * 230 + 25));
        this.visualizerDataArray[i] = val;
      } else {
        this.visualizerDataArray[i] = 15;
      }
    }

    return this.visualizerDataArray;
  }

  private startSynthPlayback(track: Track) {
    this.stopSynth();
    if (!this.audioContext) return;

    try {
      this.isSynthPlaying = true;
      this.synthGain = this.audioContext.createGain();
      const actualVol = this.isMuted ? 0 : this.volume;
      this.synthGain.gain.setValueAtTime(actualVol * 0.12, this.audioContext.currentTime);

      if (this.analyser) {
        this.synthGain.connect(this.analyser);
      } else {
        this.synthGain.connect(this.audioContext.destination);
      }

      // Chord frequencies according to mood
      const moodChords: Record<string, number[]> = {
        synthwave: [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3
        cyberpunk: [110.00, 138.59, 164.81, 220.00], // A2, C#3, E3, A3
        ambient: [146.83, 174.61, 220.00, 261.63],   // D3, F3, A3, C4
        hiphop: [98.00, 123.47, 146.83, 196.00],    // G2, B2, D3, G3
        acoustic: [130.81, 164.81, 196.00, 261.63],  // C3, E3, G3, C4
        anthem: [174.61, 220.00, 261.63, 349.23],    // F3, A3, C4, F4
      };

      const notes = moodChords[track.mood] || [130.81, 164.81, 196.00, 246.94];

      notes.forEach((freq, idx) => {
        if (!this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800 + idx * 200, this.audioContext.currentTime);

        osc.connect(filter);
        if (this.synthGain) filter.connect(this.synthGain);

        osc.start();
        this.synthOscillators.push(osc);
      });

      // Emulate playback progress
      let currentSecs = 0;
      this.synthInterval = setInterval(() => {
        currentSecs += 1;
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(currentSecs);
        }
        if (currentSecs >= track.duration) {
          this.stopSynth();
          if (this.onEndedCallback) {
            this.onEndedCallback();
          }
        }
      }, 1000);
    } catch (e) {
      console.warn('Synth playback error:', e);
    }
  }

  private stopSynth() {
    this.isSynthPlaying = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.synthOscillators = [];
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
