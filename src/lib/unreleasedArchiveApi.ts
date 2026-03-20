const UNRELEASED_PROXY_URLS = [
  "/api/unreleased",
  "/.netlify/functions/unreleased-proxy",
] as const;

const ARTISTGRID_ASSET_BASE_URL = "https://assets.artistgrid.cx";
const ARTISTGRID_SITE_URL = "https://artistgrid.cx";

type ArtistGridProxyResource = "artists" | "tested" | "trends" | "tracker";

type ArtistGridDirectoryRow = {
  best?: boolean | number;
  credit?: string;
  links_work?: boolean | number;
  name?: string;
  updated?: boolean | number;
  url?: string;
};

export type ArtistGridArtist = {
  name: string;
  cleanName: string;
  url: string;
  credit: string;
  imageFilename: string;
  imageUrl: string;
  isAlt: boolean;
  isLinkWorking: boolean;
  isUpdated: boolean;
  isStarred: boolean;
  sheetId: string | null;
};

export type ArtistGridTrendEntry = {
  name: string;
  visitors: number;
};

export type ArtistGridTrendsResponse = {
  results?: ArtistGridTrendEntry[];
};

export type ArtistGridTrackerLeak = {
  name: string;
  extra?: string;
  description?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  type?: string;
  available_length?: string;
  quality?: string;
  url?: string;
  urls?: string[];
};

export type ArtistGridTrackerEra = {
  name: string;
  extra?: string;
  timeline?: string;
  fileInfo?: string[];
  image?: string;
  textColor?: string;
  backgroundColor?: string;
  description?: string;
  data?: Record<string, ArtistGridTrackerLeak[]>;
};

export type ArtistGridTrackerResponse = {
  name: string | null | undefined;
  tabs: string[];
  current_tab: string;
  eras: Record<string, ArtistGridTrackerEra>;
};

const requestCache = new Map<string, Promise<unknown>>();

function looksLikeHtmlDocument(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function buildUnexpectedResponseError(endpoint: string, responseText: string, responseType: string | null) {
  if (looksLikeHtmlDocument(responseText)) {
    return new Error(`ArtistGrid proxy returned HTML instead of data from ${endpoint}`);
  }

  const preview = responseText.trim().slice(0, 160);
  return new Error(
    preview
      ? `ArtistGrid proxy returned invalid data from ${endpoint}: ${preview}`
      : `ArtistGrid proxy returned an empty response from ${endpoint}${responseType ? ` (${responseType})` : ""}`,
  );
}

async function requestArtistGrid(resource: ArtistGridProxyResource, params: Record<string, string | null | undefined> = {}) {
  const searchParams = new URLSearchParams({ resource });
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    searchParams.set(key, value);
  }

  const requestKey = searchParams.toString();
  const cached = requestCache.get(requestKey);
  if (cached) {
    return cached as Promise<string>;
  }

  const requestPromise = (async () => {
    let lastError: Error | null = null;

    for (const endpoint of UNRELEASED_PROXY_URLS) {
      let response: Response;
      try {
        response = await fetch(`${endpoint}?${searchParams.toString()}`, {
          headers: {
            Accept: resource === "artists" ? "application/x-ndjson, text/plain, application/json" : "application/json",
          },
        });
      } catch (error) {
        lastError = error instanceof Error
          ? error
          : new Error(`ArtistGrid request failed for ${endpoint}`);
        continue;
      }

      const responseText = await response.text();
      const responseType = response.headers.get("content-type");

      if (!response.ok) {
        lastError = new Error(responseText || `ArtistGrid request failed: ${response.status}`);
        continue;
      }

      if (looksLikeHtmlDocument(responseText)) {
        lastError = buildUnexpectedResponseError(endpoint, responseText, responseType);
        continue;
      }

      return responseText;
    }

    throw lastError || new Error("ArtistGrid request failed");
  })();

  requestCache.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    requestCache.delete(requestKey);
  }
}

function slugifyArtistAssetName(value: string) {
  return `${value.toLowerCase().replace(/[^a-z0-9]/g, "")}.webp`;
}

