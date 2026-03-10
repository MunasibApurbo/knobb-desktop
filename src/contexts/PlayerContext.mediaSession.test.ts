import { buildMediaSessionArtwork, buildMediaSessionPositionState } from "@/contexts/PlayerContext";

describe("buildMediaSessionArtwork", () => {
  it("expands Tidal artwork into multiple sized images", () => {
    const artwork = buildMediaSessionArtwork("https://resources.tidal.com/images/ab/cd/ef/750x750.jpg");

    expect(artwork).toEqual([
      { src: "https://resources.tidal.com/images/ab/cd/ef/96x96.jpg", sizes: "96x96", type: "image/jpeg" },
      { src: "https://resources.tidal.com/images/ab/cd/ef/128x128.jpg", sizes: "128x128", type: "image/jpeg" },
      { src: "https://resources.tidal.com/images/ab/cd/ef/192x192.jpg", sizes: "192x192", type: "image/jpeg" },
      { src: "https://resources.tidal.com/images/ab/cd/ef/256x256.jpg", sizes: "256x256", type: "image/jpeg" },
      { src: "https://resources.tidal.com/images/ab/cd/ef/384x384.jpg", sizes: "384x384", type: "image/jpeg" },
      { src: "https://resources.tidal.com/images/ab/cd/ef/512x512.jpg", sizes: "512x512", type: "image/jpeg" },
    ]);
  });

  it("preserves non-Tidal artwork as a single image", () => {
    const artwork = buildMediaSessionArtwork("https://knobb.app/brand/logo-k-black-square-512.png");

    expect(artwork).toEqual([
      {
        src: "https://knobb.app/brand/logo-k-black-square-512.png",
        type: "image/png",
      },
    ]);
  });
});

describe("buildMediaSessionPositionState", () => {
  it("clamps the position to the current track duration", () => {
    expect(buildMediaSessionPositionState(215, 180, 1.25)).toEqual({
      duration: 180,
      playbackRate: 1.25,
      position: 180,
    });
  });

  it("falls back to normal playback speed when the rate is invalid", () => {
    expect(buildMediaSessionPositionState(42, 180, 0)).toEqual({
      duration: 180,
      playbackRate: 1,
      position: 42,
    });
  });

  it("returns null when the duration is not playable yet", () => {
    expect(buildMediaSessionPositionState(5, 0, 1)).toBeNull();
    expect(buildMediaSessionPositionState(5, Number.NaN, 1)).toBeNull();
  });
});
