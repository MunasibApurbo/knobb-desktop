/**
 * AudioEngine — Web Audio API + HTML5 Audio for real playback
 * Supports crossfade between tracks via dual audio elements
 */

import { EQ_BANDS, type PlaybackSource } from "@/lib/audioEngineShared";
import {
  applyDashVideoQualityPreference,
  applyHlsVideoQualityPreference,
  getVideoQualityPreference,
  type VideoQualityPreference,
} from "@/lib/videoPlaybackPreferences";

export { EQ_BANDS, EQ_PRESETS, type PlaybackSource } from "@/lib/audioEngineShared";

type DashModule = typeof import("dashjs");
type HlsModule = typeof import("hls.js");

let dashModulePromise: Promise<DashModule> | null = null;
let hlsModulePromise: Promise<HlsModule> | null = null;
const MEDIA_UNLOCK_DATA_URI = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const ACTIVE_PROGRESS_RAF_INTERVAL_MS = 100;

function loadDashModule() {
  if (!dashModulePromise) {
    dashModulePromise = import("dashjs");
  }

  return dashModulePromise;
}

function loadHlsModule() {
  if (!hlsModulePromise) {
    hlsModulePromise = import("hls.js");
  }

  return hlsModulePromise;
}

function isGoogleVideoHost(hostname: string) {
  return hostname === "googlevideo.com" || hostname.endsWith(".googlevideo.com");
}

function shouldBypassWebAudioForSource(source: PlaybackSource) {
  if (source.type !== "direct") return false;

  try {
    const parsedUrl = new URL(source.url, typeof window !== "undefined" ? window.location.href : "http://localhost");
    return isGoogleVideoHost(parsedUrl.hostname);
  } catch {
    return false;
  }
}

function getMediaElementCrossOrigin(source: PlaybackSource) {
  return shouldBypassWebAudioForSource(source) ? "" : "anonymous";
}

function formatMediaErrorCode(code: number | undefined) {
  switch (code) {
    case 1:
      return "playback was aborted";
    case 2:
      return "a network error occurred";
    case 3:
      return "the media could not be decoded";
    case 4:
      return "the media format is not supported";
    default:
      return null;
  }
}

function isPlayInterruptedByPauseError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /play\(\) request was interrupted by a call to pause\(\)/i.test(message);
}

function pickPlaybackStartError(errors: unknown[]) {
  return errors.find((error) => !isPlayInterruptedByPauseError(error)) || errors[0] || new Error("Playback failed to start");
}

export function preloadStreamPlayerModule(type: PlaybackSource["type"]) {
  if (type === "dash") {
    return loadDashModule().then(() => undefined);
  }

  if (type === "hls") {
    return loadHlsModule().then(() => undefined);
  }

  return Promise.resolve();
}

type AudioEventCallback = () => void;
type TimeUpdateCallback = (currentTime: number, duration: number) => void;
type PlaybackInterruptionReason = "waiting" | "stalled";
type AudioEngineEventMap = {
  play: AudioEventCallback;
  pause: AudioEventCallback;
  ended: AudioEventCallback;
  timeupdate: TimeUpdateCallback;
  error: (error: string) => void;
  loadstart: AudioEventCallback;
  canplay: AudioEventCallback;
  crossfade: AudioEventCallback;
  interrupted: (reason: PlaybackInterruptionReason) => void;
};

export class AudioEngine {
  private audio: HTMLAudioElement;
  private companionAudio: HTMLAudioElement | null = null;
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
  private crossfadeRequested = false;
  public isCrossfading = false;
  private crossfadeId = 0;
  private crossfadeTimeout: number | null = null;
  private onCrossfadeNeeded: (() => void) | null = null;

  // Keep progress bookkeeping responsive without doing player work every frame.
  private rafId: number | null = null;
  private progressIntervalId: number | null = null;
  private lastProgressRafTimestamp = 0;
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
  private onInterrupted: ((reason: PlaybackInterruptionReason) => void) | null = null;
  private preferredSinkId = "default";
  private sourceVideoQualityPreference: VideoQualityPreference | null = null;
  private loopEnabled = false;
  private dashPlayer: {
    initialize: (view: HTMLMediaElement | null, source: string | null, autoPlay?: boolean) => void;
    attachSource: (url: string) => void;
    reset: () => void;
    seek: (time: number) => void;
    getBitrateInfoListFor?: (type: "video") => Array<{ bitrate?: number; height?: number; qualityIndex?: number }>;
    setAutoSwitchQualityFor?: (type: "video", enabled: boolean) => void;
    setQualityFor?: (type: "video", qualityIndex: number, forceReplace?: boolean) => void;
    setPlaybackRate?: (rate: number) => void;
    getPlaybackRate?: () => number;
    updateSettings?: (settings: unknown) => void;
  } | null = null;
  private hlsPlayer: {
    destroy: () => void;
    attachMedia?: (media: HTMLMediaElement) => void;
    loadSource?: (url: string) => void;
    startLoad?: () => void;
    on?: (event: string, callback: () => void) => void;
    levels?: Array<{ bitrate?: number; height?: number }>;
    autoLevelCapping?: number;
    startLevel?: number;
    nextLevel?: number;
    currentLevel?: number;
  } | null = null;
  private dashSourceUrl: string | null = null;
  private dashReadyPromise: Promise<void> | null = null;
  private hlsSourceUrl: string | null = null;
  private webAudioEffectsError: string | null = null;
  private bypassWebAudioForCurrentSource = false;
  private mediaPlaybackPrimed = false;
  private frequencyDataBuffer: Uint8Array | null = null;
  private timeDomainDataBuffer: Uint8Array | null = null;
  private globalHost: HTMLDivElement | null = null;
  private hostTransferPlaybackRestoreTimer: number | null = null;
  private hostTransferPlaybackRestoreId = 0;

