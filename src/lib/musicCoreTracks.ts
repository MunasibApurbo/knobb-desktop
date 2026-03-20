import type { APICache } from "@/lib/musicCoreCache";
import type {
  FetchWithRetryOptions,
  SourceTrack,
  SourceTrackLookup,
} from "@/lib/musicCoreShared";
import {
  extractStreamUrlFromManifest,
  normalizeTrackResponse,
  parseTrackLookup,
  prepareTrack,
} from "@/lib/musicCoreTransforms";
import {
  extractPayload,
  isRecord,
  unwrapItem,
} from "@/lib/musicCorePayload";

type TrackDeps = {
  cache: APICache;
  requestJson: (relativePath: string, options?: FetchWithRetryOptions) => Promise<unknown>;
  streamCache: Map<string, string>;
  getTrack: (trackId: number, quality?: string) => Promise<SourceTrackLookup>;
};

function findNestedValue(value: unknown, keys: string[], visited = new Set<unknown>()): unknown {
  if (!isRecord(value) && !Array.isArray(value)) return null;
  if (visited.has(value)) return null;
  visited.add(value);

  if (isRecord(value)) {
    for (const key of keys) {
      if (key in value) {
        const candidate = value[key];
        if (candidate !== undefined && candidate !== null) {
          return candidate;
        }
      }
    }

    for (const nested of Object.values(value)) {
      const candidate = findNestedValue(nested, keys, visited);
      if (candidate !== null && candidate !== undefined) {
        return candidate;
      }
    }

    return null;
  }

  for (const nested of value) {
    const candidate = findNestedValue(nested, keys, visited);
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }

  return null;
}

function findNestedNumber(value: unknown, keys: string[]) {
  const candidate = findNestedValue(value, keys);
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === "string" && /^\d+$/.test(candidate)) {
    return Number(candidate);
  }
  return undefined;
}

export async function getTrackMetadata(
  { cache, requestJson }: TrackDeps,
  trackId: number,
) {
  const cached = await cache.get<SourceTrack>("track_meta", trackId);
  if (cached) return cached;

  const json = await requestJson(`/info/?id=${trackId}`, { type: "api" });
  const payload = extractPayload(json);
  const items = Array.isArray(payload) ? payload : [payload];
  const found = items.find((entry) => {
    const item = unwrapItem(entry);
    return isRecord(item) && item.id === trackId;
  });
  if (!found) {
    throw new Error("Track metadata not found");
  }

  const track = prepareTrack(unwrapItem(found) as SourceTrack);
  await cache.set("track_meta", trackId, track);
  return track;
}

export async function getTrackRecommendations(
  { cache, requestJson }: TrackDeps,
  trackId: number,
) {
  const cached = await cache.get<SourceTrack[]>("recommendations", trackId);
  if (cached) return cached;

  try {
    const json = await requestJson(`/recommendations/?id=${trackId}`, {
      minVersion: "2.4",
    });
    const payload = extractPayload(json);
    const items = Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : [];
    const tracks = items
      .map((item) => {
        if (isRecord(item) && "track" in item && item.track) {
          return prepareTrack(item.track as SourceTrack);
        }
        return prepareTrack(item as SourceTrack);
      })
      .filter((track) => track.id);
    await cache.set("recommendations", trackId, tracks);
    return tracks;
  } catch {
    return [];
  }
}

export async function getTrack(
  { cache, requestJson }: TrackDeps,
  trackId: number,
  quality = "HI_RES_LOSSLESS",
) {
  const cacheKey = `${trackId}:${quality}`;
  const cached = await cache.get<SourceTrackLookup>("track", cacheKey);
  if (cached) return cached;

  const json = await requestJson(
    `/track/?id=${trackId}&quality=${encodeURIComponent(quality)}`,
    {
      type: "streaming",
    },
  );
  const lookup = parseTrackLookup(normalizeTrackResponse(json));
  await cache.set("track", cacheKey, lookup);
  return lookup;
}

export async function getStreamUrl(
  { streamCache, getTrack }: TrackDeps,
  trackId: number,
  quality = "HI_RES_LOSSLESS",
) {
  const cacheKey = `${trackId}:${quality}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey) || null;
  }

  const lookup = await getTrack(trackId, quality);
  const streamUrl =
    lookup.originalTrackUrl || extractStreamUrlFromManifest(lookup.info.manifest);
  if (!streamUrl) {
    throw new Error("Could not resolve stream URL");
  }

  streamCache.set(cacheKey, streamUrl);
  return streamUrl;
}

export async function getVideo(
  { cache, requestJson }: TrackDeps,
  videoId: number,
) {
  const cached = await cache.get<SourceTrackLookup>("video", videoId);
  if (cached) return cached;

  const json = await requestJson(`/video/?id=${videoId}`, { type: "streaming" });
  const payload = extractPayload(json);
  const data = (isRecord(payload) ? payload : null) || (isRecord(json) ? json : null);
  if (!data) throw new Error("Malformed video response");

  const manifest = findNestedValue(data, ["manifest", "Manifest"]);
  const mimeType = findNestedValue(data, ["manifestMimeType", "ManifestMimeType"]);
  const idFromPayload = findNestedNumber(data, ["trackId", "videoId", "id"]);

  if (typeof manifest !== "string" || !manifest.trim()) {
    throw new Error("Video manifest not found");
  }

  const originalUrl = findNestedValue(data, [
    "OriginalTrackUrl",
    "originalTrackUrl",
    "streamUrl",
    "url",
    "manifestUrl",
  ]);

  const lookup: SourceTrackLookup = {
    track: prepareTrack(data as unknown as SourceTrack),
    info: {
      manifest,
      manifestMimeType: typeof mimeType === "string" ? mimeType : undefined,
      trackId: idFromPayload,
    },
    originalTrackUrl: typeof originalUrl === "string" && originalUrl.trim() ? originalUrl : undefined,
  };

  await cache.set("video", videoId, lookup);
  return lookup;
}

export async function getVideoStreamUrl(
  { streamCache, getVideo }: TrackDeps & { getVideo: (id: number) => Promise<SourceTrackLookup> },
  videoId: number,
) {
  const cacheKey = `video:${videoId}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey) || null;
  }

  const lookup = await getVideo(videoId);
  const streamUrl = lookup.originalTrackUrl || extractStreamUrlFromManifest(lookup.info.manifest);
  if (!streamUrl) {
    throw new Error("Could not resolve video stream URL");
  }

  streamCache.set(cacheKey, streamUrl);
  return streamUrl;
}
