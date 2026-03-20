const TIDAL_BROWSE_PROXY_URL = "/api/tidal-browse";
const DEFAULT_LOCALE = "en_US";
const DEFAULT_COUNTRY_CODE = "US";

type TidalDirectResourceKind =
  | "albums"
  | "artists"
  | "playlists"
  | "tracks"
  | "videos";

const responseCache = new Map<string, unknown>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function buildCacheKey(kind: TidalDirectResourceKind, id: string | number) {
  return `${kind}:${String(id).trim()}`;
}

async function requestTidalDirectResource<T>(kind: TidalDirectResourceKind, id: string | number) {
  const normalizedId = String(id).trim();
  if (!normalizedId) {
    throw new Error(`${kind} id is required`);
  }

  const cacheKey = buildCacheKey(kind, normalizedId);
  const cached = responseCache.get(cacheKey);
  if (cached) {
    return cached as T;
  }

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  const query = new URLSearchParams({
    path: `${kind}/${normalizedId}`,
    locale: DEFAULT_LOCALE,
    countryCode: DEFAULT_COUNTRY_CODE,
  });

  const request = fetch(`${TIDAL_BROWSE_PROXY_URL}?${query.toString()}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load official TIDAL ${kind}/${normalizedId}`);
      }

      const payload = await response.json() as T;
      responseCache.set(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function fetchOfficialTidalArtist(artistId: number) {
  return requestTidalDirectResource("artists", artistId);
}

export function fetchOfficialTidalAlbum(albumId: number) {
  return requestTidalDirectResource("albums", albumId);
}

export function fetchOfficialTidalPlaylist(playlistId: string) {
  return requestTidalDirectResource("playlists", playlistId);
}

export function fetchOfficialTidalTrack(trackId: number) {
  return requestTidalDirectResource("tracks", trackId);
}

export function fetchOfficialTidalVideo(videoId: number) {
  return requestTidalDirectResource("videos", videoId);
}
