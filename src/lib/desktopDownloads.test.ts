import { describe, expect, it } from "vitest";

import {
  detectDesktopDownloadPlatform,
  formatDesktopPlatform,
  isDesktopDownloadRecommended,
} from "@/lib/desktopDownloads";

describe("desktopDownloads", () => {
  it("detects Windows user agents", () => {
    expect(
      detectDesktopDownloadPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe("windows");
  });

  it("detects macOS user agents", () => {
    expect(
      detectDesktopDownloadPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"),
    ).toBe("macos");
  });

  it("falls back to other platforms", () => {
    expect(
      detectDesktopDownloadPlatform("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"),
    ).toBe("other");
  });

  it("flags only the matching button as recommended", () => {
    expect(isDesktopDownloadRecommended("macos", "macos")).toBe(true);
    expect(isDesktopDownloadRecommended("windows", "windows")).toBe(true);
    expect(isDesktopDownloadRecommended("macos", "windows")).toBe(false);
  });

  it("formats desktop runtime platform labels", () => {
    expect(formatDesktopPlatform("darwin")).toBe("macOS");
    expect(formatDesktopPlatform("win32")).toBe("Windows");
    expect(formatDesktopPlatform("linux")).toBe("Desktop");
  });
});
