import type { Track } from "@/types/music";

const ARTISTGRID_ASSETS_URL = "https://assets.artistgrid.cx";
const DEFAULT_CANVAS_COLOR = "352 88% 60%";
const UNRELEASED_PROXY_URL = "/api/unreleased";
const UNRELEASED_CACHE_VERSION = 1;
const UNRELEASED_CACHE_TTL_MS = 1000 * 60 * 30;

type ArtistGridArtistRecord = {
  name?: string;
  url?: string;
};

type ArtistGridTrendEntry = {
  name?: string;
  visitors?: number;
};

type ArtistGridTrendResponse = {
  results?: ArtistGridTrendEntry[];
};

type TrackerSongRecord = {
  name?: string;
  url?: string;
  urls?: string[];
  desc?: string;
  description?: string;
  category?: string;
  track_length?: string;
  [key: string]: unknown;
};

type TrackerEraRecord = {
  name?: string;
  timeline?: string;
  image?: string;
  data?: Record<string, TrackerSongRecord[]>;
  [key: string]: unknown;
};

type TrackerResponse = {
  eras?: Record<string, TrackerEraRecord>;
};

export type UnreleasedArtist = {
  sheetId: string;
  name: string;
  url: string;
  imageUrl: string;
  popularity: number;
};

export type UnreleasedSong = {
  name: string;
  description: string;
  category: string;
  duration: number;
  sourceUrl: string | null;
  directUrl: string | null;
  trackerMeta: {
    artist?: string;
    project?: string;
    era?: string;
    timeline?: string;
    category?: string;
    trackNumber?: number;
    addedDate?: string;
    leakedDate?: string;
    recordingDate?: string;
    releaseDate?: string;
    notes?: string;
    sourceUrls: string[];
    raw: Record<string, unknown>;
  };
};

export type UnreleasedProject = {
  name: string;
  timeline: string;
  imageUrl: string;
  trackCount: number;
  availableCount: number;
  songs: UnreleasedSong[];
  trackerMeta: {
    songGroups: string[];
    raw: Record<string, unknown>;
  };
};

const artistCache = new Map<string, UnreleasedArtist[]>();
const trackerCache = new Map<string, UnreleasedProject[]>();

type UnreleasedCacheSnapshot<T> = {
  timestamp: number;
  value: T;
  version: number;
};

function normalizeArtistName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getArtistImageUrl(name: string) {
  const normalized = normalizeArtistName(name);
  return normalized ? `${ARTISTGRID_ASSETS_URL}/${normalized}.webp` : "/placeholder.svg";
}

export function getSheetIdFromArtistGridUrl(url: string | null | undefined) {
  if (!url) return null;
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

function parseDuration(value: string | null | undefined) {
  if (!value || value === "N/A") return 0;
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return 0;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function getFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function getFirstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function getStringArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;

    const strings = value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
    if (strings.length > 0) return strings;
  }

  return [] as string[];
}

function getDirectUrl(rawUrl: string | null) {
  if (!rawUrl) return null;

  if (rawUrl.includes("pillows.su/f/")) {
    const match = rawUrl.match(/pillows\.su\/f\/([a-f0-9]+)/i);
    if (match?.[1]) return `https://api.pillows.su/api/download/${match[1]}`;
  }

  if (rawUrl.includes("music.froste.lol/song/")) {
    const match = rawUrl.match(/music\.froste\.lol\/song\/([a-f0-9]+)/i);
    if (match?.[1]) return `https://music.froste.lol/song/${match[1]}/download`;
  }

  const audioExtensions = [".mp3", ".m4a", ".flac", ".wav", ".ogg", ".aac"];
  if (audioExtensions.some((extension) => rawUrl.toLowerCase().includes(extension))) {
    return rawUrl;
  }

  return null;
}

function parseTimelineYear(timeline: string) {
  const matches = timeline.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length === 0) return new Date().getFullYear();
  return Number.parseInt(matches[matches.length - 1], 10);
}