  constructor() {
    this.audio = this.createPrimaryMediaElement();
    this.createGlobalHost();
    this.preferredSinkId = this.readPreferredSinkId();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private canAttachMediaElement(mediaElement: HTMLMediaElement) {
    return typeof Node !== "undefined" && mediaElement instanceof Node;
  }

  private createGlobalHost() {
    if (typeof document === "undefined") return;
    
    this.globalHost = document.createElement("div");
    this.globalHost.id = "knobb-global-media-host";
    this.globalHost.style.position = "fixed";
    this.globalHost.style.width = "0";
    this.globalHost.style.height = "0";
    this.globalHost.style.pointerEvents = "none";
    this.globalHost.style.overflow = "hidden";
    this.globalHost.style.opacity = "0";
    this.globalHost.style.zIndex = "-1";
    document.body.appendChild(this.globalHost);
    
    // Maintain initial parenting
    if (this.canAttachMediaElement(this.audio)) {
      this.globalHost.appendChild(this.audio);
    }
  }

  private clearHostTransferPlaybackRestoreTimer() {
    if (this.hostTransferPlaybackRestoreTimer === null || typeof window === "undefined") {
      this.hostTransferPlaybackRestoreTimer = null;
      return;
    }

    window.clearTimeout(this.hostTransferPlaybackRestoreTimer);
    this.hostTransferPlaybackRestoreTimer = null;
  }

  private schedulePlaybackRestoreAfterHostTransfer(transferId: number) {
    if (typeof window === "undefined") {
      return;
    }

    this.clearHostTransferPlaybackRestoreTimer();
    this.hostTransferPlaybackRestoreTimer = window.setTimeout(() => {
      this.hostTransferPlaybackRestoreTimer = null;

      if (transferId !== this.hostTransferPlaybackRestoreId || !this.audio.paused) {
        return;
      }

      void this.play().catch(() => undefined);
    }, 0);
  }

  private moveMediaElementToHost(host: HTMLElement | null) {
    if (!host || !this.audio || !this.canAttachMediaElement(this.audio)) return;
    if (this.audio.parentElement === host) return;

    const wasPlaying = !this.audio.paused;
    const transferId = ++this.hostTransferPlaybackRestoreId;
    host.appendChild(this.audio);

    if (!wasPlaying) {
      this.clearHostTransferPlaybackRestoreTimer();
      return;
    }

    if (this.audio.paused) {
      void this.play().catch(() => undefined);
    }

    this.schedulePlaybackRestoreAfterHostTransfer(transferId);
  }

  public attachMediaElementToHost(host: HTMLElement) {
    this.moveMediaElementToHost(host);
  }

  public isMediaElementAttachedToHost(host: HTMLElement) {
    return this.audio.parentElement === host;
  }

  public returnMediaElementToGlobalHost() {
    this.moveMediaElementToHost(this.globalHost);
  }

  private createPrimaryMediaElement() {
    const mediaElement = typeof document !== "undefined"
      ? (() => {
          const element = document.createElement("video");
          element.playsInline = true;
          return element as unknown as HTMLAudioElement;
        })()
      : new Audio();

    mediaElement.preload = "auto";
    mediaElement.loop = this.loopEnabled;
    this.applyPitchPreservation(mediaElement);
    this.setupAudioListeners(mediaElement);
    void this.applyPreferredSink(mediaElement);
    return mediaElement;
  }

  private createCompanionAudioElement() {
    const mediaElement = typeof document !== "undefined"
      ? document.createElement("audio")
      : new Audio();

    mediaElement.preload = "auto";
    mediaElement.loop = this.loopEnabled;
    this.applyPitchPreservation(mediaElement);
    void this.applyPreferredSink(mediaElement);

    if (this.globalHost && this.canAttachMediaElement(mediaElement)) {
      this.globalHost.appendChild(mediaElement);
    }

    return mediaElement;
  }

  private ensureCompanionAudioElement() {
    if (!this.companionAudio) {
      this.companionAudio = this.createCompanionAudioElement();
      this.companionAudio.addEventListener("error", () => {
        if (!this.companionAudio) return;
        this.onError?.(this.describeMediaElementError(this.companionAudio, "Companion audio stream"));
      });
    }

    return this.companionAudio;
  }

  private resetCompanionAudio() {
    if (!this.companionAudio) {
      return;
    }

    this.companionAudio.src = "";
    this.companionAudio.load();
    this.companionAudio = null;
  }

  private getEffectiveOutputVolume() {
    return Math.max(0, Math.min(1, this.companionAudio?.volume ?? this.audio.volume));
  }

  private getActiveProgressTime() {
    if (!this.companionAudio) {
      return this.audio.currentTime;
    }

    if (this.companionAudio.readyState < 3) {
      return this.companionAudio.currentTime || 0;
    }

    return this.companionAudio.currentTime || this.audio.currentTime;
  }

  private getActiveDuration() {
    if (!this.companionAudio) {
      return this.audio.duration || 0;
    }

    return this.companionAudio.duration || this.audio.duration || 0;
  }

  private syncCompanionAudioTime(force = false) {
    if (!this.companionAudio) {
      return;
    }

    if (!force && (this.companionAudio.paused || this.companionAudio.readyState < 3 || this.audio.readyState < 3)) {
      return;
    }

    const drift = Math.abs((this.companionAudio.currentTime || 0) - (this.audio.currentTime || 0));
    if (!force && drift < 0.2) {
      return;
    }

    try {
      if (force) {
        this.companionAudio.currentTime = this.audio.currentTime;
        return;
      }

      // In split playback, let the audible companion audio lead and keep
      // the silent video stream aligned to it instead of dragging audio ahead.
      this.audio.currentTime = this.companionAudio.currentTime;
    } catch {
      // Ignore sync failures and keep the active stream authoritative.
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
        this.syncCompanionAudioTime();
        this.emitProgress();
      }
    });
    audio.addEventListener("seeking", () => {
      if (audio === this.audio) {
        this.syncCompanionAudioTime(true);
        this.emitProgress();
      }
    });
    audio.addEventListener("seeked", () => {
      if (audio === this.audio) {
        this.syncCompanionAudioTime(true);
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
    audio.addEventListener("playing", () => {
      if (audio !== this.audio) return;
      this.emitProgress();
      this.onPlay?.();
    });
    audio.addEventListener("waiting", () => {
      if (audio !== this.audio) return;
      this.emitProgress();
      this.onLoadStart?.();
      this.onInterrupted?.("waiting");
    });
    audio.addEventListener("stalled", () => {
      if (audio !== this.audio) return;
      this.emitProgress();
      this.onLoadStart?.();
      this.onInterrupted?.("stalled");
    });
    audio.addEventListener("error", () => {
      if (audio !== this.audio) return;
      this.onError?.(this.describeMediaElementError(audio, "Primary media stream"));
    });
  }

  private describeMediaElementError(media: HTMLMediaElement, label = "Media stream") {
    const code = typeof media.error?.code === "number" ? media.error.code : undefined;
    const codeDescription = formatMediaErrorCode(code);
    const message = typeof media.error?.message === "string" ? media.error.message.trim() : "";

    if (message && codeDescription) {
      return `${label} failed: ${codeDescription}. ${message} (code ${code})`;
    }

    if (message) {
      return `${label} failed: ${message}${code ? ` (code ${code})` : ""}`;
    }

    if (codeDescription) {
      return `${label} failed: ${codeDescription}${code ? ` (code ${code})` : ""}`;
    }

    return `${label} failed while loading`;
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

    const dashModule = await loadDashModule();
    this.dashPlayer = dashModule.MediaPlayer().create();
    this.dashPlayer.updateSettings?.({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: true,
          },
          bandwidthSafetyFactor: 0.72,
          initialBitrate: {
            video: 900,
          },
        },
        buffer: {
          bufferTimeAtTopQuality: 20,
          bufferTimeAtTopQualityLongForm: 30,
          fastSwitchEnabled: true,
          initialBufferLevel: 4,
          stableBufferTime: 12,
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

  private async resetHlsPlayer() {
    if (this.hlsPlayer) {
      try {
        this.hlsPlayer.destroy();
      } catch {
        // Ignore HLS reset failures.
      }
      this.hlsPlayer = null;
    }
    this.hlsSourceUrl = null;
  }

  private waitForCanPlay(media: HTMLMediaElement, timeoutMs = 3000, label = "Media stream") {
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        media.removeEventListener("canplay", handleCanPlay);
        media.removeEventListener("error", handleError);
        window.clearTimeout(timeoutId);
      };

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const handleCanPlay = () => {
        settle(resolve);
      };

      const handleError = () => {
        settle(() => reject(new Error(this.describeMediaElementError(media, label))));
      };

      if (media.readyState >= 3) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        if (media.readyState >= 3) {
          settle(resolve);
          return;
        }

        settle(() => reject(new Error(`${label} did not become ready before playback timeout`)));
      }, timeoutMs);

      media.addEventListener("canplay", handleCanPlay, { once: true });
      media.addEventListener("error", handleError, { once: true });
    });
  }

  private async waitForPrimaryMediaReadiness(requireCanPlay = false, timeoutMs = 1500, label = "Primary media") {
    const readyStateThreshold = requireCanPlay ? 3 : 1;
    if (this.audio.readyState >= readyStateThreshold) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        this.audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        this.audio.removeEventListener("canplay", handleCanPlay);
        this.audio.removeEventListener("error", handleError);
        window.clearTimeout(timeoutId);
      };

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const handleLoadedMetadata = () => {
        if (!requireCanPlay) {
          settle(resolve);
        }
      };

      const handleCanPlay = () => {
        settle(resolve);
      };

      const handleError = () => {
        settle(() => reject(new Error(this.describeMediaElementError(this.audio, label))));
      };

      const timeoutId = window.setTimeout(() => {
        if (this.audio.readyState >= readyStateThreshold) {
          settle(resolve);
          return;
        }

        settle(() => reject(new Error(`${label} did not become ready before playback timeout`)));
      }, timeoutMs);

      this.audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      this.audio.addEventListener("canplay", handleCanPlay, { once: true });
      this.audio.addEventListener("error", handleError, { once: true });
    });
  }

  private async attachDashSource(url: string, startTime = 0) {
    await this.resetHlsPlayer();
    const player = await this.getDashPlayer();

    this.dashReadyPromise = this.waitForPrimaryMediaReadiness(true, 5000, "DASH stream");

    if (this.dashSourceUrl !== url) {
      if (this.dashSourceUrl) {
        player.attachSource(url);
      } else {
        player.initialize(this.audio, url, false);
      }
      this.dashSourceUrl = url;
    } else if (!this.dashSourceUrl) {
      player.initialize(this.audio, url, false);
      this.dashSourceUrl = url;
    }

    if (typeof player.setPlaybackRate === "function") {
      player.setPlaybackRate(this.audio.playbackRate);
    }

    this.applyVideoQualityPreference();
    await this.dashReadyPromise;
    this.applyVideoQualityPreference();

    const seekTime = Math.max(0, startTime);
    try {
      player.seek(seekTime);
    } catch {
      this.audio.currentTime = seekTime;
    }

    if (startTime > 0) {
      try {
        this.audio.currentTime = seekTime;
      } catch {
        // Ignore post-seek sync failures.
      }
    }
  }

  private async attachHlsSource(url: string) {
    await this.resetDashPlayer();
    await this.resetHlsPlayer();
    const preference = this.getActiveVideoQualityPreference();
    const canPlayNativeHls =
      Boolean(this.audio.canPlayType("application/vnd.apple.mpegurl")) ||
      Boolean(this.audio.canPlayType("audio/mpegurl"));

    if (canPlayNativeHls && preference === "auto") {
      this.hlsSourceUrl = url;
      this.audio.src = url;
      this.audio.load();
      await this.waitForCanPlay(this.audio, 5000, "HLS stream");
      return;
    }

    const Hls = (await loadHlsModule()).default;
    if (!Hls.isSupported()) {
      throw new Error("HLS playback is not supported");
    }

    this.audio.removeAttribute("src");
    this.audio.load();

    const hls = new Hls({
      abrBandWidthFactor: 0.7,
      abrBandWidthUpFactor: 0.55,
      abrEwmaDefaultEstimate: 1_000_000,
      autoStartLoad: false,
      backBufferLength: 90,
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      maxLoadingDelay: 4,
      maxStarvationDelay: 4,
      startLevel: 0,
      startFragPrefetch: true,
    });
    this.hlsPlayer = hls;
    this.hlsSourceUrl = url;

    const readyPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("HLS manifest did not become ready before playback timeout"));
      }, 5000);

      const settle = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve();
      };

      hls.on?.(Hls.Events.MEDIA_ATTACHED, () => {
        if (settled) return;
        hls.loadSource?.(url);
      });

      hls.on?.(Hls.Events.MANIFEST_PARSED, () => {
        if (settled) return;
        this.applyVideoQualityPreference();
        hls.startLoad?.();
        settle();
      });
      hls.on?.(Hls.Events.ERROR, (_event, data) => {
        if (settled || !data?.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch {
            window.clearTimeout(timeoutId);
            reject(new Error(data.details || "Failed to recover HLS stream"));
            return;
          }
        }
        window.clearTimeout(timeoutId);
        reject(new Error(data.details || "Failed to load HLS stream"));
      });
    });

    hls.attachMedia?.(this.audio);
    await readyPromise;
    this.applyVideoQualityPreference();
    await this.waitForCanPlay(this.audio, 5000, "HLS stream");
  }

  private getActiveVideoQualityPreference() {
    return this.sourceVideoQualityPreference ?? getVideoQualityPreference();
  }

  private applyVideoQualityPreference() {
    const preference = this.getActiveVideoQualityPreference();
    applyDashVideoQualityPreference(this.dashPlayer, preference);
    applyHlsVideoQualityPreference(this.hlsPlayer, preference);
  }

  preparePlayback() {
    this.initAudioContext();
    if (this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch(() => {
        // Ignore unlock failures here; a later explicit play attempt can still surface errors.
      });
    }
    if (!this.mediaPlaybackPrimed) {
      const unlockAudio = new Audio(MEDIA_UNLOCK_DATA_URI);
      unlockAudio.volume = 0;
      unlockAudio.muted = true;
      void unlockAudio.play()
        .then(() => {
          unlockAudio.pause();
          unlockAudio.src = "";
          this.mediaPlaybackPrimed = true;
        })
        .catch(() => {
          unlockAudio.src = "";
        });
    }
  }

  async preloadSourceType(type: PlaybackSource["type"]) {
    await preloadStreamPlayerModule(type);
  }

  private emitProgress() {
    this.onTimeUpdate?.(this.getActiveProgressTime(), this.getActiveDuration());
    this.checkCrossfade();
  }

  private startRAF() {
    this.stopRAF();
    const tick = (timestamp: number) => {
      if (
        this.lastProgressRafTimestamp === 0 ||
        timestamp - this.lastProgressRafTimestamp >= ACTIVE_PROGRESS_RAF_INTERVAL_MS
      ) {
        this.lastProgressRafTimestamp = timestamp;
        this.emitProgress();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRAF() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastProgressRafTimestamp = 0;
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
    if (this.crossfadeDuration <= 0 || this.isCrossfading || this.crossfadeRequested) return;
    const remaining = (this.audio.duration || 0) - this.audio.currentTime;
    if (remaining > 0 && remaining <= this.crossfadeDuration && !this.audio.paused) {
      this.crossfadeRequested = true;
      this.onCrossfadeNeeded?.();
    }
  }

  cancelPendingCrossfade() {
    if (this.isCrossfading || this.crossfadeAudio || this.crossfadeSource || this.crossfadeGainNode) {
      this.abortCrossfade();
      return;
    }
    this.crossfadeRequested = false;
  }

  setCrossfadeDuration(seconds: number) {
    this.crossfadeDuration = Math.max(0, Math.min(20, seconds));
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

    if (this.companionAudio) {
      await this.setElementSinkId(this.companionAudio, nextSinkId);
    }

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

    // This is a dynamics compressor/leveler, not true loudness normalization.
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

  private reportWebAudioEffectsUnavailable(error: unknown) {
    const reason = error instanceof Error ? error.message : String(error || "Unknown Web Audio failure");
    const message = `Web Audio effects unavailable: ${reason}`;

    if (this.webAudioEffectsError === message) {
      return;
    }

    this.webAudioEffectsError = message;
    this.onError?.(message);
  }

  private disconnectSourceFromGraph() {
    if (!this.source) {
      this.connected = false;
      return;
    }

    try {
      this.source.disconnect();
    } catch {
      // Ignore disconnect failures when toggling between playback modes.
    }

    this.connected = false;
  }

  private replacePrimaryAudioElement(source: PlaybackSource) {
    const previousAudio = this.audio;
    const nextAudio = this.createPrimaryMediaElement();
    const previousParent = previousAudio.parentElement;
    const replaceChild = previousParent && typeof (previousParent as { replaceChild?: unknown }).replaceChild === "function"
      ? (previousParent as { replaceChild: (nextChild: HTMLAudioElement, currentChild: HTMLAudioElement) => void }).replaceChild
      : null;
    const previousMedia = previousAudio as HTMLMediaElement & { poster?: string };
    const nextMedia = nextAudio as HTMLMediaElement & { poster?: string };

    nextAudio.volume = previousAudio.volume;
    nextAudio.playbackRate = previousAudio.playbackRate;
    nextAudio.crossOrigin = getMediaElementCrossOrigin(source);
    nextAudio.className = previousAudio.className;
    nextAudio.controls = previousAudio.controls;
    nextAudio.playsInline = previousAudio.playsInline;
    nextAudio.style.cssText = previousAudio.style.cssText;
    if ("poster" in previousMedia && "poster" in nextMedia) {
      nextMedia.poster = previousMedia.poster || "";
    }

    if (replaceChild) {
      replaceChild.call(previousParent, nextAudio, previousAudio);
    } else if (this.globalHost && this.canAttachMediaElement(nextAudio)) {
      this.globalHost.appendChild(nextAudio);
    }

    previousAudio.src = "";
    previousAudio.load();

    this.resetCompanionAudio();
    this.disconnectSourceFromGraph();
    this.source = null;
    this.audio = nextAudio;
  }

  private connectSource() {
    if (this.connected || !this.audioContext || !this.gainNode) return this.connected;

    try {
      if (this.source) {
        this.source.connect(this.gainNode);
        this.connected = true;
        this.webAudioEffectsError = null;
        return true;
      }

      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.gainNode);
      this.connected = true;
      this.webAudioEffectsError = null;
      return true;
    } catch (error) {
      this.connected = false;
      this.reportWebAudioEffectsUnavailable(error);
      return false;
    }
  }

  private abortCrossfade() {
    if (this.crossfadeTimeout !== null) {
      window.clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }
    this.crossfadeId++;

    const shouldRestorePrimaryGain = Boolean(
      this.crossfadeAudio || this.crossfadeSource || this.crossfadeGainNode || this.isCrossfading || this.crossfadeRequested,
    );
    this.crossfadeAudio?.pause();
    if (this.crossfadeAudio) {
      this.crossfadeAudio.src = "";
      this.crossfadeAudio.load();
    }
    this.crossfadeSource?.disconnect();
    this.crossfadeGainNode?.disconnect();
    this.crossfadeAudio = null;
    this.crossfadeSource = null;
    this.crossfadeGainNode = null;
    this.crossfadeRequested = false;
    this.isCrossfading = false;
    if (shouldRestorePrimaryGain) {
      this.applyReplayGain();
    }
  }

  /**
   * Crossfade: load next track into a secondary audio element,
   * fade out current, fade in next, then swap.
   */
  async crossfadeInto(source: PlaybackSource, replayGain = 0, peak = 1) {
    this.crossfadeRequested = false;

    if (source.audioUrl || source.type === "dash" || source.type === "hls" || this.dashSourceUrl || this.hlsSourceUrl) {
      await this.load(source, replayGain, peak);
      await this.play();
      return;
    }

    if (!this.audioContext || !this.analyser || !this.connected || !this.source || !this.masterGain || !this.gainNode) {
      // No crossfade possible, just do a regular load
      await this.load(source, replayGain, peak);
      await this.play();
      return;
    }

    this.isCrossfading = true; // Set flag immediately to suppress ended events from the outgoing track
    this.crossfadeRequested = false;
    const currentCrossfadeId = ++this.crossfadeId;

    // Create crossfade audio element
    this.crossfadeAudio = this.createPrimaryMediaElement();
    this.crossfadeAudio.crossOrigin = "anonymous";
    this.crossfadeAudio.preload = "auto";
    this.crossfadeAudio.playbackRate = this.audio.playbackRate;
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
      this.webAudioEffectsError = null;
    } catch (error) {
      this.reportWebAudioEffectsUnavailable(error);
      this.abortCrossfade();
      await this.load(source, replayGain, peak);
      await this.play();
      return;
    }

    // Wait for crossfade audio to be ready
    await new Promise<void>((resolve) => {
      this.crossfadeAudio!.addEventListener("canplay", () => resolve(), { once: true });
      setTimeout(resolve, 3000); // timeout fallback
    });

    if (this.crossfadeId !== currentCrossfadeId) return;

    // Apply replay gain to new track
    const gain = Math.pow(10, replayGain / 20);
    const clampedGain = Math.min(gain, 1 / peak);

    // Start playing crossfade audio
    try {
      await this.crossfadeAudio.play();
    } catch {
      if (this.crossfadeId === currentCrossfadeId) {
        this.abortCrossfade();
        await this.load(source, replayGain, peak);
        await this.play();
      }
      return;
    }

    if (this.crossfadeId !== currentCrossfadeId) return;

    const fadeDuration = this.crossfadeDuration;
    const now = this.audioContext.currentTime;
    const curvePoints = 40; // High resolution for smooth curve

    // Fade out current
    if (this.gainNode) {
      const fadeOutCurve = new Float32Array(curvePoints);
      const startGainSize = this.gainNode.gain.value;
      for (let i = 0; i < curvePoints; i++) {
        const t = i / (curvePoints - 1);
        fadeOutCurve[i] = startGainSize * Math.cos(t * Math.PI / 2);
      }
      this.gainNode.gain.setValueAtTime(startGainSize, now);
      this.gainNode.gain.setValueCurveAtTime(fadeOutCurve, now, fadeDuration);
    }

    // Fade in new (Equal Power)
    const fadeInCurve = new Float32Array(curvePoints);
    for (let i = 0; i < curvePoints; i++) {
      const t = i / (curvePoints - 1);
      fadeInCurve[i] = clampedGain * Math.sin(t * Math.PI / 2);
    }
    this.crossfadeGainNode.gain.setValueAtTime(0, now);
    this.crossfadeGainNode.gain.setValueCurveAtTime(fadeInCurve, now, fadeDuration);

    // After fade completes, swap audio elements
    this.crossfadeTimeout = window.setTimeout(() => {
      if (this.crossfadeId === currentCrossfadeId) {
        this.finalizeSwap(replayGain, peak);
      }
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
      this.gainNode!.gain.cancelScheduledValues(this.audioContext.currentTime);
      const gain = Math.pow(10, replayGain / 20);
      const targetGain = Math.min(gain, 1 / peak);
      this.gainNode!.gain.setValueAtTime(targetGain, this.audioContext.currentTime);
      
      this.crossfadeSource.connect(this.gainNode!);
      this.source = this.crossfadeSource;
      this.audio = this.crossfadeAudio;

      // Re-setup listeners on new primary audio
      if (!this.audio.paused) {
        this.startProgressUpdates();
        this.onPlay?.();
      }

      this.replayGain = replayGain;
      this.peak = peak;
      this.applyReplayGain();
    }

    this.crossfadeAudio = null;
    this.crossfadeSource = null;
    this.crossfadeGainNode = null;
    this.crossfadeRequested = false;
    this.isCrossfading = false;
  }

  async load(source: PlaybackSource, replayGain = 0, peak = 1) {
    this.abortCrossfade();
    await this.preloadSourceType(source.type);
    this.sourceVideoQualityPreference = source.videoQualityPreference ?? null;
    this.bypassWebAudioForCurrentSource = shouldBypassWebAudioForSource(source);
    if (this.bypassWebAudioForCurrentSource && this.source) {
      this.replacePrimaryAudioElement(source);
    }
    if (!this.bypassWebAudioForCurrentSource) {
      this.initAudioContext();
      this.connectSource();
    } else {
      this.disconnectSourceFromGraph();
    }
    this.crossfadeRequested = false;
    this.isCrossfading = false;
    this.stopProgressUpdates();
    this.audio.crossOrigin = getMediaElementCrossOrigin(source);

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
      this.audio.muted = false;
      this.audio.volume = this.getEffectiveOutputVolume();
      this.resetCompanionAudio();
      this.audio.src = "";
      this.audio.load();
      await this.attachDashSource(source.url);
    } else if (source.type === "hls") {
      this.audio.muted = false;
      this.audio.volume = this.getEffectiveOutputVolume();
      this.resetCompanionAudio();
      this.audio.src = "";
      this.audio.load();
      await this.attachHlsSource(source.url);
    } else {
      await this.resetDashPlayer();
      await this.resetHlsPlayer();
      resetToStart();
      const outputVolume = this.getEffectiveOutputVolume();

      if (source.audioUrl) {
        const companionAudio = this.ensureCompanionAudioElement();
        companionAudio.crossOrigin = getMediaElementCrossOrigin({
          url: source.audioUrl,
          type: "direct",
        });
        companionAudio.playbackRate = this.audio.playbackRate;
        companionAudio.volume = outputVolume;
        companionAudio.src = source.audioUrl;
        companionAudio.load();
        this.audio.muted = true;
        this.audio.volume = 0;
      } else {
        this.audio.muted = false;
        this.audio.volume = outputVolume;
        this.resetCompanionAudio();
      }

      this.audio.src = source.url;
      this.audio.load();
      resetToStart();

      if (this.audio.readyState < 1) {
        this.audio.addEventListener("loadedmetadata", resetToStart, { once: true });
        this.audio.addEventListener("canplay", resetToStart, { once: true });
      }

      if (source.audioUrl && this.companionAudio) {
        this.syncCompanionAudioTime(true);
        await Promise.all([
          this.waitForCanPlay(this.audio, 5000, "Video stream"),
          this.waitForCanPlay(this.companionAudio, 5000, "Companion audio stream"),
        ]);
      }
    }

    if (!this.bypassWebAudioForCurrentSource && this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async restore(source: PlaybackSource, replayGain = 0, peak = 1, startTime = 0) {
    await this.load(source, replayGain, peak);

    if (!isFinite(startTime) || startTime <= 0) {
      return;
    }

    const seekTo = Math.max(0, startTime);
    const applySeek = () => {
      this.seek(seekTo);
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
        if (this.gainNode && this.audioContext) {
          const now = this.audioContext.currentTime;
          const gain = Math.pow(10, this.replayGain / 20);
          const clampedGain = Math.min(gain, 1 / this.peak);
          this.gainNode.gain.setValueAtTime(0, now);
          this.gainNode.gain.exponentialRampToValueAtTime(clampedGain || 0.001, now + 0.1);
        }
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
    this.clearHostTransferPlaybackRestoreTimer();

    if (!this.bypassWebAudioForCurrentSource) {
      this.initAudioContext();
      this.connectSource();
    }

    if (!this.bypassWebAudioForCurrentSource && this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }

    if (this.gainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      const gain = Math.pow(10, this.replayGain / 20);
      const clampedGain = Math.min(gain, 1 / this.peak);
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.exponentialRampToValueAtTime(clampedGain || 0.001, now + 0.1);
    }

    const shouldBootstrapMuted = this.bypassWebAudioForCurrentSource;
    const previousPrimaryMuted = this.audio.muted;
    const previousPrimaryVolume = this.audio.volume;

    if (shouldBootstrapMuted) {
      this.audio.muted = true;
      this.audio.volume = 0;
    }

    if (this.companionAudio) {
      this.syncCompanionAudioTime(true);
      const companionAudio = this.companionAudio;
      const previousMuted = companionAudio.muted;
      const previousVolume = companionAudio.volume;
      companionAudio.muted = true;

      const playResults = await Promise.allSettled([
          this.audio.play(),
          companionAudio.play(),
      ]);

      const playErrors = playResults
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      if (playErrors.length > 0) {
        this.audio.pause();
        companionAudio.pause();
        this.audio.muted = previousPrimaryMuted;
        this.audio.volume = previousPrimaryVolume;
        companionAudio.muted = previousMuted;
        companionAudio.volume = previousVolume;
        throw pickPlaybackStartError(playErrors);
      }

      this.audio.muted = previousPrimaryMuted;
      this.audio.volume = previousPrimaryVolume;
      companionAudio.muted = previousMuted;
      companionAudio.volume = previousVolume;
      return;
    }

    try {
      await this.audio.play();
    } catch (error) {
      this.audio.muted = previousPrimaryMuted;
      this.audio.volume = previousPrimaryVolume;
      throw error;
    }

    this.audio.muted = previousPrimaryMuted;
    this.audio.volume = previousPrimaryVolume;
  }

  pause() {
    this.clearHostTransferPlaybackRestoreTimer();
    this.abortCrossfade();
    this.companionAudio?.pause();
    this.audio.pause();
  }

  seek(time: number) {
    if (!isFinite(time) || time < 0) {
      return;
    }

    if (this.dashSourceUrl && this.dashPlayer) {
      try {
        this.dashPlayer.seek(time);
        return;
      } catch {
        // Fall back to the media element seek below.
      }
    }

    this.audio.currentTime = time;
    this.syncCompanionAudioTime(true);
  }

  setVolume(volume: number) {
    const nextVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.companionAudio ? 0 : nextVolume;
    if (this.crossfadeAudio) {
      this.crossfadeAudio.volume = nextVolume;
    }
    if (this.companionAudio) {
      this.companionAudio.volume = nextVolume;
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
    if (this.companionAudio) {
      this.companionAudio.playbackRate = rate;
    }
  }

  setLoop(enabled: boolean) {
    this.loopEnabled = enabled;
    this.audio.loop = enabled;

    if (this.companionAudio) {
      this.companionAudio.loop = enabled;
    }

    if (this.crossfadeAudio) {
      this.crossfadeAudio.loop = enabled;
    }
  }

  setPreservePitch(enabled: boolean) {
    this.preservePitchEnabled = enabled;
    this.applyPitchPreservation(this.audio);
    if (this.companionAudio) {
      this.applyPitchPreservation(this.companionAudio);
    }
    if (this.crossfadeAudio) {
      this.applyPitchPreservation(this.crossfadeAudio);
    }
  }

  refreshVideoQualityPreference() {
    this.applyVideoQualityPreference();
  }

  getMediaElement() {
    return this.audio as HTMLMediaElement;
  }

  get currentTime() {
    return this.getActiveProgressTime();
  }

  get duration() {
    return this.getActiveDuration();
  }

  get paused() {
    return this.audio.paused;
  }

  get isLoading() {
    return this.audio.readyState < 3 || Boolean(this.companionAudio && this.companionAudio.readyState < 3);
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    if (this.frequencyDataBuffer?.length !== this.analyser.frequencyBinCount) {
      this.frequencyDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }

    const data = this.frequencyDataBuffer;
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    if (this.timeDomainDataBuffer?.length !== this.analyser.frequencyBinCount) {
      this.timeDomainDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }

    const data = this.timeDomainDataBuffer;
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
      case "interrupted": this.onInterrupted = callback as (reason: PlaybackInterruptionReason) => void; break;
    }
  }

  destroy() {
    this.clearHostTransferPlaybackRestoreTimer();
    this.stopProgressUpdates();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    this.audio.pause();
    this.audio.src = "";
    this.abortCrossfade();
    this.resetCompanionAudio();
    this.source?.disconnect();
    void this.resetDashPlayer();
    void this.resetHlsPlayer();
    this.gainNode?.disconnect();
    this.masterGain?.disconnect();
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
    this.source = null;
    this.connected = false;
    this.crossfadeRequested = false;
    this.webAudioEffectsError = null;
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
