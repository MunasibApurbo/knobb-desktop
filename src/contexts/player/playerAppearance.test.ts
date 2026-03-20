import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Track } from "@/types/music";

const extractDominantColorMock = vi.fn<(url: string) => Promise<string | null>>();
const extractDominantColorFromMediaElementMock = vi.fn<(element: HTMLImageElement | HTMLVideoElement) => string | null>();
const loadMusicApiModuleMock = vi.fn();
const getMediaElementMock = vi.fn();
const NEUTRAL_PENDING_DYNAMIC_ACCENT = "0 0% 14%";

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: overrides.id ?? "track-1",
    title: overrides.title ?? "Track",
    artist: overrides.artist ?? "Artist",
    album: overrides.album ?? "Album",
    duration: overrides.duration ?? 180,
    year: overrides.year ?? 2024,
    coverUrl: overrides.coverUrl ?? "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    canvasColor: overrides.canvasColor ?? "220 70% 55%",
    ...overrides,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("dimWaveformColor", () => {
  it("softens cool blue accents before they reach the seekbar", async () => {
    const { dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    expect(dimWaveformColor("220 70% 55%")).toBe("220 41% 56%");
  });

  it("keeps warm accents warm and readable on dark chrome", async () => {
    const { dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    expect(dimWaveformColor("38 78% 56%")).toBe("38 61% 60%");
  });
});

describe("applyTrackAccent", () => {
  beforeEach(() => {
    vi.resetModules();
    extractDominantColorMock.mockReset();
    extractDominantColorFromMediaElementMock.mockReset();
    loadMusicApiModuleMock.mockReset();
    getMediaElementMock.mockReset();
    const localStorageValues = new Map<string, string>();
    const sessionStorageValues = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStorageValues.get(key) ?? null,
        setItem: (key: string, value: string) => localStorageValues.set(key, value),
        removeItem: (key: string) => localStorageValues.delete(key),
      },
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionStorageValues.get(key) ?? null,
        setItem: (key: string, value: string) => sessionStorageValues.set(key, value),
        removeItem: (key: string) => sessionStorageValues.delete(key),
      },
    });
    document.documentElement.style.removeProperty("--dynamic-accent");
    document.documentElement.style.removeProperty("--player-waveform");
    document.documentElement.style.removeProperty("--dynamic-accent-glow");
  });

  it("uses the resolved video thumbnail for dynamic accent extraction", async () => {
    extractDominantColorMock.mockResolvedValue("12 80% 60%");
    loadMusicApiModuleMock.mockResolvedValue({
      getTrackInfo: vi.fn(),
    });

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent, dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      isVideo: true,
      tidalId: 8821167,
      canvasColor: "210 70% 55%",
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    }));

    await flushPromises();

    expect(extractDominantColorMock).toHaveBeenCalledWith(
      "/api/image-proxy?url=https%3A%2F%2Fresources.tidal.com%2Fimages%2Fab%2Fcd%2Fef%2F1280x720.jpg",
    );
    expect(loadMusicApiModuleMock).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe("12 80% 60%");
    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe(
      dimWaveformColor("12 80% 60%"),
    );
  });

  it("keeps the video player chrome neutral until the thumbnail accent resolves", async () => {
    const deferred = createDeferred<string | null>();
    extractDominantColorMock.mockReturnValue(deferred.promise);
    loadMusicApiModuleMock.mockResolvedValue({
      getTrackInfo: vi.fn(),
    });

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent, dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      isVideo: true,
      tidalId: 8821167,
      canvasColor: "210 70% 55%",
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    }));

    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe(NEUTRAL_PENDING_DYNAMIC_ACCENT);
    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe("0 0% 74%");

    deferred.resolve("12 80% 60%");
    await flushPromises();

    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe(
      dimWaveformColor("12 80% 60%"),
    );
  });

  it("keeps the audio player chrome neutral while the placeholder accent is unresolved", async () => {
    const deferred = createDeferred<string | null>();
    extractDominantColorMock.mockReturnValue(deferred.promise);
    loadMusicApiModuleMock.mockResolvedValue({
      getTrackInfo: vi.fn().mockResolvedValue({
        album: { vibrantColor: null },
      }),
    });

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent, dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      tidalId: 8821167,
      canvasColor: "220 70% 55%",
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    }));

    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe(NEUTRAL_PENDING_DYNAMIC_ACCENT);
    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe("0 0% 74%");

    deferred.resolve("38 78% 56%");
    await flushPromises();

    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe(
      dimWaveformColor("38 78% 56%"),
    );
  });

  it("uses the YouTube Music video thumbnail for dynamic accent extraction", async () => {
    extractDominantColorMock.mockResolvedValue("320 54% 52%");

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent, dimWaveformColor } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      id: "ytm-abc123",
      source: "youtube-music",
      sourceId: "abc123",
      isVideo: true,
      tidalId: undefined,
      coverUrl: "https://lh3.googleusercontent.com/example=w60-h60-l90-rj",
      canvasColor: "220 70% 55%",
    }));

    await flushPromises();

    expect(extractDominantColorMock).toHaveBeenCalledWith(
      "/api/image-proxy?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fabc123%2Fsddefault.jpg",
    );
    expect(loadMusicApiModuleMock).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe("320 54% 52%");
    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe(
      dimWaveformColor("320 54% 52%"),
    );
  });

  it("re-samples video thumbnails even when a cached accent exists", async () => {
    const sessionStorageValues = new Map<string, string>();
    sessionStorageValues.set(
      "knobb-color-cache-v2",
      JSON.stringify({
        "https://resources.tidal.com/images/ab/cd/ef/1280x720.jpg": "220 70% 55%",
      }),
    );

    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionStorageValues.get(key) ?? null,
        setItem: (key: string, value: string) => sessionStorageValues.set(key, value),
        removeItem: (key: string) => sessionStorageValues.delete(key),
      },
    });

    extractDominantColorMock.mockResolvedValue("18 82% 58%");

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      isVideo: true,
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    }));

    await flushPromises();

    expect(extractDominantColorMock).toHaveBeenCalledWith(
      "/api/image-proxy?url=https%3A%2F%2Fresources.tidal.com%2Fimages%2Fab%2Fcd%2Fef%2F1280x720.jpg",
    );
    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe("18 82% 58%");
  });

  it("uses a neutral waveform fallback while placeholder art colors are unresolved", async () => {
    extractDominantColorMock.mockResolvedValue(null);

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      canvasColor: "220 70% 55%",
      tidalId: undefined,
    }));

    await flushPromises();

    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe(NEUTRAL_PENDING_DYNAMIC_ACCENT);
    expect(document.documentElement.style.getPropertyValue("--player-waveform")).toBe("0 0% 74%");
  });

  it("keeps video accents thumbnail-driven instead of sampling live frames", async () => {
    extractDominantColorMock.mockResolvedValue("18 82% 58%");

    vi.doMock("@/lib/colorExtractor", () => ({
      extractDominantColor: extractDominantColorMock,
      extractDominantColorFromMediaElement: extractDominantColorFromMediaElementMock,
    }));
    vi.doMock("@/lib/audioEngine", () => ({
      getAudioEngine: () => ({
        getMediaElement: getMediaElementMock,
      }),
    }));
    vi.doMock("@/lib/runtimeModules", () => ({
      loadMusicApiModule: loadMusicApiModuleMock,
    }));

    const { applyTrackAccent } = await import("@/contexts/player/playerAppearance");

    applyTrackAccent(makeTrack({
      isVideo: true,
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
    }));

    await flushPromises();

    expect(extractDominantColorFromMediaElementMock).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--dynamic-accent")).toBe("18 82% 58%");
  });
});
