import type { DiscordPresenceActivity, DiscordPresenceBridge } from "@/lib/discordPresence";

const BRIDGE_BASE_URL = "http://127.0.0.1:32145";
const BRIDGE_STATUS_EVENT = "knobb:discord-presence-bridge-status";
const BRIDGE_POLL_INTERVAL_MS = 10_000;

type BridgeStatusResponse = {
  ok: boolean;
  configured: boolean;
  discordConnected: boolean;
  bridgeVersion?: string;
};

export type LocalDiscordPresenceBridgeStatus = BridgeStatusResponse;

type InstalledBridgeController = {
  stop: () => void;
};

declare global {
  interface Window {
    __KNOBB_LOCAL_DISCORD_RPC_BRIDGE__?: InstalledBridgeController;
  }
}

let latestBridgeStatus: BridgeStatusResponse = {
  ok: false,
  configured: false,
  discordConnected: false,
};
let probeBridgeStatus: (() => Promise<void>) | null = null;

function normalizeBridgeStatus(status: Partial<BridgeStatusResponse> | null | undefined): BridgeStatusResponse {
  return {
    ok: Boolean(status?.ok),
    configured: Boolean(status?.configured),
    discordConnected: Boolean(status?.discordConnected),
    ...(status?.bridgeVersion ? { bridgeVersion: status.bridgeVersion } : {}),
  };
}

function dispatchBridgeStatus(status: BridgeStatusResponse) {
  latestBridgeStatus = status;
  window.dispatchEvent(new CustomEvent<BridgeStatusResponse>(BRIDGE_STATUS_EVENT, {
    detail: status,
  }));
}

function getOfflineStatus(): BridgeStatusResponse {
  return {
    ok: false,
    configured: false,
    discordConnected: false,
  };
}

function createBridgeRequest(pathname: string, init?: RequestInit) {
  return fetch(`${BRIDGE_BASE_URL}${pathname}`, {
    mode: "cors",
    cache: "no-store",
    ...init,
  });
}

export function getLocalDiscordPresenceBridgeStatus() {
  return latestBridgeStatus;
}

export async function refreshLocalDiscordPresenceBridgeStatus() {
  if (probeBridgeStatus) {
    await probeBridgeStatus();
  }

  return latestBridgeStatus;
}

