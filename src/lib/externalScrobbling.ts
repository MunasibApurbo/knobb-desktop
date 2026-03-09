import type { Track } from "@/types/music";
import {
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from "@/lib/safeStorage";

const LISTENBRAINZ_ENABLED_KEY = "listenbrainz-enabled";
const LISTENBRAINZ_TOKEN_KEY = "listenbrainz-token";
const LISTENBRAINZ_API = "https://api.listenbrainz.org/1";

type ListenBrainzPayload = {
  listened_at?: number;
  track_metadata: {
    artist_name: string;
    track_name: string;
    release_name?: string;
    additional_info?: Record<string, string | number | boolean>;
  };
};

export function getListenBrainzToken() {
  return safeStorageGetItem(LISTENBRAINZ_TOKEN_KEY)?.trim() || "";
}

export function setListenBrainzToken(token: string) {
  const normalized = token.trim();
  if (!normalized) {
    safeStorageRemoveItem(LISTENBRAINZ_TOKEN_KEY);
    return;
  }

  safeStorageSetItem(LISTENBRAINZ_TOKEN_KEY, normalized);
}

export function isListenBrainzEnabled() {
  return safeStorageGetItem(LISTENBRAINZ_ENABLED_KEY) === "true";
}

export function setListenBrainzEnabled(enabled: boolean) {
  safeStorageSetItem(LISTENBRAINZ_ENABLED_KEY, String(enabled));
}

function getCompletionThreshold(durationSeconds: number, scrobblePercent: number) {
  if (durationSeconds <= 0) return 30;
  return Math.min(durationSeconds, Math.max(30, Math.ceil(durationSeconds * (scrobblePercent / 100))));
}

function getTrackMetadata(track: Track) {
  const artistName = track.artist?.trim() || "Unknown Artist";
  const trackName = track.title?.trim() || "Unknown Title";
  const releaseName = track.album?.trim() || undefined;

  return {
    artist_name: artistName,
    track_name: trackName,
    release_name: releaseName,
    additional_info: {
      media_player: "Knobb",
      submission_client: "Knobb",
      submission_client_version: "web",
      duration_ms: Math.max(0, Math.round((track.duration || 0) * 1000)),
      origin_url: typeof window === "undefined" ? "" : window.location.origin,
      music_service: track.isLocal ? "local" : "tidal",
    },
  };
}

async function submitListen(payload: { listen_type: "single" | "playing_now"; payload: ListenBrainzPayload[] }) {
  const token = getListenBrainzToken();
  if (!token || !isListenBrainzEnabled()) return;

  const response = await fetch(`${LISTENBRAINZ_API}/submit-listens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`ListenBrainz request failed with status ${response.status}`);
  }
}

export async function validateListenBrainzToken(token?: string) {
  const candidate = (token ?? getListenBrainzToken()).trim();
  if (!candidate) {
    return { valid: false, userName: null };
  }

  const response = await fetch(`${LISTENBRAINZ_API}/validate-token`, {
    headers: {
      Authorization: `Token ${candidate}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ListenBrainz validation failed with status ${response.status}`);
  }

  const payload = await response.json() as {
    valid?: boolean;
    user_name?: string | null;
    user_name_from_token?: string | null;
  };

  return {
    valid: payload.valid === true,
    userName: payload.user_name || payload.user_name_from_token || null,
  };
}

export async function submitListenBrainzNowPlaying(track: Track) {
  await submitListen({
    listen_type: "playing_now",
    payload: [
      {
        track_metadata: getTrackMetadata(track),
      },
    ],
  });
}

export async function submitListenBrainzScrobble(
  track: Track,
  listenedSeconds: number,
  scrobblePercent: number,
) {
  const durationSeconds = Math.max(0, Math.round(track.duration || 0));
  const threshold = getCompletionThreshold(durationSeconds, scrobblePercent);
  if (Math.round(listenedSeconds) < threshold) return;

  await submitListen({
    listen_type: "single",
    payload: [
      {
        listened_at: Math.floor(Date.now() / 1000),
        track_metadata: getTrackMetadata(track),
      },
    ],
  });
}
