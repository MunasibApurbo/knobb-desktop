import { getPlaybackDeviceName } from "@/lib/playbackSessions";

describe("getPlaybackDeviceName", () => {
  const originalKnobbDesktop = window.knobbDesktop;
  const originalNavigatorPlatform = navigator.platform;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    window.knobbDesktop = originalKnobbDesktop;
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: originalNavigatorPlatform,
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it("prefers the desktop bridge name inside Knobb Desktop", () => {
    window.knobbDesktop = {
      isDesktopApp: true,
      platform: "darwin",
      getLaunchTarget: vi.fn().mockResolvedValue(null),
      openExternal: vi.fn().mockResolvedValue(true),
    };

    expect(getPlaybackDeviceName()).toBe("Knobb Desktop on Mac");
  });

  it("falls back to Electron user agent detection when the desktop bridge is unavailable", () => {
    delete window.knobbDesktop;
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 AppleWebKit/537.36 Chrome/136.0.0.0 Electron/35.0.0 Safari/537.36",
    });

    expect(getPlaybackDeviceName()).toBe("Knobb Desktop on Mac");
  });
});
