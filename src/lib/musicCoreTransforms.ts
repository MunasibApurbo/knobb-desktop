import {
  deriveTrackQuality,
  isTrackUnavailable,
  SourceAlbum,
  SourceArtist,
  SourcePlaylist,
  SourceTrack,
  SourceTrackLookup,
  SearchResponse,
} from "@/lib/musicCoreShared";

function findSearchSection(source: unknown, key: string, visited: Set<unknown>): SearchResponse<unknown> | undefined {
  if (!source || typeof source !== "object") return undefined;

  if (Array.isArray(source)) {
    for (const entry of source) {
      const found = findSearchSection(entry, key, visited);
      if (found) return found;
    }
    return undefined;
  }

  if (visited.has(source)) return undefined;
  visited.add(source);

  if ("items" in source && Array.isArray((source as SearchResponse<unknown>).items)) {
    return source as SearchResponse<unknown>;
  }

  if (key in (source as Record<string, unknown>)) {
    const found = findSearchSection((source as Record<string, unknown>)[key], key, visited);
    if (found) return found;
  }

  for (const value of Object.values(source as Record<string, unknown>)) {
    const found = findSearchSection(value, key, visited);
    if (found) return found;
  }

  return undefined;
}

export function normalizeSearchResponse<T>(data: unknown, key: string): SearchResponse<T> {
  const section =
    findSearchSection(data, key, new Set()) ||
    ({
      items: [],
      limit: 0,
      offset: 0,
      totalNumberOfItems: 0,
    } satisfies SearchResponse<unknown>);
  const items = Array.isArray(section.items) ? section.items : [];
  return {
    items: items as T[],
    limit: section.limit ?? items.length,
    offset: section.offset ?? 0,
    totalNumberOfItems: section.totalNumberOfItems ?? items.length,
  };
}

export function prepareTrack(track: SourceTrack): SourceTrack {
  let normalized = track;

  if (!normalized.artist && Array.isArray(normalized.artists) && normalized.artists.length > 0) {
    normalized = {
      ...normalized,
      artist: normalized.artists[0],
    };
  }

  const derivedQuality = deriveTrackQuality(normalized);
  if (derivedQuality && normalized.audioQuality !== derivedQuality) {
    normalized = {
      ...normalized,
      audioQuality: derivedQuality,
    };
  }

  normalized.isUnavailable = isTrackUnavailable(normalized);
  return normalized;
}

export function prepareAlbum(album: SourceAlbum): SourceAlbum {
  if (!album.artist && Array.isArray(album.artists) && album.artists.length > 0) {
    return { ...album, artist: album.artists[0] };
  }
  return album;
}

export function preparePlaylist(playlist: SourcePlaylist): SourcePlaylist {
  return playlist;
}

export function prepareVideo(video: SourceTrack): SourceTrack {
  let normalized: SourceTrack = { ...video, type: "video" };

  if (!video.artist && Array.isArray(video.artists) && video.artists.length > 0) {
    normalized = { ...normalized, artist: video.artists[0] };
  }

  return normalized;
}

export function prepareArtist(artist: SourceArtist): SourceArtist {
  const picture =
    artist.picture ||
    artist.cover ||
    artist.image ||
    artist.squareImage ||
    artist.avatar ||
    artist.avatarUrl ||
    artist.profilePicture ||
    null;

  if (!artist.type && Array.isArray(artist.artistTypes) && artist.artistTypes.length > 0) {
    return {
      ...artist,
      picture,
      type: artist.artistTypes[0],
    };
  }

  if (artist.picture !== picture) {
    return {
      ...artist,
      picture,
    };
  }

  return artist;
}

export function deduplicateAlbums(albums: SourceAlbum[]) {
  const unique = new Map<string, SourceAlbum>();

  for (const album of albums) {
    const key = JSON.stringify([album.title, album.numberOfTracks || 0]);
    if (!unique.has(key)) {
      unique.set(key, album);
      continue;
    }

    const existing = unique.get(key)!;
    if (album.explicit && !existing.explicit) {
      unique.set(key, album);
      continue;
    }
    if (!album.explicit && existing.explicit) {
      continue;
    }

    const existingTags = existing.mediaMetadata?.tags?.length || 0;
    const nextTags = album.mediaMetadata?.tags?.length || 0;
    if (nextTags > existingTags) {
      unique.set(key, album);
    }
  }

  return Array.from(unique.values());
}

export function normalizeTrackResponse(apiResponse: unknown) {
  if (!apiResponse || typeof apiResponse !== "object") {
    return apiResponse;
  }

  const raw =
    ((apiResponse as { data?: { duration?: number; trackId?: number } }).data ??
      apiResponse) as { duration?: number; trackId?: number };
  const trackStub = {
    duration: raw.duration ?? 0,
    id: raw.trackId ?? null,
  };
  return [trackStub, raw];
}

export function parseTrackLookup(data: unknown): SourceTrackLookup {
  const entries = Array.isArray(data) ? data : [data];
  let track: SourceTrack | null = null;
  let info: SourceTrackLookup["info"] | null = null;
  let originalTrackUrl: string | undefined;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    if (!track && "duration" in entry) {
      track = entry as SourceTrack;
      continue;
    }

    if (!info && "manifest" in entry) {
      info = entry as SourceTrackLookup["info"];
      continue;
    }

    if (
      !originalTrackUrl &&
      "OriginalTrackUrl" in entry &&
      typeof (entry as { OriginalTrackUrl?: unknown }).OriginalTrackUrl === "string"
    ) {
      originalTrackUrl = (entry as { OriginalTrackUrl: string }).OriginalTrackUrl;
    }
  }

  if (!track || !info) {
    throw new Error("Malformed track response");
  }

  return { track, info, originalTrackUrl };
}

export function extractStreamUrlFromManifest(manifest: string) {
  try {
    const decoded = atob(manifest);

    if (decoded.includes("<MPD")) {
      const baseUrlMatch = decoded.match(/<BaseURL>\s*([^<\s]+)\s*<\/BaseURL>/i);
      return baseUrlMatch?.[1]?.trim() || null;
    }

    try {
      const parsed = JSON.parse(decoded);
      if (typeof parsed?.url === "string") {
        return parsed.url;
      }

      if (Array.isArray(parsed?.urls) && parsed.urls.length > 0) {
        return parsed.urls[0] as string;
      }
    } catch {
      const match = decoded.match(/https?:\/\/[\w\-.~:?#[@!$&'()*+,;=%/]+/);
      return match ? match[0] : null;
    }
  } catch {
    return null;
  }

  return null;
}