function parseArtistGridBool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function extractArtistGridSheetId(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{44})/);
  return match?.[1] || null;
}

export function getArtistGridSheetEditUrl(url: string) {
  const sheetId = extractArtistGridSheetId(url);
  return sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : url;
}

export function buildArtistGridTrackerUrl(sheetId: string, artistName?: string | null, tab?: string | null) {
  const params = new URLSearchParams({ id: sheetId });
  if (artistName) {
    params.set("artist", artistName);
  }
  if (tab) {
    params.set("tab", tab);
  }
  return `${ARTISTGRID_SITE_URL}/view?${params.toString()}`;
}

export function normalizeArtistGridArtistName(name: string) {
  return name.replace(/\s*\[Alt(?:\s*#\d+)?\]\s*$/i, "").trim();
}

export function sortArtistGridArtistsByPopularity(artists: ArtistGridArtist[], trends: Map<string, number>) {
  return [...artists].sort((left, right) => {
    const leftVisitors = trends.get(left.cleanName) || trends.get(left.name) || 0;
    const rightVisitors = trends.get(right.cleanName) || trends.get(right.name) || 0;

    const group = (artist: ArtistGridArtist, visitors: number) => {
      if (artist.isStarred && visitors > 0) return 1;
      if (artist.isStarred) return 2;
      if (visitors > 0) return 3;
      return 4;
    };

    const leftGroup = group(left, leftVisitors);
    const rightGroup = group(right, rightVisitors);

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    if ((leftGroup === 1 || leftGroup === 3) && leftVisitors !== rightVisitors) {
      return rightVisitors - leftVisitors;
    }

    return left.cleanName.localeCompare(right.cleanName);
  });
}

export function getArtistGridTrackCount(eras: Record<string, ArtistGridTrackerEra>) {
  return Object.values(eras).reduce((total, era) => {
    const groups = Object.values(era.data || {});
    return total + groups.reduce((groupTotal, items) => groupTotal + items.length, 0);
  }, 0);
}

export function clearArtistGridCache() {
  requestCache.clear();
}

export async function fetchArtistGridArtists() {
  const text = await requestArtistGrid("artists");
  const artists = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as ArtistGridDirectoryRow;
      } catch {
        return null;
      }
    })
    .filter((row): row is ArtistGridDirectoryRow => Boolean(row?.name && row?.url))
    .map((row) => {
      const name = String(row.name).trim();
      const cleanName = normalizeArtistGridArtistName(name);
      const imageFilename = slugifyArtistAssetName(name);

      return {
        name,
        cleanName,
        url: String(row.url).trim(),
        credit: typeof row.credit === "string" ? row.credit.trim() : "",
        imageFilename,
        imageUrl: `${ARTISTGRID_ASSET_BASE_URL}/${imageFilename}`,
        isAlt: /\[Alt/i.test(name),
        isLinkWorking: parseArtistGridBool(row.links_work),
        isUpdated: parseArtistGridBool(row.updated),
        isStarred: parseArtistGridBool(row.best),
        sheetId: extractArtistGridSheetId(String(row.url)),
      } satisfies ArtistGridArtist;
    });

  return artists;
}

export async function fetchArtistGridTrends() {
  const text = await requestArtistGrid("trends");
  const payload = JSON.parse(text) as ArtistGridTrendsResponse;
  const trendMap = new Map<string, number>();

  for (const item of payload.results || []) {
    if (!item?.name) continue;
    trendMap.set(String(item.name).trim(), Number(item.visitors) || 0);
  }

  return trendMap;
}

export async function fetchArtistGridTestedTrackers() {
  const text = await requestArtistGrid("tested");
  const payload = JSON.parse(text) as unknown;
  return Array.isArray(payload)
    ? payload.map((item) => String(item)).filter(Boolean)
    : [];
}

export async function fetchArtistGridTracker(sheetId: string, tab?: string) {
  const text = await requestArtistGrid("tracker", {
    sheetId,
    tab: tab?.trim() || null,
  });
  return JSON.parse(text) as ArtistGridTrackerResponse;
}
