import { searchTracks, tidalTrackToAppTrack, type TidalTrack } from "@/lib/musicApi";
import type { Track } from "@/types/music";

export type PlaylistImportFormat = "csv" | "jspf" | "xspf" | "xml" | "m3u";
export type CsvImportProvider = "spotify" | "appleMusic" | "youtubeMusic";

export type PlaylistImportRequest =
  | { file: File; format: Exclude<PlaylistImportFormat, "csv"> }
  | { file: File; format: "csv"; provider: Exclude<CsvImportProvider, "youtubeMusic"> }
  | { format: "csv"; provider: "youtubeMusic"; url: string };

export type PlaylistImportProgress = {
  current: number;
  total: number;
  currentArtist?: string;
  currentTrack?: string;
  stage: "fetching" | "matching";
};

export type PlaylistImportMissingTrack = {
  album?: string;
  artist?: string;
  title: string;
};

export type PlaylistImportResult = {
  format: PlaylistImportFormat;
  missingTracks: PlaylistImportMissingTrack[];
  provider?: CsvImportProvider;
  tracks: Track[];
};

type ParsedImportTrack = PlaylistImportMissingTrack & {
  isrc?: string;
};

type YoutubeImportSong = {
  artist?: string;
  title?: string;
  url?: string;
};

const HEADER_MAPPINGS = {
  album: ["album", "album name"],
  artist: ["artist name(s)", "artist name", "artist", "artists", "creator", "artist names"],
  isrc: ["isrc", "isrc code"],
  track: ["track name", "title", "song", "name", "track", "track title"],
  type: ["type", "category", "kind"],
} as const;

type CsvHeaderKey = keyof typeof HEADER_MAPPINGS;

function stripUtf8Bom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function isFuzzyMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function getTrackArtistName(item: TidalTrack) {
  return item.artists?.map((artist) => artist.name).join(", ") || item.artist?.name || "";
}

function findBestTrackMatch(items: TidalTrack[], candidate: ParsedImportTrack) {
  if (!items.length) return null;

  if (candidate.isrc) {
    const isrcMatch = items.find((item) => {
      const value = (item as TidalTrack & { isrc?: string }).isrc;
      return normalizeText(value) === normalizeText(candidate.isrc);
    });
    if (isrcMatch) return isrcMatch;
  }

  const scoredMatches = items
    .map((item) => {
      const titleMatches = isFuzzyMatch(item.title, candidate.title);
      if (!titleMatches) return null;

      const itemArtist = getTrackArtistName(item);
      const artistMatches = candidate.artist ? isFuzzyMatch(itemArtist, candidate.artist) : false;
      const albumMatches = candidate.album ? isFuzzyMatch(item.album?.title, candidate.album) : false;

      let score = 100;
      if (artistMatches) score += 10;
      if (albumMatches) score += 4;
      if (normalizeText(item.title) === normalizeText(candidate.title)) score += 2;
      if (candidate.artist && !artistMatches) score -= 6;
      if (candidate.album && !albumMatches) score -= 2;

      return {
        item,
        score,
      };
    })
    .filter((entry): entry is { item: TidalTrack; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score);

  return scoredMatches[0]?.item || null;
}

function detectCsvDelimiter(text: string) {
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (inQuotes) continue;
    if (char === ",") commaCount += 1;
    if (char === ";") semicolonCount += 1;
    if (char === "\n" || char === "\r") break;
  }

  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentValue = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  const delimiter = detectCsvDelimiter(text);

  const commitValue = () => {
    currentRow.push(stripUtf8Bom(currentValue.trim()));
    currentValue = "";
  };

  const commitRow = () => {
    if (currentRow.length === 0) return;
    const hasNonEmptyValue = currentRow.some((value) => value.length > 0);
    if (hasNonEmptyValue) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      commitValue();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      commitValue();
      commitRow();
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    commitValue();
    commitRow();
  }

  return rows;
}

