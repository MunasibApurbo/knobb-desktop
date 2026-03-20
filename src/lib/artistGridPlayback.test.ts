import { describe, expect, it } from "vitest";

import { extractArtistGridSourceUrl, hydrateArtistGridTrackPlayback } from "@/lib/artistGridPlayback";

describe("artistGridPlayback", () => {
  it("extracts artistgrid source urls from prefixed source ids without requiring a fixed prefix length", () => {
    expect(extractArtistGridSourceUrl("sheet-id-123:https://pillows.su/f/abc123"))
      .toBe("https://pillows.su/f/abc123");
  });

  it("restores streamUrl from cached quality streams for liked-song artistgrid tracks", async () => {
    const track = await hydrateArtistGridTrackPlayback({
      id: "tidal-sheet-id:https://pillows.su/f/abc123",
      title: "Leak",
      artist: "Artist",
      album: "Era",
      duration: 180,
      year: 2024,
      coverUrl: "/cover.jpg",
      canvasColor: "0 0% 0%",
      sourceId: "sheet-id:https://pillows.su/f/abc123",
      streamUrls: {
        HIGH: "/api/audio-proxy?url=https%3A%2F%2Fcdn.example%2Ftrack.m4a",
      },
    });

    expect(track.streamUrl).toBe("/api/audio-proxy?url=https%3A%2F%2Fcdn.example%2Ftrack.m4a");
  });
});
