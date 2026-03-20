import { describe, expect, it } from "vitest";

import { filterPlayableTracks, getTrackPlaybackIssue, isTrackPlayable } from "@/lib/trackPlayback";
import type { Track } from "@/types/music";

const baseTrack: Track = {
  id: "track-1",
  title: "Track",
  artist: "Artist",
  album: "Album",
  duration: 180,
  year: 2024,
  coverUrl: "/cover.jpg",
  canvasColor: "24 90% 60%",
};

describe("track playback helpers", () => {
  it("treats normal audio tracks as playable", () => {
    expect(isTrackPlayable(baseTrack)).toBe(true);
    expect(getTrackPlaybackIssue(baseTrack)).toBeNull();
  });

  it("flags only unavailable tracks", () => {
    expect(getTrackPlaybackIssue({ ...baseTrack, isUnavailable: true })).toBe("unavailable");
    expect(getTrackPlaybackIssue({ ...baseTrack, isVideo: true })).toBeNull();
  });

  it("filters only unavailable tracks from queues and recommendations", () => {
    const tracks = [
      baseTrack,
      { ...baseTrack, id: "track-2", isUnavailable: true },
      { ...baseTrack, id: "track-3", isVideo: true },
    ];

    expect(filterPlayableTracks(tracks)).toEqual([
      baseTrack,
      { ...baseTrack, id: "track-3", isVideo: true },
    ]);
  });
});
