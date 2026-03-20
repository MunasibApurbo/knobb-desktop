import { BROWSE_GENRES, type BrowseGenreDefinition } from "@/lib/browseGenres";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";

type TidalGenreApiRecord = {
  name?: string;
  path?: string;
  image?: string;
  hasPlaylists?: boolean;
  hasArtists?: boolean;
  hasAlbums?: boolean;
  hasTracks?: boolean;
  hasVideos?: boolean;
};

const TIDAL_BROWSE_PROXY_URL = "/api/tidal-browse";
const DEFAULT_LOCALE = "en_US";
const DEFAULT_COUNTRY_CODE = "US";

let cachedGenres: BrowseGenreDefinition[] | null = null;
let cachedGenresPromise: Promise<BrowseGenreDefinition[]> | null = null;
const cachedGenreDetails = new Map<string, BrowseGenreDefinition>();

function normalizeGenreToken(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function createGenreRouteId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "genre";
}

function createFallbackGenreColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }

  return `${Math.abs(hash) % 360} 64% 54%`;
}

function requestTidalGenrePath<T>(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({
    path,
    locale: DEFAULT_LOCALE,
    countryCode: DEFAULT_COUNTRY_CODE,
    ...params,
  });

  return fetch(`${TIDAL_BROWSE_PROXY_URL}?${query.toString()}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load TIDAL genre path ${path}`);
    }

    return response.json() as Promise<T>;
  });
}

function mergeGenreRecord(record: TidalGenreApiRecord) {
  const label = String(record.name || "").trim();
  const apiPath = String(record.path || "").trim();
  if (!label || !apiPath) return null;

  const normalizedApiPath = normalizeGenreToken(apiPath);
  const normalizedLabel = normalizeGenreToken(label);
  const fallback = BROWSE_GENRES.find((genre) => (
    normalizeGenreToken(genre.apiPath) === normalizedApiPath ||
    normalizeGenreToken(genre.label) === normalizedLabel ||
    normalizeGenreToken(genre.id) === normalizedApiPath
  ));

  return {
    id: fallback?.id || createGenreRouteId(apiPath),
    label,
    query: fallback?.query || `${label} essentials`,
    color: fallback?.color || createFallbackGenreColor(apiPath || label),
    apiPath,
    imageUrl: record.image ? getTidalImageUrl(record.image, "750x750") : fallback?.imageUrl,
    hasPlaylists: record.hasPlaylists ?? fallback?.hasPlaylists,
    hasArtists: record.hasArtists ?? fallback?.hasArtists,
    hasAlbums: record.hasAlbums ?? fallback?.hasAlbums,
    hasTracks: record.hasTracks ?? fallback?.hasTracks,
    hasVideos: record.hasVideos ?? fallback?.hasVideos,
    source: "tidal-api",
  } satisfies BrowseGenreDefinition;
}

function sortGenres(genres: BrowseGenreDefinition[]) {
  const fallbackOrder = new Map(BROWSE_GENRES.map((genre, index) => [genre.id, index]));

  return [...genres].sort((left, right) => {
    const leftOrder = fallbackOrder.get(left.id);
    const rightOrder = fallbackOrder.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.label.localeCompare(right.label);
  });
}

export async function fetchTidalGenres() {
  if (cachedGenres) {
    return cachedGenres;
  }

  if (!cachedGenresPromise) {
    cachedGenresPromise = requestTidalGenrePath<TidalGenreApiRecord[]>("genres", {
      filterId: "USER_SELECTABLE",
    })
      .then((records) => sortGenres(
        records
          .map((record) => mergeGenreRecord(record))
          .filter((record): record is BrowseGenreDefinition => Boolean(record)),
      ))
      .then((genres) => {
        cachedGenres = genres;
        return genres;
      })
      .finally(() => {
        cachedGenresPromise = null;
      });
  }

  return cachedGenresPromise;
}

export async function fetchTidalGenreDetail(apiPath: string) {
  const cacheKey = apiPath.trim();
  if (!cacheKey) {
    throw new Error("Genre path is required");
  }

  const cached = cachedGenreDetails.get(cacheKey);
  if (cached) {
    return cached;
  }

  const record = await requestTidalGenrePath<TidalGenreApiRecord>(`genres/${cacheKey}`);
  const merged = mergeGenreRecord(record);
  if (!merged) {
    throw new Error(`Genre ${apiPath} was not returned by TIDAL`);
  }

  cachedGenreDetails.set(cacheKey, merged);
  return merged;
}

export function findBrowseGenreByToken(
  genres: BrowseGenreDefinition[],
  token: string | null | undefined,
) {
  const normalizedToken = normalizeGenreToken(token);
  if (!normalizedToken) return null;

  return (
    genres.find((genre) => normalizeGenreToken(genre.id) === normalizedToken) ||
    genres.find((genre) => normalizeGenreToken(genre.apiPath) === normalizedToken) ||
    genres.find((genre) => normalizeGenreToken(genre.label) === normalizedToken) ||
    null
  );
}
