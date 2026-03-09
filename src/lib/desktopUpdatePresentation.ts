import type { KnobbDesktopUpdateStatus } from "@/lib/desktopApp";

export type DesktopUpdatePresentation = {
  title: string;
  detail: string;
  progress: number | null;
  primaryAction: "install" | "retry" | "check" | null;
};

export function isDesktopUpdateBlocked(status: KnobbDesktopUpdateStatus | null) {
  return Boolean(status && (status.required || status.blockingReason === "offline-grace-expired"));
}

export function getDesktopUpdatePresentation(status: KnobbDesktopUpdateStatus | null): DesktopUpdatePresentation {
  if (!status) {
    return {
      title: "Desktop updates unavailable",
      detail: "Knobb Desktop could not read its updater status yet.",
      progress: null,
      primaryAction: null,
    };
  }

  if (status.blockingReason === "offline-grace-expired") {
    return {
      title: "Reconnect to continue",
      detail: "Knobb Desktop must reconnect to verify required updates before it can continue.",
      progress: null,
      primaryAction: "retry",
    };
  }

  if (status.status === "downloaded") {
    return {
      title: "Required update ready",
      detail: "The required update has finished downloading. Restart Knobb Desktop to install it now.",
      progress: 100,
      primaryAction: "install",
    };
  }

  if (status.required && status.status === "downloading") {
    return {
      title: "Required update downloading",
      detail: "A newer Knobb Desktop build is required. The update is downloading now.",
      progress: status.downloadProgress,
      primaryAction: null,
    };
  }

  if (status.required && status.status === "error") {
    return {
      title: "Required update failed",
      detail: status.lastError || "Knobb Desktop could not finish downloading the required update.",
      progress: status.downloadProgress,
      primaryAction: "retry",
    };
  }

  if (status.status === "checking") {
    return {
      title: "Checking for updates",
      detail: "Knobb Desktop is verifying whether a required update is available.",
      progress: null,
      primaryAction: null,
    };
  }

  if (status.status === "error") {
    return {
      title: "Update check failed",
      detail: status.lastError || "Knobb Desktop could not contact the update server.",
      progress: null,
      primaryAction: "retry",
    };
  }

  return {
    title: "Up to date",
    detail: `Knobb Desktop ${status.currentVersion} is the latest required version.`,
    progress: null,
    primaryAction: "check",
  };
}
