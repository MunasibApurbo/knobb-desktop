import { safeStorageGetItem } from "@/lib/safeStorage";
import type { Track } from "@/types/music";

export type LibrarySource = "tidal" | "youtube-music";
export type TrackSource = LibrarySource | "local";

export const DEFAULT_LIBRARY_SOURCE: LibrarySource = "tidal";
export const LIBRARY_SOURCE_STORAGE_KEY = "library-source";

export function isLibrarySource(value: string | null | undefined): value is LibrarySource {
  return value === "tidal" || value === "youtube-music";
}

export function getStoredLibrarySource() {
  const stored = safeStorageGetItem(LIBRARY_SOURCE_STORAGE_KEY);
  return isLibrarySource(stored) ? stored : DEFAULT_LIBRARY_SOURCE;
}

export function getTrackSource(track: Pick<Track, "id" | "isLocal" | "source" | "tidalId"> | null | undefined): TrackSource {
  if (!track) return "tidal";
  if (track.isLocal) return "local";
  if (track.source === "youtube-music" || track.source === "tidal" || track.source === "local") {
    return track.source;
  }
  if (typeof track.id === "string" && track.id.startsWith("ytm-")) return "youtube-music";
  return "tidal";
}

export function getTrackSourceId(track: Pick<Track, "id" | "sourceId" | "tidalId"> | null | undefined) {
  if (!track) return null;
  if (track.sourceId && track.sourceId.trim()) return track.sourceId.trim();
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) return String(track.tidalId);
  if (typeof track.id === "string" && track.id.trim()) {
    if (track.id.startsWith("tidal-")) return track.id.replace(/^tidal-/, "").replace(/-\d+$/, "");
    if (track.id.startsWith("ytm-")) return track.id.replace(/^ytm-/, "");
    return track.id.trim();
  }
  return null;
}

export function buildSourceTrackId(source: TrackSource, sourceId: string) {
  if (source === "local") return sourceId;
  return source === "youtube-music" ? `ytm-${sourceId}` : `tidal-${sourceId}`;
}

export function buildTrackKey(track: Pick<Track, "id" | "isLocal" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "album" | "duration">) {
  const source = getTrackSource(track);
  const sourceId = getTrackSourceId(track);
  if (sourceId) {
    return `${source}:${sourceId}`;
  }
  if (track.id) {
    return `id:${String(track.id).trim().toLowerCase()}`;
  }
  return `fallback:${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}::${track.album.trim().toLowerCase()}::${track.duration}`;
}
