import { describe, expect, it } from "vitest";

import { normalizeTrackRecord, sanitizeTrackRecords } from "@/lib/trackNormalization";

describe("trackNormalization", () => {
  it("backfills render-safe fields for partial history tracks", () => {
    const track = normalizeTrackRecord(
      {
        title: "After Hours",
        duration: 242.4,
      },
      { trackKey: "tidal:12345" },
    );

    expect(track).toMatchObject({
      id: "tidal-12345",
      source: "tidal",
      sourceId: "12345",
      tidalId: 12345,
      title: "After Hours",
      artist: "Unknown Artist",
      album: "Unknown Album",
      duration: 242,
      coverUrl: "/placeholder.svg",
      canvasColor: "220 70% 55%",
    });
  });

  it("preserves explicit source ids and drops unusable empty strings", () => {
    const track = normalizeTrackRecord({
      id: "ytm-abc123",
      source: "youtube-music",
      sourceId: "abc123",
      title: "Satellite",
      artist: "Artist Name",
      album: "Orbit",
      coverUrl: "   ",
      canvasColor: "",
    });

    expect(track).toMatchObject({
      id: "ytm-abc123",
      source: "youtube-music",
      sourceId: "abc123",
      coverUrl: "/placeholder.svg",
      canvasColor: "220 70% 55%",
    });
  });

  it("sanitizes cached track arrays into renderable cards", () => {
    const tracks = sanitizeTrackRecords([
      {
        artist: "Charli xcx",
        album: "Brat",
      },
      {
        id: "track-2",
        title: "Von dutch",
        artist: "Charli xcx",
        album: "Brat",
        duration: 164,
        year: 2024,
        coverUrl: "https://example.com/von-dutch.jpg",
        canvasColor: "0 0% 50%",
      },
    ]);

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      title: "Unknown Track",
      artist: "Charli xcx",
      album: "Brat",
      coverUrl: "/placeholder.svg",
    });
    expect(tracks[1].id).toBe("track-2");
  });
});
