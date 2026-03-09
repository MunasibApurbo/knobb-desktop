import type { LocalDiscordPresenceBridgeStatus } from "@/lib/localDiscordPresenceBridge";

export type DiscordConnectionState = "offline" | "setup" | "waiting" | "connected";

export function getDiscordConnectionState(status: LocalDiscordPresenceBridgeStatus): DiscordConnectionState {
  if (!status.ok) {
    return "offline";
  }

  if (!status.configured) {
    return "setup";
  }

  if (!status.discordConnected) {
    return "waiting";
  }

  return "connected";
}

export function getDiscordBridgeConfigTemplate(siteUrl: string) {
  return JSON.stringify({
    clientId: "YOUR_DISCORD_APPLICATION_CLIENT_ID",
    port: 32145,
    appName: "Knobb",
    siteUrl,
    assets: {
      largeImageKey: "knobb",
      playImageKey: "play",
      pauseImageKey: "pause",
    },
  }, null, 2);
}
