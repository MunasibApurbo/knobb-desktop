import type { Track } from "@/types/music";

export type PlayableTrackCandidate = Pick<Track, "isUnavailable" | "isVideo">;

export function getTrackPlaybackIssue(track: PlayableTrackCandidate | null | undefined) {
  if (!track) return "unavailable";
  if (track.isUnavailable === true) return "unavailable";
  return null;
}

export function isTrackPlayable(track: PlayableTrackCandidate | null | undefined) {
  return getTrackPlaybackIssue(track) === null;
}

export function filterPlayableTracks<T extends PlayableTrackCandidate>(tracks: T[]) {
  return tracks.filter((track) => isTrackPlayable(track));
}
