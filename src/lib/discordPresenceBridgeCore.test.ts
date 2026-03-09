import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadBridgeConfig,
  toDiscordActivity,
  validateActivity,
} from "../../scripts/discord-presence-bridge-core.mjs";

describe("discordPresence bridge core", () => {
  it("preserves the track artwork url from browser activity payloads", () => {
    const activity = validateActivity({
      type: "set-activity",
      activity: {
        details: "After Hours",
        state: "The Weeknd",
        largeImageText: "After Hours",
        largeImageUrl: "https://example.com/after-hours.jpg",
        smallImageKey: "play",
        smallImageText: "Playing",
      },
    });

    expect(activity).toMatchObject({
      largeImageUrl: "https://example.com/after-hours.jpg",
    });
  });

  it("prefers the current track artwork over the static app asset", () => {
    const payload = toDiscordActivity(
      {
        appName: "Knobb",
        assets: {
          largeImageKey: "knobb",
          playImageKey: "play",
          pauseImageKey: "pause",
        },
      },
      {
        details: "After Hours",
        state: "The Weeknd",
        largeImageText: "After Hours",
        largeImageUrl: "https://example.com/after-hours.jpg",
        smallImageKey: "play",
        smallImageText: "Playing",
      },
    );

    expect(payload).toMatchObject({
      assets: {
        large_image: "https://example.com/after-hours.jpg",
        large_text: "After Hours",
        small_image: "play",
        small_text: "Playing",
      },
    });
  });

  it("treats the placeholder client id as not configured", async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "knobb-discord-config-"));

    try {
      await fs.writeFile(
        path.join(tempDirectory, "discord-presence.bridge.json"),
        JSON.stringify({
          clientId: "YOUR_DISCORD_APPLICATION_CLIENT_ID",
          appName: "Knobb",
        }),
      );

      const config = await loadBridgeConfig(tempDirectory);
      expect(config.clientId).toBe("");
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
