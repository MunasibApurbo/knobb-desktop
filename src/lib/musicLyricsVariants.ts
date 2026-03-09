import type { TidalTrack } from "@/lib/musicApiTypes";

function normalizeLookupText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
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
    keys.add(normalizeLookupText(track.artist.name));
  }

  for (const artist of track.artists || []) {
    const key = normalizeLookupText(artist.name);
    if (key) keys.add(key);
  }

  return keys;
}

export function getLyricsFallbackCandidateIds(baseTrack: TidalTrack, candidates: TidalTrack[]) {
  const baseTitle = normalizeLookupText(baseTrack.title);
  const baseAlbum = normalizeLookupText(baseTrack.album?.title);
  const baseVersion = normalizeLookupText(baseTrack.version);
  const baseArtists = getArtistKeys(baseTrack);
  const seen = new Set<number>();

  return candidates
    .map((candidate) => {
      if (!candidate?.id || candidate.id === baseTrack.id || seen.has(candidate.id)) return null;
      seen.add(candidate.id);

      if (normalizeLookupText(candidate.title) !== baseTitle) return null;

      const candidateArtists = getArtistKeys(candidate);
      const sharesArtist = Array.from(candidateArtists).some((artist) => baseArtists.has(artist));
      if (!sharesArtist) return null;

      const durationDelta =
        baseTrack.duration > 0 && candidate.duration > 0
          ? Math.abs(candidate.duration - baseTrack.duration)
          : 0;
      if (durationDelta > 8) return null;

      const candidateAlbum = normalizeLookupText(candidate.album?.title);
      const candidateVersion = normalizeLookupText(candidate.version);
      const normalizedQuality = normalizeAudioQuality(candidate.audioQuality);

      let score = 300;
      if (candidateAlbum && candidateAlbum === baseAlbum) score += 120;
      if (baseVersion && candidateVersion === baseVersion) score += 40;
      if (!baseVersion && !candidateVersion) score += 15;
      score += Math.max(0, 60 - durationDelta * 8);
      score += getAudioQualityRank(candidate.audioQuality) * 30;
      if (normalizedQuality === "LOW") score -= 45;

      return { id: candidate.id, score };
    })
    .filter((candidate): candidate is { id: number; score: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.id - left.id)
    .map((candidate) => candidate.id);
}
