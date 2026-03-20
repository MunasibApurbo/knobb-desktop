import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetPlaybackWarmupForTests, warmPlaybackOrigin } from "@/lib/playbackWarmup";

describe("playbackWarmup", () => {
  beforeEach(() => {
    __resetPlaybackWarmupForTests();
    document.head.innerHTML = "";
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("adds warmup hints for remote playback origins", () => {
    warmPlaybackOrigin("https://rr1---sn.example.googlevideo.com/videoplayback?id=123");

    expect(
      document.head.querySelector('link[rel="dns-prefetch"][href="https://rr1---sn.example.googlevideo.com"]'),
    ).not.toBeNull();
    expect(
      document.head.querySelector('link[rel="preconnect"][href="https://rr1---sn.example.googlevideo.com"]'),
    ).not.toBeNull();
  });

  it("ignores non-network playback urls", () => {
    warmPlaybackOrigin("blob:https://knobb.test/123");
    warmPlaybackOrigin("data:audio/mp4;base64,AAAA");

    expect(document.head.querySelector('link[rel="preconnect"]')).toBeNull();
    expect(document.head.querySelector('link[rel="dns-prefetch"]')).toBeNull();
  });

  it("does not duplicate warmup hints for the same origin", () => {
    warmPlaybackOrigin("https://media.example.com/track-1.m3u8");
    warmPlaybackOrigin("https://media.example.com/track-2.m3u8");

    expect(
      document.head.querySelectorAll('link[rel="preconnect"][href="https://media.example.com"]'),
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('link[rel="dns-prefetch"][href="https://media.example.com"]'),
    ).toHaveLength(1);
  });
});
