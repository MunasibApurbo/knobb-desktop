import { describe, expect, it } from "vitest";

import { getNextQueueIndex, getPreviousQueueIndex } from "@/contexts/player/playerQueue";
import type { Track } from "@/types/music";

function buildTrack(id: string): Track {
  return {
    id,
    title: id,
    artist: "Artist",
    album: "Album",
    duration: 180,
    year: 2024,
    coverUrl: "https://example.com/cover.jpg",
    canvasColor: "0 0% 0%",
  };
}

describe("playerQueue boundaries", () => {
  const queue = [buildTrack("track-1"), buildTrack("track-2"), buildTrack("track-3")];

  it("does not wrap to the first track by default when advancing from the end", () => {
    expect(getNextQueueIndex(queue, queue[2], false)).toBeNull();
  });

  it("wraps to the first track when explicitly allowed", () => {
    expect(getNextQueueIndex(queue, queue[2], false, { wrap: true })).toBe(0);
  });

  it("does not wrap to the last track by default when moving backward from the start", () => {
    expect(getPreviousQueueIndex(queue, queue[0])).toBeNull();
  });

  it("wraps to the last track when explicitly allowed", () => {
    expect(getPreviousQueueIndex(queue, queue[0], { wrap: true })).toBe(2);
  });
});