function mapHeaders(headers: string[]) {
  const mapped: Partial<Record<CsvHeaderKey, number>> = {};

  headers.forEach((header, index) => {
    const normalized = stripUtf8Bom(header).toLowerCase().trim().replace(/[_\s]+/g, " ");

    (Object.keys(HEADER_MAPPINGS) as CsvHeaderKey[]).forEach((key) => {
      if (mapped[key] !== undefined) return;
      if (HEADER_MAPPINGS[key].includes(normalized as never)) {
        mapped[key] = index;
      }
    });
  });

  return mapped;
}

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function textContent(node: ParentNode, selector: string) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

function parseSpotifyLikeCsv(text: string) {
  const rows = parseCsvRows(stripUtf8Bom(text));
  if (rows.length < 2) return [];

  const headers = rows[0];
  const mappedHeaders = mapHeaders(headers);
  const parsedTracks: ParsedImportTrack[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const type = mappedHeaders.type !== undefined ? values[mappedHeaders.type]?.toLowerCase().trim() : "";
    const title = mappedHeaders.track !== undefined ? values[mappedHeaders.track] : "";
    const artist = mappedHeaders.artist !== undefined ? values[mappedHeaders.artist] : "";
    const album = mappedHeaders.album !== undefined ? values[mappedHeaders.album] : "";
    const isrc = mappedHeaders.isrc !== undefined ? values[mappedHeaders.isrc] : "";

    if (type && !["track", "favorite", "favorite track", "song"].includes(type)) {
      continue;
    }

    if (!title || !artist) continue;

    parsedTracks.push({
      album: album || undefined,
      artist: artist || undefined,
      isrc: isrc || undefined,
      title,
    });
  }

  return parsedTracks;
}

function parseJspf(text: string) {
  const data = JSON.parse(text) as {
    playlist?: {
      track?: Array<{ album?: string; creator?: string; title?: string }>;
    };
  };

  return (data.playlist?.track || [])
    .map((item) => ({
      album: item.album?.trim() || undefined,
      artist: item.creator?.trim() || undefined,
      title: item.title?.trim() || "",
    }))
    .filter((item) => item.title && item.artist);
}

function parseXspf(text: string) {
  const xml = parseXml(text);
  return Array.from(xml.querySelectorAll("trackList > track"))
    .map((track) => ({
      album: textContent(track, "album") || undefined,
      artist: textContent(track, "creator") || undefined,
      title: textContent(track, "title"),
    }))
    .filter((item) => item.title && item.artist);
}

function parseGenericXml(text: string) {
  const xml = parseXml(text);
  return Array.from(xml.querySelectorAll("tracks > track"))
    .map((track) => ({
      album: textContent(track, "album") || undefined,
      artist: textContent(track, "artist") || undefined,
      title: textContent(track, "title"),
    }))
    .filter((item) => item.title && item.artist);
}

function parseM3u(text: string) {
  const lines = text.split(/\r?\n/);
  const parsedTracks: ParsedImportTrack[] = [];

  for (const line of lines) {
    if (!line.startsWith("#EXTINF:")) continue;

    const metadata = line.slice(line.indexOf(",") + 1).trim();
    const separator = metadata.indexOf(" - ");
    if (separator === -1) continue;

    const artist = metadata.slice(0, separator).trim();
    const title = metadata.slice(separator + 3).trim();
    if (!artist || !title) continue;

    parsedTracks.push({ artist, title });
  }

  return parsedTracks;
}

async function readFile(file: File) {
  return file.text();
}

async function readYoutubeImport(url: string) {
  const parsed = new URL(url);
  const playlistId = parsed.searchParams.get("list");
  if (!playlistId) {
    throw new Error("Invalid YouTube Music playlist URL");
  }

  const response = await fetch(`https://ytmimport.samidy.workers.dev?playlistId=${encodeURIComponent(playlistId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube Music playlist (${response.status})`);
  }

  const payload = (await response.json()) as YoutubeImportSong[] | { error?: string };
  if (!Array.isArray(payload)) {
    throw new Error(payload.error || "Invalid YouTube Music import response");
  }

  return payload
    .map((song) => ({
      artist: song.artist?.trim() || undefined,
      title: song.title?.trim() || "",
    }))
    .filter((song) => song.title);
}

