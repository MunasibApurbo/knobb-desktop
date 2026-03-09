import { buildMediaSessionArtwork } from "@/contexts/PlayerContext";

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
