import type { AudioQuality } from "@/contexts/player/playerTypes";
import type { Json, Tables } from "@/integrations/supabase/types";
import { getSupabaseClient } from "@/lib/runtimeModules";
import type { Track } from "@/types/music";

const PLAYBACK_DEVICE_ID_KEY = "playback-device-id";
const PLAYBACK_SESSION_STALE_MS = 1000 * 60 * 2;

export type PlaybackSessionSnapshot = {
  currentTime: number;
  currentTrack: Track | null;
  deviceId: string;
  deviceName: string;
  duration: number;
  id: string;
  isPlaying: boolean;
  quality: AudioQuality;
  queue: Track[];
  updatedAt: string;
};

function readStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

export function getPlaybackDeviceId() {
  const stored = readStorage(PLAYBACK_DEVICE_ID_KEY);
  if (stored) return stored;

  const nextId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  writeStorage(PLAYBACK_DEVICE_ID_KEY, nextId);
  return nextId;
}

export function getPlaybackDeviceName() {
  if (typeof navigator === "undefined") return "This browser";

  const userAgent = navigator.userAgent.toLowerCase();
  const browser = userAgent.includes("edg/")
    ? "Edge"
    : userAgent.includes("chrome/")
      ? "Chrome"
      : userAgent.includes("safari/") && !userAgent.includes("chrome/")
        ? "Safari"
        : userAgent.includes("firefox/")
          ? "Firefox"
          : "Browser";

  const platform = userAgent.includes("iphone") || userAgent.includes("ipad")
    ? "iPhone"
    : userAgent.includes("android")
      ? "Android"
      : userAgent.includes("mac os")
        ? "Mac"
        : userAgent.includes("windows")
          ? "Windows"
          : userAgent.includes("linux")
            ? "Linux"
            : "Device";

  return `${browser} on ${platform}`;
}

function sanitizeTrack(track: Track | null) {
  if (!track) return null;

  const persistableTrack = { ...track };
  delete persistableTrack.streamUrl;
  delete persistableTrack.streamUrls;
  delete persistableTrack.streamTypes;

  return persistableTrack;
}

function parseTrack(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const track = value as unknown as Track;
  return typeof track.id === "string" ? track : null;
}

function parseQueue(value: Json) {
  if (!Array.isArray(value)) return [] as Track[];
  return value
    .map((track) => parseTrack(track as Json))
    .filter((track): track is Track => Boolean(track));
}

type PlaybackSessionRow = Tables<"playback_sessions">;

function mapPlaybackSession(row: PlaybackSessionRow): PlaybackSessionSnapshot {
  const quality = row.quality === "LOW" || row.quality === "MEDIUM" || row.quality === "HIGH" || row.quality === "LOSSLESS" || row.quality === "MAX"
    ? row.quality
    : "HIGH";

  return {
    currentTime: Number.isFinite(row.current_time) ? row.current_time : 0,
    currentTrack: parseTrack(row.current_track_data),
    deviceId: row.device_id,
    deviceName: row.device_name,
    duration: Number.isFinite(row.duration) ? row.duration : 0,
    id: row.id,
    isPlaying: row.is_playing,
    quality,
    queue: parseQueue(row.queue_data),
    updatedAt: row.updated_at,
  };
}

export async function upsertPlaybackSession(input: {
  currentTime: number;
  currentTrack: Track | null;
  deviceId: string;
  deviceName: string;
  duration: number;
  isPlaying: boolean;
  quality: AudioQuality;
  queue: Track[];
  userId: string;
}) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("playback_sessions")
    .upsert({
      user_id: input.userId,
      device_id: input.deviceId,
      device_name: input.deviceName,
      current_track_data: sanitizeTrack(input.currentTrack) as Json | null,
      queue_data: input.queue
        .filter((track) => !track.isLocal)
        .map((track) => sanitizeTrack(track)) as unknown as Json,
      current_time: input.currentTime,
      duration: input.duration,
      is_playing: input.isPlaying,
      quality: input.quality,
      last_seen_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,device_id",
    });

  if (error) {
    throw new Error(error.message || "Failed to sync playback session");
  }
}

export async function removePlaybackSession(userId: string, deviceId: string) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("playback_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", deviceId);

  if (error) {
    throw new Error(error.message || "Failed to remove playback session");
  }
}

export async function removeOtherPlaybackSessions(userId: string, currentDeviceId: string) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("playback_sessions")
    .delete()
    .eq("user_id", userId)
    .neq("device_id", currentDeviceId);

  if (error) {
    throw new Error(error.message || "Failed to remove other playback sessions");
  }
}

export async function listPlaybackSessions(userId: string) {
  const supabase = await getSupabaseClient();
  const thresholdIso = new Date(Date.now() - PLAYBACK_SESSION_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("playback_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("last_seen_at", thresholdIso)
    .order("last_seen_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load playback sessions");
  }

  return (data || []).map(mapPlaybackSession);
}
