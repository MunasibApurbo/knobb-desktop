import { describe, expect, it } from "vitest";
import { buildTrackEmbedCode, buildTrackEmbedUrl, canEmbedTrack } from "@/lib/trackSharing";
import type { Track } from "@/types/music";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "tidal-123",
  tidalId: 123,
  albumId: 456,
  title: "Track",
  artist: "Artist",
  album: "Album",
  duration: 180,
  year: 2024,
  coverUrl: "/cover.jpg",
  canvasColor: "0 0% 50%",
  ...overrides,
});

describe("trackSharing", () => {
  it("builds an embed url for resolvable streaming tracks", () => {
    expect(buildTrackEmbedUrl(makeTrack())).toBe(
      "https://knobb.netlify.app/embed/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg",
    );
  });

  it("builds iframe code for track embeds", () => {
    expect(buildTrackEmbedCode("https://knobb.test/embed/track/tidal-123", { title: "Track - Knobb", height: 420 })).toBe(
      '<iframe style="border-radius:12px" src="https://knobb.test/embed/track/tidal-123" title="Track - Knobb" width="100%" height="420" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>',
    );
  });

  it("rejects local and unresolvable tracks", () => {
    expect(canEmbedTrack(makeTrack({ id: "local-9", tidalId: undefined, localFileId: "local-9" }))).toEqual({
      allowed: false,
      reason: "Local files cannot be embedded outside Knobb.",
    });
    expect(canEmbedTrack(makeTrack({ id: "app-track-9", tidalId: undefined }))).toEqual({
      allowed: false,
      reason: "Only streaming tracks with a resolvable Knobb ID can be embedded.",
    });
  });
});
