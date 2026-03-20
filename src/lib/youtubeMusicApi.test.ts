import { afterEach, describe, expect, it, vi } from "vitest";

import { getYoutubeMusicLyrics, getYoutubeMusicVideoPlaybackSource, searchYoutubeMusicReference } from "@/lib/youtubeMusicApi";

describe("youtubeMusicApi", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("surfaces an error when the API route returns HTML", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue(new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(searchYoutubeMusicReference("girls")).rejects.toThrow(
      "YouTube Music proxy returned HTML instead of JSON from /api/youtube-music",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/youtube-music");
  });

  it("surfaces a network error when the API route request fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    vi.stubGlobal("fetch", fetchMock);

    await expect(searchYoutubeMusicReference("charli xcx")).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/youtube-music");
  });

  it("passes the selected fixed video quality preference to the proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        url: "https://example.com/video.m3u8",
        type: "hls",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }));

    vi.stubGlobal("fetch", fetchMock);

    await getYoutubeMusicVideoPlaybackSource("abc123", "1080p");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("action=video-playback");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("quality=1080p");
  });

  it("passes lyrics lookup metadata to the proxy so server-side synced fallbacks can match the track", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }));

    vi.stubGlobal("fetch", fetchMock);

    await getYoutubeMusicLyrics({
      id: "JPp4Urgfs0U",
      title: "Benche Thakar Gaan",
      artist: "Anupam Roy, Rupam Islam",
      album: "Autograph (Original Soundtrack)",
      duration: 254,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("action=lyrics");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("id=JPp4Urgfs0U");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("title=Benche+Thakar+Gaan");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("artist=Anupam+Roy%2C+Rupam+Islam");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("album=Autograph+%28Original+Soundtrack%29");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("duration=254");
  });

  it("times out a stalled API route", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);

      if (requestUrl.includes("/api/youtube-music")) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }

      return Promise.reject(new Error(`Unexpected fallback request for ${requestUrl}`));
    });

    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = searchYoutubeMusicReference("fka twigs");
    const rejectionExpectation = expect(resultPromise).rejects.toThrow(
      "YouTube Music request timed out for /api/youtube-music",
    );
    await vi.advanceTimersByTimeAsync(15000);

    await rejectionExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/youtube-music");
  });
});
