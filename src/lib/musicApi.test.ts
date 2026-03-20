import { beforeEach, describe, expect, it, vi } from "vitest";

const musicCoreMocks = vi.hoisted(() => ({
  clearCaches: vi.fn(),
  getLatencySnapshot: vi.fn(() => []),
  getTrackMetadata: vi.fn(),
  getTrack: vi.fn(),
  getVideo: vi.fn(),
  invalidateTrackStream: vi.fn(),
}));

vi.mock("@/lib/musicCore", () => ({
  API_INSTANCE_POOL: [],
  STREAMING_INSTANCE_POOL: [],
  musicCore: musicCoreMocks,
}));

import {
  clearMusicApiCache,
  getPlaybackSource,
  getPlaybackSourceWithQuality,
  getTrackInfo,
  getVideoPlaybackSource,
  invalidateTrackStreamCache,
} from "@/lib/musicApi";

const tidalDirectApiMocks = vi.hoisted(() => ({
  fetchOfficialTidalAlbum: vi.fn(),
  fetchOfficialTidalArtist: vi.fn(),
  fetchOfficialTidalPlaylist: vi.fn(),
  fetchOfficialTidalTrack: vi.fn(),
  fetchOfficialTidalVideo: vi.fn(),
}));

vi.mock("@/lib/tidalDirectApi", () => tidalDirectApiMocks);

describe("musicApi playback source resolution", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
    musicCoreMocks.clearCaches.mockReset();
    musicCoreMocks.getLatencySnapshot.mockReset();
    musicCoreMocks.getLatencySnapshot.mockReturnValue([]);
    musicCoreMocks.getTrackMetadata.mockReset();
    musicCoreMocks.getTrack.mockReset();
    musicCoreMocks.getVideo.mockReset();
    musicCoreMocks.invalidateTrackStream.mockReset();
    tidalDirectApiMocks.fetchOfficialTidalAlbum.mockReset();
    tidalDirectApiMocks.fetchOfficialTidalArtist.mockReset();
    tidalDirectApiMocks.fetchOfficialTidalPlaylist.mockReset();
    tidalDirectApiMocks.fetchOfficialTidalTrack.mockReset();
    tidalDirectApiMocks.fetchOfficialTidalVideo.mockReset();
    clearMusicApiCache();
  });

  it("decodes single-url video manifests using the outer manifest mime type", async () => {
    musicCoreMocks.getVideo.mockResolvedValue({
      info: {
        manifest: btoa(JSON.stringify({ url: "https://example.com/video/master" })),
        manifestMimeType: "application/vnd.apple.mpegurl",
      },
    });

    const source = await getVideoPlaybackSource(123);

    expect(source).toEqual({
      type: "hls",
      url: "https://example.com/video/master",
    });
  });

  it("decodes single-url audio manifests using the outer manifest mime type", async () => {
    musicCoreMocks.getTrack.mockResolvedValue({
      info: {
        manifest: btoa(JSON.stringify({ url: "https://example.com/audio/master" })),
        manifestMimeType: "application/dash+xml",
      },
    });

    const source = await getPlaybackSource(456, "HIGH");

    expect(source).toEqual({
      type: "dash",
      url: "https://example.com/audio/master",
    });
  });

  it("reports the actual tidal quality attempt that resolved", async () => {
    musicCoreMocks.getTrack.mockResolvedValue({
      info: {
        manifest: btoa(JSON.stringify({ url: "https://example.com/audio/lossless" })),
        manifestMimeType: "application/dash+xml",
      },
    });

    const resolution = await getPlaybackSourceWithQuality(456, "LOSSLESS");

    expect(musicCoreMocks.getTrack).toHaveBeenCalledWith(456, "LOSSLESS");
    expect(resolution).toEqual({
      capability: null,
      quality: "LOSSLESS",
      source: {
        type: "dash",
        url: "https://example.com/audio/lossless",
      },
    });
  });

  it("invalidates cached video playback sources on forced refresh", async () => {
    musicCoreMocks.getVideo
      .mockResolvedValueOnce({
        info: {
          manifest: btoa(JSON.stringify({ url: "https://example.com/video/first.m3u8" })),
          manifestMimeType: "application/vnd.apple.mpegurl",
        },
      })
      .mockResolvedValueOnce({
        info: {
          manifest: btoa(JSON.stringify({ url: "https://example.com/video/second.m3u8" })),
          manifestMimeType: "application/vnd.apple.mpegurl",
        },
      });

    const firstSource = await getVideoPlaybackSource(789);
    invalidateTrackStreamCache(789);
    const refreshedSource = await getVideoPlaybackSource(789);

    expect(firstSource).toEqual({
      type: "hls",
      url: "https://example.com/video/first.m3u8",
    });
    expect(musicCoreMocks.invalidateTrackStream).toHaveBeenCalledWith(789);
    expect(musicCoreMocks.getVideo).toHaveBeenCalledTimes(2);
    expect(refreshedSource).toEqual({
      type: "hls",
      url: "https://example.com/video/second.m3u8",
    });
  });

  it("rethrows the last audio resolution error when all quality attempts fail", async () => {
    musicCoreMocks.getTrack.mockRejectedValue(new Error("https://example.com authentication failed"));

    await expect(getPlaybackSourceWithQuality(456, "HIGH")).rejects.toThrow("authentication failed");
  });

  it("rethrows the last video resolution error instead of masking it as null", async () => {
    musicCoreMocks.getVideo.mockRejectedValue(new Error("No Tidal credentials available; populate token.json"));

    await expect(getVideoPlaybackSource(789)).rejects.toThrow("No Tidal credentials available");
  });

  it("falls back to the official video endpoint when track metadata lookup misses", async () => {
    tidalDirectApiMocks.fetchOfficialTidalTrack.mockRejectedValue(new Error("Track not found"));
    musicCoreMocks.getTrackMetadata.mockRejectedValue(new Error("Track metadata not found"));
    tidalDirectApiMocks.fetchOfficialTidalVideo.mockResolvedValue({
      id: 162539696,
      title: "Prisoner",
      type: "Music Video",
      duration: 180,
      imageId: "video-image-id",
      artist: { id: 10, name: "Miley Cyrus" },
      artists: [{ id: 10, name: "Miley Cyrus", type: "MAIN" }],
      album: { id: 20, title: "Plastic Hearts", cover: "album-cover-id" },
    });

    const track = await getTrackInfo(162539696);

    expect(tidalDirectApiMocks.fetchOfficialTidalVideo).toHaveBeenCalledWith(162539696);
    expect(track).toMatchObject({
      id: 162539696,
      title: "Prisoner",
      isVideo: true,
      imageId: "video-image-id",
    });
  });
});
