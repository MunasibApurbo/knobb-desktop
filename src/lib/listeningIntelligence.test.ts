import { describe, expect, it } from "vitest";
import { computeListeningStats, filterHistoryByRange, isCountedPlay } from "@/lib/listeningIntelligence";
import type { PlayHistoryEntry } from "@/hooks/usePlayHistory";

function makeEntry(overrides: Partial<PlayHistoryEntry> = {}): PlayHistoryEntry {
  const now = new Date();
  return {
    id: "track-1",
    title: "Track One",
    artist: "Artist One",
    album: "Album One",
    duration: 200,
    year: 2024,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 50%",
    playedAt: now.toISOString(),
    listenedSeconds: 120,
    durationSeconds: 200,
    eventType: "progress",
    trackKey: "tidal:1",
    ...overrides,
  };
}

describe("isCountedPlay", () => {
  it("counts complete/repeat events regardless of listen seconds", () => {
    expect(isCountedPlay(makeEntry({ eventType: "complete", listenedSeconds: 1 }))).toBe(true);
    expect(isCountedPlay(makeEntry({ eventType: "repeat", listenedSeconds: 1 }))).toBe(true);
  });

  it("counts progress events only when scrobble threshold is met", () => {
    expect(isCountedPlay(makeEntry({ listenedSeconds: 99, durationSeconds: 200, eventType: "progress" }), 50)).toBe(false);
    expect(isCountedPlay(makeEntry({ listenedSeconds: 100, durationSeconds: 200, eventType: "progress" }), 50)).toBe(true);
  });

  it("handles short tracks using duration cap", () => {
    expect(isCountedPlay(makeEntry({ listenedSeconds: 19, durationSeconds: 20 }), 50)).toBe(false);
    expect(isCountedPlay(makeEntry({ listenedSeconds: 20, durationSeconds: 20 }), 50)).toBe(true);
  });
});

describe("filterHistoryByRange", () => {
  it("filters out entries older than 7 days", () => {
    const now = new Date();
    const recent = makeEntry({ playedAt: now.toISOString() });
    const old = makeEntry({
      id: "track-2",
      trackKey: "tidal:2",
      playedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const result = filterHistoryByRange([recent, old], "7d");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("track-1");
  });
});

describe("computeListeningStats", () => {
  it("computes totals, top artists, top tracks, and peak hour", () => {
    const baseHour = new Date("2026-03-04T22:00:00.000Z");
    const history: PlayHistoryEntry[] = [
      makeEntry({
        id: "a1",
        title: "One",
        artist: "Artist A",
        trackKey: "tidal:101",
        listenedSeconds: 240,
        durationSeconds: 240,
        eventType: "complete",
        playedAt: baseHour.toISOString(),
      }),
      makeEntry({
        id: "a2",
        title: "One",
        artist: "Artist A",
        trackKey: "tidal:101",
        listenedSeconds: 230,
        durationSeconds: 240,
        eventType: "repeat",
        playedAt: new Date(baseHour.getTime() - 5 * 60 * 1000).toISOString(),
      }),
      makeEntry({
        id: "b1",
        title: "Two",
        artist: "Artist B",
        trackKey: "tidal:202",
        listenedSeconds: 45,
        durationSeconds: 200,
        eventType: "progress",
        playedAt: baseHour.toISOString(),
      }),
      makeEntry({
        id: "b2",
        title: "Three",
        artist: "Artist B",
        trackKey: "tidal:303",
        listenedSeconds: 60,
        durationSeconds: 120,
        eventType: "progress",
        playedAt: baseHour.toISOString(),
      }),
    ];

    const stats = computeListeningStats(history, 50);

    // Includes all listened seconds, not only counted plays.
    expect(stats.totalMinutes).toBe(10);
    // Counted plays: a1 complete, a2 repeat, b2 progress above threshold.
    expect(stats.totalCountedPlays).toBe(3);

    expect(stats.topArtists[0]).toEqual({ artist: "Artist A", listenedSeconds: 470 });
    expect(stats.topArtists[1]).toEqual({ artist: "Artist B", listenedSeconds: 105 });

    expect(stats.topTracks[0].track.title).toBe("One");
    expect(stats.topTracks[0].listenedSeconds).toBe(470);
    expect(stats.topTracks[0].playCount).toBe(2);
    expect(stats.topTracks[1].track.title).toBe("Three");
    expect(stats.topTracks[1].listenedSeconds).toBe(60);
    expect(stats.topTracks[1].playCount).toBe(1);

    expect(stats.peakHour).toBe(new Date(baseHour).getHours());
    expect(stats.hourCounts[stats.peakHour]).toBeGreaterThan(0);
  });
});
