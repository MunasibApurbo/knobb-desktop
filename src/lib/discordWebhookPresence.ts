import { supabase } from "@/integrations/supabase/client";
import { buildTrackShareUrl } from "@/lib/mediaNavigation";
import {
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from "@/lib/safeStorage";
import type { Track } from "@/types/music";

const DISCORD_WEBHOOK_ENABLED_KEY = "discord-webhook-enabled";
const DISCORD_WEBHOOK_URL_KEY = "discord-webhook-url";
const DISCORD_WEBHOOK_MESSAGE_ID_KEY = "discord-webhook-message-id";
const DISCORD_WEBHOOK_SETTINGS_EVENT = "knobb:discord-webhook-settings";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type DiscordWebhookRequest =
  | {
      action: "test";
      webhookUrl: string;
    }
  | {
      action: "clear";
      webhookUrl: string;
      messageId?: string | null;
    }
  | {
      action: "sync";
      webhookUrl: string;
      messageId?: string | null;
      isPlaying: boolean;
      track: {
        title: string;
        artist: string;
        album?: string;
        coverUrl?: string;
        shareUrl?: string | null;
        elapsedSeconds: number;
        durationSeconds: number;
      };
    };

type DiscordWebhookResponse = {
  ok?: boolean;
  error?: string;
  messageId?: string | null;
  name?: string | null;
};

function dispatchDiscordWebhookSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DISCORD_WEBHOOK_SETTINGS_EVENT));
}

function normalizeWebhookUrl(value: string) {
  return value.trim();
}

function normalizeMessageId(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toAbsoluteUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  try {
    return new URL(candidate, window.location.origin).toString();
  } catch {
    return undefined;
  }
}

async function getSupabaseAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token?.trim() || "";
}

async function sendDiscordWebhookRequest(payload: DiscordWebhookRequest) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Sign in to Knobb before using Discord web sharing.");
  }

  const response = await fetch("/api/discord-webhook", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Knobb-Supabase-Key": SUPABASE_PUBLISHABLE_KEY,
      "X-Knobb-Supabase-Url": SUPABASE_URL,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch((): DiscordWebhookResponse => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Discord webhook request failed with status ${response.status}`);
  }

  return body;
}

function buildWebhookTrackPayload(
  track: Track,
  options: {
    currentTime: number;
    duration: number;
  },
) {
  return {
    title: track.title?.trim() || "Unknown Title",
    artist: track.artist?.trim() || "Unknown Artist",
    album: track.album?.trim() || undefined,
    coverUrl: toAbsoluteUrl(track.coverUrl),
    shareUrl: buildTrackShareUrl(track),
    elapsedSeconds: Math.max(0, Math.round(options.currentTime || 0)),
    durationSeconds: Math.max(0, Math.round(options.duration || track.duration || 0)),
  };
}

export function getDiscordWebhookUrl() {
  return normalizeWebhookUrl(safeStorageGetItem(DISCORD_WEBHOOK_URL_KEY) || "");
}

export function setDiscordWebhookUrl(value: string) {
  const normalized = normalizeWebhookUrl(value);
  if (!normalized) {
    safeStorageRemoveItem(DISCORD_WEBHOOK_URL_KEY);
    safeStorageRemoveItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY);
    dispatchDiscordWebhookSettingsChanged();
    return;
  }

  const previousUrl = getDiscordWebhookUrl();
  if (previousUrl && previousUrl !== normalized) {
    safeStorageRemoveItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY);
  }
  safeStorageSetItem(DISCORD_WEBHOOK_URL_KEY, normalized);
  dispatchDiscordWebhookSettingsChanged();
}

export function isDiscordWebhookEnabled() {
  return safeStorageGetItem(DISCORD_WEBHOOK_ENABLED_KEY) === "true";
}

export function setDiscordWebhookEnabled(enabled: boolean) {
  safeStorageSetItem(DISCORD_WEBHOOK_ENABLED_KEY, String(enabled));
  dispatchDiscordWebhookSettingsChanged();
}

export function subscribeToDiscordWebhookSettings(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(DISCORD_WEBHOOK_SETTINGS_EVENT, listener);
  return () => {
    window.removeEventListener(DISCORD_WEBHOOK_SETTINGS_EVENT, listener);
  };
}

export async function validateDiscordWebhook(webhookUrl?: string) {
  const candidate = normalizeWebhookUrl(webhookUrl ?? getDiscordWebhookUrl());
  if (!candidate) {
    return { valid: false, name: null };
  }

  const response = await sendDiscordWebhookRequest({
    action: "test",
    webhookUrl: candidate,
  });

  return {
    valid: true,
    name: typeof response.name === "string" && response.name.trim() ? response.name.trim() : null,
  };
}

export async function clearDiscordWebhookPresence() {
  const webhookUrl = getDiscordWebhookUrl();
  const messageId = normalizeMessageId(safeStorageGetItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY));

  if (!webhookUrl || !messageId) {
    safeStorageRemoveItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY);
    return false;
  }

  try {
    await sendDiscordWebhookRequest({
      action: "clear",
      webhookUrl,
      messageId,
    });
    safeStorageRemoveItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function syncDiscordWebhookPresence(options: {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}) {
  const webhookUrl = getDiscordWebhookUrl();
  if (!isDiscordWebhookEnabled() || !webhookUrl) {
    return false;
  }

  if (!options.track) {
    await clearDiscordWebhookPresence();
    return false;
  }

  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    return false;
  }

  const response = await fetch("/api/discord-webhook", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Knobb-Supabase-Key": SUPABASE_PUBLISHABLE_KEY,
      "X-Knobb-Supabase-Url": SUPABASE_URL,
    },
    body: JSON.stringify({
      action: "sync",
      webhookUrl,
      messageId: normalizeMessageId(safeStorageGetItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY)) || undefined,
      isPlaying: options.isPlaying,
      track: buildWebhookTrackPayload(options.track, {
        currentTime: options.currentTime,
        duration: options.duration,
      }),
    }),
  });

  const body = await response.json().catch((): DiscordWebhookResponse => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Discord webhook request failed with status ${response.status}`);
  }

  const messageId = normalizeMessageId(body.messageId);
  if (messageId) {
    safeStorageSetItem(DISCORD_WEBHOOK_MESSAGE_ID_KEY, messageId);
  }

  return Boolean(messageId);
}
