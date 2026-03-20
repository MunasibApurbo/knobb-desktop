import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import type { Track } from "@/types/music";

const authMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
}));

const settingsMocks = vi.hoisted(() => ({
  values: {
    discordPresenceEnabled: false,
    librarySource: "all",
    rightPanelAutoOpen: "never" as const,
    rightPanelDefaultTab: "queue" as const,
  },
}));

const toastMocks = vi.hoisted(() => ({
  showErrorToast: vi.fn(),
  showInfoToast: vi.fn(),
}));

const runtimeModuleMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      upsert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(async () => ({ error: null })),
      eq: vi.fn().mockReturnThis(),
    })),
  })),
  loadAudioEngineModule: vi.fn(),
  loadMusicApiModule: vi.fn(),
  loadYoutubeMusicApiModule: vi.fn(async () => ({
    clearYoutubeMusicCache: youtubeMusicMocks.clearYoutubeMusicCache,
    getYoutubeMusicPlaybackSource: youtubeMusicMocks.getYoutubeMusicPlaybackSource,
    getYoutubeMusicVideoPlaybackSource: youtubeMusicMocks.getYoutubeMusicVideoPlaybackSource,
    searchYoutubeMusicReference: youtubeMusicMocks.searchYoutubeMusicReference,
  })),
  reportClientErrorLazy: vi.fn(async () => {}),
  reportClientEventLazy: vi.fn(async () => {}),
}));

const playbackSessionMocks = vi.hoisted(() => ({
  getPlaybackDeviceId: vi.fn(() => "device-1"),
  getPlaybackDeviceName: vi.fn(() => "Test Browser"),
  removePlaybackSession: vi.fn(async () => {}),
  upsertPlaybackSession: vi.fn(async () => {}),
}));

const youtubeMusicMocks = vi.hoisted(() => ({
  clearYoutubeMusicCache: vi.fn(),
  getYoutubeMusicPlaybackSource: vi.fn(),
  getYoutubeMusicVideoPlaybackSource: vi.fn(),
  searchYoutubeMusicReference: vi.fn(),
}));

const youtubeEmbedManagerMocks = vi.hoisted(() => ({
  attachHost: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 245),
  isPaused: vi.fn(() => false),
  load: vi.fn(async () => {}),
  on: vi.fn(() => () => {}),
  pause: vi.fn(),
  play: vi.fn(async () => {}),
  reset: vi.fn(),
  returnToGlobalHost: vi.fn(),
  seek: vi.fn(),
  warmup: vi.fn(async () => {}),
}));

const playbackEnvironmentMocks = vi.hoisted(() => ({
  isPublishedRuntimeHost: vi.fn(() => false),
}));

const discordPresenceMocks = vi.hoisted(() => {
  const state = {
    listener: null as (() => void) | null,
    syncDiscordPresence: vi.fn(async () => {}),
    subscribeToDiscordPresenceBridge: vi.fn((listener: () => void) => {
      state.listener = listener;
      return () => {
        if (state.listener === listener) {
          state.listener = null;
        }
      };
    }),
  };

  return state;
});

const discordWebhookMocks = vi.hoisted(() => {
  const state = {
    listener: null as (() => void) | null,
    syncDiscordWebhookPresence: vi.fn(async () => {}),
    subscribeToDiscordWebhookSettings: vi.fn((listener: () => void) => {
      state.listener = listener;
      return () => {
        if (state.listener === listener) {
          state.listener = null;
        }
      };
    }),
  };

  return state;
});

vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => ({
    user: authMocks.user,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => settingsMocks.values,
}));

vi.mock("@/lib/toast", () => ({
  showErrorToast: toastMocks.showErrorToast,
  showInfoToast: toastMocks.showInfoToast,
}));

vi.mock("@/lib/runtimeModules", () => ({
  getSupabaseClient: runtimeModuleMocks.getSupabaseClient,
  loadAudioEngineModule: runtimeModuleMocks.loadAudioEngineModule,
  loadMusicApiModule: runtimeModuleMocks.loadMusicApiModule,
  loadYoutubeMusicApiModule: runtimeModuleMocks.loadYoutubeMusicApiModule,
  reportClientErrorLazy: runtimeModuleMocks.reportClientErrorLazy,
  reportClientEventLazy: runtimeModuleMocks.reportClientEventLazy,
}));

vi.mock("@/lib/playbackSessions", () => ({
  getPlaybackDeviceId: playbackSessionMocks.getPlaybackDeviceId,
  getPlaybackDeviceName: playbackSessionMocks.getPlaybackDeviceName,
  removePlaybackSession: playbackSessionMocks.removePlaybackSession,
  upsertPlaybackSession: playbackSessionMocks.upsertPlaybackSession,
}));

