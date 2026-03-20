export const INSTANCE_STORAGE_KEY = "nobbb-music-instances-v9";
export const API_PRIORITY_STORAGE_KEY = "nobbb-instance-priority-api";
export const STREAMING_PRIORITY_STORAGE_KEY = "nobbb-instance-priority-streaming";
export const INSTANCE_CACHE_TTL_MS = 15 * 60 * 1000;
export const TIDAL_V2_TOKEN = "txNoH4kkV41MfH25";
export const LATENCY_SAMPLE_SIZE = 120;

export type InstanceType = "api" | "streaming";

export type InstanceDescriptor = {
  url: string;
  version?: string;
};

export type FetchWithRetryOptions = {
  type?: InstanceType;
  minVersion?: string;
  signal?: AbortSignal;
};

export type CacheRecord = {
  key: string;
  data: unknown;
  timestamp: number;
};

export type SearchResponse<T> = {
  items: T[];
  limit: number;
  offset: number;
  totalNumberOfItems: number;
};

export type SourceTrack = {
  id: number;
  title: string;
  duration: number;
  version?: string | null;
  popularity?: number;
  explicit?: boolean;
  audioQuality?: string;
  replayGain?: number;
  peak?: number;
  type?: string;
  imageId?: string | null;
  allowStreaming?: boolean;
  streamReady?: boolean;
  isUnavailable?: boolean;
  mixes?: Record<string, string | number | null> | null;
  artist?: SourceArtist;
  artists?: SourceArtist[];
  album?: SourceAlbum;
  mediaMetadata?: { tags?: string[] };
};

export type SourceArtist = {
  id: number;
  name: string;
  picture?: string | null;
  cover?: string | null;
  image?: string | null;
  squareImage?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  profilePicture?: string | null;
  popularity?: number;
  url?: string;
  bio?: string;
  description?: string;
  about?: string;
  type?: string;
  artistTypes?: string[];
  mixes?: Record<string, string | number | null> | null;
};

export type SourceAlbum = {
  id: number;
  title: string;
  cover?: string;
  squareImage?: string | null;
  image?: string | null;
  vibrantColor?: string | null;
  releaseDate?: string;
  numberOfTracks?: number;
  type?: string;
  explicit?: boolean;
  audioModes?: string[];
  mediaMetadata?: { tags?: string[] };
  artist?: SourceArtist;
  artists?: SourceArtist[];
};

export type SourcePlaylist = {
  uuid: string;
  title: string;
  description?: string;
  image?: string | null;
  squareImage?: string | null;
  numberOfTracks: number;
  duration?: number;
  type?: string;
  publicPlaylist?: boolean;
  popularity?: number;
  url?: string;
};

export type SourceTrackLookup = {
  track: SourceTrack;
  info: {
    manifest: string;
    manifestMimeType?: string;
    trackId?: number;
    [key: string]: unknown;
  };
  originalTrackUrl?: string;
};

export type SourceArtistPage = SourceArtist & {
  albums: SourceAlbum[];
  eps: SourceAlbum[];
  tracks: SourceTrack[];
  videos: SourceTrack[];
};

export type EndpointLatencySnapshot = {
  endpoint: string;
  sampleCount: number;
  p95Ms: number;
  avgMs: number;
};

export const UPTIME_URLS = [
  "https://tidal-uptime.jiffy-puffs-1j.workers.dev/",
  "https://tidal-uptime.props-76styles.workers.dev/",
] as const;

export const API_INSTANCE_POOL = [
  "https://aether.squid.wtf",
  "https://zeus.squid.wtf",
  "https://kraken.squid.wtf",
  "https://phoenix.squid.wtf",
  "https://shiva.squid.wtf",
  "https://chaos.squid.wtf",
  "https://triton.squid.wtf",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
  "https://wolf.qqdl.site",
  "https://tidal-api.binimum.org",
  "https://tidal.kinoplus.online",
] as const;

export const STREAMING_INSTANCE_POOL = [
  "https://aether.squid.wtf",
  "https://zeus.squid.wtf",
  "https://kraken.squid.wtf",
  "https://phoenix.squid.wtf",
  "https://shiva.squid.wtf",
  "https://chaos.squid.wtf",
  "https://triton.squid.wtf",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
  "https://wolf.qqdl.site",
  "https://tidal-api.binimum.org",
  "https://tidal.kinoplus.online",
] as const;

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeQualityToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

  if (!token) return null;
  if (
    [
      "HI_RES_LOSSLESS",
      "HIRES_LOSSLESS",
      "HIRESLOSSLESS",
      "HIFI_PLUS",
      "HI_RES_FLAC",
      "HI_RES",
      "HIRES",
      "MASTER",
      "MASTER_QUALITY",
      "MQA",
    ].includes(token)
  ) {
    return "HI_RES_LOSSLESS";
  }
  if (["LOSSLESS", "HIFI"].includes(token)) return "LOSSLESS";
  if (["HIGH", "HIGH_QUALITY"].includes(token)) return "HIGH";
  if (["LOW", "LOW_QUALITY"].includes(token)) return "LOW";
  return null;
}

function deriveQualityFromTags(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const normalized = normalizeQualityToken(tag);
    if (normalized) return normalized;
  }
  return null;
}

export function deriveTrackQuality(track: SourceTrack | null | undefined) {
  if (!track) return null;
  const candidates = [
    deriveQualityFromTags(track.mediaMetadata?.tags),
    deriveQualityFromTags(track.album?.mediaMetadata?.tags),
    normalizeQualityToken(track.audioQuality),
  ].filter(Boolean) as string[];

  if (candidates.includes("HI_RES_LOSSLESS")) return "HI_RES_LOSSLESS";
  if (candidates.includes("LOSSLESS")) return "LOSSLESS";
  if (candidates.includes("HIGH")) return "HIGH";
  if (candidates.includes("LOW")) return "LOW";
  return null;
}

export function isTrackUnavailable(track: SourceTrack | null | undefined) {
  if (!track) return true;
  return track.isUnavailable === true || track.title === "Unavailable";
}

export function getPercentile(samples: number[], percentile: number) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

export function storageGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

export function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isDash(url: string, mimeType?: string) {
  const normalizedUrl = url.trim().toLowerCase();
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  return normalizedUrl.includes(".mpd") || normalizedMime.includes("dash+xml") || normalizedMime.includes("mpd");
}

export function isHls(url: string, mimeType?: string) {
  const normalizedUrl = url.trim().toLowerCase();
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  return normalizedUrl.includes(".m3u8") || normalizedMime.includes("mpegurl");
}

export function resolveProtocol(url: string, mimeType?: string): "direct" | "dash" | "hls" {
  if (isDash(url, mimeType)) return "dash";
  if (isHls(url, mimeType)) return "hls";
  return "direct";
}

export function buildInstanceUrl(baseUrl: string, relativePath: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${normalizedPath}`;
}

export function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => {
    globalThis.clearTimeout(timeout);
  });
}
