import type { Track } from "@/types/music";

function getTrackMixQueueKey(track: Pick<Track, "id" | "tidalId">) {
  return track.tidalId ? `tidal:${track.tidalId}` : `app:${track.id}`;
}

export function getTrackMixId(track: Pick<Track, "mixes">) {
  const mixId = track.mixes?.TRACK_MIX;
  if (mixId === null || mixId === undefined || mixId === "") return null;
  return String(mixId);
}

export function getPrimaryArtistName(track: Pick<Track, "artist" | "artists">) {
  const namedArtist = track.artists?.find((artist) => artist.name.trim().length > 0)?.name?.trim();
  if (namedArtist) return namedArtist;

  return track.artist
    .split(",")[0]
    ?.trim() || "";
}

export function buildTrackMixQueue(seedTrack: Track, candidateTracks: Track[]) {
  const seen = new Set<string>();
  const queue: Track[] = [];

  for (const track of [seedTrack, ...candidateTracks]) {
    const key = getTrackMixQueueKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(track);
  }

  return queue;
}
