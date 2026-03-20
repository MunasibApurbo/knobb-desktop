import { describe, expect, it } from "vitest";

import { getLatestLikedSongsArtwork } from "@/lib/likedSongsArtwork";
import type { Track } from "@/types/music";

function makeTrack(overrides: Partial<Track>): Track {
  return {
    id: overrides.id ?? "track-id",
    title: overrides.title ?? "Track",
    artist: overrides.artist ?? "Artist",
    album: overrides.album ?? "Album",
    duration: overrides.duration ?? 180,
    year: overrides.year ?? 2024,
    coverUrl: overrides.coverUrl ?? "/cover.jpg",
    canvasColor: overrides.canvasColor ?? "0 0% 0%",
    ...overrides,
  };
}

describe("getLatestLikedSongsArtwork", () => {
  it("returns the newest artwork by addedAt", () => {
    const artwork = getLatestLikedSongsArtwork([
      makeTrack({ id: "older", coverUrl: "/older.jpg", addedAt: "2026-03-08T10:00:00.000Z" }),
      makeTrack({ id: "newer", coverUrl: "/newer.jpg", addedAt: "2026-03-09T10:00:00.000Z" }),
    ]);

    expect(artwork).toBe("/newer.jpg");
  });

  it("falls back to the first available artwork when addedAt is missing", () => {
    const artwork = getLatestLikedSongsArtwork([
      makeTrack({ id: "first", coverUrl: "/first.jpg" }),
      makeTrack({ id: "second", coverUrl: "/second.jpg" }),
    ]);

    expect(artwork).toBe("/first.jpg");
  });

  it("skips tracks without artwork", () => {
    const artwork = getLatestLikedSongsArtwork([
      makeTrack({ id: "missing", coverUrl: "" }),
      makeTrack({ id: "present", coverUrl: "/present.jpg", addedAt: "2026-03-09T10:00:00.000Z" }),
    ]);

    expect(artwork).toBe("/present.jpg");
  });
});
