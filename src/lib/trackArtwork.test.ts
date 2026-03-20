import { describe, expect, it } from "vitest";

import { getArtworkColorSampleUrl, getMediaSessionTrackArtworkUrl, getTrackArtworkUrl } from "@/lib/trackArtwork";

describe("getTrackArtworkUrl", () => {
  it("keeps audio artwork unchanged", () => {
    expect(getTrackArtworkUrl({
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
      isVideo: false,
      source: "tidal",
    })).toBe("https://resources.tidal.com/images/ab/cd/ef/750x750.jpg");
  });

  it("upgrades Tidal video artwork to the widescreen thumbnail size", () => {
    expect(getTrackArtworkUrl({
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg",
      isVideo: true,
      source: "tidal",
    })).toBe("https://resources.tidal.com/images/ab/cd/ef/1280x720.jpg");
  });

  it("preserves non-Tidal video artwork URLs", () => {
    expect(getTrackArtworkUrl({
      coverUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
      isVideo: true,
      source: "youtube-music",
      sourceId: "abc123",
    })).toBe("https://i.ytimg.com/vi/abc123/maxresdefault.jpg");
  });

  it("falls back to a stable YouTube thumbnail when YT Music track art uses a flaky googleusercontent URL", () => {
    expect(getTrackArtworkUrl({
      coverUrl: "https://lh3.googleusercontent.com/example=w60-h60-l90-rj",
      isVideo: false,
      source: "youtube-music",
      sourceId: "abc123",
    })).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
  });
});

describe("getMediaSessionTrackArtworkUrl", () => {
  it("keeps the original YouTube Music cover art for media session artwork", () => {
    expect(getMediaSessionTrackArtworkUrl({
      coverUrl: "https://lh3.googleusercontent.com/example=w544-h544-l90-rj",
      isVideo: false,
      source: "youtube-music",
      sourceId: "abc123",
    })).toBe("https://lh3.googleusercontent.com/example=w544-h544-l90-rj");
  });

  it("falls back to a YouTube thumbnail when no cover art exists", () => {
    expect(getMediaSessionTrackArtworkUrl({
      coverUrl: "/placeholder.svg",
      isVideo: true,
      source: "youtube-music",
      sourceId: "abc123",
    })).toBe("https://i.ytimg.com/vi/abc123/sddefault.jpg");
  });

  it("uses a square TIDAL image for video media session artwork", () => {
    expect(getMediaSessionTrackArtworkUrl({
      coverUrl: "https://resources.tidal.com/images/ab/cd/ef/1280x720.jpg",
      isVideo: true,
      source: "tidal",
    })).toBe("https://resources.tidal.com/images/ab/cd/ef/750x750.jpg");
  });
});

describe("getArtworkColorSampleUrl", () => {
  it("routes supported remote artwork through the same-origin proxy for color sampling", () => {
    expect(getArtworkColorSampleUrl("https://i.ytimg.com/vi/abc123/sddefault.jpg")).toBe(
      "/api/image-proxy?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fabc123%2Fsddefault.jpg",
    );
  });

  it("routes generic remote artwork through the same-origin proxy for color sampling", () => {
    expect(getArtworkColorSampleUrl("https://i1.sndcdn.com/artworks-abc123-t500x500.jpg")).toBe(
      "/api/image-proxy?url=https%3A%2F%2Fi1.sndcdn.com%2Fartworks-abc123-t500x500.jpg",
    );
  });

  it("leaves local artwork URLs untouched", () => {
    expect(getArtworkColorSampleUrl("/placeholder.svg")).toBe("/placeholder.svg");
  });
});
