import { describe, expect, it } from "vitest";

import { tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
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
