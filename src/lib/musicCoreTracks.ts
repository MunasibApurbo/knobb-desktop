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
