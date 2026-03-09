export type KnobbDesktopLaunchTarget = {
  mode: string;
  url: string | null;
  error: string | null;
};

export type KnobbDesktopUpdateInfo = {
  version: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  updateURL: string | null;
};

export type KnobbDesktopUpdateStatus = {
  supported: boolean;
  configured: boolean;
  currentVersion: string;
  feedURL: string | null;
  checkOnLaunch: boolean;
  checkIntervalHours: number;
  status: string;
  lastCheckedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  required: boolean;
  blockingReason: "update-required" | "offline-grace-expired" | null;
  downloadProgress: number | null;
  updateInfo: KnobbDesktopUpdateInfo | null;
  lastError: string | null;
};

export function getKnobbDesktop() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.knobbDesktop || null;
}

export function isKnobbDesktopApp() {
  return Boolean(getKnobbDesktop()?.isDesktopApp);
}

export function getKnobbDesktopPlatform() {
  return getKnobbDesktop()?.platform || null;
}

export async function getKnobbDesktopLaunchTarget() {
  return await getKnobbDesktop()?.getLaunchTarget?.() || null;
}

export async function getKnobbDesktopConfigDirectory() {
  return await getKnobbDesktop()?.getConfigDirectory?.() || null;
}

export async function getKnobbDesktopConfigFilePath() {
  return await getKnobbDesktop()?.getConfigFilePath?.() || null;
}

export async function getKnobbDesktopExampleConfigFilePath() {
  return await getKnobbDesktop()?.getConfigExampleFilePath?.() || null;
}

export async function getKnobbDesktopUpdateStatus() {
  return await getKnobbDesktop()?.getUpdateStatus?.() || null;
}

export async function checkKnobbDesktopForUpdates() {
  return await getKnobbDesktop()?.checkForUpdates?.() || null;
}

export async function installKnobbDesktopUpdate() {
  return await getKnobbDesktop()?.quitAndInstallUpdate?.() || false;
}

export async function quitKnobbDesktopApp() {
  return await getKnobbDesktop()?.quit?.() || false;
}