vi.mock("@/lib/profilePreferences", () => ({
  loadProfilePreferences: vi.fn(async () => ({ data: null, error: null })),
  persistProfilePreferences: vi.fn(async () => {}),
}));

vi.mock("@/lib/appDiagnostics", () => ({
  pushAppDiagnostic: vi.fn(),
}));

vi.mock("@/lib/discordPresence", () => ({
  subscribeToDiscordPresenceBridge: discordPresenceMocks.subscribeToDiscordPresenceBridge,
  syncDiscordPresence: discordPresenceMocks.syncDiscordPresence,
}));

vi.mock("@/lib/discordWebhookPresence", () => ({
  subscribeToDiscordWebhookSettings: discordWebhookMocks.subscribeToDiscordWebhookSettings,
  syncDiscordWebhookPresence: discordWebhookMocks.syncDiscordWebhookPresence,
}));

vi.mock("@/lib/mediaPlaybackPrimer", () => ({
  primeMediaPlayback: vi.fn(async () => {}),
}));

vi.mock("@/lib/playbackWarmup", () => ({
  warmPlaybackOrigin: vi.fn(),
}));

vi.mock("@/lib/performanceProfile", () => ({
  readStartupPerformanceBudget: vi.fn(() => ({
    canWarmPlaybackStackEagerly: false,
  })),
  scheduleBackgroundTask: (task: () => void) => {
    task();
    return () => {};
  },
}));

vi.mock("@/lib/videoPlaybackPreferences", () => ({
  formatResolvedVideoQuality: vi.fn((height?: number | null) => (
    typeof height === "number" && Number.isFinite(height) && height > 0 ? `${Math.round(height)}p` : null
  )),
  getVideoQualityPreference: vi.fn(() => "1080p"),
}));

vi.mock("@/lib/youtubeMusicApi", () => ({
  clearYoutubeMusicCache: youtubeMusicMocks.clearYoutubeMusicCache,
  getYoutubeMusicPlaybackSource: youtubeMusicMocks.getYoutubeMusicPlaybackSource,
  getYoutubeMusicVideoPlaybackSource: youtubeMusicMocks.getYoutubeMusicVideoPlaybackSource,
  searchYoutubeMusicReference: youtubeMusicMocks.searchYoutubeMusicReference,
}));

vi.mock("@/lib/youtubeEmbedManager", () => ({
  getYoutubeEmbedManager: () => youtubeEmbedManagerMocks,
}));

vi.mock("@/lib/playbackEnvironment", () => ({
  isPublishedRuntimeHost: playbackEnvironmentMocks.isPublishedRuntimeHost,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createEngineMock() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of listeners.get(event) || []) {
      handler(...args);
    }
  };

  return {
    emit,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    paused: true,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    }),
    preparePlayback: vi.fn(),
    preloadSourceType: vi.fn(async () => {}),
    load: vi.fn(async function load() {
      await Promise.resolve();
      this.isLoading = true;
      emit("loadstart");
      this.duration = 180;
      this.isLoading = false;
      emit("canplay");
    }),
    play: vi.fn(async function play() {
      await Promise.resolve();
      this.paused = false;
      emit("play");
    }),
    pause: vi.fn(function pause() {
      this.paused = true;
      emit("pause");
    }),
    restore: vi.fn(async function restore() {
      await Promise.resolve();
      this.paused = false;
      emit("play");
    }),
    seek: vi.fn(),
    cancelPendingCrossfade: vi.fn(),
    crossfadeInto: vi.fn(async () => {}),
    setNormalization: vi.fn(),
    setEqualizerEnabled: vi.fn(),
    setEqBandGain: vi.fn(),
    setPreampDb: vi.fn(),
    setMonoAudioEnabled: vi.fn(),
    setCrossfadeDuration: vi.fn(),
    setLoop: vi.fn(),
    setPlaybackRate: vi.fn(),
    setPreservePitch: vi.fn(),
    setVolume: vi.fn(),
  };
}

function buildTrack(id: string, title: string, tidalId: number): Track {
  return {
    id,
    tidalId,
    title,
    artist: "Artist",
    album: "Album",
    duration: 180,
    year: 2024,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 0%",
    source: "tidal",
  };
}

function buildYoutubeVideoTrack(id: string, title: string, sourceId: string): Track {
  return {
    id,
    title,
    artist: "Artist",
    album: "Album",
    duration: 297,
    year: 2025,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 0%",
    source: "youtube-music",
    sourceId,
    isVideo: true,
  };
}

