import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearArtistGridCache,
  fetchArtistGridArtists,
  fetchArtistGridTracker,
} from "@/lib/unreleasedArchiveApi";

describe("unreleasedArchiveApi", () => {
  afterEach(() => {
    clearArtistGridCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to the Netlify function path when the API route returns HTML for artists", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }))
      .mockResolvedValueOnce(new Response(
        '{ "name": "Drake", "url": "https://docs.google.com/spreadsheets/d/1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI/edit", "credit": "crew", "links_work": 1, "updated": 1, "best": true }\n',
        {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        },
      ));

    vi.stubGlobal("fetch", fetchMock);

    const artists = await fetchArtistGridArtists();

    expect(artists).toHaveLength(1);
    expect(artists[0]).toMatchObject({
      name: "Drake",
      cleanName: "Drake",
      credit: "crew",
      isLinkWorking: true,
      isUpdated: true,
      isStarred: true,
      sheetId: "1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI",
    });
    expect(artists[0]?.imageUrl).toContain("https://assets.artistgrid.cx/drake.webp");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unreleased?resource=artists");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/.netlify/functions/unreleased-proxy?resource=artists");
  });

  it("passes the selected tracker tab through the fallback proxy request", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: "Drake Tracker",
        tabs: ["Unreleased", "Best Of"],
        current_tab: "Best Of",
        eras: {
          "Best Of": {
            name: "Best Of",
            data: {
              Default: [{ name: "Track 1", urls: ["https://example.com/file.mp3"] }],
            },
          },
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchArtistGridTracker("1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI", "Best Of");

    expect(result.current_tab).toBe("Best Of");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/unreleased?resource=tracker");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/.netlify/functions/unreleased-proxy?resource=tracker");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("sheetId=1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("tab=Best+Of");
  });
});
