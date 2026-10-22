class AudioEngine {
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private onTimeUpdate?: (time: number) => void;
  private onEnded?: () => void;
  private volume: number = 0.8;
  private isMuted: boolean = false;

  public getVisualizerData(): Uint8Array {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    // Generate soft simulated audio wave when analyser is inactive
    const fallback = new Uint8Array(32);
    const time = Date.now() / 150;
    for (let i = 0; i < fallback.length; i++) {
      fallback[i] = Math.floor(Math.sin(time + i * 0.5) * 80 + 100);
    }
    return fallback;
  }

  public setCallbacks(onTimeUpdate: (time: number) => void, onEnded: () => void) {
    this.onTimeUpdate = onTimeUpdate;
    this.onEnded = onEnded;
  }

  public playTrack(_track: any, startTime = 0) {
    if (this.onTimeUpdate) {
      this.onTimeUpdate(startTime);
    }
  }

  public resume() {}

  public pause() {}

  public seek(seconds: number) {
    if (this.onTimeUpdate) {
      this.onTimeUpdate(seconds);
    }
  }

  public setVolume(volume: number, muted = false) {
    this.volume = volume;
    this.isMuted = muted;
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
