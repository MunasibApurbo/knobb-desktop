import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDiscordWebhookPresence,
  getDiscordWebhookUrl,
  isDiscordWebhookEnabled,
  setDiscordWebhookEnabled,
  setDiscordWebhookUrl,
  syncDiscordWebhookPresence,
  validateDiscordWebhook,
} from "@/lib/discordWebhookPresence";
import { safeStorageClear } from "@/lib/safeStorage";
import type { Track } from "@/types/music";

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
    },
  },
}));

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

describe("discordWebhookPresence", () => {
  beforeEach(() => {
    safeStorageClear();
    supabaseMocks.getSession.mockReset();
    supabaseMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "session-token",
        },
      },
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stores Discord web sharing settings locally", () => {
    setDiscordWebhookUrl(" https://discord.com/api/webhooks/1/token ");
    setDiscordWebhookEnabled(true);

    expect(getDiscordWebhookUrl()).toBe("https://discord.com/api/webhooks/1/token");
    expect(isDiscordWebhookEnabled()).toBe(true);
  });

  it("validates the webhook through the authenticated proxy", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      name: "Music Room",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }));

    const result = await validateDiscordWebhook("https://discord.com/api/webhooks/1/token");

    expect(result).toEqual({
      valid: true,
      name: "Music Room",
    });
    expect(fetch).toHaveBeenCalledWith("/api/discord-webhook", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
      }),
    }));
  });

  it("creates, updates, and clears a webhook message for now playing sync", async () => {
    setDiscordWebhookUrl("https://discord.com/api/webhooks/1/token");
    setDiscordWebhookEnabled(true);

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messageId: "message-1",
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messageId: "message-1",
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messageId: null,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }));

    const created = await syncDiscordWebhookPresence({
      track,
      isPlaying: true,
      currentTime: 30,
      duration: 240,
    });
    const updated = await syncDiscordWebhookPresence({
      track,
      isPlaying: false,
      currentTime: 90,
      duration: 240,
    });
    const cleared = await clearDiscordWebhookPresence();

    expect(created).toBe(true);
    expect(updated).toBe(true);
    expect(cleared).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/discord-webhook", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"action\":\"sync\""),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/discord-webhook", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"messageId\":\"message-1\""),
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/api/discord-webhook", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"action\":\"clear\""),
    }));
  });
});
