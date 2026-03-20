import { describe, expect, it } from "vitest";

import { isTrackUnavailable, type SourceTrack } from "@/lib/musicCoreShared";

const baseTrack: SourceTrack = {
  id: 1,
  title: "Track",
  duration: 180,
};

describe("musicCoreShared.isTrackUnavailable", () => {
  it("does not reject streamable catalog tracks just because browse flags are false", () => {
    expect(isTrackUnavailable({
      ...baseTrack,
      allowStreaming: false,
      streamReady: false,
    })).toBe(false);
  });

  it("still rejects explicitly unavailable tracks", () => {
    expect(isTrackUnavailable({
      ...baseTrack,
      isUnavailable: true,
    })).toBe(true);
  });

  it("still rejects placeholder unavailable titles", () => {
    expect(isTrackUnavailable({
      ...baseTrack,
      title: "Unavailable",
    })).toBe(true);
  });
});
