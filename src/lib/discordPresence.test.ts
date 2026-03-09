import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildDiscordPresenceActivity,
  hasDiscordPresenceBridge,
  subscribeToDiscordPresenceBridge,
  syncDiscordPresence,
} from "@/lib/discordPresence";
import type { Track } from "@/types/music";

const track: Track = {
  id: "track-1",
  title: "After Hours",
  artist: "The Weeknd",
  album: "After Hours",
  duration: 240,
  year: 2020,
  coverUrl: "https://example.com/after-hours.jpg",
  canvasColor: "0 0% 0%",
};

describe("discordPresence", () => {
  beforeEach(() => {
    delete window.__KNOBB_DISCORD_RPC__;
  });

  it("builds presence activity from the current track", () => {
    vi.spyOn(Date, "now").mockReturnValue(100_000);

    const activity = buildDiscordPresenceActivity(track, {
      isPlaying: true,
      currentTime: 30,
      duration: 240,
    });

    expect(activity.details).toBe("After Hours");
    expect(activity.state).toBe("The Weeknd");
    expect(activity.largeImageUrl).toBe("https://example.com/after-hours.jpg");
    expect(activity.startTimestamp).toBe(70);
    expect(activity.endTimestamp).toBe(310);
  });

  it("uses the bridge when one is attached", async () => {
    const setActivity = vi.fn();
    window.__KNOBB_DISCORD_RPC__ = {
      setActivity,
    };

    const delivered = await syncDiscordPresence({
      enabled: true,
      track,
      isPlaying: false,
      currentTime: 0,
      duration: 240,
    });

    expect(hasDiscordPresenceBridge()).toBe(true);
    expect(delivered).toBe(true);
    expect(setActivity).toHaveBeenCalledTimes(1);
    expect(setActivity.mock.calls[0]?.[0]).toMatchObject({
      details: "After Hours",
      smallImageKey: "pause",
    });
  });

  it("dispatches bridge status and clear commands through window events", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDiscordPresenceBridge(listener);

    window.dispatchEvent(new Event("knobb:discord-presence-bridge-status"));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    const clearEvent = vi.fn();
    window.addEventListener("knobb:discord-presence", clearEvent as EventListener);

    await syncDiscordPresence({
      enabled: false,
      track,
      isPlaying: true,
      currentTime: 42,
      duration: 240,
    });

    const customEvent = clearEvent.mock.calls[0]?.[0] as CustomEvent<{ type: string }>;
    expect(customEvent.detail.type).toBe("clear-activity");
  });
});