function getArtistsCacheStorageKey() {
  return "knobb-unreleased-artists";
}

function getProjectsCacheStorageKey(sheetId: string) {
  return `knobb-unreleased-projects:${sheetId}`;
}

function readCachedSnapshot<T>(storageKey: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<UnreleasedCacheSnapshot<T>>;
    if (
      parsed.version !== UNRELEASED_CACHE_VERSION ||
      typeof parsed.timestamp !== "number" ||
      Date.now() - parsed.timestamp >= UNRELEASED_CACHE_TTL_MS
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function writeCachedSnapshot<T>(storageKey: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    const payload: UnreleasedCacheSnapshot<T> = {
      timestamp: Date.now(),
      value,
      version: UNRELEASED_CACHE_VERSION,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

async function fetchArtistPopularity() {
  try {
    const response = await fetch(`${UNRELEASED_PROXY_URL}?resource=trends`);
    if (!response.ok) return new Map<string, number>();

    const data = await response.json() as ArtistGridTrendResponse;
    const entries = Array.isArray(data.results) ? data.results : [];
    const popularity = new Map<string, number>();

    entries.forEach((entry, index) => {
      const name = typeof entry.name === "string" ? entry.name : "";
      const visitors = typeof entry.visitors === "number" ? entry.visitors : 0;
      if (!name) return;
      const score = visitors * (1 - (index / Math.max(entries.length, 1)));
      popularity.set(name.toLowerCase(), score);
    });

    return popularity;
  } catch {
    return new Map<string, number>();
  }
}

export async function fetchUnreleasedArtists() {
  const cacheKey = "artists";
  const cached = artistCache.get(cacheKey);
  if (cached) return cached;

  const cachedSnapshot = readCachedSnapshot<UnreleasedArtist[]>(getArtistsCacheStorageKey());
  if (cachedSnapshot && cachedSnapshot.length > 0) {
    artistCache.set(cacheKey, cachedSnapshot);
    return cachedSnapshot;
  }

  const [popularity, response] = await Promise.all([
    fetchArtistPopularity(),
    fetch(`${UNRELEASED_PROXY_URL}?resource=artists`),
  ]);

  if (!response.ok) {
    throw new Error("Failed to load unreleased artists");
  }

  const text = await response.text();
  const artists = text
    .trim()
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as ArtistGridArtistRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is ArtistGridArtistRecord => Boolean(record?.name && record?.url))
    .map((record) => {
      const sheetId = getSheetIdFromArtistGridUrl(record.url);
      if (!sheetId || !record.name || !record.url) return null;

      return {
        sheetId,
        name: record.name,
        url: record.url,
        imageUrl: getArtistImageUrl(record.name),
        popularity: popularity.get(record.name.toLowerCase()) ?? 0,
      } satisfies UnreleasedArtist;
    })
    .filter((artist): artist is UnreleasedArtist => Boolean(artist))
    .sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));

  artistCache.set(cacheKey, artists);
  writeCachedSnapshot(getArtistsCacheStorageKey(), artists);
  return artists;
}

export function getCachedUnreleasedArtists() {
  const cacheKey = "artists";
  return artistCache.get(cacheKey) || readCachedSnapshot<UnreleasedArtist[]>(getArtistsCacheStorageKey()) || [];
}

function mapSongRecord(song: TrackerSongRecord, project: TrackerEraRecord, index: number): UnreleasedSong {
  const raw = asRecord(song);
  const sourceUrl =
    (typeof song.url === "string" && song.url.trim()) ||
    (Array.isArray(song.urls) ? song.urls.find((value) => typeof value === "string" && value.trim()) : null) ||
    null;
  const sourceUrls = [
    ...new Set(
      [
        sourceUrl,
        ...getStringArray(raw, ["urls", "sources", "links"]),
      ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())),
    ),
  ];

  return {
    name: song.name || "Untitled Track",
    description: song.desc || song.description || "",
    category: song.category || "",
    duration: parseDuration(song.track_length),
    sourceUrl,
    directUrl: getDirectUrl(sourceUrl),
    trackerMeta: {
      artist: getFirstString(raw, ["artist", "artist_name", "artistName"]),
      project: getFirstString(raw, ["project", "album", "project_name", "projectName"]),
      era: getFirstString(raw, ["era", "era_name", "eraName"]) || project.name,
      timeline: getFirstString(raw, ["timeline", "era_timeline", "eraTimeline"]) || project.timeline,
      category: song.category || getFirstString(raw, ["category", "type", "kind"]),
      trackNumber: getFirstNumber(raw, ["track_number", "trackNumber", "track", "number"]) ?? index + 1,
      addedDate: getFirstString(raw, ["added_date", "addedDate", "date_added", "dateAdded"]),
      leakedDate: getFirstString(raw, ["leaked_date", "leakedDate", "leak_date", "leakDate"]),
      recordingDate: getFirstString(raw, ["recording_date", "recordingDate"]),
      releaseDate: getFirstString(raw, ["release_date", "releaseDate"]),
      notes: getFirstString(raw, ["notes", "note", "tracker_notes", "trackerNotes"]),
      sourceUrls,
      raw,
    },
  };
}

