import { describe, expect, it } from "vitest";

import {
  KNOBB_COMPANION_MAC_DOWNLOAD_URL,
  KNOBB_COMPANION_WINDOWS_DOWNLOAD_URL,
  KNOBB_DESKTOP_REPO_URL,
  KNOBB_MAC_DOWNLOAD_URL,
  KNOBB_RELEASES_URL,
  KNOBB_WINDOWS_DOWNLOAD_URL,
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

  it("keeps the desktop repo and latest-release links on GitHub", () => {
    expect(KNOBB_RELEASES_URL).toContain("github.com/MunasibApurbo/knobb-desktop/releases/latest");
    expect(KNOBB_DESKTOP_REPO_URL).toBe("https://github.com/MunasibApurbo/knobb-desktop");
  });

  it("keeps both desktop app download links on the latest release", () => {
    expect(KNOBB_MAC_DOWNLOAD_URL).toContain("/releases/latest/download/Knobb-Desktop-macOS.dmg");
    expect(KNOBB_WINDOWS_DOWNLOAD_URL).toContain("/releases/latest/download/Knobb-Desktop-Setup.exe");
    expect(KNOBB_COMPANION_MAC_DOWNLOAD_URL).toContain("/releases/latest/download/Knobb-Discord-Companion-macOS.dmg");
    expect(KNOBB_COMPANION_WINDOWS_DOWNLOAD_URL).toContain("/releases/latest/download/Knobb-Discord-Companion-Setup.exe");
  });
});
