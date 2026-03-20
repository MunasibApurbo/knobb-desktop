import { render, screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";

import type { LyricsResult } from "@/lib/musicApiTypes";
import { LyricsPanel } from "@/components/LyricsPanel";
import { loadLyricsForTrack, preloadLyricsForTrack, resetLyricsPreloadCacheForTests } from "@/lib/lyricsPanelData";
import type { Track } from "@/types/music";

const { amLyricsSpy, getLyricsMock, getYoutubeMusicLyricsMock } = vi.hoisted(() => ({
  amLyricsSpy: vi.fn(),
  getLyricsMock: vi.fn(),
  getYoutubeMusicLyricsMock: vi.fn(),
}));

vi.mock("@/lib/musicApi", () => ({
  getLyrics: getLyricsMock,
}));

vi.mock("@/lib/youtubeMusicApi", () => ({
  getYoutubeMusicLyrics: getYoutubeMusicLyricsMock,
}));

vi.mock("@uimaxbai/am-lyrics/am-lyrics.js", () => ({}));

vi.mock("@uimaxbai/am-lyrics/react", () => ({
  AmLyrics: forwardRef((props: Record<string, unknown>, ref) => {
    void ref;
    amLyricsSpy(props);
    return null;
  }),
}));

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "ytm-1",
    source: "youtube-music",
    sourceId: "video-123",
    title: "Example Song",
    artist: "Example Artist",
    album: "Example Album",
    duration: 200,
    year: 2026,
    coverUrl: "/cover.jpg",
    canvasColor: "0 0% 0%",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("LyricsPanel preloading", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetLyricsPreloadCacheForTests();
    amLyricsSpy.mockReset();
    getLyricsMock.mockReset();
    getYoutubeMusicLyricsMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes in-flight and resolved lyrics loads for the same track", async () => {
    const track = createTrack();
    const deferred = createDeferred<LyricsResult | null>();

    getYoutubeMusicLyricsMock.mockReturnValue(deferred.promise);

    preloadLyricsForTrack(track);
    preloadLyricsForTrack(track);

    await waitFor(() => {
      expect(getYoutubeMusicLyricsMock).toHaveBeenCalledTimes(1);
    });

    deferred.resolve({
      lines: [{ time: 1, text: "Hello world" }],
      provider: "YouTube Music",
      sourceLabel: "YouTube Music",
      sourceHost: null,
      isSynced: true,
      isRightToLeft: false,
      rawLyrics: null,
      rawSubtitles: null,
    });

    await waitFor(() => {
      expect(getYoutubeMusicLyricsMock).toHaveBeenCalledTimes(1);
    });

    preloadLyricsForTrack(track);

    await Promise.resolve();
    expect(getYoutubeMusicLyricsMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to LRCLIB search results even when track duration is missing", async () => {
    const track = createTrack({
      id: "artistgrid-track-1",
      source: "tidal",
      sourceId: `sheet-id:https://pillows.su/f/abc123`,
      duration: 0,
      title: "Fingers Crossed",
      artist: "Billie Eilish",
      album: "Unreleased Era",
    });

    getYoutubeMusicLyricsMock.mockResolvedValue(null);
    getLyricsMock.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            trackName: "Fingers Crossed",
            artistName: "Billie Eilish",
            albumName: "Don't Smile at Me",
            syncedLyrics: "[00:01.00]Pre-don't smile at me",
          },
        ]),
      } as Response);

    const result = await loadLyricsForTrack(track, track.artist, track.album);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.lyricsProvider).toBe("LRCLIB");
    expect(result?.lines[0]?.text).toBe("Pre-don't smile at me");
  });

  it("sorts provider lyrics by timestamp before rendering", async () => {
    const track = createTrack();

    getYoutubeMusicLyricsMock.mockResolvedValue({
      lines: [
        { time: 12, text: "Third" },
        { time: 4, text: "First" },
        { time: 8, text: "Second" },
      ],
      provider: "YouTube Music",
      sourceLabel: "YouTube Music",
      sourceHost: null,
      isSynced: true,
      isRightToLeft: false,
      rawLyrics: null,
      rawSubtitles: null,
    } satisfies LyricsResult);

    const result = await loadLyricsForTrack(track, track.artist, track.album);

    expect(result?.lines.map((line) => line.text)).toEqual(["First", "Second", "Third"]);
    expect(result?.lines.map((line) => line.timeMs)).toEqual([4000, 8000, 12000]);
  });

  it("prefers synced LRCLIB lyrics over unsynced YouTube Music lyrics for Bangla tracks", async () => {
    const track = createTrack({
      title: "আমার সোনার বাংলা",
      artist: "অর্ণব",
      album: "গানের খাতা",
      duration: 234,
    });

    getYoutubeMusicLyricsMock.mockResolvedValue({
      lines: [
        { time: 0, text: "Unsynced line 1" },
        { time: 4, text: "Unsynced line 2" },
      ],
      provider: "YouTube Music",
      sourceLabel: "YouTube Music",
      sourceHost: null,
      isSynced: false,
      isRightToLeft: false,
      rawLyrics: "Unsynced line 1\nUnsynced line 2",
      rawSubtitles: null,
    } satisfies LyricsResult);

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            trackName: "ভুল গান",
            artistName: "অন্য শিল্পী",
            albumName: "অন্য অ্যালবাম",
            syncedLyrics: "[00:01.00]Wrong line",
          },
          {
            trackName: "আমার সোনার বাংলা",
            artistName: "অর্ণব",
            albumName: "গানের খাতা",
            syncedLyrics: "[00:02.50]সঠিক লাইন",
          },
        ]),
      } as Response);

    const result = await loadLyricsForTrack(track, track.artist, track.album);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.lyricsProvider).toBe("LRCLIB");
    expect(result?.isSynced).toBe(true);
    expect(result?.lines[0]).toEqual({
      timeMs: 2500,
      text: "সঠিক লাইন",
    });
  });

  it("renders am-lyrics in controlled mode without triggering provider lookups", async () => {
    const track = createTrack();

    getYoutubeMusicLyricsMock.mockResolvedValue({
      lines: [{ time: 5, text: "Hello world" }],
      provider: "YouTube Music",
      sourceLabel: "YouTube Music",
      sourceHost: null,
      isSynced: true,
      isRightToLeft: false,
      rawLyrics: null,
      rawSubtitles: null,
    } satisfies LyricsResult);

    render(
      <LyricsPanel
        currentTime={12}
        onSeek={vi.fn()}
        track={track}
      />,
    );

    await waitFor(() => {
      expect(amLyricsSpy).toHaveBeenCalled();
    });

    const lastCall = amLyricsSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastCall.currentTime).toBe(12_000);
    expect(lastCall.duration).toBe(200_000);
    expect(lastCall.interpolate).toBe(false);
    expect(lastCall.query).toBeUndefined();
    expect(lastCall.songTitle).toBeUndefined();
    expect(lastCall.songArtist).toBeUndefined();
    expect(lastCall.songAlbum).toBeUndefined();
    expect(lastCall.songDurationMs).toBeUndefined();
    expect(lastCall.isrc).toBeUndefined();
  });

  it("renders unsynced fallback lyrics as static text instead of the synced lyrics component", async () => {
    const track = createTrack();

    getYoutubeMusicLyricsMock.mockResolvedValue({
      lines: [
        { time: 0, text: "Fallback line 1" },
        { time: 4, text: "Fallback line 2" },
      ],
      provider: "LewdHuTao Lyrics API",
      sourceLabel: "LewdHuTao Lyrics API",
      sourceHost: null,
      isSynced: false,
      isRightToLeft: false,
      rawLyrics: "Fallback line 1\nFallback line 2",
      rawSubtitles: null,
    } satisfies LyricsResult);

    render(
      <LyricsPanel
        currentTime={34}
        onSeek={vi.fn()}
        track={track}
      />,
    );

    expect(await screen.findByTestId("static-lyrics-panel")).toBeInTheDocument();
    expect(screen.getByText("Unsynced lyrics")).toBeInTheDocument();
    expect(screen.getByText("Fallback line 1")).toBeInTheDocument();
    expect(screen.getByText("Fallback line 2")).toBeInTheDocument();
    expect(amLyricsSpy).toHaveBeenCalledTimes(1);
  });
});
