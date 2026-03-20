import type { TidalTrack } from "@/lib/musicApiTypes";

export function normalizeLyricsLookupText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeAudioQuality(value: string | null | undefined) {
  return String(value || "HIGH").trim().toUpperCase();
}

function getAudioQualityRank(value: string | null | undefined) {
  const normalized = normalizeAudioQuality(value);
  if (normalized === "HI_RES_LOSSLESS" || normalized === "MAX" || normalized === "MASTER") return 4;
  if (normalized === "LOSSLESS") return 3;
  if (normalized === "HIGH") return 2;
  if (normalized === "MEDIUM") return 1;
  if (normalized === "LOW") return 0;
  return 1;
}

function getArtistKeys(track: Pick<TidalTrack, "artist" | "artists">) {
  const keys = new Set<string>();

  if (track.artist?.name) {
    keys.add(normalizeLyricsLookupText(track.artist.name));
  }

  for (const artist of track.artists || []) {
    const key = normalizeLyricsLookupText(artist.name);
    if (key) keys.add(key);
  }

  return keys;
}


export function cleanTrackTitle(title: string): string {
  return String(title || "")
    .replace(/\(feat\..*?\)/gi, "")
    .replace(/\[feat\..*?\]/gi, "")
    .replace(/\(with.*?\)/gi, "")
    .replace(/\(Official.*?\)/gi, "")
    .replace(/\(Video.*?\)/gi, "")
    .replace(/\(Vertical.*?\)/gi, "")
    .replace(/\(Live.*?\)/gi, "")
    .replace(/\(Remastered.*?\)/gi, "")
    .replace(/\(Radio Edit.*?\)/gi, "")
    .replace(/\(Extended.*?\)/gi, "")
    .replace(/\(Mix.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCleanLyricsSearchQuery(track: Pick<TidalTrack, "title" | "artist" | "artists">): string {
  const title = cleanTrackTitle(track.title);
  const artist = track.artists?.[0]?.name || track.artist?.name || "";
  return `${artist} ${title}`.trim();
}

export function getLyricsFallbackCandidateIds(baseTrack: TidalTrack, candidates: TidalTrack[]) {
  const baseTitle = normalizeLyricsLookupText(baseTrack.title);
  const baseAlbum = normalizeLyricsLookupText(baseTrack.album?.title);
  const baseVersion = normalizeLyricsLookupText(baseTrack.version);
  const baseArtists = getArtistKeys(baseTrack);
  const seen = new Set<number>();

  return candidates
    .map((candidate) => {
      if (!candidate?.id || candidate.id === baseTrack.id || seen.has(candidate.id)) return null;
      seen.add(candidate.id);

      if (normalizeLyricsLookupText(candidate.title) !== baseTitle) return null;

      const candidateArtists = getArtistKeys(candidate);
      const sharesArtist = Array.from(candidateArtists).some((artist) => baseArtists.has(artist));
      if (!sharesArtist) return null;

      const durationDelta =
        baseTrack.duration > 0 && candidate.duration > 0
          ? Math.abs(candidate.duration - baseTrack.duration)
          : 0;

      // Relax duration constraint for videos, as they often have different intro/outros.
      const maxDelta = baseTrack.isVideo ? 42 : 12;
      if (durationDelta > maxDelta) return null;

      const candidateAlbum = normalizeLyricsLookupText(candidate.album?.title);
      const candidateVersion = normalizeLyricsLookupText(candidate.version);
      const normalizedQuality = normalizeAudioQuality(candidate.audioQuality);

      let score = 300;
      if (candidateAlbum && candidateAlbum === baseAlbum) score += 120;
      if (baseVersion && candidateVersion === baseVersion) score += 40;
      if (!baseVersion && !candidateVersion) score += 15;

      // Score based on duration proximity, but less strictly for videos.
      const durationScoreLimit = baseTrack.isVideo ? 80 : 60;
      score += Math.max(0, durationScoreLimit - durationDelta * (baseTrack.isVideo ? 1.5 : 5));

      score += getAudioQualityRank(candidate.audioQuality) * 30;
      if (normalizedQuality === "LOW") score -= 45;

      return { id: candidate.id, score };
    })
    .filter((candidate): candidate is { id: number; score: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.id - left.id)
    .map((candidate) => candidate.id);
}
