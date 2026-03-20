import { describe, expect, it } from "vitest";
import {
  buildTrackSharePath,
  buildTrackAlbumPath,
  buildTrackShareUrl,
  buildTrackSourceUrl,
  buildTrackUri,
  getTrackShareIdentifier,
} from "@/lib/mediaNavigation";
import type { Track } from "@/types/music";

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

describe("mediaNavigation track sharing", () => {
  it("builds album routes for track-driven navigation", () => {
    expect(buildTrackAlbumPath(makeTrack())).toBe("/album/tidal-456?title=Album&artist=Artist");
    expect(buildTrackAlbumPath(makeTrack({ albumId: undefined }))).toBeNull();
  });

  it("builds dedicated track share paths with a stable track id and redirect target", () => {
    expect(buildTrackSharePath(makeTrack())).toBe(
      "/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&redirect=%2Falbum%2Ftidal-456%3Ftitle%3DAlbum%26artist%3DArtist%26trackId%3Dtidal-123",
    );
  });

  it("uses the mix route as the share destination when no album route is available", () => {
    expect(
      buildTrackSharePath(
        makeTrack({
          albumId: undefined,
          mixes: { TRACK_MIX: "focus-mix" },
          title: "Heat Wave",
          artist: "Neon Echo",
          coverUrl: "/wave.jpg",
        }),
      ),
    ).toBe(
      "/track/tidal-123?title=Heat+Wave&artist=Neon+Echo&album=Album&cover=%2Fwave.jpg&redirect=%2Fmix%2Ffocus-mix%3Ftitle%3DHeat%2BWave%26artist%3DNeon%2BEcho%26cover%3D%252Fwave.jpg",
    );
  });

  it("uses a crawler-friendly share route that redirects to the embed player", () => {
    expect(buildTrackShareUrl(makeTrack())).toBe(
      "https://knobb.netlify.app/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&redirect=%2Fembed%2Ftrack%2Ftidal-123%3Ftitle%3DTrack%26artist%3DArtist%26album%3DAlbum%26cover%3D%252Fcover.jpg",
    );
  });

  it("keeps a source route for opening the track inside Knobb", () => {
    expect(buildTrackSourceUrl(makeTrack())).toBe(
      "https://knobb.netlify.app/track/tidal-123?title=Track&artist=Artist&album=Album&cover=%2Fcover.jpg&redirect=%2Falbum%2Ftidal-456%3Ftitle%3DAlbum%26artist%3DArtist%26trackId%3Dtidal-123",
    );
  });

  it("builds track URIs for both tidal and local tracks", () => {
    expect(buildTrackUri(makeTrack())).toBe("knobb:track:tidal:123");
    expect(buildTrackUri(makeTrack({ id: "local-1", tidalId: undefined, localFileId: "local-file-9" }))).toBe(
      "knobb:track:local:local-file-9",
    );
  });

  it("exposes the same stable share identifier used by album deep links", () => {
    expect(getTrackShareIdentifier(makeTrack({ id: "tidal-123-7", tidalId: undefined }))).toBe("tidal-123");
  });
});
