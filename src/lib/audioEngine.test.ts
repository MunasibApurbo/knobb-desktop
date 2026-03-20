import { beforeEach, describe, expect, it, vi } from "vitest";

import { AudioEngine } from "@/lib/audioEngine";

class FakeAudio extends EventTarget {
  crossOrigin = "";
  preload = "";
  src = "";
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  duration = 0;
  paused = true;
  readyState = 4;
  error: { code: number; message?: string } | null = null;
  preservesPitch = true;
  className = "";
  controls = false;
  playsInline = true;
  muted = false;
  poster = "";
  parentElement: { replaceChild?: (nextChild: FakeAudio, currentChild: FakeAudio) => void } | null = null;
  style = {
    cssText: "",
  };

  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
  }

  pause() {
    const wasPaused = this.paused;
    this.paused = true;
    if (!wasPaused) {
      this.dispatchEvent(new Event("pause"));
    }
  }

  load() {
    this.dispatchEvent(new Event("loadstart"));
  }
}

function createGainNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  };
}

class FakeAudioContext {
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  destination = { connect: vi.fn(), disconnect: vi.fn() };
  createMediaElementSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createAnalyser = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 32,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  }));
  createGain = vi.fn(() => createGainNode());
  createDynamicsCompressor = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
  }));
  createBiquadFilter = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    type: "peaking",
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
  }));
  createChannelSplitter = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createChannelMerger = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

