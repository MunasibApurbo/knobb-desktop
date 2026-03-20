import { describe, expect, it } from "vitest";

import {
  buildDesktopProxyTargetUrl,
  getDesktopBackendOrigin,
  shouldHandleDesktopRequestLocally,
  shouldProxyDesktopRequestPath,
} from "../../desktop/knobb/server-routing.mjs";

describe("desktop server routing", () => {
  it("keeps the desktop YouTube Music proxy local to the app shell", () => {
    expect(shouldHandleDesktopRequestLocally("/api/youtube-music")).toBe(true);
    expect(shouldHandleDesktopRequestLocally("/.netlify/functions/youtube-music-proxy")).toBe(true);
    expect(shouldHandleDesktopRequestLocally("/api/audio-proxy")).toBe(false);
  });

  it("proxies backend and function endpoints from the bundled desktop shell", () => {
    expect(shouldProxyDesktopRequestPath("/api/youtube-music")).toBe(true);
    expect(shouldProxyDesktopRequestPath("/api/audio-proxy")).toBe(true);
    expect(shouldProxyDesktopRequestPath("/.netlify/functions/unreleased-proxy")).toBe(true);
    expect(shouldProxyDesktopRequestPath("/app")).toBe(false);
    expect(shouldProxyDesktopRequestPath("/assets/index-abc123.js")).toBe(false);
  });

  it("prefers configured site origins and normalizes them to a backend origin", () => {
    expect(getDesktopBackendOrigin({
      envSiteUrl: "",
      configuredSiteUrl: "https://preview.knobb.example.com/app?foo=bar",
    })).toBe("https://preview.knobb.example.com");

    expect(getDesktopBackendOrigin({
      envSiteUrl: "https://env.knobb.example.com/desktop",
      configuredSiteUrl: "https://config.knobb.example.com",
    })).toBe("https://env.knobb.example.com");
  });

  it("preserves the original backend request path and query when building proxy targets", () => {
    const requestUrl = new URL("http://127.0.0.1:32146/api/youtube-music?action=stream&id=abc123&quality=HIGH");

    expect(buildDesktopProxyTargetUrl(requestUrl, "https://knobb.netlify.app")).toBe(
      "https://knobb.netlify.app/api/youtube-music?action=stream&id=abc123&quality=HIGH",
    );
  });
});
