import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDiscordPresenceBridgeStatus,
  installLocalDiscordPresenceBridge,
} from "@/lib/localDiscordPresenceBridge";

describe("localDiscordPresenceBridge", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete window.__KNOBB_DISCORD_RPC__;
    delete window.__KNOBB_LOCAL_DISCORD_RPC_BRIDGE__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("installs a bridge and updates availability from the localhost status endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        configured: true,
        discordConnected: false,
        bridgeVersion: "1.0.0",
      }),
    });

    const stop = installLocalDiscordPresenceBridge();
    await vi.waitFor(() => {
      expect(window.__KNOBB_DISCORD_RPC__?.isAvailable?.()).toBe(true);
    });

    await window.__KNOBB_DISCORD_RPC__?.clearActivity?.();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:32145/activity",
      expect.objectContaining({
        method: "POST",
      }),
    );

    stop();
    expect(window.__KNOBB_DISCORD_RPC__).toBeUndefined();
  });

  it("does not override an existing injected bridge", () => {
    const existingBridge = {
      isAvailable: () => true,
    };
    window.__KNOBB_DISCORD_RPC__ = existingBridge;

    installLocalDiscordPresenceBridge();

    expect(window.__KNOBB_DISCORD_RPC__).toBe(existingBridge);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("syncs bridge status from an injected native bridge", async () => {
    const injectedBridge = {
      isAvailable: () => true,
      getStatus: vi.fn().mockResolvedValue({
        ok: true,
        configured: true,
        discordConnected: false,
        bridgeVersion: "desktop",
      }),
      onStatus(listener: (status: {
        ok: boolean;
        configured: boolean;
        discordConnected: boolean;
        bridgeVersion?: string;
      }) => void) {
        listener({
          ok: true,
          configured: true,
          discordConnected: true,
          bridgeVersion: "desktop",
        });
        return () => undefined;
      },
    };
    window.__KNOBB_DISCORD_RPC__ = injectedBridge;

    installLocalDiscordPresenceBridge();

    await vi.waitFor(() => {
      expect(getLocalDiscordPresenceBridgeStatus()).toMatchObject({
        ok: true,
        configured: true,
        discordConnected: true,
        bridgeVersion: "desktop",
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
