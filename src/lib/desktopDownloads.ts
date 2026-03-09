export const KNOBB_MAC_DOWNLOAD_URL = "https://github.com/MunasibApurbo/knobb-desktop/releases/latest/download/Knobb-Desktop-macOS.dmg";
export const KNOBB_WINDOWS_DOWNLOAD_URL = "https://github.com/MunasibApurbo/knobb-desktop/releases/latest/download/Knobb-Desktop-Setup.exe";
export const KNOBB_RELEASES_URL = "https://github.com/MunasibApurbo/knobb-desktop/releases/latest";

export type DesktopDownloadPlatform = "macos" | "windows" | "other";

export function detectDesktopDownloadPlatform(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  const normalized = String(userAgent || "").toLowerCase();

  if (normalized.includes("windows")) {
    return "windows" as const;
  }

  if (normalized.includes("macintosh") || normalized.includes("mac os") || normalized.includes("macos")) {
    return "macos" as const;
  }

  return "other" as const;
}

export function isDesktopDownloadRecommended(
  buttonPlatform: Exclude<DesktopDownloadPlatform, "other">,
  detectedPlatform: DesktopDownloadPlatform,
) {
  return buttonPlatform === detectedPlatform;
}

export function formatDesktopPlatform(platform: string | null | undefined) {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    default:
      return "Desktop";
  }
}
