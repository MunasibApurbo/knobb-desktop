/**
 * AudioEngine — Web Audio API + HTML5 Audio for real playback
 * Supports crossfade between tracks via dual audio elements
 */

import { EQ_BANDS, type PlaybackSource } from "@/lib/audioEngineShared";

export { EQ_BANDS, EQ_PRESETS, type PlaybackSource } from "@/lib/audioEngineShared";

type AudioEventCallback = () => void;
type TimeUpdateCallback = (currentTime: number, duration: number) => void;
type AudioEngineEventMap = {
  play: AudioEventCallback;
  pause: AudioEventCallback;
  ended: AudioEventCallback;
  timeupdate: TimeUpdateCallback;
  error: (error: string) => void;
  loadstart: AudioEventCallback;
  canplay: AudioEventCallback;
  crossfade: AudioEventCallback;
};

export class AudioEngine {
  private audio: HTMLAudioElement;
  private crossfadeAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private crossfadeGainNode: GainNode | null = null;

  // Audio Graph Sub-nodes
  private masterGain: GainNode | null = null;
  private eqNodes: BiquadFilterNode[] = [];
  private compressorNode: DynamicsCompressorNode | null = null;
  private preampNode: GainNode | null = null;
  private monoSplitter: ChannelSplitterNode | null = null;
  private monoMerger: ChannelMergerNode | null = null;
  private monoLeftGain: GainNode | null = null;
  private monoRightGain: GainNode | null = null;

  private normalizationEnabled = false;
  private equalizerEnabled = false;
  private monoAudioEnabled = false;
  private eqGains: number[] = new Array(10).fill(0);
  private preampDb = 0;

  private source: MediaElementAudioSourceNode | null = null;
  private crossfadeSource: MediaElementAudioSourceNode | null = null;
  private connected = false;

  // Crossfade
  private crossfadeDuration = 0; // 0 = disabled
  private isCrossfading = false;
  private onCrossfadeNeeded: (() => void) | null = null;

  // rAF-based smooth time updates (60fps)
  private rafId: number | null = null;
  private progressIntervalId: number | null = null;
  private readonly handleVisibilityChange = () => {
    if (!this.audio.paused) {
      this.startProgressUpdates();
    }
  };

  // Replay gain
  private replayGain = 0;
  private peak = 1;
  private preservePitchEnabled = true;

  // Callbacks
  private onPlay: AudioEventCallback | null = null;
  private onPause: AudioEventCallback | null = null;
  private onEnded: AudioEventCallback | null = null;
  private onTimeUpdate: TimeUpdateCallback | null = null;
  private onError: ((error: string) => void) | null = null;
  private onLoadStart: AudioEventCallback | null = null;
  private onCanPlay: AudioEventCallback | null = null;
  private preferredSinkId = "default";
  private dashPlayer: {
    initialize: (view: HTMLMediaElement | null, source: string | null, autoPlay?: boolean) => void;
    attachSource: (url: string) => void;
    reset: () => void;
    seek: (time: number) => void;
    setPlaybackRate?: (rate: number) => void;
    getPlaybackRate?: () => number;
    updateSettings?: (settings: unknown) => void;
  } | null = null;
  private dashSourceUrl: string | null = null;
  private dashReadyPromise: Promise<void> | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    this.applyPitchPreservation(this.audio);
    this.preferredSinkId = this.readPreferredSinkId();
    this.setupAudioListeners(this.audio);
    void this.applyPreferredSink(this.audio);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private readPreferredSinkId() {
    if (typeof window === "undefined") return "default";

    try {
      return window.localStorage.getItem("audio-output-device") || "default";
    } catch {
      return "default";
    }
  }