function mapProjectRecord(project: TrackerEraRecord): UnreleasedProject {
  const raw = asRecord(project);
  const songs = Object.values(project.data || {})
    .flatMap((entries) => entries || [])
    .map((song, index) => mapSongRecord(song, project, index));

  return {
    name: project.name || "Untitled Project",
    timeline: project.timeline || "Unreleased",
    imageUrl: project.image || "/placeholder.svg",
    trackCount: songs.length,
    availableCount: songs.filter((song) => Boolean(song.directUrl)).length,
    songs,
    trackerMeta: {
      songGroups: Object.keys(project.data || {}),
      raw,
    },
  };
}

export async function fetchUnreleasedProjects(sheetId: string) {
  const cached = trackerCache.get(sheetId);
  if (cached) return cached;

  const cachedSnapshot = readCachedSnapshot<UnreleasedProject[]>(getProjectsCacheStorageKey(sheetId));
  if (cachedSnapshot && cachedSnapshot.length > 0) {
    trackerCache.set(sheetId, cachedSnapshot);
    return cachedSnapshot;
  }

  const response = await fetch(`${UNRELEASED_PROXY_URL}?resource=tracker&sheetId=${encodeURIComponent(sheetId)}`);
  if (!response.ok) {
    throw new Error("Failed to load unreleased projects");
  }

  const data = await response.json() as TrackerResponse;
  const projects = Object.values(data.eras || {})
    .map(mapProjectRecord)
    .filter((project) => project.trackCount > 0);

  trackerCache.set(sheetId, projects);
  writeCachedSnapshot(getProjectsCacheStorageKey(sheetId), projects);
  return projects;
}

export async function fetchUnreleasedArtistPage(sheetId: string) {
  const [artists, projects] = await Promise.all([
    fetchUnreleasedArtists(),
    fetchUnreleasedProjects(sheetId),
  ]);

  const artist = artists.find((entry) => entry.sheetId === sheetId);
  if (!artist) {
    throw new Error("Unreleased artist not found");
  }

  return { artist, projects };
}

export function createUnreleasedTrack(
  song: UnreleasedSong,
  project: UnreleasedProject,
  artist: UnreleasedArtist,
  index: number,
): Track {
  return {
    id: `unreleased:${artist.sheetId}:${encodeURIComponent(project.name)}:${index}`,
    title: song.name,
    artist: artist.name,
    album: project.name,
    duration: song.duration,
    year: parseTimelineYear(project.timeline),
    releaseDate: song.trackerMeta.releaseDate,
    coverUrl: project.imageUrl || artist.imageUrl || "/placeholder.svg",
    canvasColor: DEFAULT_CANVAS_COLOR,
    streamUrl: song.directUrl || undefined,
    explicit: false,
  };
}