function buildYoutubeTrack(id: string, title: string, sourceId: string): Track {
  return {
    id,
    title,
    artist: "Artist",
    album: "Album",
    duration: 245,
    year: 2025,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 0%",
    source: "youtube-music",
    sourceId,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <PlayerProvider>{children}</PlayerProvider>;
}

const PLAYER_STORAGE_KEYS = [
  "audio-quality",
  "settings-auto-quality",
  "audio-normalization",
  "equalizer-enabled",
  "equalizer-gains",
  "equalizer-preset",
  "audio-preamp-db",
  "mono-audio-enabled",
  "crossfade-duration",
  "playback-speed",
  "preserve-pitch",
  "player-state-v1",
] as const;

describe("PlayerProvider playback concurrency", () => {
  beforeEach(() => {
    for (const key of PLAYER_STORAGE_KEYS) {
      window.localStorage?.removeItem?.(key);
      window.sessionStorage?.removeItem?.(key);
    }
    settingsMocks.values.discordPresenceEnabled = false;
    settingsMocks.values.librarySource = "all";
    settingsMocks.values.rightPanelAutoOpen = "never";
    settingsMocks.values.rightPanelDefaultTab = "queue";
    authMocks.user = null;
    toastMocks.showErrorToast.mockReset();
    toastMocks.showInfoToast.mockReset();
    runtimeModuleMocks.getSupabaseClient.mockClear();
    runtimeModuleMocks.loadAudioEngineModule.mockReset();
    runtimeModuleMocks.loadMusicApiModule.mockReset();
    runtimeModuleMocks.loadYoutubeMusicApiModule.mockClear();
    runtimeModuleMocks.reportClientErrorLazy.mockClear();
    runtimeModuleMocks.reportClientEventLazy.mockClear();
    youtubeMusicMocks.clearYoutubeMusicCache.mockReset();
    youtubeMusicMocks.getYoutubeMusicPlaybackSource.mockReset();
    youtubeMusicMocks.getYoutubeMusicVideoPlaybackSource.mockReset();
    youtubeMusicMocks.searchYoutubeMusicReference.mockReset();
    youtubeEmbedManagerMocks.attachHost.mockReset();
    youtubeEmbedManagerMocks.getCurrentTime.mockReset();
    youtubeEmbedManagerMocks.getCurrentTime.mockReturnValue(0);
    youtubeEmbedManagerMocks.getDuration.mockReset();
    youtubeEmbedManagerMocks.getDuration.mockReturnValue(245);
    youtubeEmbedManagerMocks.isPaused.mockReset();
    youtubeEmbedManagerMocks.isPaused.mockReturnValue(false);
    youtubeEmbedManagerMocks.load.mockReset();
    youtubeEmbedManagerMocks.on.mockReset();
    youtubeEmbedManagerMocks.on.mockImplementation(() => () => {});
    youtubeEmbedManagerMocks.pause.mockReset();
    youtubeEmbedManagerMocks.play.mockReset();
    youtubeEmbedManagerMocks.reset.mockReset();
    youtubeEmbedManagerMocks.returnToGlobalHost.mockReset();
    youtubeEmbedManagerMocks.seek.mockReset();
    youtubeEmbedManagerMocks.warmup.mockReset();
    youtubeEmbedManagerMocks.warmup.mockImplementation(async () => {});
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReset();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(false);
    discordPresenceMocks.listener = null;
    discordPresenceMocks.syncDiscordPresence.mockReset();
    discordPresenceMocks.syncDiscordPresence.mockImplementation(async () => {});
    discordPresenceMocks.subscribeToDiscordPresenceBridge.mockClear();
    discordWebhookMocks.listener = null;
    discordWebhookMocks.syncDiscordWebhookPresence.mockReset();
    discordWebhookMocks.syncDiscordWebhookPresence.mockImplementation(async () => {});
    discordWebhookMocks.subscribeToDiscordWebhookSettings.mockClear();
  });

  it("re-syncs Discord presence when the bridge becomes available after playback has already started", async () => {
    const engine = createEngineMock();

    settingsMocks.values.discordPresenceEnabled = true;
    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: "https://example.com/presence-track.m4a",
        },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("discord-presence-track", "Presence Track", 909);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    await waitFor(() => {
      expect(discordPresenceMocks.syncDiscordPresence).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true,
        track: expect.objectContaining({ id: "discord-presence-track" }),
      }));
    });

    const syncCallsBeforeBridgeReady = discordPresenceMocks.syncDiscordPresence.mock.calls.length;

    act(() => {
      discordPresenceMocks.listener?.();
    });

    await waitFor(() => {
      expect(discordPresenceMocks.syncDiscordPresence.mock.calls.length).toBeGreaterThan(syncCallsBeforeBridgeReady);
    });

    expect(discordPresenceMocks.syncDiscordPresence.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: true,
      track: expect.objectContaining({ id: "discord-presence-track" }),
      isPlaying: true,
    });
  });

  it("re-syncs Discord web sharing when the webhook settings change after playback has already started", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: "https://example.com/webhook-track.m4a",
        },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("discord-webhook-track", "Webhook Track", 910);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    await waitFor(() => {
      expect(discordWebhookMocks.syncDiscordWebhookPresence).toHaveBeenCalledWith(expect.objectContaining({
        track: expect.objectContaining({ id: "discord-webhook-track" }),
      }));
    });

    const syncCallsBeforeSettingsChange = discordWebhookMocks.syncDiscordWebhookPresence.mock.calls.length;

    act(() => {
      discordWebhookMocks.listener?.();
    });

    await waitFor(() => {
      expect(discordWebhookMocks.syncDiscordWebhookPresence.mock.calls.length).toBeGreaterThan(syncCallsBeforeSettingsChange);
    });

    expect(discordWebhookMocks.syncDiscordWebhookPresence.mock.calls.at(-1)?.[0]).toMatchObject({
      track: expect.objectContaining({ id: "discord-webhook-track" }),
      isPlaying: true,
    });
  });

  it("ignores stale playback failures after a newer track starts successfully", async () => {
    const engine = createEngineMock();
    const firstSourceRequest = deferred<never>();
    const secondSourceRequest = deferred<{
      capability: "HIGH";
      quality: "HIGH";
      source: { type: "direct"; url: string };
    }>();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn((tidalId: number) => {
        if (tidalId === 101) {
          return firstSourceRequest.promise;
        }

        return secondSourceRequest.promise;
      }),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const firstTrack = buildTrack("track-a", "First Track", 101);
    const secondTrack = buildTrack("track-b", "Second Track", 202);

    act(() => {
      result.current.play(firstTrack, [firstTrack, secondTrack]);
      result.current.play(secondTrack, [firstTrack, secondTrack]);
    });

    await act(async () => {
      secondSourceRequest.resolve({
        capability: "HIGH",
        quality: "HIGH",
        source: {
          type: "direct",
          url: "https://example.com/second-track.mp3",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-b");
      expect(result.current.isPlaying).toBe(true);
    });

    await act(async () => {
      firstSourceRequest.reject(new Error("source temporarily unavailable"));
      try {
        await firstSourceRequest.promise;
      } catch {
        // The provider handles the rejection internally.
      }
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-b");
      expect(result.current.isPlaying).toBe(true);
    });

    expect(toastMocks.showErrorToast).not.toHaveBeenCalledWith("\"First Track\" is unavailable to play right now.");
  });

  it("keeps playback running when a new preference resolves to the same track quality", async () => {
    const engine = createEngineMock();
    const getPlaybackSourceWithQuality = vi.fn(async () => ({
      capability: "HIGH" as const,
      quality: "HIGH" as const,
      source: {
        type: "direct" as const,
        url: "https://example.com/current-track.mp3",
      },
    }));

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality,
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("track-high-only", "Current Track", 303);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-high-only");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.resolvedAudioQuality).toBe("HIGH");
    });

    act(() => {
      result.current.setQuality("LOSSLESS");
    });

    await waitFor(() => {
      expect(result.current.quality).toBe("LOSSLESS");
      expect(result.current.resolvedAudioQuality).toBe("HIGH");
      expect(result.current.isPlaying).toBe(true);
    });

    expect(engine.restore).not.toHaveBeenCalled();
    expect(getPlaybackSourceWithQuality).toHaveBeenCalledTimes(1);
  });

  it("caps fixed TIDAL requests to the track capability before resolving playback", async () => {
    const engine = createEngineMock();
    const getPlaybackSourceWithQuality = vi.fn(async (_tidalId: number, quality: string) => ({
      capability: "HIGH" as const,
      quality: "HIGH" as const,
      source: {
        type: "direct" as const,
        url: `https://example.com/${quality.toLowerCase()}.mp3`,
      },
    }));

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality,
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track: Track = {
      ...buildTrack("track-capped", "Capability Capped Track", 909),
      audioQuality: "HIGH",
    };

    act(() => {
      result.current.setQuality("MAX");
    });

    await waitFor(() => {
      expect(result.current.quality).toBe("MAX");
    });

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-capped");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.resolvedAudioQuality).toBe("HIGH");
    });

    expect(getPlaybackSourceWithQuality).toHaveBeenCalledWith(909, "HIGH");
    expect(engine.load).toHaveBeenCalledWith(
      {
        type: "direct",
        url: "https://example.com/high.mp3",
      },
      0,
      1,
    );
  });

  it("ignores a stale quality refresh after the user starts a different track", async () => {
    const engine = createEngineMock();
    const staleQualityRefresh = deferred<{
      capability: "LOSSLESS";
      quality: "LOSSLESS";
      source: { type: "direct"; url: string };
    }>();

    const getPlaybackSourceWithQuality = vi.fn((tidalId: number, quality: string) => {
      if (tidalId === 101 && quality === "LOSSLESS") {
        return staleQualityRefresh.promise;
      }

      return Promise.resolve({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: `https://example.com/${tidalId}-${quality.toLowerCase()}.mp3`,
        },
      });
    });

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality,
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const firstTrack = buildTrack("track-a", "First Track", 101);
    const secondTrack = buildTrack("track-b", "Second Track", 202);

    act(() => {
      result.current.play(firstTrack, [firstTrack, secondTrack]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-a");
      expect(result.current.isPlaying).toBe(true);
    });

    act(() => {
      result.current.setQuality("LOSSLESS");
      result.current.play(secondTrack, [firstTrack, secondTrack]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-b");
      expect(result.current.isPlaying).toBe(true);
    });

    await act(async () => {
      staleQualityRefresh.resolve({
        capability: "LOSSLESS",
        quality: "LOSSLESS",
        source: {
          type: "direct",
          url: "https://example.com/track-a-lossless.mp3",
        },
      });
      await staleQualityRefresh.promise;
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-b");
      expect(result.current.isPlaying).toBe(true);
    });
  });

  it("seeds the active queue when playback starts without an explicit queue", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: "https://example.com/solo-track.mp3",
        },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("solo-track", "Solo Track", 515);

    act(() => {
      result.current.play(track);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("solo-track");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.queue.map((queuedTrack) => queuedTrack.id)).toEqual(["solo-track"]);
    });
  });

  it("applies repeat-one immediately when a track ends right after the user toggles it", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: "https://example.com/repeat-track.mp3",
        },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("repeat-track", "Repeat Track", 616);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("repeat-track");
      expect(result.current.isPlaying).toBe(true);
    });

    const playCallCountBeforeRepeat = engine.play.mock.calls.length;

    act(() => {
      result.current.toggleRepeat();
      result.current.toggleRepeat();
      engine.emit("ended");
    });

    await waitFor(() => {
      expect(result.current.repeat).toBe("one");
      expect(engine.seek).toHaveBeenCalledWith(0);
      expect(engine.play.mock.calls.length).toBeGreaterThan(playCallCountBeforeRepeat);
      expect(result.current.currentTrack?.id).toBe("repeat-track");
    });
  });

  it("uses native engine looping for repeat-one so playback can roll over seamlessly", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH" as const,
        quality: "HIGH" as const,
        source: {
          type: "direct" as const,
          url: "https://example.com/loop-track.mp3",
        },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("loop-track", "Loop Track", 717);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("loop-track");
      expect(result.current.isPlaying).toBe(true);
    });

    expect(engine.setLoop).toHaveBeenCalledWith(false);

    act(() => {
      result.current.toggleRepeat();
      result.current.toggleRepeat();
    });

    await waitFor(() => {
      expect(result.current.repeat).toBe("one");
      expect(engine.setLoop).toHaveBeenLastCalledWith(true);
    });

    act(() => {
      result.current.toggleRepeat();
    });

    await waitFor(() => {
      expect(result.current.repeat).toBe("off");
      expect(engine.setLoop).toHaveBeenLastCalledWith(false);
    });
  });

  it("restarts a queue-less track when repeat-all is enabled", async () => {
    const engine = createEngineMock();
    const track = buildTrack("single-repeat-track", "Single Repeat Track", 818);
    const storage = new Map<string, string>();
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        get length() {
          return storage.size;
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    try {
      window.localStorage.setItem("player-state-v1", JSON.stringify({
        currentTime: 0,
        currentTrack: track,
        duration: track.duration,
        queue: [],
        repeat: "off",
        rightPanelTab: "queue",
        showRightPanel: false,
        shuffle: false,
        volume: 1,
      }));

      runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
        getAudioEngine: () => engine,
      });
      runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
        getPlaybackSourceWithQuality: vi.fn(async () => ({
          capability: "HIGH" as const,
          quality: "HIGH" as const,
          source: {
            type: "direct" as const,
            url: "https://example.com/single-repeat-track.mp3",
          },
        })),
        getVideoPlaybackSource: vi.fn(),
        invalidateTrackStreamCache: vi.fn(),
      });

      const { result } = renderHook(() => usePlayer(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentTrack?.title).toBe("Single Repeat Track");
        expect(result.current.currentTrack?.tidalId).toBe(818);
        expect(result.current.queue).toHaveLength(0);
      });

      const loadCallCountBeforeRepeat = engine.load.mock.calls.length;

      act(() => {
        result.current.toggleRepeat();
        engine.emit("ended");
      });

      await waitFor(() => {
        expect(result.current.repeat).toBe("all");
        expect(engine.load.mock.calls.length).toBeGreaterThan(loadCallCountBeforeRepeat);
        expect(result.current.currentTrack?.title).toBe("Single Repeat Track");
        expect(result.current.currentTrack?.tidalId).toBe(818);
      });
    } finally {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it("reloads custom direct tracks with a cache-busted playback url", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track: Track = {
      id: "custom-direct-track",
      title: "Custom Song",
      artist: "Demo Artist",
      album: "Demo Album",
      duration: 180,
      year: 2024,
      coverUrl: "https://example.com/cover.jpg",
      canvasColor: "0 0% 0%",
      streamUrl: "https://example.com/audio/custom-song.mp3",
    };

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(engine.load).toHaveBeenCalledTimes(1);
    });

    expect(engine.load).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "direct",
        url: expect.stringContaining("https://example.com/audio/custom-song.mp3"),
      }),
      0,
      1,
    );

    const [loadedSource] = engine.load.mock.calls[0] as [{ url: string; type: string }, number, number];
    expect(loadedSource.url).toContain("knobbPlayback=");
  });

  it("reuses cached direct stream variants even when the active quality key is missing", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track: Track = {
      id: "tidal-sheet-id:https://pillows.su/f/abc123",
      title: "Saved Leak",
      artist: "Artist",
      album: "Era",
      duration: 180,
      year: 2024,
      coverUrl: "https://example.com/cover.jpg",
      canvasColor: "0 0% 0%",
      sourceId: "sheet-id:https://pillows.su/f/abc123",
      streamUrls: {
        HIGH: "https://example.com/audio/saved-leak.m4a",
      },
      streamTypes: {
        HIGH: "direct",
      },
    };

    act(() => {
      result.current.setQuality("LOSSLESS");
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("tidal-sheet-id:https://pillows.su/f/abc123");
      expect(result.current.isPlaying).toBe(true);
      expect(engine.load).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "direct",
          url: expect.stringContaining("https://example.com/audio/saved-leak.m4a"),
        }),
        0,
        1,
      );
    });
  });

  it("falls back to a matched YouTube Music audio source when TIDAL streaming resolution fails", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => {
        throw new Error("All available TIDAL streaming instances failed");
      }),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });
    youtubeMusicMocks.searchYoutubeMusicReference.mockResolvedValue({
      topResult: null,
      rankedResults: [],
      tracks: [{
        id: "ytm-home-1",
        title: "Home",
        artist: "Hikaru Utada",
        album: "Exodus",
        duration: 224,
        year: 2004,
        coverUrl: "https://example.com/home.jpg",
        canvasColor: "0 0% 0%",
        source: "youtube-music",
        sourceId: "ytm-home-1",
      }],
      videos: [],
      artists: [],
      albums: [],
      playlists: [],
    });
    youtubeMusicMocks.getYoutubeMusicPlaybackSource.mockResolvedValue({
      type: "direct",
      url: "https://example.com/home-fallback.m4a",
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("tidal-home", "Home (feat. Hikaru Utada)", 404);
    track.artist = "Utada";
    track.album = "Exodus";
    track.duration = 224;

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("tidal-home");
      expect(result.current.isPlaying).toBe(true);
    });

    expect(youtubeMusicMocks.searchYoutubeMusicReference).toHaveBeenCalled();
    expect(youtubeMusicMocks.getYoutubeMusicPlaybackSource).toHaveBeenCalledWith("ytm-home-1", "HIGH");
    expect(engine.load).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "direct",
        url: "https://example.com/home-fallback.m4a",
      }),
      0,
      1,
    );
  });

  it("keeps automatic recovery locked to the active playback quality", async () => {
    const engine = createEngineMock();
    const getPlaybackSourceWithQuality = vi.fn(async (_tidalId: number, quality: string) => {
      if (quality === "AUTO") {
        return {
          capability: "LOSSLESS" as const,
          quality: "LOSSLESS" as const,
          source: {
            type: "direct" as const,
            url: "https://example.com/adaptive-track.flac",
          },
        };
      }

      if (quality === "LOSSLESS") {
        throw new Error("lossless refresh failed");
      }

      if (quality === "HIGH") {
        return {
          capability: "LOSSLESS" as const,
          quality: "HIGH" as const,
          source: {
            type: "direct" as const,
            url: "https://example.com/adaptive-track.mp3",
          },
        };
      }

      throw new Error(`Unexpected quality request: ${quality}`);
    });

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality,
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("adaptive-track", "Adaptive Track", 404);

    act(() => {
      result.current.setQuality("AUTO");
    });

    await waitFor(() => {
      expect(result.current.quality).toBe("AUTO");
    });

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("adaptive-track");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.resolvedAudioQuality).toBe("LOSSLESS");
    });

    await act(async () => {
      engine.emit("error", "Playback stalled after waiting");
    });

    await waitFor(() => {
      expect(engine.restore).toHaveBeenCalledWith(
        {
          type: "direct",
          url: "https://example.com/adaptive-track.mp3",
        },
        0,
        1,
        0,
      );
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.resolvedAudioQuality).toBe("HIGH");
    });

    expect(getPlaybackSourceWithQuality.mock.calls.map(([, quality]) => quality)).toEqual(["AUTO", "LOSSLESS", "HIGH"]);
    expect(toastMocks.showErrorToast).not.toHaveBeenCalledWith("\"Adaptive Track\" is unavailable to play right now.");
  });

  it("starts YouTube videos in native playback mode instead of the embed path", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });
    youtubeMusicMocks.getYoutubeMusicVideoPlaybackSource.mockResolvedValue({
      type: "direct",
      url: "/api/youtube-music?action=video-stream&id=video-123&quality=1080P",
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeVideoTrack("yt-native", "Native YouTube Video", "video-123");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(engine.load).toHaveBeenCalledWith(
        {
          type: "direct",
          url: "/api/youtube-music?action=video-stream&id=video-123&quality=1080P",
        },
        0,
        1,
      );
      expect(result.current.playbackMode).toBe("native");
      expect(result.current.currentTrack?.id).toBe("yt-native");
      expect(result.current.isPlaying).toBe(true);
    });
  });

  it("starts YouTube videos in embed playback mode on published hosts", async () => {
    const engine = createEngineMock();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeVideoTrack("yt-native-published", "Published Host YouTube Video", "video-999");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-999", { autoplay: true });
      expect(result.current.playbackMode).toBe("youtube-embed");
      expect(result.current.currentTrack?.id).toBe("yt-native-published");
      expect(result.current.isPlaying).toBe(true);
    });

    expect(engine.load).not.toHaveBeenCalled();
  });

  it("starts YouTube Music tracks in embed playback mode on published hosts", async () => {
    const engine = createEngineMock();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeTrack("yt-embed", "Embedded YouTube Track", "video-456");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-456", { autoplay: true });
      expect(result.current.playbackMode).toBe("youtube-embed");
      expect(result.current.currentTrack?.id).toBe("yt-embed");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.showRightPanel).toBe(false);
    });

    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.pause).toHaveBeenCalled();
  });

  it("does not fall back to native playback when published-host YouTube embed playback errors", async () => {
    const engine = createEngineMock();
    const embedListeners = new Map<string, (...args: unknown[]) => void>();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    youtubeEmbedManagerMocks.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      embedListeners.set(event, handler);
      return () => {
        embedListeners.delete(event);
      };
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeTrack("yt-embed-fallback", "Embed Fallback Track", "video-embed-fallback");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-embed-fallback", { autoplay: true });
      expect(result.current.playbackMode).toBe("youtube-embed");
    });

    act(() => {
      embedListeners.get("error")?.("YouTube embed error (101)");
    });

    await waitFor(() => {
      expect(youtubeMusicMocks.getYoutubeMusicPlaybackSource).not.toHaveBeenCalled();
      expect(engine.load).not.toHaveBeenCalled();
      expect(result.current.playbackMode).toBe("youtube-embed");
      expect(result.current.currentTrack?.id).toBe("yt-embed-fallback");
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    expect(toastMocks.showErrorToast).toHaveBeenCalledWith("YouTube playback is unavailable right now.");
  });

  it("warms the YouTube embed stack for published YouTube tracks before playback", async () => {
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeTrack("yt-warm", "Warm YouTube Track", "video-warm");

    act(() => {
      result.current.warmTrackPlayback(track);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.warmup).toHaveBeenCalledTimes(1);
    });
    expect(youtubeMusicMocks.getYoutubeMusicPlaybackSource).not.toHaveBeenCalled();
  });

  it("opens the visible panel when published YouTube video tracks use embed playback", async () => {
    const engine = createEngineMock();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeVideoTrack("yt-embed-video", "Embedded YouTube Video", "video-789");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-789", { autoplay: true });
      expect(result.current.playbackMode).toBe("youtube-embed");
      expect(result.current.currentTrack?.id).toBe("yt-embed-video");
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.showRightPanel).toBe(true);
    });

    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.pause).toHaveBeenCalled();
  });

  it("restores persisted YouTube tracks through embed playback on published hosts", async () => {
    const engine = createEngineMock();
    const track = buildYoutubeTrack("yt-restore", "Restored YouTube Track", "video-restore");
    const storage = new Map<string, string>();
    const originalLocalStorage = window.localStorage;
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        get length() {
          return storage.size;
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
    try {
      window.localStorage.setItem("player-state-v1", JSON.stringify({
        currentTime: 32,
        currentTrack: track,
        duration: 245,
        queue: [track],
        repeat: "off",
        rightPanelTab: "queue",
        showRightPanel: false,
        shuffle: false,
        volume: 1,
      }));

      runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
        getAudioEngine: () => engine,
      });
      runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
        getPlaybackSourceWithQuality: vi.fn(),
        getVideoPlaybackSource: vi.fn(),
        invalidateTrackStreamCache: vi.fn(),
      });

      const { result } = renderHook(() => usePlayer(), { wrapper });

      await waitFor(() => {
        expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-restore", {
          autoplay: false,
          startSeconds: 32,
        });
        expect(result.current.playbackMode).toBe("youtube-embed");
        expect(result.current.currentTrack?.id).toBe("yt-restore");
        expect(result.current.isPlaying).toBe(false);
      });

      expect(engine.restore).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it("keeps the right panel open for published YouTube embed videos even when auto-open is while-playing", async () => {
    const engine = createEngineMock();
    const loadRequest = deferred<void>();
    playbackEnvironmentMocks.isPublishedRuntimeHost.mockReturnValue(true);
    settingsMocks.values.rightPanelAutoOpen = "while-playing";
    youtubeEmbedManagerMocks.load.mockImplementation(() => loadRequest.promise);

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeVideoTrack("yt-embed-sticky-panel", "Sticky Embed Video", "video-321");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(youtubeEmbedManagerMocks.load).toHaveBeenCalledWith("video-321", { autoplay: true });
      expect(result.current.playbackMode).toBe("youtube-embed");
      expect(result.current.currentTrack?.id).toBe("yt-embed-sticky-panel");
      expect(result.current.showRightPanel).toBe(true);
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      loadRequest.resolve();
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.showRightPanel).toBe(true);
    });

    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.pause).toHaveBeenCalled();
  });

  it("recovers from unexpected native pause events without interrupting playback", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH",
        quality: "HIGH",
        source: { type: "direct" as const, url: "https://example.com/stream.m4a" },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("track-passive-pause", "Passive Pause Track", 404);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-passive-pause");
      expect(result.current.isPlaying).toBe(true);
      expect(engine.play).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.paused = true;
      engine.emit("pause");
    });

    await waitFor(() => {
      expect(engine.play).toHaveBeenCalledTimes(2);
      expect(result.current.isPlaying).toBe(true);
    });
  });

  it("keeps explicit user pauses paused instead of auto-resuming", async () => {
    const engine = createEngineMock();

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(async () => ({
        capability: "HIGH",
        quality: "HIGH",
        source: { type: "direct" as const, url: "https://example.com/stream.m4a" },
      })),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildTrack("track-user-pause", "User Pause Track", 405);

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("track-user-pause");
      expect(result.current.isPlaying).toBe(true);
      expect(engine.play).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.togglePlay();
    });

    await waitFor(() => {
      expect(engine.pause).toHaveBeenCalledTimes(1);
      expect(result.current.isPlaying).toBe(false);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 250));

    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it("falls back to a compatible YouTube video stream when the engine errors after split playback starts", async () => {
    const engine = createEngineMock();
    const getYoutubeMusicVideoPlaybackSource = vi.fn(async () => ({
      type: "direct" as const,
      url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=137",
      audioUrl: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=140",
      fallbackUrl: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=18",
    }));

    runtimeModuleMocks.loadAudioEngineModule.mockResolvedValue({
      getAudioEngine: () => engine,
    });
    runtimeModuleMocks.loadMusicApiModule.mockResolvedValue({
      getPlaybackSourceWithQuality: vi.fn(),
      getVideoPlaybackSource: vi.fn(),
      invalidateTrackStreamCache: vi.fn(),
    });

    const youtubeMusicApi = await import("@/lib/youtubeMusicApi");
    vi.mocked(youtubeMusicApi.getYoutubeMusicVideoPlaybackSource).mockImplementation(getYoutubeMusicVideoPlaybackSource);

    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = buildYoutubeVideoTrack("yt-video", "YouTube Video", "video-123");

    act(() => {
      result.current.play(track, [track]);
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.id).toBe("yt-video");
      expect(result.current.isPlaying).toBe(true);
      expect(engine.load).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      engine.emit("error", "Media aborted");
    });

    await waitFor(() => {
      expect(engine.restore).toHaveBeenCalledWith(
        {
          type: "direct",
          url: "https://rr3---sn-example.googlevideo.com/videoplayback?id=test&itag=18",
        },
        0,
        1,
        0,
      );
      expect(toastMocks.showInfoToast).toHaveBeenCalledWith("\"YouTube Video\" fell back to a compatible YouTube video stream.");
    });

    expect(toastMocks.showErrorToast).not.toHaveBeenCalledWith("\"YouTube Video\" is unavailable to play right now.");
  });
});
