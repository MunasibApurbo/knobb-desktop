import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";

const mocks = vi.hoisted(() => {
  const track = {
    id: "track-1",
    title: "Track One",
    artist: "Artist One",
    album: "Album One",
    duration: 240,
    year: 2024,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 50%",
  };

  return {
    player: {
      currentTrack: null as typeof track | null,
      isPlaying: false,
    },
    timeline: {
      currentTime: 0,
      duration: 0,
      pendingSeekTime: null,
    },
    auth: {
      user: { id: "user-1" },
    },
    recordPlay: vi.fn(),
    submitListenBrainzNowPlaying: vi.fn().mockResolvedValue(undefined),
    submitListenBrainzScrobble: vi.fn().mockResolvedValue(undefined),
    track,
  };
});

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => mocks.player,
  usePlayerTimeline: () => mocks.timeline,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    scrobblePercent: "50",
  }),
}));

vi.mock("@/hooks/usePlayHistory", () => ({
  usePlayHistory: () => ({
    recordPlay: mocks.recordPlay,
  }),
}));

vi.mock("@/lib/externalScrobbling", () => ({
  submitListenBrainzNowPlaying: mocks.submitListenBrainzNowPlaying,
  submitListenBrainzScrobble: mocks.submitListenBrainzScrobble,
}));

describe("usePlayHistoryRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
    mocks.player.currentTrack = null;
    mocks.player.isPlaying = false;
    mocks.timeline.currentTime = 0;
    mocks.timeline.duration = 0;
    mocks.timeline.pendingSeekTime = null;
    mocks.recordPlay.mockReset();
    mocks.submitListenBrainzNowPlaying.mockClear();
    mocks.submitListenBrainzScrobble.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records elapsed listening time instead of the furthest seek position", () => {
    const { rerender, unmount } = renderHook(() => usePlayHistoryRecorder());

    act(() => {
      mocks.player.currentTrack = mocks.track;
      mocks.player.isPlaying = true;
      mocks.timeline.currentTime = 0;
      mocks.timeline.duration = mocks.track.duration;
      rerender();
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
      mocks.timeline.currentTime = 30;
      rerender();
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
      mocks.timeline.currentTime = 210;
      rerender();
    });

    act(() => {
      mocks.player.currentTrack = null;
      mocks.player.isPlaying = false;
      mocks.timeline.currentTime = 0;
      mocks.timeline.duration = 0;
      rerender();
    });

    expect(mocks.recordPlay).toHaveBeenCalledTimes(1);
    expect(mocks.recordPlay).toHaveBeenCalledWith(
      mocks.track,
      31,
      expect.objectContaining({
        scrobblePercent: 50,
        contextType: "player",
        contextId: "main",
      }),
    );

    unmount();
  });
});
