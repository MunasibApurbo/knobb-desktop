import type { APICache } from "@/lib/musicCoreCache";
import {
  TIDAL_V2_TOKEN,
  type FetchWithRetryOptions,
  type SearchResponse,
  type SourceAlbum,
  type SourceArtist,
  type SourceArtistPage,
  type SourceTrack,
} from "@/lib/musicCoreShared";
import {
  deduplicateAlbums,
  prepareAlbum,
  prepareArtist,
  prepareTrack,
  prepareVideo,
} from "@/lib/musicCoreTransforms";
import {
  extractPayload,
  getArrayProp,
  getFirstArrayEntry,
  getObjectProp,
  isRecord,
  unwrapItem,
} from "@/lib/musicCorePayload";

export type ArtistPageOptions = {
  lightweight?: boolean;
  skipCache?: boolean;
};

type ArtistDeps = {
  cache: APICache;
  requestJson: (relativePath: string, options?: FetchWithRetryOptions) => Promise<unknown>;
  searchAlbums: (query: string, limit?: number) => Promise<SearchResponse<SourceAlbum>>;
  searchVideos: (query: string, limit?: number) => Promise<SearchResponse<SourceTrack>>;
  getArtist: (artistId: number, options?: ArtistPageOptions) => Promise<SourceArtistPage | null>;
  getArtistTopTracks: (artistId: number, limit?: number) => Promise<SourceTrack[]>;
};

export async function getArtistMetadata(
  { cache, requestJson }: ArtistDeps,
  artistId: number,
) {
  const cached = await cache.get<SourceArtist>("artist_meta", artistId);
  if (cached) return cached;

  const json = await requestJson(`/artist/?id=${artistId}`);
  const payload = extractPayload(json);
  const rawArtist =
    getObjectProp<SourceArtist & { cover?: string | null }>(payload, "artist") ||
    (isRecord(getFirstArrayEntry(payload)) ? (getFirstArrayEntry(payload) as SourceArtist) : null) ||
    (isRecord(payload) ? (payload as SourceArtist) : null);
  if (!rawArtist) return null;

  const artist = prepareArtist({
    ...rawArtist,
    picture:
      rawArtist.picture ||
      rawArtist.cover ||
      rawArtist.image ||
      rawArtist.squareImage ||
      rawArtist.avatar ||
      rawArtist.avatarUrl ||
      rawArtist.profilePicture ||
      (isRecord(payload) ? (payload.cover as string | null | undefined) : null) ||
      (isRecord(payload) ? (payload.image as string | null | undefined) : null) ||
      (isRecord(payload) ? (payload.squareImage as string | null | undefined) : null) ||
      null,
  });
  await cache.set("artist_meta", artistId, artist);
  return artist;
}

export async function getArtistTopTracks(
  { cache, requestJson, getArtist }: ArtistDeps,
  artistId: number,
  limit = 20,
) {
  const cacheKey = `${artistId}:${limit}`;
  const cached = await cache.get<SourceTrack[]>("artist_top", cacheKey);
  if (cached) return cached;

  try {
    const json = await requestJson(`/artist/top/?id=${artistId}&limit=${limit}`);
    const payload = extractPayload(json);
    const items =
      [
        getArrayProp(payload, "items"),
        getArrayProp(payload, "tracks"),
        getArrayProp(json, "tracks"),
        getArrayProp(getObjectProp(json, "data"), "tracks"),
      ].find((candidate) => candidate.length > 0) ?? [];
    const tracks = items
      .map((item) => prepareTrack(unwrapItem(item) as SourceTrack))
      .slice(0, limit);
    await cache.set("artist_top", cacheKey, tracks);
    return tracks;
  } catch {
    const artist = await getArtist(artistId, { lightweight: true });
    return artist?.tracks?.slice(0, limit) || [];
  }
}

