/**
 * AudioEngine — Web Audio API + HTML5 Audio for real playback
 * Provides AnalyserNode frequency data for visualizers
 */

type AudioEventCallback = () => void;
type TimeUpdateCallback = (currentTime: number, duration: number) => void;

export class AudioEngine {
  private audio: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private connected = false;

  // Replay gain
  private replayGain = 0;
  private peak = 1;

  // Callbacks
  private onPlay: AudioEventCallback | null = null;
  private onPause: AudioEventCallback | null = null;
  private onEnded: AudioEventCallback | null = null;
  private onTimeUpdate: TimeUpdateCallback | null = null;
  private onError: ((error: string) => void) | null = null;
  private onLoadStart: AudioEventCallback | null = null;
  private onCanPlay: AudioEventCallback | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";

    this.audio.addEventListener("play", () => this.onPlay?.());
    this.audio.addEventListener("pause", () => this.onPause?.());
    this.audio.addEventListener("ended", () => this.onEnded?.());
    this.audio.addEventListener("loadstart", () => this.onLoadStart?.());
    this.audio.addEventListener("canplay", () => this.onCanPlay?.());
    this.audio.addEventListener("timeupdate", () => {
      this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    });
    this.audio.addEventListener("error", () => {
      const err = this.audio.error;
      this.onError?.(err ? `Audio error: ${err.message} (code ${err.code})` : "Unknown audio error");
    });
  }

  private initAudioContext() {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  private connectSource() {
    if (this.connected || !this.audioContext || !this.gainNode) return;

    try {
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.gainNode);
      this.connected = true;
    } catch (e) {
      // Already connected — this is fine
      this.connected = true;
    }
  }

  async load(url: string, replayGain = 0, peak = 1) {
    this.initAudioContext();
    this.connectSource();

    this.replayGain = replayGain;
    this.peak = peak;
    this.applyReplayGain();

    this.audio.src = url;
    this.audio.load();

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  private applyReplayGain() {
    if (!this.gainNode) return;
    // Apply replay gain: convert dB to linear gain
    // Clamp to prevent clipping using peak
    const gain = Math.pow(10, this.replayGain / 20);
    const clampedGain = Math.min(gain, 1 / this.peak);
    this.gainNode.gain.value = clampedGain;
  }

  async play() {
    this.initAudioContext();
    this.connectSource();

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }

    try {
      await this.audio.play();
    } catch (e) {
      console.warn("Playback failed:", e);
    }
  }

  pause() {
    this.audio.pause();
  }

  seek(time: number) {
    if (isFinite(time) && time >= 0) {
      this.audio.currentTime = time;
    }
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  get duration() {
    return this.audio.duration || 0;
  }

  get paused() {
    return this.audio.paused;
  }

  get isLoading() {
    return this.audio.readyState < 3;
  }

  // Frequency data for visualizers
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  get fftSize() {
    return this.analyser?.fftSize || 2048;
  }

  // Event binding
  on(event: string, callback: any) {
    switch (event) {
      case "play":
        this.onPlay = callback;
        break;
      case "pause":
        this.onPause = callback;
        break;
      case "ended":
        this.onEnded = callback;
        break;
      case "timeupdate":
        this.onTimeUpdate = callback;
        break;
      case "error":
        this.onError = callback;
        break;
      case "loadstart":
        this.onLoadStart = callback;
        break;
      case "canplay":
        this.onCanPlay = callback;
        break;
    }
  }

  destroy() {
    this.audio.pause();
    this.audio.src = "";
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.analyser?.disconnect();
    this.audioContext?.close();
  }
}

// Singleton
let engineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
  }
  return engineInstance;
}
