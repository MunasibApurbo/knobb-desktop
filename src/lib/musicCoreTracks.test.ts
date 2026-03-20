import { describe, expect, it, vi } from "vitest";

import { getVideo } from "@/lib/musicCoreTracks";

describe("musicCoreTracks.getVideo", () => {
  it("finds nested video manifest fields in streaming payloads", async () => {
    const cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const requestJson = vi.fn().mockResolvedValue({
      data: {
        id: 162539696,
        title: "Prisoner (feat. Dua Lipa) (Official Video)",
        duration: 194,
        type: "Music Video",
        artists: [{ id: 33236, name: "Miley Cyrus" }],
        playback: {
          manifest: btoa(JSON.stringify({ url: "https://example.com/video/master.m3u8" })),
          manifestMimeType: "application/vnd.apple.mpegurl",
          OriginalTrackUrl: "https://example.com/video/master.m3u8",
        },
      },
    });

    const lookup = await getVideo(
      {
        cache,
        requestJson,
        streamCache: new Map(),
        getTrack: vi.fn(),
      },
      162539696,
    );

    expect(requestJson).toHaveBeenCalledWith("/video/?id=162539696", { type: "streaming" });
    expect(lookup.info).toEqual({
      manifest: btoa(JSON.stringify({ url: "https://example.com/video/master.m3u8" })),
      manifestMimeType: "application/vnd.apple.mpegurl",
      trackId: 162539696,
    });
    expect(lookup.originalTrackUrl).toBe("https://example.com/video/master.m3u8");
  });
});
