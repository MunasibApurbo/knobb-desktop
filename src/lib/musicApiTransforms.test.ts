import { describe, expect, it } from "vitest";

import { qualityAttempts, tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
import { formatReleaseDate, getReleaseYear } from "@/lib/releaseDates";

describe("tidalTrackToAppTrack", () => {
  it("preserves the album release date and derives the correct release year", () => {
    const appTrack = tidalTrackToAppTrack({
      id: 123,
      title: "Sin Pijama",
      duration: 200,
      artist: { id: 1, name: "Becky G", picture: null },
      artists: [
        { id: 1, name: "Becky G", type: "MAIN" },
        { id: 2, name: "NATTI NATASHA", type: "FEATURED" },
      ],
      album: {
        id: 99,
        title: "Sin Pijama",
        cover: "cover-id",
        vibrantColor: "#00bcd4",
        releaseDate: "2018-04-20",
      },
      version: null,
      popularity: 100,
      explicit: false,
      audioQuality: "LOSSLESS",
      replayGain: 0,
      peak: 1,
    });

    expect(appTrack.releaseDate).toBe("2018-04-20");
    expect(appTrack.year).toBe(2018);
  });

  it("uses Tidal's video thumbnail path for video tracks", () => {
    const appTrack = tidalTrackToAppTrack({
      id: 456,
      title: "One Kiss",
      duration: 220,
      artist: { id: 3, name: "Dua Lipa", picture: null },
      artists: [{ id: 3, name: "Dua Lipa", type: "MAIN" }],
      album: {
        id: 100,
        title: "One Kiss",
        cover: "album-cover-id",
        vibrantColor: "#00bcd4",
      },
      version: null,
      popularity: 100,
      explicit: false,
      audioQuality: "HIGH",
      replayGain: 0,
      peak: 1,
      imageId: "video-image-id",
      type: "VIDEO",
    });

    expect(appTrack.isVideo).toBe(true);
    expect(appTrack.coverUrl).toBe("https://resources.tidal.com/images/video/image/id/1280x720.jpg");
  });

  it("does not invent the current year when a release date is missing", () => {
    const appTrack = tidalTrackToAppTrack({
      id: 123,
      title: "Untitled",
      duration: 200,
      artist: { id: 1, name: "Unknown Artist", picture: null },
      artists: [{ id: 1, name: "Unknown Artist", type: "MAIN" }],
      album: {
        id: 99,
        title: "Unknown Album",
        cover: "cover-id",
        vibrantColor: "#00bcd4",
      },
      version: null,
      popularity: 100,
      explicit: false,
      audioQuality: "LOSSLESS",
      replayGain: 0,
      peak: 1,
    });

    expect(appTrack.releaseDate).toBeUndefined();
    expect(appTrack.year).toBe(0);
  });

  it("uses the placeholder accent when Tidal metadata has no vibrant color", () => {
    const appTrack = tidalTrackToAppTrack({
      id: 789,
      title: "No Color Metadata",
      duration: 180,
      artist: { id: 1, name: "Unknown Artist", picture: null },
      artists: [{ id: 1, name: "Unknown Artist", type: "MAIN" }],
      album: {
        id: 100,
        title: "Unknown Album",
        cover: "cover-id",
        vibrantColor: null,
      },
      version: null,
      popularity: 0,
      explicit: false,
      audioQuality: "HIGH",
      replayGain: 0,
      peak: 1,
    });

    expect(appTrack.canvasColor).toBe("220 70% 55%");
  });
});

describe("qualityAttempts", () => {
  it("keeps fixed TIDAL requests locked to the selected quality", () => {
    expect(qualityAttempts("LOW")).toEqual(["LOW"]);
    expect(qualityAttempts("HIGH")).toEqual(["HIGH"]);
    expect(qualityAttempts("LOSSLESS")).toEqual(["LOSSLESS"]);
    expect(qualityAttempts("MAX")).toEqual(["HI_RES_LOSSLESS"]);
  });

  it("allows fallback only when auto quality is selected", () => {
    expect(qualityAttempts("AUTO")).toEqual(["HI_RES_LOSSLESS", "LOSSLESS", "HIGH", "LOW"]);
  });
});

describe("release date helpers", () => {
  it("formats ISO date strings without timezone drift", () => {
    expect(formatReleaseDate("2025-12-31")).toBe("December 31, 2025");
    expect(formatReleaseDate("2025-12")).toBe("December 2025");
    expect(formatReleaseDate("2025")).toBe("2025");
  });

  it("falls back to unknown when no release date or year is available", () => {
    expect(getReleaseYear(undefined)).toBe(0);
    expect(formatReleaseDate(undefined, 0)).toBe("Unknown");
  });
});