  private persistPreferredSinkId(sinkId: string) {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem("audio-output-device", sinkId || "default");
    } catch {
      // Ignore storage failures.
    }
  }

  private canSetSinkId(audio: HTMLAudioElement = this.audio) {
    return typeof (audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> }).setSinkId === "function";
  }

  private async setElementSinkId(audio: HTMLAudioElement, sinkId: string) {
    const sinkAudio = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
    if (typeof sinkAudio.setSinkId !== "function") return;
    await sinkAudio.setSinkId(sinkId);
  }

  private async applyPreferredSink(audio: HTMLAudioElement) {
    if (!this.canSetSinkId(audio)) return;

    try {
      await this.setElementSinkId(audio, this.preferredSinkId || "default");
    } catch {
      // Ignore output routing errors during bootstrap and keep default output.
    }
  }

  private setupAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener("play", () => {
      if (audio !== this.audio) return;
      this.onPlay?.();
      this.startProgressUpdates();
    });
    audio.addEventListener("pause", () => {
      if (audio !== this.audio) return;
      this.stopProgressUpdates();
      if (!this.isCrossfading) this.onPause?.();
    });
    audio.addEventListener("ended", () => {
      if (audio !== this.audio) return;
      this.stopProgressUpdates();
      if (!this.isCrossfading) this.onEnded?.();
    });
    audio.addEventListener("timeupdate", () => {
      if (audio === this.audio) {
        this.emitProgress();
      }
    });
    audio.addEventListener("seeking", () => {
      if (audio === this.audio) {
        this.emitProgress();
      }
    });
    audio.addEventListener("seeked", () => {
      if (audio === this.audio) {
        this.emitProgress();
      }
    });
    audio.addEventListener("loadstart", () => {
      if (audio !== this.audio) return;
      this.onLoadStart?.();
    });
    audio.addEventListener("canplay", () => {
      if (audio !== this.audio) return;
      this.emitProgress();
      this.onCanPlay?.();
    });
    audio.addEventListener("error", () => {
      if (audio !== this.audio) return;
      const err = audio.error;
      this.onError?.(err ? `Audio error: ${err.message} (code ${err.code})` : "Unknown audio error");
    });
  }

  private applyPitchPreservation(audio: HTMLAudioElement) {
    const target = audio as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };

    if (typeof target.preservesPitch === "boolean") {
      target.preservesPitch = this.preservePitchEnabled;
    }

    if (typeof target.mozPreservesPitch === "boolean") {
      target.mozPreservesPitch = this.preservePitchEnabled;
    }

    if (typeof target.webkitPreservesPitch === "boolean") {
      target.webkitPreservesPitch = this.preservePitchEnabled;
    }
  }

  private async getDashPlayer() {
    if (this.dashPlayer) return this.dashPlayer;

    const dashModule = await import("dashjs");
    this.dashPlayer = dashModule.MediaPlayer().create();
    this.dashPlayer.updateSettings?.({
      streaming: {
        buffer: {
          fastSwitchEnabled: true,
        },
      },
    });
    return this.dashPlayer;
  }

  private async resetDashPlayer() {
    if (!this.dashPlayer) return;
    try {
      this.dashPlayer.reset();
    } catch {
      // Ignore dash reset failures.
    }
    this.dashSourceUrl = null;
    this.dashReadyPromise = null;
  }

  private async attachDashSource(url: string, startTime = 0) {
    const player = await this.getDashPlayer();
    this.dashReadyPromise = new Promise<void>((resolve) => {
      const onCanPlay = () => {
        this.audio.removeEventListener("canplay", onCanPlay);
        resolve();
      };
      this.audio.addEventListener("canplay", onCanPlay, { once: true });
      window.setTimeout(onCanPlay, 2000);
    });

    if (this.dashSourceUrl && this.dashSourceUrl !== url) {
      player.attachSource(url);
    } else if (!this.dashSourceUrl) {
      player.initialize(this.audio, url, false);
    } else {
      player.attachSource(url);
    }

    this.dashSourceUrl = url;

    if (typeof player.setPlaybackRate === "function") {
      player.setPlaybackRate(this.audio.playbackRate);
    }

    await this.dashReadyPromise;

    if (startTime > 0) {
      try {
        player.seek(startTime);
      } catch {
        this.audio.currentTime = startTime;
      }
    }
  }

  private emitProgress() {
    this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    this.checkCrossfade();
  }

  private startRAF() {
    this.stopRAF();
    const tick = () => {
      this.emitProgress();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRAF() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startProgressUpdates() {
    this.stopProgressUpdates();
    this.emitProgress();

    if (typeof document !== "undefined" && document.hidden) {
      this.progressIntervalId = window.setInterval(() => {
        this.emitProgress();
      }, 250);
      return;
    }

    this.startRAF();
  }

  private stopProgressUpdates() {
    this.stopRAF();
    if (this.progressIntervalId !== null) {
      window.clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
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

  supportsSinkSelection() {
    return this.canSetSinkId();
  }

  getSinkId() {
    return this.preferredSinkId || "default";
  }

  async setSinkId(sinkId: string) {
    const nextSinkId = sinkId || "default";
    if (nextSinkId !== "default" && !this.supportsSinkSelection()) {
      throw new Error("This browser does not support audio output switching.");
    }

    await this.setElementSinkId(this.audio, nextSinkId);

    if (this.crossfadeAudio) {
      await this.setElementSinkId(this.crossfadeAudio, nextSinkId);
    }

    this.preferredSinkId = nextSinkId;
    this.persistPreferredSinkId(nextSinkId);
  }

  private initAudioContext() {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain = this.audioContext.createGain();
    this.gainNode = this.audioContext.createGain();
    this.preampNode = this.audioContext.createGain();
    this.monoSplitter = this.audioContext.createChannelSplitter(2);
    this.monoMerger = this.audioContext.createChannelMerger(2);
    this.monoLeftGain = this.audioContext.createGain();
    this.monoRightGain = this.audioContext.createGain();
    this.monoLeftGain.gain.value = 0.5;
    this.monoRightGain.gain.value = 0.5;

    // Set up Equalizer Bands
    this.eqNodes = EQ_BANDS.map((freq) => {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    // Set up Compressor (Normalization)
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    // Connect source gain to master gain
    this.gainNode.connect(this.masterGain);

    this.rebuildAudioGraph();
  }

  private rebuildAudioGraph() {
    if (!this.masterGain || !this.analyser || !this.compressorNode || !this.audioContext || !this.preampNode) return;

    this.masterGain.disconnect();
    this.preampNode.disconnect();
    this.monoSplitter?.disconnect();
    this.monoMerger?.disconnect();
    this.monoLeftGain?.disconnect();
    this.monoRightGain?.disconnect();
    this.eqNodes.forEach((node) => node.disconnect());
    this.compressorNode.disconnect();
    this.analyser.disconnect();

    let currentNode: AudioNode = this.masterGain;

    if (
      this.monoAudioEnabled &&
      this.monoSplitter &&
      this.monoMerger &&
      this.monoLeftGain &&
      this.monoRightGain
    ) {
      currentNode.connect(this.monoSplitter);
      this.monoSplitter.connect(this.monoLeftGain, 0);
      this.monoSplitter.connect(this.monoLeftGain, 1);
      this.monoSplitter.connect(this.monoRightGain, 0);
      this.monoSplitter.connect(this.monoRightGain, 1);
      this.monoLeftGain.connect(this.monoMerger, 0, 0);
      this.monoRightGain.connect(this.monoMerger, 0, 1);
      currentNode = this.monoMerger;
    }

    this.preampNode.gain.value = Math.pow(10, this.preampDb / 20);
    if (this.equalizerEnabled || Math.abs(this.preampDb) > 0.01) {
      currentNode.connect(this.preampNode);
      currentNode = this.preampNode;
    }

    // Route through EQ if enabled
    if (this.equalizerEnabled && this.eqNodes.length > 0) {
      for (let i = 0; i < this.eqNodes.length - 1; i++) {
        this.eqNodes[i].connect(this.eqNodes[i + 1]);
      }

      // Map saved gains
      this.eqNodes.forEach((node, idx) => {
        node.gain.value = this.eqGains[idx] || 0;
      });

      currentNode.connect(this.eqNodes[0]);
      currentNode = this.eqNodes[this.eqNodes.length - 1];
    }

    // Route through Compressor if enabled
    if (this.normalizationEnabled) {
      currentNode.connect(this.compressorNode);
      currentNode = this.compressorNode;
    }

    // Connect final node to analyser and then destination
    currentNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  setNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled;
    if (this.audioContext) this.rebuildAudioGraph();
  }

  setEqualizerEnabled(enabled: boolean) {
    this.equalizerEnabled = enabled;
    if (this.audioContext) this.rebuildAudioGraph();
  }

  setEqBandGain(bandIndex: number, gainDb: number) {
    this.eqGains[bandIndex] = gainDb;
    if (this.eqNodes[bandIndex]) {
      this.eqNodes[bandIndex].gain.value = gainDb;
    }
  }

  getEqGains() {
    return this.eqGains;
  }

  setPreampDb(gainDb: number) {
    this.preampDb = Math.max(-20, Math.min(20, gainDb));
    if (this.audioContext) this.rebuildAudioGraph();
  }

  getPreampDb() {
    return this.preampDb;
  }

  setMonoAudioEnabled(enabled: boolean) {
    this.monoAudioEnabled = enabled;
    if (this.audioContext) this.rebuildAudioGraph();
  }

  getMonoAudioEnabled() {
    return this.monoAudioEnabled;
  }

  private connectSource() {
    if (this.connected || !this.audioContext || !this.gainNode) return;

    try {
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.gainNode);
      this.connected = true;
    } catch {
      this.connected = true;
    }
  }

  /**
   * Crossfade: load next track into a secondary audio element,
   * fade out current, fade in next, then swap.
   */
  async crossfadeInto(source: PlaybackSource, replayGain = 0, peak = 1) {
    if (source.type === "dash" || this.dashSourceUrl) {
      await this.load(source, replayGain, peak);
      await this.play();
      return;
    }

    if (!this.audioContext || !this.analyser) {
      // No crossfade possible, just do a regular load
      await this.load(source, replayGain, peak);
      await this.play();
      return;
    }

    // Create crossfade audio element
    this.crossfadeAudio = new Audio();
    this.crossfadeAudio.crossOrigin = "anonymous";
    this.crossfadeAudio.preload = "auto";
    this.crossfadeAudio.playbackRate = this.audio.playbackRate;
    this.applyPitchPreservation(this.crossfadeAudio);
    await this.applyPreferredSink(this.crossfadeAudio);
    this.crossfadeAudio.src = source.url;
    this.crossfadeAudio.volume = this.audio.volume;
    this.crossfadeAudio.load();

    // Create gain for crossfade audio
    this.crossfadeGainNode = this.audioContext.createGain();
    this.crossfadeGainNode.gain.value = 0;
    this.crossfadeGainNode.connect(this.masterGain!);

    try {
      this.crossfadeSource = this.audioContext.createMediaElementSource(this.crossfadeAudio);
      this.crossfadeSource.connect(this.crossfadeGainNode);
    } catch {
      // Fallback to regular load
      this.isCrossfading = false;
      await this.load(source, replayGain, peak);
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
      if (!this.audio.paused) {
        this.startProgressUpdates();
      }

      this.replayGain = replayGain;
      this.peak = peak;
      this.applyReplayGain();
    }

    this.crossfadeAudio = null;
    this.crossfadeSource = null;
    this.crossfadeGainNode = null;
    this.isCrossfading = false;
  }

  async load(source: PlaybackSource, replayGain = 0, peak = 1) {
    this.initAudioContext();
    this.connectSource();
    this.isCrossfading = false;

    this.replayGain = replayGain;
    this.peak = peak;
    this.applyReplayGain();

    const resetToStart = () => {
      try {
        this.audio.currentTime = 0;
      } catch {
        // Ignore pre-metadata seek failures; a later event will retry.
      }
    };

    if (source.type === "dash") {
      await this.attachDashSource(source.url);
    } else {
      await this.resetDashPlayer();
      resetToStart();
      this.audio.src = source.url;
      this.audio.load();
      resetToStart();

      if (this.audio.readyState < 1) {
        this.audio.addEventListener("loadedmetadata", resetToStart, { once: true });
        this.audio.addEventListener("canplay", resetToStart, { once: true });
      }
    }

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async restore(source: PlaybackSource, replayGain = 0, peak = 1, startTime = 0) {
    await this.load(source, replayGain, peak);

    if (!isFinite(startTime) || startTime <= 0) {
      return;
    }

    if (source.type === "dash") {
      await this.attachDashSource(source.url, startTime);
      return;
    }

    const seekTo = Math.max(0, startTime);
    const applySeek = () => {
      try {
        this.audio.currentTime = seekTo;
      } catch {
        // Ignore pre-metadata seek failures.
      }
    };

    if (this.audio.readyState >= 1) {
      applySeek();
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const handleReady = () => {
        if (settled) return;
        settled = true;
        applySeek();
        resolve();
      };

      this.audio.addEventListener("loadedmetadata", handleReady, { once: true });
      this.audio.addEventListener("canplay", handleReady, { once: true });

      window.setTimeout(handleReady, 1500);
    });
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
    if (this.dashPlayer && typeof this.dashPlayer.setPlaybackRate === "function") {
      this.dashPlayer.setPlaybackRate(rate);
    }
    if (this.crossfadeAudio) {
      this.crossfadeAudio.playbackRate = rate;
    }
  }

  setPreservePitch(enabled: boolean) {
    this.preservePitchEnabled = enabled;
    this.applyPitchPreservation(this.audio);
    if (this.crossfadeAudio) {
      this.applyPitchPreservation(this.crossfadeAudio);
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

  on<K extends keyof AudioEngineEventMap>(event: K, callback: AudioEngineEventMap[K]) {
    switch (event) {
      case "play": this.onPlay = callback as AudioEventCallback; break;
      case "pause": this.onPause = callback as AudioEventCallback; break;
      case "ended": this.onEnded = callback as AudioEventCallback; break;
      case "timeupdate": this.onTimeUpdate = callback as TimeUpdateCallback; break;
      case "error": this.onError = callback as (error: string) => void; break;
      case "loadstart": this.onLoadStart = callback as AudioEventCallback; break;
      case "canplay": this.onCanPlay = callback as AudioEventCallback; break;
      case "crossfade": this.onCrossfadeNeeded = callback as AudioEventCallback; break;
    }
  }

  destroy() {
    this.stopProgressUpdates();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    this.audio.pause();
    this.audio.src = "";
    this.crossfadeAudio?.pause();
    if (this.crossfadeAudio) this.crossfadeAudio.src = "";
    this.source?.disconnect();
    this.crossfadeSource?.disconnect();
    void this.resetDashPlayer();
    this.gainNode?.disconnect();
    this.masterGain?.disconnect();
    this.crossfadeGainNode?.disconnect();
    this.eqNodes.forEach(n => n.disconnect());
    this.compressorNode?.disconnect();
    this.preampNode?.disconnect();
    this.monoSplitter?.disconnect();
    this.monoMerger?.disconnect();
    this.monoLeftGain?.disconnect();
    this.monoRightGain?.disconnect();
    this.analyser?.disconnect();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => { });
    }
    this.audioContext = null;
    this.analyser = null;
    this.masterGain = null;
    this.gainNode = null;
    this.compressorNode = null;
    this.preampNode = null;
    this.monoSplitter = null;
    this.monoMerger = null;
    this.monoLeftGain = null;
    this.monoRightGain = null;
    this.eqNodes = [];
    this.crossfadeGainNode = null;
    this.source = null;
    this.crossfadeSource = null;
    this.connected = false;
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
