import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("youtubei.js", () => ({
  Innertube: {
    create: createMock,
  },
}));

describe("youtubeMusicProxy search normalization", () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.resetModules();
    delete process.env.YTMUSIC_COOKIE;
    delete process.env.YTMUSIC_VISITOR_DATA;
    delete process.env.YTMUSIC_PO_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps video search results when youtubei.js only exposes endpoint payload videoId", async () => {
    const baseSearch = {
      contents: [],
      filters: ["Songs", "Videos"],
      applyFilter: vi.fn(async (filter: string) => {
        if (filter === "Videos") {
          return {
            results: [
              {
                item_type: "video",
                endpoint: {
                  payload: {
                    videoId: "mv-123",
                  },
                },
                title: "Girl Official Video",
                authors: [{ name: "Artist Example", channel_id: "UC123" }],
                duration: { text: "3:45", seconds: 225 },
                thumbnails: [
                  {
                    url: "https://lh3.googleusercontent.com/example=w60-h60-l90-rj",
                    width: 60,
                    height: 60,
                  },
                ],
              },
            ],
          };
        }

        if (filter === "Songs") {
          return { results: [] };
        }

        return null;
      }),
    };

    createMock.mockResolvedValue({
      music: {
        search: vi.fn().mockResolvedValue(baseSearch),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "search",
        q: "girl",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      retrieve_player: false,
    }));

    const payload = JSON.parse(response.body);
    expect(payload.data.videos).toHaveLength(1);
    expect(payload.data.videos[0]).toMatchObject({
      id: "ytm-mv-123",
      sourceId: "mv-123",
      title: "Girl Official Video",
      artist: "Artist Example",
      isVideo: true,
      coverUrl: "https://lh3.googleusercontent.com/example=w1200-h1200-l90-rj",
    });
  });

  it("matches newer track and music video filter labels instead of requiring the legacy names", async () => {
    const applyFilter = vi.fn(async (filter: string) => {
      if (filter === "Tracks") {
        return {
          results: [
            {
              item_type: "song",
              id: "track-123",
              title: "Phul Futeche",
              artists: [{ name: "Artist Example", id: "UC123" }],
              duration: { text: "4:02", seconds: 242 },
            },
          ],
        };
      }

      if (filter === "Music videos") {
        return {
          results: [
            {
              item_type: "video",
              endpoint: {
                payload: {
                  videoId: "video-456",
                },
              },
              title: "Phul Futeche Live",
              authors: [{ name: "Artist Example", channel_id: "UC123" }],
              duration: { text: "4:40", seconds: 280 },
            },
          ],
        };
      }

      return { results: [] };
    });

    createMock.mockResolvedValue({
      music: {
        search: vi.fn().mockResolvedValue({
          contents: [],
          filters: ["Tracks", "Music videos", "Playlists"],
          applyFilter,
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "search",
        q: "phul futeche",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(applyFilter).toHaveBeenCalledWith("Tracks");
    expect(applyFilter).toHaveBeenCalledWith("Music videos");

    const payload = JSON.parse(response.body);
    expect(payload.data.tracks).toHaveLength(1);
    expect(payload.data.videos).toHaveLength(1);
    expect(payload.data.tracks[0]).toMatchObject({
      id: "ytm-track-123",
      sourceId: "track-123",
      title: "Phul Futeche",
      isVideo: false,
    });
    expect(payload.data.videos[0]).toMatchObject({
      id: "ytm-video-456",
      sourceId: "video-456",
      title: "Phul Futeche Live",
      isVideo: true,
    });
  });

  it("ignores malformed runtime cookie values so search still works", async () => {
    process.env.YTMUSIC_COOKIE = "SAPISID=abc…def";

    createMock.mockResolvedValue({
      music: {
        search: vi.fn().mockResolvedValue({
          contents: [],
          filters: [],
          applyFilter: vi.fn(async () => null),
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "search",
        q: "bela sheshe",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      cookie: undefined,
      retrieve_player: false,
    }));
  });

  it("prefers the DASH manifest for best-available video playback so the top adaptive stream stays available", async () => {
    createMock.mockResolvedValue({
      music: {
        getInfo: vi.fn().mockResolvedValue({
          streaming_data: {
            hls_manifest_url: "https://example.com/video.m3u8",
            dash_manifest_url: "https://example.com/video.mpd",
          },
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "video-playback",
        id: "mv-123",
        quality: "auto",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      retrieve_player: true,
    }));
    expect(JSON.parse(response.body)).toEqual({
      data: {
        url: "https://example.com/video.mpd",
        type: "dash",
      },
    });
  });

  it("keeps the lower-latency HLS preference for explicitly capped 720p playback", async () => {
    createMock.mockResolvedValue({
      music: {
        getInfo: vi.fn().mockResolvedValue({
          streaming_data: {
            hls_manifest_url: "https://example.com/video.m3u8",
            dash_manifest_url: "https://example.com/video.mpd",
          },
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "video-playback",
        id: "mv-123",
        quality: "720p",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      data: {
        url: "https://example.com/video.m3u8",
        type: "hls",
      },
    });
  });

  it("prefers AVC video tracks over AV1 when building split direct playback", async () => {
    const { buildSplitDirectPlaybackSource, buildYtDlpVideoFormatSelector } = await import("../../server/youtubeMusicProxy.js");

    expect(buildYtDlpVideoFormatSelector("AUTO")).not.toContain("height<=");
    expect(buildYtDlpVideoFormatSelector("1080P")).toContain("bestvideo[vcodec^=avc1][height<=1080]+bestaudio");

    const resolved = buildSplitDirectPlaybackSource({
      requested_formats: [
        {
          url: "https://example.com/video-av1.mp4",
          ext: "mp4",
          height: 1080,
          tbr: 900,
          vcodec: "av01.0.08M.08",
          acodec: "none",
        },
        {
          url: "https://example.com/video-avc.mp4",
          ext: "mp4",
          height: 1080,
          tbr: 750,
          vcodec: "avc1.640028",
          acodec: "none",
        },
        {
          url: "https://example.com/audio.m4a",
          ext: "m4a",
          abr: 128,
          vcodec: "none",
          acodec: "mp4a.40.2",
        },
        {
          url: "https://example.com/audio.webm",
          ext: "webm",
          abr: 251,
          vcodec: "none",
          acodec: "opus",
        },
      ],
    });

    expect(resolved).toEqual({
      availableAudioQualityLabels: ["Opus 251 kbps", "AAC 128 kbps"],
      url: "https://example.com/video-avc.mp4",
      audioUrl: "https://example.com/audio.webm",
      audioQualityLabel: "Opus 251 kbps",
      videoHeight: 1080,
      type: "direct",
    });
  });

  it("rewrites direct audio playback into same-origin proxy endpoints for the browser", async () => {
    const { buildBrowserPlaybackSource } = await import("../../server/youtubeMusicProxy.js");

    expect(buildBrowserPlaybackSource("abc123", {
      audioQualityLabel: "AAC 128 kbps",
      url: "https://rr1---sn-example.googlevideo.com/videoplayback?id=abc123&itag=140",
      type: "direct",
    }, {
      preferVideo: false,
      quality: "high",
    })).toEqual({
      audioQualityLabel: "AAC 128 kbps",
      url: "/api/youtube-music?action=stream&id=abc123&quality=HIGH",
      type: "direct",
    });
  });

  it("rewrites split direct video playback into same-origin proxy endpoints for the browser", async () => {
    const { buildBrowserPlaybackSource } = await import("../../server/youtubeMusicProxy.js");

    expect(buildBrowserPlaybackSource("mv123", {
      availableAudioQualityLabels: ["Opus 251 kbps", "AAC 128 kbps"],
      audioQualityLabel: "Opus 251 kbps",
      url: "https://rr1---sn-example.googlevideo.com/videoplayback?id=mv123&itag=137",
      audioUrl: "https://rr1---sn-example.googlevideo.com/videoplayback?id=mv123&itag=251",
      fallbackUrl: "https://rr1---sn-example.googlevideo.com/videoplayback?id=mv123&itag=18",
      videoHeight: 1080,
      fallbackVideoHeight: 360,
      type: "direct",
    }, {
      preferVideo: true,
      quality: "1080p",
    })).toEqual({
      availableAudioQualityLabels: ["Opus 251 kbps", "AAC 128 kbps"],
      audioQualityLabel: "Opus 251 kbps",
      url: "/api/youtube-music?action=video-stream&id=mv123&quality=1080P",
      audioUrl: "/api/youtube-music?action=video-audio-stream&id=mv123&quality=1080P",
      fallbackUrl: "/api/youtube-music?action=video-fallback-stream&id=mv123&quality=1080P",
      videoHeight: 1080,
      fallbackVideoHeight: 360,
      type: "direct",
    });
  });

  it("prefers native YouTube Music lyrics and skips the LewdHuTao fallback when native lyrics exist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    createMock.mockResolvedValue({
      music: {
        getLyrics: vi.fn().mockResolvedValue({
          description: "[00:12.00]Native line",
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "lyrics",
        id: "native-123",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(response.body)).toEqual({
      data: {
        lines: [
          { time: 12, text: "Native line" },
        ],
        provider: "YouTube Music",
        sourceLabel: "YouTube Music",
        sourceHost: "music.youtube.com",
        isSynced: true,
        isRightToLeft: false,
        rawLyrics: "[00:12.00]Native line",
        rawSubtitles: "[00:12.00]Native line",
      },
    });
  });

  it("falls back to LewdHuTao lyrics API when native YouTube Music lyrics are unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        artistName: "Example Artist",
        trackName: "Example Song",
        trackId: "fallback-123",
        searchEngine: "YouTube",
        artworkUrl: "https://example.com/art.jpg",
        lyrics: "Fallback line 1\nFallback line 2",
      },
      metadata: {
        apiVersion: "2.0",
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    createMock.mockResolvedValue({
      music: {
        getLyrics: vi.fn().mockResolvedValue({
          description: "",
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "lyrics",
        id: "fallback-123",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("https://lyrics.lewdhutao.my.eu.org/v2/youtube/lyrics");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("trackId=fallback-123");
    expect(JSON.parse(response.body)).toEqual({
      data: {
        lines: [
          { time: 0, text: "Fallback line 1" },
          { time: 4, text: "Fallback line 2" },
        ],
        provider: "LewdHuTao Lyrics API",
        sourceLabel: "LewdHuTao Lyrics API",
        sourceHost: "lyrics.lewdhutao.my.eu.org",
        isSynced: false,
        isRightToLeft: false,
        rawLyrics: "Fallback line 1\nFallback line 2",
        rawSubtitles: null,
      },
    });
  });

  it("prefers synced LRCLIB lyrics over unsynced native YouTube Music lyrics when track metadata is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      syncedLyrics: "[00:17.66] যদি ফেলে দিতে বলে\n[00:20.36] ঘোলা জলে কোলা তুলি",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    createMock.mockResolvedValue({
      music: {
        getLyrics: vi.fn().mockResolvedValue({
          description: "যদি ফেলে দিতে বলে\nঘোলা জলে কোলা তুলি",
        }),
      },
    });

    const { handleYoutubeMusicProxyEvent } = await import("../../server/youtubeMusicProxy.js");
    const response = await handleYoutubeMusicProxyEvent({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        action: "lyrics",
        id: "JPp4Urgfs0U",
        title: "Benche Thakar Gaan",
        artist: "Anupam Roy, Rupam Islam",
        album: "Autograph (Original Soundtrack)",
        duration: "254",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("https://lrclib.net/api/get"))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("track_name=Benche+Thakar+Gaan"))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("lyrics.lewdhutao.my.eu.org"))).toBe(false);
    expect(JSON.parse(response.body)).toEqual({
      data: {
        lines: [
          { time: 17.66, text: "যদি ফেলে দিতে বলে" },
          { time: 20.36, text: "ঘোলা জলে কোলা তুলি" },
        ],
        provider: "LRCLIB",
        sourceLabel: "LRCLIB",
        sourceHost: "lrclib.net",
        isSynced: true,
        isRightToLeft: false,
        rawLyrics: "[00:17.66] যদি ফেলে দিতে বলে\n[00:20.36] ঘোলা জলে কোলা তুলি",
        rawSubtitles: "[00:17.66] যদি ফেলে দিতে বলে\n[00:20.36] ঘোলা জলে কোলা তুলি",
      },
    });
  });
});
