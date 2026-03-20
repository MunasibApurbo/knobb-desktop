import {
  filterAudioTracks,
  getTidalImageUrl,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchTracks,
  searchVideos,
  tidalTrackToAppTrack,
} from "@/lib/musicApi";
import type { TidalArtist } from "@/lib/musicApiTypes";

function normalizeQuery(value: string) {
  return value.trim();
}

function normalizeSearchableText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
}

function tokenizeSearchableText(value: string | null | undefined) {
  return normalizeSearchableText(value).split(" ").filter(Boolean);
}

const DERIVATIVE_PROFILE_MARKERS = new Set([
  "cover",
  "fan",
  "fans",
  "tribute",
  "karaoke",
]);

const COLLABORATION_CONNECTOR_PATTERN = /(?:,|&|\+|\/|\b(?:and|feat|featuring|ft|with|x|vs)\b)/i;

function containsAllQueryTokens(queryTokens: string[], candidateTokens: string[]) {
  return queryTokens.every((token) => candidateTokens.includes(token));
}

function removeQueryTokens(candidateTokens: string[], queryTokens: string[]) {
  const remaining = [...candidateTokens];

  for (const token of queryTokens) {
    const index = remaining.indexOf(token);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }

  return remaining;
}

function shouldExcludeArtistFromProfiles(query: string, artist: TidalArtist) {
  const normalizedName = normalizeSearchableText(artist.name);
  if (!normalizedName || normalizedName === query) {
    return false;
  }

  const candidateTokens = tokenizeSearchableText(artist.name);
  const hasDerivativeMarker = candidateTokens.some((token) => DERIVATIVE_PROFILE_MARKERS.has(token));
  if (hasDerivativeMarker) {
    return true;
  }

  const queryTokens = tokenizeSearchableText(query);
  if (queryTokens.length < 2 || !containsAllQueryTokens(queryTokens, candidateTokens)) {
    return false;
  }

  const remainingTokens = removeQueryTokens(candidateTokens, queryTokens);
  if (remainingTokens.length === 0) {
    return false;
  }

  return COLLABORATION_CONNECTOR_PATTERN.test(artist.name) || remainingTokens.length > 0;
}

function scoreText(query: string, candidate: string) {
  if (!query || !candidate) return 0;
  if (candidate === query) return 180;
  if (candidate.startsWith(query)) return 140;
  if (candidate.includes(query)) return 110;

  const queryTokens = query.split(" ").filter(Boolean);
  let score = 0;
  for (const token of queryTokens) {
    if (candidate.startsWith(token)) score += 26;
    else if (candidate.includes(token)) score += 15;
  }

  return score - Math.max(0, candidate.length - query.length) * 0.03;
}

function toImageUrl(value: string | null | undefined, size = "750x750") {
  if (!value) return "/placeholder.svg";
  if (/^https?:\/\//i.test(value)) return value;
  return getTidalImageUrl(value, size);
}

export async function searchTidalReference(query: string) {
  const trimmed = normalizeQuery(query);
  if (!trimmed) {
    return { tracks: [], videos: [], artists: [], albums: [], playlists: [] };
  }
  const normalizedQuery = normalizeSearchableText(trimmed);

  const [tracks, videos, artists, albums, playlists] = await Promise.all([
    searchTracks(trimmed, 30).catch(() => []),
    searchVideos(trimmed, 20).catch(() => []),
    searchArtists(trimmed, 16).catch(() => []),
    searchAlbums(trimmed, 15).catch(() => []),
    searchPlaylists(trimmed, 15).catch(() => []),
  ]);

  const dedupe = <T>(items: T[], keyFn: (item: T) => string) => {
    const map = new Map<string, T>();
    for (const item of items) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  };

  return {
    tracks: filterAudioTracks(
      dedupe(tracks, (track) => String(track.id)).map((t) => tidalTrackToAppTrack(t)),
    )
      .sort((left, right) => {
        const leftScore =
          scoreText(normalizedQuery, normalizeSearchableText(left.title)) * 1.8 +
          scoreText(normalizedQuery, normalizeSearchableText(left.artist)) +
          scoreText(normalizedQuery, normalizeSearchableText(left.album)) * 0.65;
        const rightScore =
          scoreText(normalizedQuery, normalizeSearchableText(right.title)) * 1.8 +
          scoreText(normalizedQuery, normalizeSearchableText(right.artist)) +
          scoreText(normalizedQuery, normalizeSearchableText(right.album)) * 0.65;

        return rightScore - leftScore;
      })
      .slice(0, 30),
    videos: dedupe(videos, (track) => String(track.id))
      .map((track) => tidalTrackToAppTrack(track))
      .sort((left, right) => {
        const leftScore =
          scoreText(normalizedQuery, normalizeSearchableText(left.title)) * 1.8 +
          scoreText(normalizedQuery, normalizeSearchableText(left.artist)) +
          scoreText(normalizedQuery, normalizeSearchableText(left.album)) * 0.65;
        const rightScore =
          scoreText(normalizedQuery, normalizeSearchableText(right.title)) * 1.8 +
          scoreText(normalizedQuery, normalizeSearchableText(right.artist)) +
          scoreText(normalizedQuery, normalizeSearchableText(right.album)) * 0.65;

        return rightScore - leftScore;
      })
      .slice(0, 20),
    artists: dedupe(artists, (artist) => String(artist.id))
      .filter((artist) => !shouldExcludeArtistFromProfiles(normalizedQuery, artist))
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        imageUrl: toImageUrl(artist.picture, "750x750"),
      }))
      .sort((left, right) => (
        scoreText(normalizedQuery, normalizeSearchableText(right.name)) -
        scoreText(normalizedQuery, normalizeSearchableText(left.name))
      ))
      .slice(0, 16),
    albums: dedupe(albums, (album) => String(album.id))
      .map((album) => ({
        id: album.id,
        title: album.title,
        artist: album.artist?.name || album.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
        coverUrl: toImageUrl(album.cover, "640x640"),
        releaseDate: album.releaseDate,
      }))
      .sort((left, right) => {
        const leftScore =
          scoreText(normalizedQuery, normalizeSearchableText(left.title)) * 1.5 +
          scoreText(normalizedQuery, normalizeSearchableText(left.artist));
        const rightScore =
          scoreText(normalizedQuery, normalizeSearchableText(right.title)) * 1.5 +
          scoreText(normalizedQuery, normalizeSearchableText(right.artist));

        return rightScore - leftScore;
      })
      .slice(0, 15),
    playlists: dedupe(playlists, (playlist) => String(playlist.uuid || playlist.title))
      .map((playlist) => ({
        id: playlist.uuid || `playlist-${playlist.title.toLowerCase().replace(/\s+/g, "-")}`,
        title: playlist.title,
        description: playlist.description || "",
        trackCount: playlist.numberOfTracks || 0,
        coverUrl: toImageUrl(playlist.squareImage || playlist.image, "640x640"),
      }))
      .sort((left, right) => {
        const leftScore =
          scoreText(normalizedQuery, normalizeSearchableText(left.title)) * 1.5 +
          scoreText(normalizedQuery, normalizeSearchableText(left.description));
        const rightScore =
          scoreText(normalizedQuery, normalizeSearchableText(right.title)) * 1.5 +
          scoreText(normalizedQuery, normalizeSearchableText(right.description));

        return rightScore - leftScore;
      })
      .slice(0, 15),
  };
}
