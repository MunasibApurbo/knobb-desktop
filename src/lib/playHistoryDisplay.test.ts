import { describe, expect, it } from "vitest";

import type { PlayHistoryEntry } from "@/hooks/usePlayHistory";
import { collapseHistoryToLatestUniqueTrack } from "@/lib/playHistoryDisplay";

function makeEntry(overrides: Partial<PlayHistoryEntry> = {}): PlayHistoryEntry {
  return {
    id: "track-1",
    title: "Track One",
    artist: "Artist One",
    album: "Album One",
    duration: 200,
    year: 2024,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 50%",
    playedAt: "2026-03-08T10:00:00.000Z",
    listenedSeconds: 120,
    durationSeconds: 200,
    eventType: "progress",
    trackKey: "tidal:1",
    ...overrides,
  };
}

describe("collapseHistoryToLatestUniqueTrack", () => {
  it("keeps only the latest play per track and preserves newest-first ordering", () => {
    const history: PlayHistoryEntry[] = [
      makeEntry({
        id: "latest-repeat",
        title: "One Call Away",
        trackKey: "tidal:111",
        playedAt: "2026-03-08T11:43:00.000Z",
      }),
      makeEntry({
        id: "older-repeat",
        title: "One Call Away",
        trackKey: "tidal:111",
        playedAt: "2026-03-08T11:40:00.000Z",
      }),
      makeEntry({
        id: "other-track",
        title: "There's Nothing Holdin' Me Back",
        trackKey: "tidal:222",
        playedAt: "2026-03-08T11:41:00.000Z",
      }),
    ];

    const result = collapseHistoryToLatestUniqueTrack(history);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.id)).toEqual(["latest-repeat", "other-track"]);
  });
});
