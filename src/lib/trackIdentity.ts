import type { Track } from "@/types/music";

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
  if (!tidalId || track.tidalId === tidalId) {
    return track;
  }

  return {
    ...track,
    tidalId,
  };
}

function normalizeComparableTrackText(value: string | null | undefined) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/\((feat|ft)\.[^)]+\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSameTrack(
  currentTrack: Pick<Track, "id" | "tidalId" | "title" | "artist" | "duration"> | null | undefined,
  track: Pick<Track, "id" | "tidalId" | "title" | "artist" | "duration"> | null | undefined,
) {
  if (!currentTrack || !track) return false;
  if (currentTrack.id === track.id) return true;

  const currentTidalId = getResolvableTidalId(currentTrack);
  const nextTidalId = getResolvableTidalId(track);
  if (currentTidalId && nextTidalId && currentTidalId === nextTidalId) {
    return true;
  }

  const sameTitle = normalizeComparableTrackText(currentTrack.title) === normalizeComparableTrackText(track.title);
  const sameArtist = normalizeComparableTrackText(currentTrack.artist) === normalizeComparableTrackText(track.artist);
  const closeDuration = Math.abs((currentTrack.duration || 0) - (track.duration || 0)) <= 1;

  return sameTitle && sameArtist && closeDuration;
}