export async function getArtist(
  { cache, requestJson, searchAlbums, searchVideos, getArtistTopTracks: loadArtistTopTracks }: ArtistDeps,
  artistId: number,
  options: ArtistPageOptions = {},
) {
  const cacheKey = options.lightweight ? `artist_${artistId}_light` : `artist_${artistId}`;
  if (!options.skipCache) {
    const cached = await cache.get<SourceArtistPage>("artist", cacheKey);
    if (cached) return cached;
  }

  const [primaryResponse, contentResponse] = await Promise.all([
    requestJson(`/artist/?id=${artistId}`),
    requestJson(`/artist/?f=${artistId}&skip_tracks=true`),
  ]);

  const primaryPayload = extractPayload(primaryResponse);
  const rawArtist =
    getObjectProp<SourceArtist & { cover?: string | null }>(primaryPayload, "artist") ||
    (isRecord(getFirstArrayEntry(primaryPayload))
      ? (getFirstArrayEntry(primaryPayload) as SourceArtist)
      : null) ||
    (isRecord(primaryPayload) ? (primaryPayload as SourceArtist) : null);
  if (!rawArtist) {
    throw new Error("Primary artist details not found.");
  }

  const artist = prepareArtist({
    ...rawArtist,
    picture:
      rawArtist.picture ||
      rawArtist.cover ||
      rawArtist.image ||
      rawArtist.squareImage ||
      rawArtist.avatar ||
      rawArtist.avatarUrl ||
      rawArtist.profilePicture ||
      (isRecord(primaryPayload)
        ? (primaryPayload.cover as string | null | undefined)
        : null) ||
      (isRecord(primaryPayload)
        ? (primaryPayload.image as string | null | undefined)
        : null) ||
      (isRecord(primaryPayload)
        ? (primaryPayload.squareImage as string | null | undefined)
        : null) ||
      null,
    name: rawArtist.name || "Unknown Artist",
  });

  const contentPayload = extractPayload(contentResponse);
  const entries = Array.isArray(contentPayload) ? contentPayload : [contentPayload];
  const albumMap = new Map<number, SourceAlbum>();
  const trackMap = new Map<number, SourceTrack>();
  const videoMap = new Map<number, SourceTrack>();

  const isVideo = (v: unknown): boolean =>
    isRecord(v) && typeof v.id === "number" && String(v.type || "").toUpperCase() === "VIDEO";

  const scan = (value: unknown, visited = new Set<unknown>()) => {
    if (!isRecord(value) && !Array.isArray(value)) return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => scan(item, visited));
      return;
    }

    const item = unwrapItem(value);
    if (isRecord(item) && typeof item.id === "number" && "numberOfTracks" in item && !isVideo(item)) {
      albumMap.set(item.id, prepareAlbum(item as SourceAlbum));
    }
    if (isRecord(item) && typeof item.id === "number" && "duration" in item && "album" in item && !isVideo(item)) {
      trackMap.set(item.id, prepareTrack(item as SourceTrack));
    }
    if (isVideo(item) && isRecord(item)) {
      videoMap.set(item.id as number, prepareVideo(item as SourceTrack));
    }

    Object.values(value).forEach((nested) => scan(nested, visited));
  };

  entries.forEach((entry) => scan(entry));
  scan(primaryPayload);

  if (!options.lightweight) {
    try {
      const searchResults = await searchAlbums(artist.name, 30);
      for (const item of searchResults.items) {
        const matchesArtist =
          item.artist?.id === artistId ||
          (Array.isArray(item.artists) &&
            item.artists.some((candidate) => candidate.id === artistId));

        if (matchesArtist && !albumMap.has(item.id)) {
          albumMap.set(item.id, item);
        }
      }
    } catch {
      // Ignore supplemental search errors.
    }

    try {
      const videoSearchResult = await searchVideos(artist.name, 20);
      for (const item of videoSearchResult.items) {
        const itemArtistId = item.artist?.id;
        const matchesArtist =
          itemArtistId === artistId ||
          (Array.isArray(item.artists) && item.artists.some((a) => a.id === artistId));

        if (matchesArtist && !videoMap.has(item.id)) {
          videoMap.set(item.id, prepareVideo(item));
        }
      }
    } catch {
      // Ignore supplemental video search errors.
    }
  }

  const rawReleases = Array.from(albumMap.values());
  const allReleases = deduplicateAlbums(rawReleases).sort(
    (a, b) =>
      new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime(),
  );
  const eps = allReleases.filter((album) => album.type === "EP" || album.type === "SINGLE");
  const albums = allReleases.filter((album) => !eps.includes(album));

  let tracks = Array.from(trackMap.values())
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20);

  if (tracks.length === 0) {
    tracks = await loadArtistTopTracks(artistId, 20);
  }

  const videos = Array.from(videoMap.values()).sort(
    (a, b) => new Date(b.album?.releaseDate || 0).getTime() - new Date(a.album?.releaseDate || 0).getTime(),
  );

  const result: SourceArtistPage = {
    ...artist,
    albums,
    eps,
    tracks,
    videos,
  };

  await cache.set("artist", cacheKey, result);
  return result;
}

export async function getSimilarArtists(
  { cache, requestJson }: ArtistDeps,
  artistId: number,
) {
  const cached = await cache.get<SourceArtist[]>("similar_artists", artistId);
  if (cached) return cached;

  try {
    const json = await requestJson(`/artist/similar/?id=${artistId}`, {
      minVersion: "2.3",
    });
    const payload = extractPayload(json);
    const items =
      getArrayProp(payload, "artists").length > 0
        ? getArrayProp(payload, "artists")
        : getArrayProp(payload, "items").length > 0
          ? getArrayProp(payload, "items")
          : getArrayProp(json, "artists");
    const result = items.map((artist) => prepareArtist(artist as SourceArtist));
    await cache.set("similar_artists", artistId, result);
    return result;
  } catch {
    return [];
  }
}

export async function getArtistBiography(
  { cache }: ArtistDeps,
  artistId: number,
) {
  const cacheKey = `artist_bio_${artistId}`;
  const cached = await cache.get<{ text: string; source: string } | null>(
    "artist_bio",
    cacheKey,
  );
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.tidal.com/v1/artists/${artistId}/bio?locale=en_US&countryCode=GB`,
      {
        headers: {
          "X-Tidal-Token": TIDAL_V2_TOKEN,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.text) {
        const bio = {
          text: data.text,
          source: data.source || "Tidal",
        };
        await cache.set("artist_bio", cacheKey, bio);
        return bio;
      }
    }
  } catch {
    // Ignore biography endpoint failures.
  }

  return null;
}