async function matchImportedTracks(
  parsedTracks: ParsedImportTrack[],
  onProgress?: (progress: PlaylistImportProgress) => void,
) {
  const tracksByIndex: Array<Track | null> = new Array(parsedTracks.length).fill(null);
  const missingByIndex: Array<PlaylistImportMissingTrack | null> = new Array(parsedTracks.length).fill(null);
  const searchCache = new Map<string, Promise<TidalTrack[]>>();
  let nextIndex = 0;
  let completed = 0;

  const searchWithCache = (query: string) => {
    const cacheKey = query.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    const request = searchTracks(query, 10).catch(() => []);
    searchCache.set(cacheKey, request);
    return request;
  };

  const getSearchQueries = (candidate: ParsedImportTrack) => {
    return Array.from(new Set([
      candidate.isrc?.trim(),
      [`"${candidate.title}"`, candidate.artist].filter(Boolean).join(" ").trim(),
      [candidate.title, candidate.artist].filter(Boolean).join(" ").trim(),
      [candidate.title, candidate.album].filter(Boolean).join(" ").trim(),
      candidate.title.trim(),
    ].filter((query): query is string => Boolean(query))));
  };

  const getSearchResults = async (candidate: ParsedImportTrack) => {
    const queries = getSearchQueries(candidate);
    if (queries.length === 0) return null;

    const merged = new Map<number, TidalTrack>();

    for (const query of queries) {
      const results = await searchWithCache(query);
      for (const item of results) {
        merged.set(item.id, item);
      }
      if (merged.size > 0) {
        return Array.from(merged.values());
      }
    }

    return [];
  };

  const workerCount = Math.min(4, Math.max(1, parsedTracks.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const candidateIndex = nextIndex;
      nextIndex += 1;
      if (candidateIndex >= parsedTracks.length) return;

      const candidate = parsedTracks[candidateIndex];

      try {
        const searchResults = await getSearchResults(candidate);
        if (!searchResults) {
          missingByIndex[candidateIndex] = candidate;
          continue;
        }

        const matched = findBestTrackMatch(searchResults, candidate);
        if (!matched) {
          missingByIndex[candidateIndex] = candidate;
          continue;
        }

        tracksByIndex[candidateIndex] = tidalTrackToAppTrack(matched);
      } catch {
        missingByIndex[candidateIndex] = candidate;
      } finally {
        completed += 1;
        onProgress?.({
          current: completed,
          total: parsedTracks.length,
          currentArtist: candidate.artist,
          currentTrack: candidate.title,
          stage: "matching",
        });
      }
    }
  });

  await Promise.all(workers);

  return {
    missingTracks: missingByIndex.filter((candidate): candidate is PlaylistImportMissingTrack => candidate !== null),
    tracks: tracksByIndex.filter((track): track is Track => track !== null),
  };
}

export async function importPlaylist(
  request: PlaylistImportRequest,
  onProgress?: (progress: PlaylistImportProgress) => void,
): Promise<PlaylistImportResult> {
  let parsedTracks: ParsedImportTrack[] = [];

  if (request.format === "csv" && request.provider === "youtubeMusic") {
    onProgress?.({ current: 0, total: 0, stage: "fetching" });
    parsedTracks = await readYoutubeImport(request.url);
  } else if (request.format === "csv") {
    parsedTracks = parseSpotifyLikeCsv(await readFile(request.file));
  } else if (request.format === "jspf") {
    parsedTracks = parseJspf(await readFile(request.file));
  } else if (request.format === "xspf") {
    parsedTracks = parseXspf(await readFile(request.file));
  } else if (request.format === "xml") {
    parsedTracks = parseGenericXml(await readFile(request.file));
  } else if (request.format === "m3u") {
    parsedTracks = parseM3u(await readFile(request.file));
  }

  const matched = await matchImportedTracks(parsedTracks, onProgress);
  return {
    format: request.format,
    missingTracks: matched.missingTracks,
    provider: request.format === "csv" ? request.provider : undefined,
    tracks: matched.tracks,
  };
}
