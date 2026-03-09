import { describe, expect, it } from "vitest";

import {
  getDesktopUpdatePresentation,
  isDesktopUpdateBlocked,
} from "@/lib/desktopUpdatePresentation";
import type { KnobbDesktopUpdateStatus } from "@/lib/desktopApp";

function createStatus(overrides: Partial<KnobbDesktopUpdateStatus> = {}): KnobbDesktopUpdateStatus {
  return {
    supported: true,
    configured: true,
    currentVersion: "0.1.0",
    feedURL: null,
    checkOnLaunch: true,
    checkIntervalHours: 4,
    status: "idle",
    lastCheckedAt: "2026-03-09T00:00:00.000Z",
    lastSuccessfulCheckAt: "2026-03-09T00:00:00.000Z",
    required: false,
    blockingReason: null,
    downloadProgress: null,
    updateInfo: null,
    lastError: null,
    ...overrides,
  };
}

describe("desktopUpdatePresentation", () => {
  it("stays unblocked when the app is up to date", () => {
    const status = createStatus();

    expect(isDesktopUpdateBlocked(status)).toBe(false);
    expect(getDesktopUpdatePresentation(status)).toMatchObject({
      title: "Up to date",
      primaryAction: "check",
    });
  });

  it("blocks when a required update is downloading", () => {
    const status = createStatus({
      status: "downloading",
      required: true,
      blockingReason: "update-required",
      downloadProgress: 48.4,
    });

    expect(isDesktopUpdateBlocked(status)).toBe(true);
    expect(getDesktopUpdatePresentation(status)).toMatchObject({
      title: "Required update downloading",
      progress: 48.4,
      primaryAction: null,
    });
  });

  it("surfaces the restart action once the required update is downloaded", () => {
    const status = createStatus({
      status: "downloaded",
      required: true,
      blockingReason: "update-required",
      downloadProgress: 100,
    });

    expect(getDesktopUpdatePresentation(status)).toMatchObject({
      title: "Required update ready",
      progress: 100,
      primaryAction: "install",
    });
  });

  it("blocks when the offline grace window has expired", () => {
    const status = createStatus({
      status: "error",
      blockingReason: "offline-grace-expired",
      lastError: "network down",
    });

    expect(isDesktopUpdateBlocked(status)).toBe(true);
    expect(getDesktopUpdatePresentation(status)).toMatchObject({
      title: "Reconnect to continue",
      primaryAction: "retry",
    });
  });

  it("keeps non-required update errors retriable without blocking the app", () => {
    const status = createStatus({
      status: "error",
      required: false,
      blockingReason: null,
      lastError: "temporary outage",
    });

    expect(isDesktopUpdateBlocked(status)).toBe(false);
    expect(getDesktopUpdatePresentation(status)).toMatchObject({
      title: "Update check failed",
      detail: "temporary outage",
      primaryAction: "retry",
    });
  });
});
