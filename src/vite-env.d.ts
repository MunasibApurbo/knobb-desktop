/// <reference types="vite/client" />

type KnobbDesktopLaunchTarget = {
  mode: string;
  url: string | null;
  error: string | null;
};

type KnobbDesktopUpdateInfo = {
  version: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  updateURL: string | null;
};

type KnobbDesktopUpdateStatus = {
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

interface KnobbDesktopBridge {
  isDesktopApp: boolean;
  platform: string;
  getLaunchTarget: () => Promise<KnobbDesktopLaunchTarget | null>;
  getConfigDirectory?: () => Promise<string | null>;
  getConfigFilePath?: () => Promise<string | null>;
  getConfigExampleFilePath?: () => Promise<string | null>;
  getUpdateStatus?: () => Promise<KnobbDesktopUpdateStatus | null>;
  checkForUpdates?: () => Promise<KnobbDesktopUpdateStatus | null>;
  quitAndInstallUpdate?: () => Promise<boolean>;
  onUpdateStatus?: (listener: (status: KnobbDesktopUpdateStatus) => void) => () => void;
  openExternal: (url: string) => Promise<boolean>;
  openConfigDirectory?: () => Promise<boolean>;
  revealConfigFile?: () => Promise<boolean>;
  showWindow?: () => Promise<boolean>;
  hideWindow?: () => Promise<boolean>;
  quit?: () => Promise<boolean>;
}

interface Window {
  knobbDesktop?: KnobbDesktopBridge;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
