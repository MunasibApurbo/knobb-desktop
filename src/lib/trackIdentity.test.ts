import { describe, expect, it } from "vitest";
import { inferTidalIdFromTrackId, normalizeTrackIdentity } from "@/lib/trackIdentity";
import type { Track } from "@/types/music";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "tidal-123",
  title: "Track",
  artist: "Artist",
  album: "Album",
  duration: 180,
  year: 2024,
  coverUrl: "/cover.jpg",
  canvasColor: "0 0% 50%",
  ...overrides,
});

describe("trackIdentity", () => {
  it("infers a tidal id from a standard tidal track id", () => {
    expect(inferTidalIdFromTrackId("tidal-123")).toBe(123);
  });

  it("infers a tidal id from playlist-style tidal ids with an index suffix", () => {
    expect(inferTidalIdFromTrackId("tidal-456-7")).toBe(456);
  });

  it("normalizes legacy tracks by backfilling tidalId from id", () => {
    expect(normalizeTrackIdentity(makeTrack({ id: "tidal-789" })).tidalId).toBe(789);
  });
});