describe("AudioEngine", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === "video" || tagName === "audio") {
        return new FakeAudio() as unknown as HTMLElement;
      }
      return originalCreateElement(tagName, options);
    });
  });

  it("keeps ended events active while a crossfade request is still pending", () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const onCrossfade = vi.fn();
    const onEnded = vi.fn();

    engine.on("crossfade", onCrossfade);
    engine.on("ended", onEnded);
    engine.setCrossfadeDuration(4);

    primary.duration = 120;
    primary.currentTime = 117;
    primary.paused = false;

    (engine as unknown as { checkCrossfade: () => void }).checkCrossfade();

    expect(onCrossfade).toHaveBeenCalledTimes(1);
    expect((engine as unknown as { isCrossfading: boolean }).isCrossfading).toBe(false);
    expect((engine as unknown as { crossfadeRequested: boolean }).crossfadeRequested).toBe(true);

    primary.dispatchEvent(new Event("ended"));

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("emits play when a crossfaded element becomes the primary audio element", () => {
    const engine = new AudioEngine();
    const onPlay = vi.fn();
    const startProgressUpdates = vi.spyOn(engine as unknown as { startProgressUpdates: () => void }, "startProgressUpdates");

    engine.on("play", onPlay);

    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    primary.paused = false;

    const crossfadeAudio = new FakeAudio();
    crossfadeAudio.paused = false;

    const crossfadeSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const crossfadeGainNode = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const internals = engine as unknown as {
      audioContext: FakeAudioContext | null;
      isCrossfading: boolean;
      crossfadeAudio: FakeAudio | null;
      crossfadeSource: typeof crossfadeSource | null;
      crossfadeGainNode: typeof crossfadeGainNode | null;
      gainNode: ReturnType<typeof createGainNode> | null;
      finalizeSwap: (replayGain: number, peak: number) => void;
    };

    internals.audioContext = new FakeAudioContext();
    internals.isCrossfading = true;
    internals.crossfadeAudio = crossfadeAudio;
    internals.crossfadeSource = crossfadeSource;
    internals.crossfadeGainNode = crossfadeGainNode;
    internals.gainNode = createGainNode();

    internals.finalizeSwap(0, 1);

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(startProgressUpdates).toHaveBeenCalledTimes(1);
    expect((engine as unknown as { audio: FakeAudio }).audio).toBe(crossfadeAudio);
    expect((engine as unknown as { isCrossfading: boolean }).isCrossfading).toBe(false);
  });

  it("surfaces Web Audio hookup failures without pretending the source is connected", () => {
    const engine = new AudioEngine();
    const onError = vi.fn();

    engine.on("error", onError);

    const audioContext = new FakeAudioContext();
    audioContext.createMediaElementSource.mockImplementation(() => {
      throw new Error("mock connect failure");
    });

    const internals = engine as unknown as {
      audioContext: FakeAudioContext | null;
      gainNode: ReturnType<typeof createGainNode> | null;
      connected: boolean;
      connectSource: () => boolean;
    };

    internals.audioContext = audioContext;
    internals.gainNode = createGainNode();

    const connected = internals.connectSource();

    expect(connected).toBe(false);
    expect(internals.connected).toBe(false);
    expect(onError).toHaveBeenCalledWith("Web Audio effects unavailable: mock connect failure");
  });

  it("resumes a suspended audio context during playback warmup", async () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      audioContext: FakeAudioContext | null;
    };

    internals.audioContext = new FakeAudioContext();
    internals.audioContext.state = "suspended";
    const resumeSpy = internals.audioContext.resume;

    engine.preparePlayback();
    await Promise.resolve();

    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });

  it("honors a source-level fixed video quality override before applying player quality settings", () => {
    const engine = new AudioEngine();
    const dashPlayer = {
      getBitrateInfoListFor: vi.fn(() => [
        { bitrate: 800_000, height: 480, qualityIndex: 0 },
        { bitrate: 2_500_000, height: 720, qualityIndex: 1 },
        { bitrate: 5_000_000, height: 1080, qualityIndex: 2 },
      ]),
      setAutoSwitchQualityFor: vi.fn(),
      updateSettings: vi.fn(),
      setQualityFor: vi.fn(),
    };

    const internals = engine as unknown as {
      applyVideoQualityPreference: () => void;
      dashPlayer: typeof dashPlayer | null;
      sourceVideoQualityPreference: "1080p" | null;
    };

    internals.dashPlayer = dashPlayer;
    internals.sourceVideoQualityPreference = "1080p";
    internals.applyVideoQualityPreference();

    expect(dashPlayer.setAutoSwitchQualityFor).toHaveBeenCalledWith("video", false);
    expect(dashPlayer.updateSettings).toHaveBeenCalledWith({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: false,
          },
          initialBitrate: {
            video: 5000,
          },
          maxBitrate: {
            video: 5000,
          },
        },
      },
    });
    expect(dashPlayer.setQualityFor).toHaveBeenCalledWith("video", 2, true);
  });

  it("bypasses Web Audio hookup for direct googlevideo streams", async () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      audio: FakeAudio;
      connectSource: () => boolean;
      initAudioContext: () => void;
    };

    const connectSpy = vi.spyOn(internals, "connectSource").mockReturnValue(true);
    const initSpy = vi.spyOn(internals, "initAudioContext");

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    expect(initSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(internals.audio.crossOrigin).toBe("");
  });

  it("does not reconnect direct googlevideo streams during play()", async () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      connectSource: () => boolean;
      initAudioContext: () => void;
      audio: FakeAudio;
    };

    const connectSpy = vi.spyOn(internals, "connectSource").mockReturnValue(true);
    const initSpy = vi.spyOn(internals, "initAudioContext");

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    connectSpy.mockClear();
    initSpy.mockClear();

    await engine.play();

    expect(initSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(internals.audio.paused).toBe(false);
  });

  it("starts direct googlevideo playback muted before restoring audible output", async () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      audio: FakeAudio;
    };

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=18",
      type: "direct",
    });

    internals.audio.muted = false;
    internals.audio.volume = 0.8;

    const playSpy = vi.spyOn(internals.audio, "play").mockImplementation(async function (this: FakeAudio) {
      expect(this.muted).toBe(true);
      expect(this.volume).toBe(0);
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
    });

    await engine.play();

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(internals.audio.muted).toBe(false);
    expect(internals.audio.volume).toBe(0.8);
  });

  it("restores DASH playback position without attaching the source twice", async () => {
    const engine = new AudioEngine();
    const preloadSourceType = vi.spyOn(engine, "preloadSourceType").mockResolvedValue(undefined);
    const attachDashSource = vi.spyOn(engine as unknown as { attachDashSource: (url: string, startTime?: number) => Promise<void> }, "attachDashSource").mockResolvedValue(undefined);
    const seek = vi.spyOn(engine, "seek");

    await engine.restore({ url: "https://example.com/stream.mpd", type: "dash" }, 0, 1, 42);

    expect(preloadSourceType).toHaveBeenCalledWith("dash");
    expect(attachDashSource).toHaveBeenCalledTimes(1);
    expect(attachDashSource).toHaveBeenCalledWith("https://example.com/stream.mpd");
    expect(seek).toHaveBeenCalledWith(42);
  });

  it("seeks DASH playback back to the start when reloading the same stream URL", async () => {
    vi.useFakeTimers();

    const engine = new AudioEngine();
    const dashPlayer = {
      initialize: vi.fn(),
      attachSource: vi.fn(),
      reset: vi.fn(),
      seek: vi.fn(),
    };

    const internals = engine as unknown as {
      dashPlayer: typeof dashPlayer | null;
      dashSourceUrl: string | null;
      attachDashSource: (url: string, startTime?: number) => Promise<void>;
    };

    internals.dashPlayer = dashPlayer;
    internals.dashSourceUrl = "https://example.com/video.mpd";

    try {
      const attachPromise = internals.attachDashSource("https://example.com/video.mpd");
      await vi.runAllTimersAsync();
      await attachPromise;

      expect(dashPlayer.initialize).not.toHaveBeenCalled();
      expect(dashPlayer.attachSource).not.toHaveBeenCalled();
      expect(dashPlayer.seek).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when DASH readiness never reaches canplay", async () => {
    vi.useFakeTimers();

    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    primary.readyState = 0;

    const internals = engine as unknown as {
      waitForPrimaryMediaReadiness: (requireCanPlay?: boolean, timeoutMs?: number, label?: string) => Promise<void>;
    };

    try {
      const readinessPromise = internals.waitForPrimaryMediaReadiness(true, 1000, "DASH stream");
      const rejection = readinessPromise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(rejection).resolves.toMatchObject({
        message: "DASH stream did not become ready before playback timeout",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("avoids explicit pause while loading a replacement source", async () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const pauseSpy = vi.spyOn(primary, "pause");

    primary.paused = false;
    await engine.load({ url: "https://example.com/next-track.mp3", type: "direct" }, 0, 1);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(primary.src).toBe("https://example.com/next-track.mp3");
  });

  it("keeps the replacement video element attached to the current host when bypassing Web Audio", () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio & HTMLElement }).audio;
    const host = {
      firstChild: primary,
      replaceChild: vi.fn((nextChild: FakeAudio, currentChild: FakeAudio) => {
        host.firstChild = nextChild;
        nextChild.parentElement = host;
        currentChild.parentElement = null;
      }),
    };

    primary.className = "h-full w-full object-contain";
    primary.style.cssText = "position:absolute;inset:0;";
    (primary as unknown as HTMLVideoElement).poster = "https://example.com/poster.jpg";
    primary.parentElement = host;

    (
      engine as unknown as {
        replacePrimaryAudioElement: (source: { url: string; type: "direct" }) => void;
        audio: FakeAudio & HTMLElement;
      }
    ).replacePrimaryAudioElement({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=399",
      type: "direct",
    });

    const nextPrimary = (engine as unknown as { audio: FakeAudio & HTMLElement }).audio;

    expect(nextPrimary).not.toBe(primary);
    expect(host.firstChild).toBe(nextPrimary);
    expect(nextPrimary.parentElement).toBe(host);
    expect(host.replaceChild).toHaveBeenCalledTimes(1);
    expect(nextPrimary.className).toBe("h-full w-full object-contain");
    expect(nextPrimary.style.cssText).toBe("position:absolute;inset:0;");
    expect((nextPrimary as unknown as HTMLVideoElement).poster).toBe("https://example.com/poster.jpg");
  });

  it("restores playback after moving the active media element into a new host", () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      audio: FakeAudio;
      attachMediaElementToHost: (host: HTMLElement) => void;
      canAttachMediaElement: (mediaElement: HTMLMediaElement) => boolean;
    };
    const primary = internals.audio;
    const nextHost = {
      appendChild: vi.fn((mediaElement: FakeAudio) => {
        mediaElement.parentElement = nextHost;
        mediaElement.pause();
        return mediaElement;
      }),
    } as unknown as HTMLElement;
    const playSpy = vi.spyOn(engine, "play").mockImplementation(async () => {
      primary.paused = false;
    });

    primary.paused = false;
    vi.spyOn(internals, "canAttachMediaElement").mockReturnValue(true);

    internals.attachMediaElementToHost(nextHost);

    expect(nextHost.appendChild).toHaveBeenCalledWith(primary);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(primary.parentElement).toBe(nextHost);
    expect(primary.paused).toBe(false);
  });

  it("restores playback after returning the active media element to the global host", () => {
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      audio: FakeAudio;
      globalHost: HTMLElement | null;
      returnMediaElementToGlobalHost: () => void;
      canAttachMediaElement: (mediaElement: HTMLMediaElement) => boolean;
    };
    const primary = internals.audio;
    const currentHost = { appendChild: vi.fn() };
    const globalHost = {
      appendChild: vi.fn((mediaElement: FakeAudio) => {
        mediaElement.parentElement = globalHost;
        mediaElement.pause();
        return mediaElement;
      }),
    } as unknown as HTMLElement;
    const playSpy = vi.spyOn(engine, "play").mockImplementation(async () => {
      primary.paused = false;
    });

    primary.parentElement = currentHost;
    primary.paused = false;
    internals.globalHost = globalHost;
    vi.spyOn(internals, "canAttachMediaElement").mockReturnValue(true);

    internals.returnMediaElementToGlobalHost();

    expect(globalHost.appendChild).toHaveBeenCalledWith(primary);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(primary.parentElement).toBe(globalHost);
    expect(primary.paused).toBe(false);
  });

  it("restores playback when the browser pauses after the media element is returned to the global host", async () => {
    vi.useFakeTimers();

    try {
      const engine = new AudioEngine();
      const internals = engine as unknown as {
        audio: FakeAudio;
        globalHost: HTMLElement | null;
        returnMediaElementToGlobalHost: () => void;
        canAttachMediaElement: (mediaElement: HTMLMediaElement) => boolean;
      };
      const primary = internals.audio;
      const currentHost = { appendChild: vi.fn() };
      const globalHost = {
        appendChild: vi.fn((mediaElement: FakeAudio) => {
          mediaElement.parentElement = globalHost;
          window.setTimeout(() => {
            mediaElement.pause();
          }, 0);
          return mediaElement;
        }),
      } as unknown as HTMLElement;
      const playSpy = vi.spyOn(engine, "play").mockImplementation(async () => {
        primary.paused = false;
      });

      primary.parentElement = currentHost;
      primary.paused = false;
      internals.globalHost = globalHost;
      vi.spyOn(internals, "canAttachMediaElement").mockReturnValue(true);

      internals.returnMediaElementToGlobalHost();
      await vi.advanceTimersByTimeAsync(0);

      expect(globalHost.appendChild).toHaveBeenCalledWith(primary);
      expect(playSpy).toHaveBeenCalledTimes(1);
      expect(primary.parentElement).toBe(globalHost);
      expect(primary.paused).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts companion audio muted before unmuting split direct playback", async () => {
    const engine = new AudioEngine();

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=399",
      audioUrl: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    const internals = engine as unknown as {
      audio: FakeAudio;
      companionAudio: FakeAudio | null;
    };
    const primary = internals.audio;
    const companion = internals.companionAudio;

    expect(companion).not.toBeNull();

    const primaryPlaySpy = vi.spyOn(primary, "play");
    const companionPlaySpy = vi.spyOn(companion!, "play").mockImplementation(async function (this: FakeAudio) {
      expect(this.muted).toBe(true);
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
    });

    await engine.play();

    expect(primaryPlaySpy).toHaveBeenCalledTimes(1);
    expect(companionPlaySpy).toHaveBeenCalledTimes(1);
    expect(companion?.muted).toBe(false);
  });

  it("forwards companion audio errors with a readable reason", async () => {
    const engine = new AudioEngine();
    const onError = vi.fn();

    engine.on("error", onError);

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=137",
      audioUrl: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    const companion = (engine as unknown as { companionAudio: FakeAudio | null }).companionAudio;
    expect(companion).not.toBeNull();

    companion!.error = {
      code: 4,
      message: "Source not supported",
    };
    companion!.dispatchEvent(new Event("error"));

    expect(onError).toHaveBeenCalledWith("Companion audio stream failed: the media format is not supported. Source not supported (code 4)");
  });

  it("prefers the original split-playback failure over pause interruption noise", async () => {
    const engine = new AudioEngine();

    await engine.load({
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=137",
      audioUrl: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    const internals = engine as unknown as {
      audio: FakeAudio;
      companionAudio: FakeAudio | null;
    };

    vi.spyOn(internals.audio, "play").mockRejectedValue(
      new Error("The play() request was interrupted by a call to pause(). https://goo.gl/LdLk22"),
    );
    vi.spyOn(internals.companionAudio!, "play").mockRejectedValue(
      new Error("NotAllowedError: play() failed because the user didn't interact with the document first."),
    );

    await expect(engine.play()).rejects.toThrow(
      "NotAllowedError: play() failed because the user didn't interact with the document first.",
    );
  });

  it("aborts an active crossfade before loading a replacement source", async () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const crossfadeAudio = new FakeAudio();
    crossfadeAudio.paused = false;
    crossfadeAudio.src = "https://example.com/crossfade-track.mp3";
    const crossfadePauseSpy = vi.spyOn(crossfadeAudio, "pause");
    const crossfadeLoadSpy = vi.spyOn(crossfadeAudio, "load");

    const internals = engine as unknown as {
      audio: FakeAudio;
      crossfadeAudio: FakeAudio | null;
      crossfadeSource: { disconnect: ReturnType<typeof vi.fn> } | null;
      crossfadeGainNode: { disconnect: ReturnType<typeof vi.fn> } | null;
      gainNode: ReturnType<typeof createGainNode> | null;
      isCrossfading: boolean;
      crossfadeRequested: boolean;
    };

    internals.crossfadeAudio = crossfadeAudio;
    internals.crossfadeSource = { disconnect: vi.fn() };
    internals.crossfadeGainNode = { disconnect: vi.fn() };
    internals.gainNode = createGainNode();
    internals.gainNode.gain.value = 0;
    internals.isCrossfading = true;
    internals.crossfadeRequested = true;
    primary.paused = false;

    await engine.load({ url: "https://example.com/next-track.mp3", type: "direct" }, 0, 1);

    expect(crossfadePauseSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeLoadSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeAudio.src).toBe("");
    expect(internals.crossfadeSource).toBeNull();
    expect(internals.crossfadeGainNode).toBeNull();
    expect(internals.crossfadeAudio).toBeNull();
    expect(internals.isCrossfading).toBe(false);
    expect(internals.crossfadeRequested).toBe(false);
    expect(internals.gainNode?.gain.value).toBe(1);
  });

  it("pauses crossfade audio when playback is paused mid-handoff", () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const primaryPauseSpy = vi.spyOn(primary, "pause");
    const crossfadeAudio = new FakeAudio();
    crossfadeAudio.paused = false;
    crossfadeAudio.src = "https://example.com/crossfade-track.mp3";
    const crossfadePauseSpy = vi.spyOn(crossfadeAudio, "pause");
    const crossfadeLoadSpy = vi.spyOn(crossfadeAudio, "load");

    const internals = engine as unknown as {
      crossfadeAudio: FakeAudio | null;
      crossfadeSource: { disconnect: ReturnType<typeof vi.fn> } | null;
      crossfadeGainNode: { disconnect: ReturnType<typeof vi.fn> } | null;
      gainNode: ReturnType<typeof createGainNode> | null;
      isCrossfading: boolean;
      crossfadeRequested: boolean;
    };

    internals.crossfadeAudio = crossfadeAudio;
    internals.crossfadeSource = { disconnect: vi.fn() };
    internals.crossfadeGainNode = { disconnect: vi.fn() };
    internals.gainNode = createGainNode();
    internals.gainNode.gain.value = 0;
    internals.isCrossfading = true;
    internals.crossfadeRequested = true;
    primary.paused = false;

    engine.pause();

    expect(primaryPauseSpy).toHaveBeenCalledTimes(1);
    expect(crossfadePauseSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeLoadSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeAudio.src).toBe("");
    expect(internals.crossfadeAudio).toBeNull();
    expect(internals.crossfadeSource).toBeNull();
    expect(internals.crossfadeGainNode).toBeNull();
    expect(internals.isCrossfading).toBe(false);
    expect(internals.crossfadeRequested).toBe(false);
    expect(internals.gainNode?.gain.value).toBe(1);
  });

  it("avoids explicit pause calls when internally swapping YouTube video sources", async () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;

    await engine.load({
      url: "https://rr1---sn-example.googlevideo.com/videoplayback?id=test&itag=137",
      audioUrl: "https://rr1---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      type: "direct",
    });

    const companion = (engine as unknown as { companionAudio: FakeAudio | null }).companionAudio;
    expect(companion).not.toBeNull();

    const primaryPauseSpy = vi.spyOn(primary, "pause");
    const companionPauseSpy = vi.spyOn(companion!, "pause");

    await engine.load({
      url: "https://rr1---sn-example.googlevideo.com/videoplayback?id=test&itag=18",
      type: "direct",
    });

    expect(primaryPauseSpy).not.toHaveBeenCalled();
    expect(companionPauseSpy).not.toHaveBeenCalled();
  });

  it("re-emits loadstart when playback falls back into buffering", () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const onLoadStart = vi.fn();

    engine.on("loadstart", onLoadStart);

    primary.dispatchEvent(new Event("waiting"));
    primary.dispatchEvent(new Event("stalled"));

    expect(onLoadStart).toHaveBeenCalledTimes(2);
  });

  it("emits interruption reasons for waiting and stalled playback", () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;
    const onInterrupted = vi.fn();

    engine.on("interrupted", onInterrupted);

    primary.dispatchEvent(new Event("waiting"));
    primary.dispatchEvent(new Event("stalled"));

    expect(onInterrupted).toHaveBeenNthCalledWith(1, "waiting");
    expect(onInterrupted).toHaveBeenNthCalledWith(2, "stalled");
  });

  it("rethrows play failures so callers can recover", async () => {
    const engine = new AudioEngine();
    const primary = (engine as unknown as { audio: FakeAudio }).audio;

    vi.spyOn(primary, "play").mockRejectedValue(new Error("Playback blocked"));

    await expect(engine.play()).rejects.toThrow("Playback blocked");
  });
});
