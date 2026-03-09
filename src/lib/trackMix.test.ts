import { describe, expect, it } from "vitest";
import { buildTrackMixQueue, getPrimaryArtistName, getTrackMixId } from "@/lib/trackMix";
import type { Track } from "@/types/music";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "tidal-123",
  tidalId: 123,
  title: "Track",
  artist: "Artist",
  album: "Album",
  duration: 180,
  year: 2024,
  coverUrl: "/cover.jpg",
  canvasColor: "0 0% 50%",
  ...overrides,
});

describe("getTrackMixId", () => {
  it("returns a normalized track mix id when present", () => {
    expect(getTrackMixId(makeTrack({ mixes: { TRACK_MIX: 987654 } }))).toBe("987654");
  });

  it("returns null when a track mix is unavailable", () => {
    expect(getTrackMixId(makeTrack())).toBeNull();
  });
});

describe("getPrimaryArtistName", () => {
  it("prefers structured artists when available", () => {
    expect(getPrimaryArtistName(makeTrack({
      artist: "Artist A, Artist B",
      artists: [{ id: 7, name: "Artist B" }],
    }))).toBe("Artist B");
  });

  it("falls back to the first credited artist in the display string", () => {
    expect(getPrimaryArtistName(makeTrack({ artist: "Artist A, Artist B" }))).toBe("Artist A");
  });
});

describe("buildTrackMixQueue", () => {
  it("keeps the selected track at the front and removes duplicates", () => {
    const seed = makeTrack({ id: "tidal-123", tidalId: 123, title: "Seed" });
    const duplicate = makeTrack({ id: "other-id", tidalId: 123, title: "Seed Duplicate" });
    const recommendation = makeTrack({ id: "tidal-456", tidalId: 456, title: "Recommendation" });

    const queue = buildTrackMixQueue(seed, [duplicate, recommendation]);

    expect(queue.map((track) => track.title)).toEqual(["Seed", "Recommendation"]);
  });
});
