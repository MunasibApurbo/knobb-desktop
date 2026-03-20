import type { Track } from "@/types/music";
import type { LibrarySource, TrackSource } from "@/lib/librarySources";

const PLACEHOLDER_COVER_URL = "/placeholder.svg";
const DEFAULT_CANVAS_COLOR = "220 70% 55%";

type UnknownTrackArtist = {
  id?: unknown;
  name?: unknown;
};

type UnknownTrackRecord = Partial<Track> & {
  artists?: UnknownTrackArtist[];
};

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function toRoundedNonNegativeNumber(value: unknown, fallback = 0) {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return fallback;
  return Math.max(0, Math.round(parsed));
}

function parseTrackKey(trackKey?: string | null): { source?: TrackSource; sourceId?: string } {
  const normalizedTrackKey = toNonEmptyString(trackKey);
  if (!normalizedTrackKey) return {};

  const separatorIndex = normalizedTrackKey.indexOf(":");
  if (separatorIndex < 0) return {};

  const sourceToken = normalizedTrackKey.slice(0, separatorIndex);
  const sourceId = normalizedTrackKey.slice(separatorIndex + 1).trim();
  if (!sourceId) return {};

  if (sourceToken === "tidal" || sourceToken === "youtube-music" || sourceToken === "local") {
    return {
      source: sourceToken,
      sourceId,
    };
  }

  return {};
}

function inferTrackSource(
  rawTrack: UnknownTrackRecord,
  trackId: string | null,
  trackKey?: string | null,
): TrackSource | undefined {
  if (rawTrack.isLocal === true) return "local";
  if (rawTrack.source === "tidal" || rawTrack.source === "youtube-music" || rawTrack.source === "local") {
    return rawTrack.source;
  }

  const parsedTrackKey = parseTrackKey(trackKey);
  if (parsedTrackKey.source) return parsedTrackKey.source;

  if (typeof rawTrack.tidalId === "number" && Number.isFinite(rawTrack.tidalId)) return "tidal";
  if (trackId?.startsWith("ytm-")) return "youtube-music";
  if (trackId?.startsWith("tidal-")) return "tidal";

  return undefined;
}

function inferTrackSourceId(
  rawTrack: UnknownTrackRecord,
  source: TrackSource | undefined,
  trackId: string | null,
  trackKey?: string | null,
) {
  const explicitSourceId = toNonEmptyString(rawTrack.sourceId);
  if (explicitSourceId) return explicitSourceId;

  const parsedTrackKey = parseTrackKey(trackKey);
  if (parsedTrackKey.sourceId && (!source || parsedTrackKey.source === source)) {
    return parsedTrackKey.sourceId;
  }

  if (source === "youtube-music" && trackId?.startsWith("ytm-")) {
    return trackId.slice(4).trim() || null;
  }

  if (source === "tidal" && trackId?.startsWith("tidal-")) {
    const rawSourceId = trackId.slice(6).trim();
    return rawSourceId || null;
  }

  if (source === "tidal" && typeof rawTrack.tidalId === "number" && Number.isFinite(rawTrack.tidalId)) {
    return String(rawTrack.tidalId);
  }

  return null;
}

function buildFallbackTrackId(
  title: string,
  artist: string,
  album: string,
  duration: number,
) {
  const slug = `${title}-${artist}-${album}-${duration}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `history-${slug || "track"}`;
}

function buildTrackId(
  rawTrack: UnknownTrackRecord,
  source: TrackSource | undefined,
  sourceId: string | null,
  title: string,
  artist: string,
  album: string,
  duration: number,
) {
  const explicitId = toNonEmptyString(rawTrack.id);
  if (explicitId) return explicitId;

  if (source === "youtube-music" && sourceId) return `ytm-${sourceId}`;
  if (source === "tidal" && sourceId) return `tidal-${sourceId}`;
  if (source === "local" && sourceId) return sourceId;

  return buildFallbackTrackId(title, artist, album, duration);
}

function normalizeTrackArtists(rawTrack: UnknownTrackRecord, artistName: string) {
  if (!Array.isArray(rawTrack.artists) || rawTrack.artists.length === 0) {
    return undefined;
  }

  const normalized = rawTrack.artists
    .map((artist) => {
      const name = toNonEmptyString(artist?.name);
      if (!name) return null;
      const id = typeof artist?.id === "number" || typeof artist?.id === "string"
        ? artist.id
        : undefined;
      return { id, name };
    })
    .filter((artist): artist is { id?: number | string; name: string } => Boolean(artist));

  if (normalized.length > 0) return normalized;

  return artistName
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function normalizeTrackRecord(value: unknown, options: { trackKey?: string | null } = {}): Track {
  const rawTrack = (value && typeof value === "object" ? value : {}) as UnknownTrackRecord;

  const title = toNonEmptyString(rawTrack.title) ?? "Unknown Track";
  const artist = toNonEmptyString(rawTrack.artist) ?? "Unknown Artist";
  const album = toNonEmptyString(rawTrack.album) ?? "Unknown Album";
  const duration = toRoundedNonNegativeNumber(rawTrack.duration);
  const releaseDate = toNonEmptyString(rawTrack.releaseDate) ?? undefined;
  const source = inferTrackSource(rawTrack, toNonEmptyString(rawTrack.id), options.trackKey);
  const sourceId = inferTrackSourceId(rawTrack, source, toNonEmptyString(rawTrack.id), options.trackKey) ?? undefined;
  const trackId = buildTrackId(rawTrack, source, sourceId ?? null, title, artist, album, duration);

  const yearFromTrack = toFiniteNumber(rawTrack.year);
  const yearFromReleaseDate = releaseDate ? new Date(releaseDate).getFullYear() : NaN;
  const year = yearFromTrack != null
    ? Math.round(yearFromTrack)
    : Number.isFinite(yearFromReleaseDate)
      ? yearFromReleaseDate
      : 0;

  const tidalId = typeof rawTrack.tidalId === "number" && Number.isFinite(rawTrack.tidalId)
    ? rawTrack.tidalId
    : source === "tidal" && sourceId && /^\d+$/.test(sourceId)
      ? Number.parseInt(sourceId, 10)
      : undefined;

  return {
    ...rawTrack,
    id: trackId,
    source: source as LibrarySource | "local" | undefined,
    sourceId,
    tidalId,
    title,
    artist,
    album,
    duration,
    year,
    releaseDate,
    coverUrl: toNonEmptyString(rawTrack.coverUrl) ?? PLACEHOLDER_COVER_URL,
    canvasColor: toNonEmptyString(rawTrack.canvasColor) ?? DEFAULT_CANVAS_COLOR,
    artists: normalizeTrackArtists(rawTrack, artist),
    localFileId: toNonEmptyString(rawTrack.localFileId) ?? undefined,
    localImportedAt: toNonEmptyString(rawTrack.localImportedAt) ?? undefined,
    audioQuality:
      rawTrack.audioQuality === "LOW" ||
      rawTrack.audioQuality === "MEDIUM" ||
      rawTrack.audioQuality === "HIGH" ||
      rawTrack.audioQuality === "LOSSLESS" ||
      rawTrack.audioQuality === "MAX"
        ? rawTrack.audioQuality
        : undefined,
    explicit: rawTrack.explicit === true,
    isVideo: rawTrack.isVideo === true,
    isUnavailable: rawTrack.isUnavailable === true,
    isLocal: rawTrack.isLocal === true || source === "local",
  };
}

export function sanitizeTrackRecords(values: unknown[]) {
  return values
    .map((value) => normalizeTrackRecord(value))
    .filter((track) => Boolean(track.id && track.title && track.artist));
}
