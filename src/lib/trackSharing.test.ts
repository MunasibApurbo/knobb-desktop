import { describe, expect, it } from "vitest";
import type { Track } from "@/types/music";
import {
  TRACK_EMBED_SIZES,
  buildTrackEmbedCode,
  buildTrackEmbedPath,
  buildTrackEmbedUrl,
  canEmbedTrack,
} from "@/lib/trackSharing";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "tidal-123-0",
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
  it("allows embeds for tracks with a stable TIDAL-backed public id", () => {
    expect(canEmbedTrack(makeTrack())).toEqual({ allowed: true, reason: null });
  });

  it("blocks embeds for local-only tracks", () => {
    expect(canEmbedTrack(makeTrack({ id: "local-1", tidalId: undefined, localFileId: "local-file-9" }))).toEqual({
      allowed: false,
      reason: "Embedding is currently available for tracks with a TIDAL source ID.",
    });
  });

  it("builds track embed paths with theme and size controls", () => {
    expect(buildTrackEmbedPath(makeTrack(), { theme: "graphite", size: "compact" })).toBe(
      "/embed/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&theme=graphite&size=compact",
    );
  });

  it("builds absolute track embed URLs", () => {
    expect(buildTrackEmbedUrl(makeTrack(), { theme: "graphite", size: "compact" })).toBe(
      "https://knobb.netlify.app/embed/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&theme=graphite&size=compact",
    );
  });

  it("builds iframe code using the selected embed size", () => {
    expect(
      buildTrackEmbedCode("https://knobb.netlify.app/embed/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&theme=graphite&size=compact", {
        title: "Track - Artist • Knobb",
        height: TRACK_EMBED_SIZES.compact.height,
      }),
    ).toContain(`height="${TRACK_EMBED_SIZES.compact.height}"`);
  });
});
