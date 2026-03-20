import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARTIST_GRID_TRACK_COLOR,
  normalizeArtistGridTrackColor,
  resolveArtistGridTrackCanvasColor,
} from "@/lib/artistGridTrackColors";

describe("normalizeArtistGridTrackColor", () => {
  it("keeps existing HSL tokens intact", () => {
    expect(normalizeArtistGridTrackColor("48 100% 68%")).toBe("48 100% 68%");
  });

  it("converts hex colors into HSL tokens", () => {
    expect(normalizeArtistGridTrackColor("#ffde5b")).toBe("48 100% 68%");
  });

  it("converts rgb colors into HSL tokens", () => {
    expect(normalizeArtistGridTrackColor("rgb(255, 222, 91)")).toBe("48 100% 68%");
  });

  it("ignores unsupported values like gradients", () => {
    expect(normalizeArtistGridTrackColor("linear-gradient(black, white)")).toBeNull();
  });
});

describe("resolveArtistGridTrackCanvasColor", () => {
  it("prefers the extracted artwork color", () => {
    expect(resolveArtistGridTrackCanvasColor({
      artworkColor: "49 99% 67%",
      eraBackgroundColor: "#ffde5b",
    })).toBe("49 99% 67%");
  });

  it("falls back to the era color before using the default blue", () => {
    expect(resolveArtistGridTrackCanvasColor({
      artworkColor: null,
      eraBackgroundColor: "#ffde5b",
    })).toBe("48 100% 68%");
  });

  it("uses the existing default only when no usable color is available", () => {
    expect(resolveArtistGridTrackCanvasColor({
      artworkColor: null,
      eraBackgroundColor: "linear-gradient(black, white)",
    })).toBe(DEFAULT_ARTIST_GRID_TRACK_COLOR);
  });
});
