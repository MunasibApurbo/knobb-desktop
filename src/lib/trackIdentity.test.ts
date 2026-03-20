import { describe, expect, it } from "vitest";
import { inferTidalIdFromTrackId, isSameTrack, normalizeTrackIdentity } from "@/lib/trackIdentity";
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

  it("does not treat two different stable ids with matching metadata as the same track", () => {
    const currentTrack = makeTrack({
      id: "ytm-alpha",
      source: "youtube-music",
      sourceId: "alpha",
      title: "Shoroter Shesh Thekey",
      artist: "Pritom Hasan",
      duration: 0,
    });
    const duplicateResult = makeTrack({
      id: "ytm-beta",
      source: "youtube-music",
      sourceId: "beta",
      title: "Shoroter Shesh Thekey",
      artist: "Pritom Hasan",
      duration: 0,
    });

    expect(isSameTrack(currentTrack, duplicateResult)).toBe(false);
  });

  it("does not treat a recycled custom id as the same track when the song changed", () => {
    const currentTrack = makeTrack({
      id: "hero-slot-track",
      tidalId: undefined,
      title: "Same Old Love",
      artist: "Selena Gomez",
      duration: 229,
    });
    const replacementTrack = makeTrack({
      id: "hero-slot-track",
      tidalId: undefined,
      title: "Calm Down",
      artist: "Rema, Selena Gomez",
      duration: 239,
    });

    expect(isSameTrack(currentTrack, replacementTrack)).toBe(false);
  });

  it("normalizes artistgrid-style tracks to a stable source-based identity", () => {
    expect(normalizeTrackIdentity(makeTrack({
      id: "artistgrid-temp",
      tidalId: undefined,
      source: undefined,
      sourceId: "sheet-id-123:https://pillows.su/f/abc123",
    }))).toMatchObject({
      id: "tidal-sheet-id-123:https://pillows.su/f/abc123",
      source: "tidal",
      sourceId: "sheet-id-123:https://pillows.su/f/abc123",
      tidalId: undefined,
    });
  });

  it("treats artistgrid tracks with the same source id as the same track", () => {
    const currentTrack = makeTrack({
      id: "artistgrid-temp",
      tidalId: undefined,
      source: undefined,
      sourceId: "sheet-id-123:https://pillows.su/f/abc123",
      title: "Leaked Song",
      artist: "Artist",
      duration: 184,
    });
    const likedTrack = normalizeTrackIdentity(makeTrack({
      id: "liked-version",
      tidalId: undefined,
      source: undefined,
      sourceId: "sheet-id-123:https://pillows.su/f/abc123",
      title: "Leaked Song",
      artist: "Artist",
      duration: 184,
    }));

    expect(isSameTrack(currentTrack, likedTrack)).toBe(true);
  });
});
