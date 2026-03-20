type YoutubeEmbedEventMap = {
  ended: () => void;
  error: (error: string) => void;
  pause: () => void;
  play: () => void;
  timeupdate: (currentTime: number, duration: number) => void;
};

type YoutubeEmbedEventName = keyof YoutubeEmbedEventMap;

type YoutubePlayerStateChangeEvent = {
  data: number;
};

type YoutubePlayerErrorEvent = {
  data: number;
};

type YoutubePlayer = {
  cueVideoById: (options: { endSeconds?: number; startSeconds?: number; videoId: string }) => void;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (options: { endSeconds?: number; startSeconds?: number; videoId: string }) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  stopVideo: () => void;
};

type YoutubeApiNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      events?: {
        onError?: (event: YoutubePlayerErrorEvent) => void;
        onReady?: () => void;
        onStateChange?: (event: YoutubePlayerStateChangeEvent) => void;
      };
      height?: string;
      playerVars?: Record<string, number | string>;
      width?: string;
    },
  ) => YoutubePlayer;
};

declare global {
  interface Window {
    YT?: YoutubeApiNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
const YOUTUBE_PROGRESS_INTERVAL_MS = 250;
const YOUTUBE_PLAYER_STATE_ENDED = 0;
const YOUTUBE_PLAYER_STATE_PLAYING = 1;
const YOUTUBE_PLAYER_STATE_PAUSED = 2;
const YOUTUBE_PLAYER_STATE_BUFFERING = 3;

function isActiveYoutubePlayerState(state: number | null | undefined) {
  return state === YOUTUBE_PLAYER_STATE_PLAYING || state === YOUTUBE_PLAYER_STATE_BUFFERING;
}

class YoutubeEmbedManager {
  private apiPromise: Promise<YoutubeApiNamespace> | null = null;
  private currentVideoId: string | null = null;
  private globalHost: HTMLDivElement | null = null;
  private readonly listeners: { [K in YoutubeEmbedEventName]: Set<YoutubeEmbedEventMap[K]> } = {
    ended: new Set(),
    error: new Set(),
    pause: new Set(),
    play: new Set(),
    timeupdate: new Set(),
  };
  private mountNode: HTMLDivElement | null = null;
  private player: YoutubePlayer | null = null;
  private playerPromise: Promise<YoutubePlayer> | null = null;
  private progressIntervalId: number | null = null;
  private warmupPromise: Promise<void> | null = null;

  constructor() {
    if (typeof document === "undefined") {
      return;
    }

    this.mountNode = document.createElement("div");
    this.mountNode.className = "h-full w-full";

    this.globalHost = document.createElement("div");
    this.globalHost.id = "knobb-youtube-embed-host";
    this.globalHost.style.position = "fixed";
    // Keep the hidden host large enough for the YouTube iframe player to initialize
    // reliably even when audio-only tracks never attach to a visible panel host.
    this.globalHost.style.width = "320px";
    this.globalHost.style.height = "240px";
    this.globalHost.style.pointerEvents = "none";
    this.globalHost.style.opacity = "0";
    this.globalHost.style.overflow = "hidden";
    this.globalHost.style.right = "0";
    this.globalHost.style.bottom = "0";
    this.globalHost.style.left = "auto";
    this.globalHost.style.top = "auto";
    this.globalHost.style.zIndex = "-1";
    document.body.appendChild(this.globalHost);
    this.globalHost.appendChild(this.mountNode);
  }

  on<EventName extends YoutubeEmbedEventName>(eventName: EventName, callback: YoutubeEmbedEventMap[EventName]) {
    this.listeners[eventName].add(callback);
    return () => {
      this.listeners[eventName].delete(callback);
    };
  }

  attachHost(host: HTMLElement) {
    const previousHost = this.mountNode?.parentElement;
    this.moveMountNodeToHost(host);

    if (previousHost === this.globalHost && host !== this.globalHost) {
      this.recreatePlayerInVisibleHost();
    }
  }

  isAttachedToHost(host: HTMLElement) {
    return this.mountNode?.parentElement === host;
  }

  returnToGlobalHost() {
    this.moveMountNodeToHost(this.globalHost);
  }

  private getPlayerMethod(methodName: keyof YoutubePlayer) {
    const player = this.player as Partial<YoutubePlayer> | null;
    const candidate = player?.[methodName];
    if (typeof candidate !== "function") {
      return null;
    }

    return candidate.bind(player);
  }

  private moveMountNodeToHost(host: HTMLElement | null) {
    if (!host || !this.mountNode || this.mountNode.parentElement === host) {
      return;
    }

    const wasPlaying = isActiveYoutubePlayerState(this.player?.getPlayerState());
    host.appendChild(this.mountNode);
    this.syncIframeLayout();
    this.queueIframeLayoutSync();

    if (!wasPlaying || typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      if (!isActiveYoutubePlayerState(this.player?.getPlayerState())) {
        this.getPlayerMethod("playVideo")?.();
        this.startProgressUpdates();
      }
    }, 0);
  }

  async load(videoId: string, options: { autoplay?: boolean; startSeconds?: number } = {}) {
    this.currentVideoId = videoId;
    await this.waitForVisibleHost();
    const player = await this.ensurePlayer();

    const loadOptions = {
      startSeconds: options.startSeconds && options.startSeconds > 0 ? options.startSeconds : undefined,
      videoId,
    };

    if (options.autoplay === false) {
      player.cueVideoById(loadOptions);
    } else {
      player.loadVideoById(loadOptions);
    }

    this.startProgressUpdates();
    this.queueIframeLayoutSync();
  }

  async play() {
    const player = await this.ensurePlayer();
    player.playVideo();
    this.startProgressUpdates();
  }

  warmup() {
    if (this.player) {
      this.syncIframeLayout();
      this.queueIframeLayoutSync();
      return Promise.resolve();
    }

    if (!this.warmupPromise) {
      this.warmupPromise = this.ensurePlayer()
        .then(() => {
          this.syncIframeLayout();
          this.queueIframeLayoutSync();
        })
        .finally(() => {
          this.warmupPromise = null;
        });
    }

    return this.warmupPromise;
  }

  pause() {
    this.getPlayerMethod("pauseVideo")?.();
    this.emit("pause");
  }

  seek(time: number) {
    if (!this.player) {
      return;
    }

    const nextTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    this.getPlayerMethod("seekTo")?.(nextTime, true);
    this.emitTimeUpdate();
  }

  reset() {
    this.currentVideoId = null;
    this.stopProgressUpdates();
    const stopVideo = this.getPlayerMethod("stopVideo");
    const pauseVideo = this.getPlayerMethod("pauseVideo");

    if (stopVideo) {
      stopVideo();
    } else {
      pauseVideo?.();
    }

    this.emit("pause");
    this.emit("timeupdate", 0, 0);
  }

  isPaused() {
    const state = this.player?.getPlayerState();
    return state !== YOUTUBE_PLAYER_STATE_PLAYING && state !== YOUTUBE_PLAYER_STATE_BUFFERING;
  }

  getCurrentTime() {
    try {
      return this.player?.getCurrentTime() || 0;
    } catch {
      return 0;
    }
  }

  getDuration() {
    try {
      return this.player?.getDuration() || 0;
    } catch {
      return 0;
    }
  }

  private emit<EventName extends YoutubeEmbedEventName>(
    eventName: EventName,
    ...args: Parameters<YoutubeEmbedEventMap[EventName]>
  ) {
    for (const listener of this.listeners[eventName]) {
      listener(...args);
    }
  }

  private emitTimeUpdate() {
    this.emit("timeupdate", this.getCurrentTime(), this.getDuration());
  }

  private syncIframeLayout() {
    const iframe = this.mountNode?.querySelector("iframe");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.display = "block";
    iframe.style.border = "0";
  }

  private queueIframeLayoutSync(frameCount = 3) {
    if (typeof window === "undefined") {
      return;
    }

    let remainingFrames = frameCount;
    const sync = () => {
      this.syncIframeLayout();
      this.emitTimeUpdate();

      if (remainingFrames <= 0) {
        return;
      }

      remainingFrames -= 1;
      window.requestAnimationFrame(sync);
    };

    window.requestAnimationFrame(sync);
  }

  private recreatePlayerInVisibleHost() {
    if (!this.currentVideoId || !this.mountNode || !this.player) {
      return;
    }

    const startSeconds = this.getCurrentTime();
    const autoplay = !this.isPaused();

    this.stopProgressUpdates();

    try {
      this.getPlayerMethod("destroy")?.();
    } catch {
      // Ignore destroy failures and try to recreate anyway.
    }

    this.player = null;
    this.playerPromise = null;
    this.mountNode.innerHTML = "";

    void this.load(this.currentVideoId, {
      autoplay,
      startSeconds,
    }).catch((error) => {
      this.emit("error", error instanceof Error ? error.message : String(error || "Failed to rebuild YouTube embed"));
    });
  }

  private startProgressUpdates() {
    if (this.progressIntervalId !== null || typeof window === "undefined") {
      return;
    }

    this.progressIntervalId = window.setInterval(() => {
      this.emitTimeUpdate();
    }, YOUTUBE_PROGRESS_INTERVAL_MS);
  }

  private stopProgressUpdates() {
    if (this.progressIntervalId === null || typeof window === "undefined") {
      return;
    }

    window.clearInterval(this.progressIntervalId);
    this.progressIntervalId = null;
  }

  private async ensurePlayer() {
    if (this.player) {
      return this.player;
    }

    if (!this.mountNode) {
      throw new Error("YouTube embed host is unavailable");
    }

    if (!this.playerPromise) {
      this.playerPromise = this.loadApi().then((api) => new Promise<YoutubePlayer>((resolve) => {
        this.player = new api.Player(this.mountNode as HTMLElement, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              resolve(this.player as YoutubePlayer);
            },
            onError: (event) => {
              this.emit("error", `YouTube embed error (${event.data})`);
            },
            onStateChange: (event) => {
              this.handlePlayerStateChange(event.data);
            },
          },
        });
      }));
    }

    return this.playerPromise;
  }

  private handlePlayerStateChange(nextState: number) {
    if (nextState === YOUTUBE_PLAYER_STATE_PLAYING) {
      this.startProgressUpdates();
      this.emit("play");
      this.emitTimeUpdate();
      return;
    }

    if (nextState === YOUTUBE_PLAYER_STATE_PAUSED) {
      this.emitTimeUpdate();
      this.emit("pause");
      return;
    }

    if (nextState === YOUTUBE_PLAYER_STATE_ENDED) {
      this.emitTimeUpdate();
      this.stopProgressUpdates();
      this.emit("ended");
      return;
    }

    if (nextState === YOUTUBE_PLAYER_STATE_BUFFERING) {
      this.startProgressUpdates();
      this.emitTimeUpdate();
    }
  }

  private loadApi() {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("YouTube embed is only available in the browser"));
    }

    if (window.YT?.Player) {
      return Promise.resolve(window.YT);
    }

    if (!this.apiPromise) {
      this.apiPromise = new Promise<YoutubeApiNamespace>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_IFRAME_API_URL}"]`);
        const previousReady = window.onYouTubeIframeAPIReady;
        const timeoutId = window.setTimeout(() => {
          reject(new Error("YouTube embed API timed out"));
        }, 15000);

        window.onYouTubeIframeAPIReady = () => {
          previousReady?.();
          window.clearTimeout(timeoutId);
          if (window.YT?.Player) {
            resolve(window.YT);
            return;
          }

          reject(new Error("YouTube embed API was unavailable after load"));
        };

        if (!existingScript) {
          const script = document.createElement("script");
          script.src = YOUTUBE_IFRAME_API_URL;
          script.async = true;
          script.onerror = () => {
            window.clearTimeout(timeoutId);
            reject(new Error("Failed to load the YouTube embed API"));
          };
          document.head.appendChild(script);
        }
      });
    }

    return this.apiPromise;
  }

  private waitForVisibleHost(timeoutMs = 2000) {
    if (typeof window === "undefined" || !this.mountNode) {
      return Promise.resolve();
    }

    const startedAt = window.performance.now();

    return new Promise<void>((resolve) => {
      const checkVisibility = () => {
        const parent = this.mountNode?.parentElement;
        if (!parent) {
          resolve();
          return;
        }

        const rect = parent.getBoundingClientRect();
        const isMountedInVisibleHost = parent !== this.globalHost && rect.width > 0 && rect.height > 0;
        if (isMountedInVisibleHost) {
          this.syncIframeLayout();
          resolve();
          return;
        }

        if (window.performance.now() - startedAt >= timeoutMs) {
          resolve();
          return;
        }

        window.requestAnimationFrame(checkVisibility);
      };

      checkVisibility();
    });
  }
}

let youtubeEmbedManager: YoutubeEmbedManager | null = null;

export function getYoutubeEmbedManager() {
  if (!youtubeEmbedManager) {
    youtubeEmbedManager = new YoutubeEmbedManager();
  }

  return youtubeEmbedManager;
}
