import type { APICache } from "@/lib/musicCoreCache";
import type {
  SearchResponse,
  SourceAlbum,
  SourceArtist,
  SourcePlaylist,
  SourceTrack,
} from "@/lib/musicCoreShared";
import {
  deduplicateAlbums,
  normalizeSearchResponse,
  prepareAlbum,
  prepareArtist,
  preparePlaylist,
  prepareTrack,
} from "@/lib/musicCoreTransforms";

type SearchDeps = {
  cache: APICache;
  requestJson: (relativePath: string) => Promise<unknown>;
};

function emptySearchResult<T>(): SearchResponse<T> {
  return {
    items: [],
    limit: 0,
    offset: 0,
    totalNumberOfItems: 0,
  };
}

export async function searchTracks(
  { cache, requestJson }: SearchDeps,
  query: string,
  limit = 25,
) {
  const cacheKey = `${query}:${limit}`;
  const cached = await cache.get<SearchResponse<SourceTrack>>("search_tracks", cacheKey);
  if (cached) return cached;

  try {
    const data = await requestJson(`/search/?s=${encodeURIComponent(query)}&limit=${limit}`);
    const normalized = normalizeSearchResponse<SourceTrack>(data, "tracks");
    const result = {
      ...normalized,
      items: normalized.items.map((track) => prepareTrack(track)),
    };
    await cache.set("search_tracks", cacheKey, result);
    return result;
  } catch {
    return emptySearchResult<SourceTrack>();
  }
}

export async function searchVideos(
  { cache, requestJson }: SearchDeps,
  query: string,
  limit = 20,
) {
  const cacheKey = `${query}:${limit}`;
  const cached = await cache.get<SearchResponse<SourceTrack>>("search_videos", cacheKey);
  if (cached) return cached;

  try {
    const data = await requestJson(`/search/?v=${encodeURIComponent(query)}&limit=${limit}`);
    const normalized = normalizeSearchResponse<SourceTrack>(data, "videos");
    const result = {
      ...normalized,
      items: normalized.items.map((track) => prepareTrack(track)),
    };
    await cache.set("search_videos", cacheKey, result);
    return result;
  } catch {
    return emptySearchResult<SourceTrack>();
  }
}

export async function searchArtists(
  { cache, requestJson }: SearchDeps,
  query: string,
  limit = 20,
) {
  const cacheKey = `${query}:${limit}`;
  const cached = await cache.get<SearchResponse<SourceArtist>>("search_artists", cacheKey);
  if (cached) return cached;

  try {
    const data = await requestJson(`/search/?a=${encodeURIComponent(query)}&limit=${limit}`);
    const normalized = normalizeSearchResponse<SourceArtist>(data, "artists");
    const result = {
      ...normalized,
      items: normalized.items.map((artist) => prepareArtist(artist)),
    };
    await cache.set("search_artists", cacheKey, result);
    return result;
  } catch {
    return emptySearchResult<SourceArtist>();
  }
}

export async function searchAlbums(
  { cache, requestJson }: SearchDeps,
  query: string,
  limit = 20,
) {
  const cacheKey = `${query}:${limit}`;
  const cached = await cache.get<SearchResponse<SourceAlbum>>("search_albums", cacheKey);
  if (cached) return cached;

  try {
    const data = await requestJson(`/search/?al=${encodeURIComponent(query)}&limit=${limit}`);
    const normalized = normalizeSearchResponse<SourceAlbum>(data, "albums");
    const result = {
      ...normalized,
      items: deduplicateAlbums(normalized.items.map((album) => prepareAlbum(album))),
    };
    await cache.set("search_albums", cacheKey, result);
    return result;
  } catch {
    return emptySearchResult<SourceAlbum>();
  }
}

export async function searchPlaylists(
  { cache, requestJson }: SearchDeps,
  query: string,
  limit = 20,
) {
  const cacheKey = `${query}:${limit}`;
  const cached = await cache.get<SearchResponse<SourcePlaylist>>("search_playlists", cacheKey);
  if (cached) return cached;

  try {
    const data = await requestJson(`/search/?p=${encodeURIComponent(query)}&limit=${limit}`);
    const normalized = normalizeSearchResponse<SourcePlaylist>(data, "playlists");
    const result = {
      ...normalized,
      items: normalized.items.map((playlist) => preparePlaylist(playlist)),
    };
    await cache.set("search_playlists", cacheKey, result);
    return result;
  } catch {
    return emptySearchResult<SourcePlaylist>();
  }
}
