import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMediaPlaybackPrimerForTests, primeMediaPlayback } from "@/lib/mediaPlaybackPrimer";

class FakeMediaElement {
  preload = "";
  volume = 1;
  muted = false;
  src = "";
  playsInline = false;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  removeAttribute = vi.fn();
  load = vi.fn();
}

describe("mediaPlaybackPrimer", () => {
  beforeEach(() => {
    __resetMediaPlaybackPrimerForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts primer playback synchronously so the caller keeps the user gesture", () => {
    const created: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const element = new FakeMediaElement();
        created.push(element);
        return element as unknown as HTMLElement;
      }

      throw new Error(`Unexpected tag requested in test: ${tagName}`);
    });

    void primeMediaPlayback();

    expect(created).toHaveLength(2);
    expect(created.every((element) => element.play.mock.calls.length === 1)).toBe(true);
  });
});
