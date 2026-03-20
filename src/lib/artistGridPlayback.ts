import type { Track } from "@/types/music";

const KRAKENFILES_API = "https://info.artistgrid.cx/kf/?id=";
const IMGUR_API = "https://temp.imgur.gg/api/file/";
const QOBUZ_API = "https://qobuz.squid.wtf/api/download-music";
const TIDAL_APIS = [
  { baseUrl: "https://triton.squid.wtf" },
  { baseUrl: "https://tidal.kinoplus.online" },
  { baseUrl: "https://hund.qqdl.site" },
  { baseUrl: "https://katze.qqdl.site" },
  { baseUrl: "https://maus.qqdl.site" },
  { baseUrl: "https://vogel.qqdl.site" },
  { baseUrl: "https://wolf.qqdl.site" },
];

let tidalApiIndex = 0;
const artistGridDurationRequestCache = new Map<string, Promise<number | null>>();

type ArtistGridPlayableSource =
  | "direct"
  | "froste"
  | "imgur"
  | "juicewrldapi"
  | "krakenfiles"
  | "pillows"
  | "pixeldrain"
  | "qobuz"
  | "soundcloud"
  | "tidal"
  | "yetracker"
  | "unknown";

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

function getFirstCachedStreamUrl(streamUrls: Track["streamUrls"]) {
  for (const value of Object.values(streamUrls || {})) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeArtistGridTrackDuration(duration: number | null | undefined) {
  if (!Number.isFinite(duration) || !duration || duration <= 0) {
    return null;
  }

  return Math.max(1, Math.round(duration));
}

async function probeArtistGridTrackDuration(url: string): Promise<number | null> {
  const normalizedUrl = typeof url === "string" ? url.trim() : "";
  if (!normalizedUrl) return null;
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;

  const cachedRequest = artistGridDurationRequestCache.get(normalizedUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const request = new Promise<number | null>((resolve) => {
    const audio = new Audio();
    let settled = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("durationchange", handleReady);
      audio.removeEventListener("canplay", handleReady);
      audio.removeEventListener("error", handleError);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      audio.src = "";
      audio.load();
    };

    const settle = (duration: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };

    const handleReady = () => {
      settle(normalizeArtistGridTrackDuration(audio.duration));
    };

    const handleError = () => {
      settle(null);
    };

    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.addEventListener("loadedmetadata", handleReady, { once: true });
    audio.addEventListener("durationchange", handleReady);
    audio.addEventListener("canplay", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    timeoutId = window.setTimeout(() => {
      settle(normalizeArtistGridTrackDuration(audio.duration));
    }, 8000);
    audio.src = normalizedUrl;
    audio.load();
  }).finally(() => {
    artistGridDurationRequestCache.delete(normalizedUrl);
  });

  artistGridDurationRequestCache.set(normalizedUrl, request);
  return request;
}

async function hydrateArtistGridTrackDuration<T extends Track>(track: T, streamUrl: string | null): Promise<T> {
  if ((track.duration || 0) > 0 || !streamUrl) {
    return track;
  }

  const resolvedDuration = await probeArtistGridTrackDuration(streamUrl);
  if (!resolvedDuration) {
    return track;
  }

  return {
    ...track,
    duration: resolvedDuration,
  };
}

export function normalizeArtistGridSourceUrl(url: string) {
  return url.replace(/pillowcase\.su/gi, "pillows.su").trim();
}

export function extractArtistGridSourceUrl(sourceId: string | null | undefined) {
  const normalizedSourceId = typeof sourceId === "string" ? sourceId.trim() : "";
  const match = normalizedSourceId.match(/^[a-zA-Z0-9_-]+:(https?:\/\/.+)$/i);
  return match ? normalizeArtistGridSourceUrl(match[1]) : null;
}

function getArtistGridPlayableSource(url: string): ArtistGridPlayableSource {
  const normalized = normalizeArtistGridSourceUrl(url);

  if (/\.(mp3|m4a|aac|wav|flac|ogg|opus)(?:$|[?#])/i.test(normalized)) return "direct";
  if (/https?:\/\/pillows\.su\/f\//i.test(normalized)) return "pillows";
  if (/https?:\/\/music\.froste\.lol\/song\//i.test(normalized)) return "froste";
  if (/https?:\/\/krakenfiles\.com\/view\//i.test(normalized)) return "krakenfiles";
  if (/https?:\/\/pixeldrain\.com\/d\//i.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/i.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/i.test(normalized)) return "imgur";
  if (/https?:\/\/files\.yetracker\.org\/f\//i.test(normalized)) return "yetracker";
  if (/https?:\/\/(www\.)?soundcloud\.com\//i.test(normalized)) return "soundcloud";
  if (/https?:\/\/tidal\.com\/(?:browse\/)?track\//i.test(normalized)) return "tidal";
  if (/https?:\/\/(open\.)?qobuz\.com\/track\//i.test(normalized)) return "qobuz";
  return "unknown";
}

function extractArtistGridKrakenId(url: string) {
  return url.match(/krakenfiles\.com\/view\/([a-zA-Z0-9]+)/i)?.[1] || null;
}

function extractArtistGridImgurId(url: string) {
  return url.match(/\/f\/([a-zA-Z0-9]+)/i)?.[1]
    || url.match(/\/([a-zA-Z0-9]+)(?:\?|$)/i)?.[1]
    || null;
}

function extractArtistGridSoundcloudPath(url: string) {
  return url.match(/soundcloud\.com\/([^/]+\/[^/?#]+)/i)?.[1] || null;
}

function extractArtistGridTidalId(url: string) {
  return url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/i)?.[1] || null;
}

function extractArtistGridQobuzId(url: string) {
  return url.match(/(?:open\.)?qobuz\.com\/track\/(\d+)/i)?.[1] || null;
}

function selectArtistGridTidalApi() {
  const api = TIDAL_APIS[tidalApiIndex];
  tidalApiIndex = (tidalApiIndex + 1) % TIDAL_APIS.length;
  return api.baseUrl;
}

export function buildArtistGridPlaybackProxyUrl(url: string) {
  const params = new URLSearchParams({ url });
  return `/api/audio-proxy?${params.toString()}`;
}

export async function resolveArtistGridPlayableUrl(url: string): Promise<string | null> {
  const normalized = normalizeArtistGridSourceUrl(url);
  const source = getArtistGridPlayableSource(normalized);

  try {
    switch (source) {
      case "direct":
      case "juicewrldapi":
        return normalized;
      case "pillows": {
        const id = normalized.match(/pillows\.su\/f\/([a-f0-9]+)/i)?.[1];
        return id ? `https://api.pillows.su/api/download/${id}` : null;
      }
      case "pixeldrain": {
        const id = normalized.match(/pixeldrain\.com\/d\/([a-zA-Z0-9]+)/i)?.[1];
        return id ? `https://tracker.thug.surf/goy/dl/${id}` : null;
      }
      case "froste": {
        const id = normalized.match(/music\.froste\.lol\/song\/([a-f0-9]+)/i)?.[1];
        return id ? `https://music.froste.lol/song/${id}/download` : null;
      }
      case "krakenfiles": {
        const id = extractArtistGridKrakenId(normalized);
        if (!id) return null;
        const response = await fetch(`${KRAKENFILES_API}${id}`);
        const payload = await response.json();
        return payload?.success ? payload.m4a || payload.url || null : null;
      }
      case "imgur": {
        const id = extractArtistGridImgurId(normalized);
        if (!id) return null;
        const response = await fetch(`${IMGUR_API}${id}`);
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.cdnUrl || null;
      }
      case "yetracker": {
        const id = normalized.match(/files\.yetracker\.org\/f\/([a-zA-Z0-9]+)/i)?.[1];
        return id ? `https://files.yetracker.org/raw/${id}` : null;
      }
      case "soundcloud": {
        const path = extractArtistGridSoundcloudPath(normalized);
        return path ? `https://sc.maid.zone/_/restream/${path}` : null;
      }
      case "tidal": {
        const id = extractArtistGridTidalId(normalized);
        if (!id) return null;
        const response = await fetch(`${selectArtistGridTidalApi()}/track/?id=${id}&quality=HI_RES_LOSSLESS`);
        if (!response.ok) return null;
        const payload = await response.json();
        const manifest = payload?.data?.manifest;
        if (typeof manifest !== "string") return null;
        const decoded = JSON.parse(atob(manifest)) as { urls?: string[] };
        return decoded?.urls?.[0] || null;
      }
      case "qobuz": {
        const id = extractArtistGridQobuzId(normalized);
        if (!id) return null;
        const response = await fetch(`${QOBUZ_API}?track_id=${id}&quality=27`);
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.data?.url || null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function hydrateArtistGridTrackPlayback<T extends Track>(track: T): Promise<T> {
  const hasCachedStream = typeof track.streamUrl === "string" && track.streamUrl.trim().length > 0;
  const fallbackCachedStream = getFirstCachedStreamUrl(track.streamUrls);
  if (hasCachedStream || fallbackCachedStream) {
    const hydratedTrack = hasCachedStream
      ? track
      : {
          ...track,
          streamUrl: fallbackCachedStream || undefined,
        };

    return hydrateArtistGridTrackDuration(
      hydratedTrack,
      hydratedTrack.streamUrl || fallbackCachedStream,
    );
  }

  const sourceUrl = extractArtistGridSourceUrl(track.sourceId);
  if (!isHttpUrl(sourceUrl)) {
    return track;
  }

  const playableUrl = await resolveArtistGridPlayableUrl(sourceUrl);
  if (!playableUrl) {
    return track;
  }

  const proxiedUrl = buildArtistGridPlaybackProxyUrl(playableUrl);
  return hydrateArtistGridTrackDuration({
    ...track,
    streamUrl: proxiedUrl,
    streamUrls: {
      ...(track.streamUrls || {}),
      HIGH: proxiedUrl,
    },
    streamTypes: {
      ...(track.streamTypes || {}),
      HIGH: "direct",
    },
    audioQuality: track.audioQuality || "HIGH",
    isUnavailable: false,
  }, proxiedUrl);
}

export async function hydrateArtistGridLikedSongs(tracks: Track[]) {
  return Promise.all(tracks.map((track) => hydrateArtistGridTrackPlayback(track)));
}
