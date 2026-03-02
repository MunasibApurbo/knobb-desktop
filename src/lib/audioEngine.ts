/**
 * AudioEngine — Web Audio API + HTML5 Audio for real playback
 * Supports crossfade between tracks via dual audio elements
 */

type AudioEventCallback = () => void;
type TimeUpdateCallback = (currentTime: number, duration: number) => void;

export class AudioEngine {
  private audio: HTMLAudioElement;
  private crossfadeAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private crossfadeGainNode: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private crossfadeSource: MediaElementAudioSourceNode | null = null;
  private connected = false;
  private crossfadeConnected = false;

  // Crossfade
  private crossfadeDuration = 0; // 0 = disabled
  private crossfadeTimer: number | null = null;
  private isCrossfading = false;
  private onCrossfadeNeeded: (() => void) | null = null;

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
    this.setupAudioListeners(this.audio);
  }

  private setupAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener("play", () => this.onPlay?.());
    audio.addEventListener("pause", () => {
      if (!this.isCrossfading) this.onPause?.();
    });
    audio.addEventListener("ended", () => {
      if (!this.isCrossfading) this.onEnded?.();
    });
    audio.addEventListener("loadstart", () => this.onLoadStart?.());
    audio.addEventListener("canplay", () => this.onCanPlay?.());
    audio.addEventListener("timeupdate", () => {
      this.onTimeUpdate?.(audio.currentTime, audio.duration || 0);
      this.checkCrossfade();
    });
    audio.addEventListener("error", () => {
      const err = audio.error;
      this.onError?.(err ? `Audio error: ${err.message} (code ${err.code})` : "Unknown audio error");
    });
  }

  private checkCrossfade() {
    if (this.crossfadeDuration <= 0 || this.isCrossfading) return;
    const remaining = (this.audio.duration || 0) - this.audio.currentTime;
    if (remaining > 0 && remaining <= this.crossfadeDuration && !this.audio.paused) {
      this.isCrossfading = true;
      this.onCrossfadeNeeded?.();
    }
  }

  setCrossfadeDuration(seconds: number) {
    this.crossfadeDuration = Math.max(0, Math.min(12, seconds));
  }

  getCrossfadeDuration() {
    return this.crossfadeDuration;
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
      this.connected = true;
    }
  }

  /**
   * Crossfade: load next track into a secondary audio element,
   * fade out current, fade in next, then swap.
   */
  async crossfadeInto(url: string, replayGain = 0, peak = 1) {
    if (!this.audioContext || !this.analyser) {
      // No crossfade possible, just do a regular load
      await this.load(url, replayGain, peak);
      await this.play();
      return;
    }

    // Create crossfade audio element
    this.crossfadeAudio = new Audio();
    this.crossfadeAudio.crossOrigin = "anonymous";
    this.crossfadeAudio.preload = "auto";
    this.crossfadeAudio.src = url;
    this.crossfadeAudio.volume = this.audio.volume;
    this.crossfadeAudio.load();

    // Create gain for crossfade audio
    this.crossfadeGainNode = this.audioContext.createGain();
    this.crossfadeGainNode.gain.value = 0;
    this.crossfadeGainNode.connect(this.analyser);

    try {
      this.crossfadeSource = this.audioContext.createMediaElementSource(this.crossfadeAudio);
      this.crossfadeSource.connect(this.crossfadeGainNode);
    } catch {
      // Fallback to regular load
      this.isCrossfading = false;
      await this.load(url, replayGain, peak);
      await this.play();
      return;
    }

    // Wait for crossfade audio to be ready
    await new Promise<void>((resolve) => {
      this.crossfadeAudio!.addEventListener("canplay", () => resolve(), { once: true });
      setTimeout(resolve, 3000); // timeout fallback
    });

    // Apply replay gain to new track
    const gain = Math.pow(10, replayGain / 20);
    const clampedGain = Math.min(gain, 1 / peak);

    // Start playing crossfade audio
    try {
      await this.crossfadeAudio.play();
    } catch {
      this.isCrossfading = false;
      return;
    }

    const fadeDuration = this.crossfadeDuration;
    const now = this.audioContext.currentTime;

    // Fade out current
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
    }

    // Fade in new
    this.crossfadeGainNode.gain.setValueAtTime(0, now);
    this.crossfadeGainNode.gain.linearRampToValueAtTime(clampedGain, now + fadeDuration);

    // After fade completes, swap audio elements
    setTimeout(() => {
      this.finalizeSwap(replayGain, peak);
    }, fadeDuration * 1000);
  }

  private finalizeSwap(replayGain: number, peak: number) {
    // Stop old audio
    this.audio.pause();
    this.audio.src = "";

    // Disconnect old source
    this.source?.disconnect();

    // Swap: crossfade becomes primary
    if (this.crossfadeAudio && this.crossfadeGainNode && this.crossfadeSource) {
      // Disconnect crossfade from its gain node
      this.crossfadeSource.disconnect();
      this.crossfadeGainNode.disconnect();

      // Reconnect to main gain node
      this.crossfadeSource.connect(this.gainNode!);
      this.source = this.crossfadeSource;
      this.audio = this.crossfadeAudio;

      // Re-setup listeners on new primary audio
      this.setupAudioListeners(this.audio);

      this.replayGain = replayGain;
      this.peak = peak;
      this.applyReplayGain();
    }

    this.crossfadeAudio = null;
    this.crossfadeSource = null;
    this.crossfadeGainNode = null;
    this.isCrossfading = false;
  }

  async load(url: string, replayGain = 0, peak = 1) {
    this.initAudioContext();
    this.connectSource();
    this.isCrossfading = false;

    this.replayGain = replayGain;
    this.peak = peak;
    this.applyReplayGain();

    this.audio.src = url;
    this.audio.load();

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  private applyReplayGain() {
    if (!this.gainNode) return;
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
    if (this.crossfadeAudio) {
      this.crossfadeAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  setPlaybackRate(rate: number) {
    this.audio.playbackRate = rate;
    if (this.crossfadeAudio) {
      this.crossfadeAudio.playbackRate = rate;
    }
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

  on(event: string, callback: any) {
    switch (event) {
      case "play": this.onPlay = callback; break;
      case "pause": this.onPause = callback; break;
      case "ended": this.onEnded = callback; break;
      case "timeupdate": this.onTimeUpdate = callback; break;
      case "error": this.onError = callback; break;
      case "loadstart": this.onLoadStart = callback; break;
      case "canplay": this.onCanPlay = callback; break;
      case "crossfade": this.onCrossfadeNeeded = callback; break;
    }
  }

  destroy() {
    this.audio.pause();
    this.audio.src = "";
    this.crossfadeAudio?.pause();
    if (this.crossfadeAudio) this.crossfadeAudio.src = "";
    this.source?.disconnect();
    this.crossfadeSource?.disconnect();
    this.gainNode?.disconnect();
    this.crossfadeGainNode?.disconnect();
    this.analyser?.disconnect();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
    this.crossfadeGainNode = null;
    this.source = null;
    this.crossfadeSource = null;
    this.connected = false;
    this.crossfadeConnected = false;
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
