import { describe, expect, it } from "vitest";

import {
  hasConfiguredDiscordClientId,
  resolveDesktopDiscordConfig,
  shouldSeedDesktopBridgeConfig,
} from "../../desktop/knobb/discord-config.mjs";

describe("desktop discord config", () => {
  it("treats the placeholder client id as unconfigured", () => {
    expect(hasConfiguredDiscordClientId("YOUR_DISCORD_APPLICATION_CLIENT_ID")).toBe(false);
    expect(hasConfiguredDiscordClientId("1480172578378354840")).toBe(true);
  });

  it("seeds the packaged bridge config when the user config is missing or still a placeholder", () => {
    expect(shouldSeedDesktopBridgeConfig(null, { clientId: "1480172578378354840" })).toBe(true);
    expect(shouldSeedDesktopBridgeConfig(
      { clientId: "YOUR_DISCORD_APPLICATION_CLIENT_ID" },
      { clientId: "1480172578378354840" },
    )).toBe(true);
  });

  it("keeps an already configured user bridge config in place", () => {
    expect(shouldSeedDesktopBridgeConfig(
      { clientId: "999999999999999999" },
      { clientId: "1480172578378354840" },
    )).toBe(false);
    expect(shouldSeedDesktopBridgeConfig(
      { clientId: "" },
      { clientId: "YOUR_DISCORD_APPLICATION_CLIENT_ID" },
    )).toBe(false);
  });

  it("prefers the bundled desktop config unless the user has provided a real override", () => {
    expect(resolveDesktopDiscordConfig(
      { clientId: "1480172578378354840", appName: "Knobb" },
      null,
    )).toMatchObject({
      clientId: "1480172578378354840",
      appName: "Knobb",
    });

    expect(resolveDesktopDiscordConfig(
      { clientId: "1480172578378354840", appName: "Knobb" },
      { clientId: "999999999999999999", appName: "Custom Knobb" },
    )).toMatchObject({
      clientId: "999999999999999999",
      appName: "Custom Knobb",
    });
  });
});
