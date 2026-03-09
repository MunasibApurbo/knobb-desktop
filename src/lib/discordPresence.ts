import type { Track } from "@/types/music";

const DISCORD_PRESENCE_EVENT = "knobb:discord-presence";
const DISCORD_PRESENCE_BRIDGE_STATUS_EVENT = "knobb:discord-presence-bridge-status";
const DEFAULT_APP_NAME = "Knobb";

export type DiscordPresenceActivity = {
  details: string;
  state: string;
  largeImageText: string;
  largeImageUrl?: string;
  sourceUrl?: string;
  smallImageKey: "play" | "pause";
  smallImageText: string;
  startTimestamp?: number;
  endTimestamp?: number;
};

export type DiscordPresenceCommand =
  | {
      type: "set-activity";
      activity: DiscordPresenceActivity;
    }
  | {
      type: "clear-activity";
    };

export type DiscordPresenceBridge = {
  setActivity?: (activity: DiscordPresenceActivity) => void | Promise<void>;
  clearActivity?: () => void | Promise<void>;
  isAvailable?: () => boolean;
  getStatus?: () => Promise<{
    ok: boolean;
    configured: boolean;
    discordConnected: boolean;
    bridgeVersion?: string;
  } | null> | {
    ok: boolean;
    configured: boolean;
    discordConnected: boolean;
    bridgeVersion?: string;
  } | null;
  onStatus?: (
    listener: (status: {
      ok: boolean;
      configured: boolean;
      discordConnected: boolean;
      bridgeVersion?: string;
    }) => void,
  ) => (() => void) | void;
};

declare global {
  interface Window {
    __KNOBB_DISCORD_RPC__?: DiscordPresenceBridge;
  }
}

function getDiscordPresenceBridge() {
  if (typeof window === "undefined") return null;

  const bridge = window.__KNOBB_DISCORD_RPC__;
  if (!bridge) return null;

  if (typeof bridge.isAvailable === "function" && !bridge.isAvailable()) {
    return null;
  }

  return bridge;
}

function dispatchPresenceCommand(command: DiscordPresenceCommand) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<DiscordPresenceCommand>(DISCORD_PRESENCE_EVENT, {
    detail: command,
  }));
}

function getTrackArtistLabel(track: Track) {
  const artistNames = track.artists
    ?.map((artist) => artist.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (artistNames && artistNames.length > 0) {
    return artistNames.join(", ");
  }

  return track.artist?.trim() || "Unknown Artist";
}

export function hasDiscordPresenceBridge() {
  return getDiscordPresenceBridge() !== null;
}

export function subscribeToDiscordPresenceBridge(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(DISCORD_PRESENCE_BRIDGE_STATUS_EVENT, listener);
  return () => {
    window.removeEventListener(DISCORD_PRESENCE_BRIDGE_STATUS_EVENT, listener);
  };
}

export function buildDiscordPresenceActivity(
  track: Track,
  options: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  },
): DiscordPresenceActivity {
  const duration = Math.max(0, options.duration || track.duration || 0);
  const currentTime = Math.max(0, options.currentTime || 0);
  const activity: DiscordPresenceActivity = {
    details: track.title?.trim() || "Unknown Title",
    state: getTrackArtistLabel(track),
    largeImageText: track.album?.trim() || DEFAULT_APP_NAME,
    sourceUrl: typeof window === "undefined" ? undefined : window.location.origin,
    smallImageKey: options.isPlaying ? "play" : "pause",
    smallImageText: options.isPlaying ? "Playing" : "Paused",
  };

  if (track.coverUrl) {
    activity.largeImageUrl = track.coverUrl;
  }

  if (options.isPlaying && duration > 0) {
    const now = Date.now();
    activity.startTimestamp = Math.floor((now - currentTime * 1000) / 1000);
    activity.endTimestamp = Math.floor((now + Math.max(0, duration - currentTime) * 1000) / 1000);
  }

  return activity;
}

export async function syncDiscordPresence(options: {
  enabled: boolean;
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}) {
  const bridge = getDiscordPresenceBridge();

  if (!options.enabled || !options.track) {
    dispatchPresenceCommand({ type: "clear-activity" });
    await bridge?.clearActivity?.();
    return false;
  }

  const activity = buildDiscordPresenceActivity(options.track, {
    isPlaying: options.isPlaying,
    currentTime: options.currentTime,
    duration: options.duration,
  });

  dispatchPresenceCommand({
    type: "set-activity",
    activity,
  });

  await bridge?.setActivity?.(activity);
  return bridge !== null;
}