export function installLocalDiscordPresenceBridge() {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const existingBridge = window.__KNOBB_DISCORD_RPC__;
  if (existingBridge?.getStatus) {
    let stopped = false;
    const syncExistingBridgeStatus = async () => {
      try {
        const nextStatus = normalizeBridgeStatus(await existingBridge.getStatus?.());
        if (!stopped && nextStatus) {
          dispatchBridgeStatus(nextStatus);
        }
      } catch {
        if (!stopped) {
          dispatchBridgeStatus(getOfflineStatus());
        }
      }
    };

    const unsubscribe = existingBridge.onStatus?.((nextStatus) => {
      dispatchBridgeStatus(normalizeBridgeStatus(nextStatus));
    });

    void syncExistingBridgeStatus();
    return () => {
      stopped = true;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }

  const desktopBridge = window.knobbDesktop;
  if (
    desktopBridge?.isDesktopApp
    && typeof desktopBridge.getDiscordPresenceStatus === "function"
    && typeof desktopBridge.setDiscordPresenceActivity === "function"
    && typeof desktopBridge.clearDiscordPresenceActivity === "function"
  ) {
    let stopped = false;
    let latestStatus = latestBridgeStatus;

    const updateStatus = (nextStatus: BridgeStatusResponse) => {
      const changed = latestStatus.ok !== nextStatus.ok
        || latestStatus.configured !== nextStatus.configured
        || latestStatus.discordConnected !== nextStatus.discordConnected
        || latestStatus.bridgeVersion !== nextStatus.bridgeVersion;

      latestStatus = nextStatus;
      if (changed) {
        dispatchBridgeStatus(nextStatus);
      }
    };

    const probeStatus = async () => {
      try {
        const nextStatus = normalizeBridgeStatus(await desktopBridge.getDiscordPresenceStatus());
        if (!stopped) {
          updateStatus(nextStatus);
        }
      } catch {
        if (!stopped) {
          updateStatus(getOfflineStatus());
        }
      }
    };
    probeBridgeStatus = probeStatus;

    const bridge: DiscordPresenceBridge = {
      isAvailable: () => latestStatus.ok && latestStatus.configured,
      getStatus: async () => latestStatus,
      setActivity: async (activity) => {
        await desktopBridge.setDiscordPresenceActivity?.(activity);
        await probeStatus();
      },
      clearActivity: async () => {
        await desktopBridge.clearDiscordPresenceActivity?.();
        await probeStatus();
      },
      onStatus: (listener) => desktopBridge.onDiscordPresenceStatus?.((status) => {
        const nextStatus = normalizeBridgeStatus(status);
        updateStatus(nextStatus);
        listener(nextStatus);
      }),
    };

    window.__KNOBB_DISCORD_RPC__ = bridge;
    const unsubscribe = desktopBridge.onDiscordPresenceStatus?.((status) => {
      updateStatus(normalizeBridgeStatus(status));
    });
    void probeStatus();

    return () => {
      stopped = true;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      if (window.__KNOBB_DISCORD_RPC__ === bridge) {
        delete window.__KNOBB_DISCORD_RPC__;
      }
      if (probeBridgeStatus === probeStatus) {
        probeBridgeStatus = null;
      }
    };
  }

  if (window.__KNOBB_LOCAL_DISCORD_RPC_BRIDGE__) {
    return window.__KNOBB_LOCAL_DISCORD_RPC_BRIDGE__.stop;
  }

  if (window.__KNOBB_DISCORD_RPC__) {
    return () => undefined;
  }

  let stopped = false;
  let latestStatus = latestBridgeStatus;

  const updateStatus = (nextStatus: BridgeStatusResponse) => {
    const changed = latestStatus.ok !== nextStatus.ok
      || latestStatus.configured !== nextStatus.configured
      || latestStatus.discordConnected !== nextStatus.discordConnected
      || latestStatus.bridgeVersion !== nextStatus.bridgeVersion;

    latestStatus = nextStatus;
    if (changed) {
      dispatchBridgeStatus(nextStatus);
    }
  };

  const probeStatus = async () => {
    try {
      const response = await createBridgeRequest("/status");
      if (!response.ok) {
        updateStatus(getOfflineStatus());
        return;
      }

      const payload = await response.json() as BridgeStatusResponse;
      updateStatus(payload);
    } catch {
      updateStatus(getOfflineStatus());
    }
  };
  probeBridgeStatus = probeStatus;

  const sendCommand = async (body: { type: "set-activity"; activity: DiscordPresenceActivity } | { type: "clear-activity" }) => {
    const response = await createBridgeRequest("/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Discord bridge request failed with status ${response.status}`);
    }

    const payload = await response.json() as { status?: BridgeStatusResponse };
    if (payload.status) {
      updateStatus(payload.status);
    }
  };

  const bridge: DiscordPresenceBridge = {
    isAvailable: () => latestStatus.ok && latestStatus.configured,
    setActivity: async (activity) => {
      await sendCommand({
        type: "set-activity",
        activity,
      });
    },
    clearActivity: async () => {
      await sendCommand({
        type: "clear-activity",
      });
    },
  };

  window.__KNOBB_DISCORD_RPC__ = bridge;

  const intervalId = window.setInterval(() => {
    void probeStatus();
  }, BRIDGE_POLL_INTERVAL_MS);

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      void probeStatus();
    }
  };

  const handleOnline = () => {
    void probeStatus();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  void probeStatus();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    if (window.__KNOBB_DISCORD_RPC__ === bridge) {
      delete window.__KNOBB_DISCORD_RPC__;
    }
    delete window.__KNOBB_LOCAL_DISCORD_RPC_BRIDGE__;
    if (probeBridgeStatus === probeStatus) {
      probeBridgeStatus = null;
    }
  };

  window.__KNOBB_LOCAL_DISCORD_RPC_BRIDGE__ = { stop };
  return stop;
}
