import type { Track } from "@/types/music";
import { buildSourceTrackId, getTrackSource, getTrackSourceId } from "@/lib/librarySources";

export function inferTidalIdFromTrackId(trackId: string | null | undefined) {
  const normalized = String(trackId || "").trim();
  if (!normalized) return undefined;

  const tidalMatch = normalized.match(/^tidal-(\d+)(?:-\d+)?$/i);
  if (tidalMatch) {
    const parsed = Number.parseInt(tidalMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function getResolvableTidalId(track: Pick<Track, "id" | "tidalId">) {
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return track.tidalId;
  }

  return inferTidalIdFromTrackId(track.id);
}

export function normalizeTrackIdentity<T extends Track>(track: T): T {
  const tidalId = getResolvableTidalId(track);
  const source = getTrackSource(track);
  const sourceId = getTrackSourceId(track);
  if ((!tidalId || track.tidalId === tidalId) && track.source === source && track.sourceId === sourceId) {
    return track;
  }

  return {
    ...track,
    source,
    sourceId: sourceId || undefined,
    id: sourceId ? buildSourceTrackId(source, sourceId) : track.id,
    tidalId,
  };
}

function getStableTrackIdentity(
  track: Pick<Track, "id" | "isLocal" | "localFileId" | "source" | "sourceId" | "tidalId"> | null | undefined,
) {
  if (!track) return null;

  if (track.isLocal) {
    const localId = typeof track.localFileId === "string" && track.localFileId.trim()
      ? track.localFileId.trim()
      : typeof track.id === "string" && track.id.trim()
        ? track.id.trim()
        : null;

    return localId ? `local:${localId.toLocaleLowerCase()}` : null;
  }

  if (track.source === "youtube-music" && typeof track.sourceId === "string" && track.sourceId.trim()) {
    return `youtube-music:${track.sourceId.trim().toLocaleLowerCase()}`;
  }

  const tidalId = getResolvableTidalId(track);
  if (tidalId) {
    return `tidal:${tidalId}`;
  }

  return null;
}

function normalizeComparableTrackText(value: string | null | undefined) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/\((feat|ft)\.[^)]+\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSameTrack(
  currentTrack: Pick<Track, "id" | "isLocal" | "localFileId" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "duration"> | null | undefined,
  track: Pick<Track, "id" | "isLocal" | "localFileId" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "duration"> | null | undefined,
) {
  if (!currentTrack || !track) return false;

  const currentStableIdentity = getStableTrackIdentity(currentTrack);
  const nextStableIdentity = getStableTrackIdentity(track);
  if (currentStableIdentity && nextStableIdentity) {
    return currentStableIdentity === nextStableIdentity;
  }

  const currentSourceId = typeof currentTrack.sourceId === "string" && currentTrack.sourceId.trim()
    ? currentTrack.sourceId
    : null;
  const nextSourceId = typeof track.sourceId === "string" && track.sourceId.trim()
    ? track.sourceId
    : null;
  if (currentSourceId && nextSourceId) {
    return getTrackSource(currentTrack) === getTrackSource(track)
      && currentSourceId.trim().toLocaleLowerCase() === nextSourceId.trim().toLocaleLowerCase();
  }

  const currentTidalId = getResolvableTidalId(currentTrack);
  const nextTidalId = getResolvableTidalId(track);
  if (currentTidalId && nextTidalId && currentTidalId === nextTidalId) {
    return true;
  }

  const sameRawId = String(currentTrack.id || "").trim().toLocaleLowerCase() === String(track.id || "").trim().toLocaleLowerCase();
  const sameTitle = normalizeComparableTrackText(currentTrack.title) === normalizeComparableTrackText(track.title);
  const sameArtist = normalizeComparableTrackText(currentTrack.artist) === normalizeComparableTrackText(track.artist);
  const closeDuration = Math.abs((currentTrack.duration || 0) - (track.duration || 0)) <= 1;

  if (sameRawId) {
    return sameTitle && sameArtist && closeDuration;
  }

  return sameTitle && sameArtist && closeDuration;
}
