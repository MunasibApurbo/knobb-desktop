import { describe, expect, it } from "vitest";

import { getDiscordBridgeConfigTemplate, getDiscordConnectionState } from "@/lib/discordConnect";

describe("discordConnect", () => {
  it("maps bridge states into user-facing connection states", () => {
    expect(getDiscordConnectionState({
      ok: false,
      configured: false,
      discordConnected: false,
    })).toBe("offline");

    expect(getDiscordConnectionState({
      ok: true,
      configured: false,
      discordConnected: false,
    })).toBe("setup");

    expect(getDiscordConnectionState({
      ok: true,
      configured: true,
      discordConnected: false,
    })).toBe("waiting");

    expect(getDiscordConnectionState({
      ok: true,
      configured: true,
      discordConnected: true,
    })).toBe("connected");
  });

  it("builds a ready-to-copy bridge config template", () => {
    expect(getDiscordBridgeConfigTemplate("https://knobb.test")).toBe(`{
  "clientId": "YOUR_DISCORD_APPLICATION_CLIENT_ID",
  "port": 32145,
  "appName": "Knobb",
  "siteUrl": "https://knobb.test",
  "assets": {
    "largeImageKey": "knobb",
    "playImageKey": "play",
    "pauseImageKey": "pause"
  }
}`);
  });
});
