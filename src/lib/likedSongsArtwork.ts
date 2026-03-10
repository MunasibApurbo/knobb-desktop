import type { Track } from "@/types/music";

export function getLatestLikedSongsArtwork(likedSongs: Track[]) {
  let fallbackCoverUrl: string | null = null;
  let latestCoverUrl: string | null = null;
  let latestAddedAt = Number.NEGATIVE_INFINITY;

  for (const track of likedSongs) {
    if (!track.coverUrl) continue;

    fallbackCoverUrl ??= track.coverUrl;

    const addedAt = track.addedAt ? Date.parse(track.addedAt) : Number.NaN;
    if (Number.isNaN(addedAt) || addedAt <= latestAddedAt) continue;

    latestAddedAt = addedAt;
    latestCoverUrl = track.coverUrl;
  }

  return latestCoverUrl ?? fallbackCoverUrl;
}
