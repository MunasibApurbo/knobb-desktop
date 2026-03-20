import {
  API_INSTANCE_POOL,
  STREAMING_INSTANCE_POOL,
  musicCore,
  type EndpointLatencySnapshot,
  type SourceAlbum,
  type SourceArtist,
  type SourceTrack,
} from "@/lib/musicCore";
import {
  buildInstanceUrl,
  deriveTrackQuality,
  fetchJsonWithTimeout,
  normalizeOrigin,
  resolveProtocol,
  UPTIME_URLS,
} from "@/lib/musicCoreShared";
import type { AudioQuality } from "@/contexts/player/playerTypes";
import type {
  AlbumResult,
  ArtistCredit,
  CoverAsset,
  LyricsResult,
  MixResult,
  PlaylistResult,
  TidalAlbum,
  TidalArtist,
  TidalLyricLine,
  TidalMix,
  TidalPlaylist,
  TidalSearchResult,
  TidalStreamResult,
  TidalTrack,
  TidalTrackInfo,
} from "@/lib/musicApiTypes";
import {
  dedupeAlbums,
  filterAudioTracks,
  getTidalImageUrl,
  hexToHsl,
  mapAlbum,
  mapArtist,
  mapPlaylist,
  mapTrack,
  parsePlaylistTracks,
  qualityAttempts,
  tidalTrackToAppTrack,
} from "@/lib/musicApiTransforms";
import { getLyricsFallbackCandidateIds, getCleanLyricsSearchQuery } from "@/lib/musicLyricsVariants";
import {
  fetchOfficialTidalAlbum,
  fetchOfficialTidalArtist,
  fetchOfficialTidalPlaylist,
  fetchOfficialTidalTrack,
  fetchOfficialTidalVideo,
} from "@/lib/tidalDirectApi";

export { API_INSTANCE_POOL, STREAMING_INSTANCE_POOL };
export type { EndpointLatencySnapshot };
export type {
  AlbumResult,
  ArtistCredit,
  CoverAsset,
  LyricsResult,
  MixResult,
  PlaylistResult,
  TidalAlbum,
  TidalArtist,
  TidalLyricLine,
  TidalMix,
  TidalPlaylist,
  TidalSearchResult,
  TidalStreamResult,
  TidalTrack,
  TidalTrackInfo,
};
export {
  filterAudioTracks,
  getTidalImageUrl,
  hexToHsl,
  tidalTrackToAppTrack,
};

export async function getVideoPlaybackSource(trackId: number): Promise<PlaybackSource | null> {
  const cacheKey = `video:${trackId}`;
  const cached = playbackSourceCache.get(cacheKey);
  if (cached) return cached;

  let lastError: unknown = null;
  try {
    const source = await musicCore.getVideo(trackId);
    const playbackSource: PlaybackSource | null = source.originalTrackUrl
      ? { url: source.originalTrackUrl, type: resolveProtocol(source.originalTrackUrl, source.info.manifestMimeType) }
      : decodePlaybackSource(source.info.manifest, source.info.manifestMimeType) || { url: "", type: "direct" };

    if (playbackSource && playbackSource.url) {
      playbackSourceCache.set(cacheKey, playbackSource);
      return playbackSource;
    }
  } catch (error) {
    lastError = error;
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

export function getApiLatencySnapshot(): EndpointLatencySnapshot[] {
  return musicCore.getLatencySnapshot();
}

export function clearMusicApiCache() {
  musicCore.clearCaches();
  lyricsCache.clear();
  for (const source of playbackSourceCache.values()) {
    if (source.type === "dash") {
      URL.revokeObjectURL(source.url);
    }
  }
  playbackSourceCache.clear();
  cachedLyricsInstanceUrls = null;
}

export function invalidateTrackStreamCache(trackId: number) {
  musicCore.invalidateTrackStream(trackId);
  const prefix = `${trackId}:`;
  for (const [key, source] of Array.from(playbackSourceCache.entries())) {
    if (!key.startsWith(prefix) && key !== `video:${trackId}`) continue;
    if (source.type === "dash") {
      URL.revokeObjectURL(source.url);
    }
    playbackSourceCache.delete(key);
  }
}

const artistPageWarmups = new Map<number, Promise<void>>();
const artistImageCache = new Map<string, string>();
const artistImageResolvers = new Map<string, Promise<string>>();
const lyricsCache = new Map<number, LyricsResult>();
const playbackSourceCache = new Map<string, PlaybackSource>();
const ARTIST_IMAGE_STORAGE_PREFIX = "knobb-artist-image";
const LYRICS_INSTANCE_CACHE_TTL_MS = 1000 * 60 * 15;
let cachedLyricsInstanceUrls: { urls: string[]; timestamp: number } | null = null;

export type PlaybackSource = {
  url: string;
  type: "direct" | "dash" | "hls";
};

export type PlaybackSourceResolution = {
  quality: AudioQuality | null;
  capability: AudioQuality | null;
  source: PlaybackSource;
};

function normalizeResolvedAudioQuality(value: unknown): AudioQuality | null {
  const token = String(value || "").trim().toUpperCase();
  if (token === "HI_RES_LOSSLESS" || token === "MAX" || token === "MASTER") return "MAX";
  if (token === "LOSSLESS") return "LOSSLESS";
  if (token === "HIGH") return "HIGH";
  if (token === "MEDIUM") return "MEDIUM";
  if (token === "LOW") return "LOW";
  return null;
}

function decodePlaybackSource(manifest: string, manifestMimeType?: string): PlaybackSource | null {
  try {
    const decoded = atob(manifest);

    if (decoded.includes("<MPD")) {
      const blob = new Blob([decoded], { type: "application/dash+xml" });
      return {
        url: URL.createObjectURL(blob),
        type: "dash",
      };
    }

    try {
      const parsed = JSON.parse(decoded);
      const url = typeof parsed?.url === "string"
        ? parsed.url
        : Array.isArray(parsed?.urls) && parsed.urls.length > 0 && typeof parsed.urls[0] === "string"
          ? parsed.urls[0]
          : null;
      const mimeType = typeof parsed?.mimeType === "string"
        ? parsed.mimeType
        : typeof parsed?.manifestMimeType === "string"
          ? parsed.manifestMimeType
          : manifestMimeType;

      if (url) {
        return {
          url,
          type: resolveProtocol(url, mimeType),
        };
      }
    } catch {
      const match = decoded.match(/https?:\/\/[\w\-.~:?#[@!$&'()*+,;=%/]+/);
      if (match) {
        return {
          url: match[0],
          type: resolveProtocol(match[0], manifestMimeType),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function isUsableArtistImageUrl(value: string | null | undefined) {
  return Boolean(value && value !== "/placeholder.svg");
}

function normalizeArtistImageCacheKey(artistId: number, artistName?: string | null) {
  if (Number.isFinite(artistId) && artistId > 0) {
    return `id:${artistId}`;
  }

  const normalizedArtistName = artistName?.trim().toLowerCase();
  if (normalizedArtistName) {
    return `name:${normalizedArtistName}`;
  }

  return null;
}

function getArtistImageStorageKey(cacheKey: string) {
  return `${ARTIST_IMAGE_STORAGE_PREFIX}:${cacheKey}`;
}

function readPersistedArtistImageUrl(cacheKey: string) {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(getArtistImageStorageKey(cacheKey));
    return isUsableArtistImageUrl(value) ? value : null;
  } catch {
    return null;
  }
}

function persistArtistImageUrl(cacheKey: string, imageUrl: string) {
  if (typeof window === "undefined" || !isUsableArtistImageUrl(imageUrl)) return;

  try {
    window.localStorage.setItem(getArtistImageStorageKey(cacheKey), imageUrl);
  } catch {
    // Ignore storage quota failures and continue with memory cache only.
  }
}

export function getCachedArtistImageUrl(
  artistId: number,
  preferredImageUrl?: string | null,
  artistName?: string | null,
) {
  if (isUsableArtistImageUrl(preferredImageUrl)) {
    return preferredImageUrl as string;
  }

  const cacheKey = normalizeArtistImageCacheKey(artistId, artistName);
  if (!cacheKey) {
    return preferredImageUrl || "/placeholder.svg";
  }

  const inMemoryImage = artistImageCache.get(cacheKey);
  if (inMemoryImage) {
    return inMemoryImage;
  }

  const persistedImage = readPersistedArtistImageUrl(cacheKey);
  if (persistedImage) {
    artistImageCache.set(cacheKey, persistedImage);
    return persistedImage;
  }

  return preferredImageUrl || "/placeholder.svg";
}

export async function searchTracks(query: string, limit = 25): Promise<TidalTrack[]> {
  const result = await musicCore.searchTracks(query, limit);
  return result.items
    .map((track) => mapTrack(track))
    .filter((track): track is TidalTrack => Boolean(track))
    .slice(0, limit);
}

export async function searchVideos(query: string, limit = 25): Promise<TidalTrack[]> {
  const result = await musicCore.searchVideos(query, limit);
  return result.items
    .map((track) => mapTrack(track))
    .filter((track): track is TidalTrack => Boolean(track))
    .slice(0, limit);
}

export async function searchArtists(query: string, limit = 20): Promise<TidalArtist[]> {
  const result = await musicCore.searchArtists(query, limit);
  return result.items
    .map((artist) => mapArtist(artist))
    .filter((artist): artist is TidalArtist => Boolean(artist))
    .slice(0, limit);
}

export async function getArtistById(artistId: number): Promise<TidalArtist | null> {
  const officialArtist = await fetchOfficialTidalArtist(artistId)
    .then((artist) => mapArtist(artist as SourceArtist))
    .catch(() => null);
  if (officialArtist) {
    return officialArtist;
  }

  try {
    const artist = await musicCore.getArtistMetadata(artistId);
    return mapArtist(artist);
  } catch {
    return null;
  }
}

export async function searchAlbums(query: string, limit = 20): Promise<TidalAlbum[]> {
  const result = await musicCore.searchAlbums(query, limit);
  const directItems = result.items
    .map((album) => mapAlbum(album))
    .filter((album): album is TidalAlbum => Boolean(album));

  if (directItems.length > 0) {
    return directItems.slice(0, limit);
  }

  const trackResult = await musicCore.searchTracks(query, Math.max(limit, 30));
  const albumMap = new Map<number, TidalAlbum>();

  for (const track of trackResult.items) {
    const mapped = mapTrack(track);
    if (!mapped?.album?.id || albumMap.has(mapped.album.id)) continue;

    albumMap.set(mapped.album.id, {
      id: mapped.album.id,
      title: mapped.album.title,
      cover: mapped.album.cover,
      vibrantColor: mapped.album.vibrantColor,
      releaseDate: mapped.album.releaseDate,
      artist: mapped.artist.id ? { id: mapped.artist.id, name: mapped.artist.name } : undefined,
      artists: mapped.artists?.map((artist) => ({ id: artist.id, name: artist.name })),
    });
  }

  return Array.from(albumMap.values()).slice(0, limit);
}

export async function searchPlaylists(query: string, limit = 20): Promise<TidalPlaylist[]> {
  const result = await musicCore.searchPlaylists(query, limit);
  return result.items
    .map((playlist) => mapPlaylist(playlist))
    .filter((playlist): playlist is TidalPlaylist => Boolean(playlist))
    .slice(0, limit);
}

export async function getArtistPopularTracks(artistId: number, limit = 20): Promise<TidalTrack[]> {
  const tracks = await musicCore.getArtistTopTracks(artistId, limit);
  return tracks
    .map((track) => mapTrack(track))
    .filter((track): track is TidalTrack => Boolean(track))
    .slice(0, limit);
}

export async function getArtistTopTracks(artistId: number, limit = 20): Promise<TidalTrack[]> {
  return getArtistPopularTracks(artistId, limit);
}

export async function getArtistAlbums(artistId: number): Promise<TidalAlbum[]> {
  try {
    const artist = await musicCore.getArtist(artistId);
    const releases = [...(artist.albums || []), ...(artist.eps || [])]
      .map((album) => mapAlbum(album))
      .filter((album): album is TidalAlbum => Boolean(album));

    return dedupeAlbums(releases).sort(
      (a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime(),
    );
  } catch {
    return [];
  }
}

export async function getArtistAlbumsWithType(
  artistId: number,
  filter: "ALBUMS" | "SINGLES" | "EPS",
): Promise<TidalAlbum[]> {
  const albums = await getArtistAlbums(artistId);

  if (filter === "ALBUMS") {
    return albums.filter((album) => {
      if (album.type) return album.type === "ALBUM";
      return (album.numberOfTracks || 10) > 5;
    });
  }

  if (filter === "SINGLES") {
    return albums.filter((album) => {
      if (album.type) return album.type === "SINGLE";
      return (album.numberOfTracks || 0) === 1;
    });
  }

  return albums.filter((album) => {
    if (album.type) return album.type === "EP";
    const trackCount = album.numberOfTracks || 0;
    return trackCount > 1 && trackCount <= 5;
  });
}

export async function getArtistBio(artistId: number): Promise<string> {
  try {
    const [bio, artist] = await Promise.all([
      musicCore.getArtistBiography(artistId).catch(() => null),
      musicCore.getArtistMetadata(artistId).catch(() => null),
    ]);

    return bio?.text || artist?.bio || artist?.description || artist?.about || "";
  } catch {
    return "";
  }
}

export function warmArtistPageData(artistId: number) {
  if (!Number.isFinite(artistId) || artistId <= 0) {
    return Promise.resolve();
  }

  const existingWarmup = artistPageWarmups.get(artistId);
  if (existingWarmup) return existingWarmup;

  const warmup = Promise.allSettled([
    getArtistById(artistId),
    getArtistPopularTracks(artistId, 25),
    getArtistBio(artistId),
  ])
    .then(() => undefined)
    .finally(() => {
      artistPageWarmups.delete(artistId);
    });

  artistPageWarmups.set(artistId, warmup);
  return warmup;
}

export async function resolveArtistImageUrl(
  artistId: number,
  preferredImageUrl?: string | null,
  artistName?: string | null,
) {
  if (isUsableArtistImageUrl(preferredImageUrl)) {
    return preferredImageUrl as string;
  }

  const cacheKey = normalizeArtistImageCacheKey(artistId, artistName);
  if (!cacheKey) {
    return preferredImageUrl || "/placeholder.svg";
  }

  const cached =
    artistImageCache.get(cacheKey) ||
    readPersistedArtistImageUrl(cacheKey);
  if (cached) {
    artistImageCache.set(cacheKey, cached);
    return cached;
  }

  const pending = artistImageResolvers.get(cacheKey);
  if (pending) return pending;

  const resolution = (async () => {
    const hasArtistId = Number.isFinite(artistId) && artistId > 0;
    const normalizedArtistName = artistName?.trim().toLowerCase() || "";

    const artist = hasArtistId ? await getArtistById(artistId).catch(() => null) : null;
    if (artist?.picture) {
      return getTidalImageUrl(artist.picture, "750x750");
    }

    if (normalizedArtistName) {
      const searchResults = await searchArtists(artistName || normalizedArtistName, 8).catch(() => [] as TidalArtist[]);
      const matchingArtist =
        searchResults.find((result) => result.id === artistId && isUsableArtistImageUrl(result.picture)) ||
        searchResults.find(
          (result) =>
            result.name.trim().toLowerCase() === normalizedArtistName &&
            isUsableArtistImageUrl(result.picture),
        ) ||
        searchResults.find((result) => isUsableArtistImageUrl(result.picture)) ||
        null;

      if (matchingArtist?.picture) {
        return getTidalImageUrl(matchingArtist.picture, "750x750");
      }
    }

    if (hasArtistId) {
      const topTracks = await getArtistPopularTracks(artistId, 6).catch(() => [] as TidalTrack[]);
      const topTrackCover = topTracks.find((track) => track.album?.cover)?.album?.cover;
      if (topTrackCover) {
        return getTidalImageUrl(topTrackCover, "750x750");
      }
    }

    if (hasArtistId) {
      const albums = await getArtistAlbums(artistId).catch(() => [] as TidalAlbum[]);
      const albumCover = albums.find((album) => album.cover)?.cover;
      if (albumCover) {
        return getTidalImageUrl(albumCover, "750x750");
      }
    }

    return preferredImageUrl || "/placeholder.svg";
  })()
    .then((resolvedImageUrl) => {
      artistImageCache.set(cacheKey, resolvedImageUrl);
      persistArtistImageUrl(cacheKey, resolvedImageUrl);
      return resolvedImageUrl;
    })
    .finally(() => {
      artistImageResolvers.delete(cacheKey);
    });

  artistImageResolvers.set(cacheKey, resolution);
  return resolution;
}

export async function getArtistCredits(artistId: number): Promise<ArtistCredit[]> {
  try {
    const tracks = await getArtistTopTracks(artistId, 20);
    const creditMap = new Map<string, ArtistCredit>();

    for (const track of tracks) {
      for (const artist of track.artists || []) {
        if (artist.id !== artistId && !creditMap.has(artist.name)) {
          creditMap.set(artist.name, {
            name: artist.name,
            role: artist.type === "FEATURED"
              ? "Featured Artist"
              : artist.type === "MAIN"
                ? "Collaborator"
                : artist.type || "Contributor",
            id: artist.id,
          });
        }
      }

      if (track.artist && track.artist.id !== artistId && !creditMap.has(track.artist.name)) {
        creditMap.set(track.artist.name, {
          name: track.artist.name,
          role: "Collaborator",
          id: track.artist.id,
        });
      }
    }

    return Array.from(creditMap.values()).slice(0, 20);
  } catch {
    return [];
  }
}

export async function getAlbumTracks(albumId: number): Promise<TidalTrack[]> {
  try {
    const result = await musicCore.getAlbum(albumId);
    return result.tracks
      .map((track) => mapTrack(track))
      .filter((track): track is TidalTrack => Boolean(track));
  } catch {
    return [];
  }
}

export async function getAlbumWithTracks(albumId: number): Promise<AlbumResult> {
  const officialAlbumPromise = fetchOfficialTidalAlbum(albumId)
    .then((album) => mapAlbum(album as SourceAlbum))
    .catch(() => null);

  try {
    const [result, officialAlbum] = await Promise.all([
      musicCore.getAlbum(albumId),
      officialAlbumPromise,
    ]);
    return {
      album: officialAlbum || mapAlbum(result.album),
      tracks: result.tracks
        .map((track) => mapTrack(track))
        .filter((track): track is TidalTrack => Boolean(track)),
    };
  } catch {
    return { album: await officialAlbumPromise, tracks: [] };
  }
}

export async function getPlaylistWithTracks(playlistId: string): Promise<PlaylistResult> {
  const officialPlaylistPromise = fetchOfficialTidalPlaylist(playlistId)
    .then((playlist) => mapPlaylist(playlist as SourcePlaylist))
    .catch(() => null);

  try {
    const [result, officialPlaylist] = await Promise.all([
      musicCore.getPlaylist(playlistId),
      officialPlaylistPromise,
    ]);
    return {
      playlist: officialPlaylist || mapPlaylist(result.playlist),
      tracks: parsePlaylistTracks(result.tracks),
    };
  } catch {
    return { playlist: await officialPlaylistPromise, tracks: [] };
  }
}

export async function searchAlbumTracksByName(albumTitle: string, artistName: string): Promise<TidalTrack[]> {
  const albumLower = albumTitle.toLowerCase().trim();
  const artistLower = (artistName || "").toLowerCase().trim();

  const findByAlbumTitle = (results: TidalTrack[]) =>
    results.find((track) => track.album?.title?.toLowerCase() === albumLower) ||
    results.find((track) => {
      const candidate = track.album?.title?.toLowerCase() || "";
      return (candidate.includes(albumLower) || albumLower.includes(candidate)) && candidate.length > 2;
    });

  const fetchAlbumTracks = async (track: TidalTrack | undefined) => {
    if (!track?.album?.id) return { album: null, tracks: [] as TidalTrack[] };
    return getAlbumWithTracks(track.album.id);
  };

  try {
    if (artistName) {
      const firstPass = await searchTracks(`${artistName} ${albumTitle}`, 50);
      const fromAlbum = await fetchAlbumTracks(findByAlbumTitle(firstPass));
      if (fromAlbum.tracks.length > 0) return fromAlbum.tracks;
    }

    const secondPass = await searchTracks(albumTitle, 50);
    const fromNameOnly = await fetchAlbumTracks(findByAlbumTitle(secondPass));
    if (fromNameOnly.tracks.length > 0) return fromNameOnly.tracks;

    if (artistName) {
      const artistMatches = secondPass.filter((track) =>
        (track.artist?.name?.toLowerCase() === artistLower ||
          track.artists?.some((artist) => artist.name.toLowerCase() === artistLower)) &&
        track.album?.title?.toLowerCase() === albumLower,
      );

      if (artistMatches.length > 0) {
        const albumLookup = await fetchAlbumTracks(artistMatches[0]);
        if (albumLookup.tracks.length > 0) return albumLookup.tracks;
        return artistMatches;
      }

      const fallbackMatches = secondPass.filter((track) =>
        track.artist?.name?.toLowerCase() === artistLower ||
        track.artists?.some((artist) => artist.name.toLowerCase() === artistLower),
      );
      if (fallbackMatches.length > 0) return fallbackMatches;
    }
  } catch {
    // Ignore fallback search errors.
  }

  return [];
}

export async function getMixWithTracks(mixId: string): Promise<TidalTrack[]> {
  const result = await getMix(mixId);
  return result.tracks;
}

export async function getMix(mixId: string): Promise<MixResult> {
  try {
    const result = await musicCore.requestJson(`/mix/?id=${encodeURIComponent(mixId)}`);
    const mixData = result?.mix || result?.data?.mix || null;
    const items = result?.items || result?.data?.items || [];
    const tracks = (Array.isArray(items) ? items : [])
      .map((item) => {
        const value =
          item && typeof item === "object" && "item" in item
            ? (item as { item?: unknown }).item
            : item;
        return mapTrack((value ?? null) as SourceTrack | null | undefined);
      })
      .filter((track): track is TidalTrack => Boolean(track));

    const mix: TidalMix | null = mixData && typeof mixData === "object"
      ? {
        id: String((mixData as { id?: string | number }).id ?? mixId),
        title: String((mixData as { title?: string }).title ?? "Mix"),
        subTitle: typeof (mixData as { subTitle?: string }).subTitle === "string"
          ? (mixData as { subTitle?: string }).subTitle ?? null
          : null,
        description: typeof (mixData as { description?: string }).description === "string"
          ? (mixData as { description?: string }).description ?? null
          : null,
        mixType: typeof (mixData as { mixType?: string }).mixType === "string"
          ? (mixData as { mixType?: string }).mixType ?? null
          : null,
        image:
          (mixData as { images?: { LARGE?: { url?: string }; MEDIUM?: { url?: string }; SMALL?: { url?: string } } }).images?.LARGE?.url ||
          (mixData as { images?: { LARGE?: { url?: string }; MEDIUM?: { url?: string }; SMALL?: { url?: string } } }).images?.MEDIUM?.url ||
          (mixData as { images?: { LARGE?: { url?: string }; MEDIUM?: { url?: string }; SMALL?: { url?: string } } }).images?.SMALL?.url ||
          null,
      }
      : null;

    return { mix, tracks };
  } catch {
    return { mix: null, tracks: [] };
  }
}

export async function getSimilarArtists(artistId: number, cursor?: string | number): Promise<TidalArtist[]> {
  if (cursor !== undefined && cursor !== null) {
    try {
      const result = await musicCore.requestJson(
        `/artist/similar/?id=${artistId}&cursor=${encodeURIComponent(String(cursor))}`,
        { minVersion: "2.3" },
      );
      const items = result?.artists || result?.data?.artists || [];
      return (Array.isArray(items) ? items : [])
        .map((artist: SourceArtist) => mapArtist(artist))
        .filter((artist): artist is TidalArtist => Boolean(artist));
    } catch {
      return [];
    }
  }

  const items = await musicCore.getSimilarArtists(artistId);
  return items
    .map((artist) => mapArtist(artist))
    .filter((artist): artist is TidalArtist => Boolean(artist));
}

export async function getSimilarAlbums(albumId: number, cursor?: string | number): Promise<TidalAlbum[]> {
  if (cursor !== undefined && cursor !== null) {
    try {
      const result = await musicCore.requestJson(
        `/album/similar/?id=${albumId}&cursor=${encodeURIComponent(String(cursor))}`,
        { minVersion: "2.3" },
      );
      const items = result?.albums || result?.data?.albums || result?.items || [];
      return (Array.isArray(items) ? items : [])
        .map((album: SourceAlbum) => mapAlbum(album))
        .filter((album): album is TidalAlbum => Boolean(album));
    } catch {
      return [];
    }
  }

  const items = await musicCore.getSimilarAlbums(albumId);
  return items
    .map((album) => mapAlbum(album))
    .filter((album): album is TidalAlbum => Boolean(album));
}

export async function getTrackCovers(trackId: number): Promise<CoverAsset[]> {
  try {
    const result = await musicCore.requestJson(`/cover/?id=${trackId}`);
    const covers = result?.covers || result?.data?.covers || [];
    return Array.isArray(covers) ? covers : [];
  } catch {
    return [];
  }
}

export async function searchTrackCovers(query: string): Promise<CoverAsset[]> {
  try {
    const result = await musicCore.requestJson(`/cover/?q=${encodeURIComponent(query)}`);
    const covers = result?.covers || result?.data?.covers || [];
    return Array.isArray(covers) ? covers : [];
  } catch {
    return [];
  }
}

export async function getHifiApiInfo() {
  return musicCore.requestJson("/");
}

export async function getTrackInfo(trackId: number): Promise<TidalTrack | null> {
  const officialTrack = await fetchOfficialTidalTrack(trackId)
    .then((track) => mapTrack(track as SourceTrack))
    .catch(() => null);
  if (officialTrack) {
    return officialTrack;
  }

  try {
    const track = await musicCore.getTrackMetadata(trackId);
    return mapTrack(track);
  } catch {
    return getVideoInfo(trackId);
  }
}

export async function getVideoInfo(videoId: number): Promise<TidalTrack | null> {
  const officialVideo = await fetchOfficialTidalVideo(videoId)
    .then((video) => mapTrack(video as SourceTrack))
    .catch(() => null);
  if (officialVideo) {
    return officialVideo;
  }

  try {
    const video = await musicCore.getVideo(videoId);
    return mapTrack(video.track);
  } catch {
    return null;
  }
}

export async function getStreamUrl(trackId: number, quality = "HIGH"): Promise<string | null> {
  for (const attempt of qualityAttempts(quality)) {
    try {
      const streamUrl = await musicCore.getStreamUrl(trackId, attempt);
      if (streamUrl) return streamUrl;
    } catch {
      continue;
    }
  }

  return null;
}

export async function getPlaybackSource(trackId: number, quality = "HIGH"): Promise<PlaybackSource | null> {
  const resolution = await getPlaybackSourceWithQuality(trackId, quality);
  return resolution?.source || null;
}

export async function getPlaybackSourceWithQuality(trackId: number, quality = "HIGH"): Promise<PlaybackSourceResolution | null> {
  let lastError: unknown = null;
  for (const attempt of qualityAttempts(quality)) {
    const cacheKey = `${trackId}:${attempt}`;
    const cached = playbackSourceCache.get(cacheKey);
    if (cached) {
      return {
        quality: normalizeResolvedAudioQuality(attempt),
        capability: null,
        source: cached,
      };
    }

    try {
      const lookup = await musicCore.getTrack(trackId, attempt);
      const capability = normalizeResolvedAudioQuality(deriveTrackQuality(lookup.track) || lookup.track?.audioQuality);
      const source = lookup.originalTrackUrl
        ? { url: lookup.originalTrackUrl, type: "direct" as const }
        : decodePlaybackSource(lookup.info.manifest, lookup.info.manifestMimeType);

      if (!source) continue;

      playbackSourceCache.set(cacheKey, source);
      return {
        quality: normalizeResolvedAudioQuality(attempt),
        capability,
        source,
      };
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function getRecommendations(trackId: number): Promise<TidalTrack[]> {
  const tracks = await musicCore.getTrackRecommendations(trackId);
  return tracks
    .map((track) => mapTrack(track))
    .filter((track): track is TidalTrack => Boolean(track));
}

async function requestLyrics(trackId: number): Promise<LyricsResult> {
  const cached = lyricsCache.get(trackId);
  if (cached) return cached;

  const instanceUrls = await getLyricsInstanceUrls();
  const fetchFromInstance = async (instanceUrl: string): Promise<LyricsResult> => {
    const response = await fetchJsonWithTimeout(
      buildInstanceUrl(instanceUrl, `/lyrics/?id=${trackId}`),
      3000,
    );
    if (!response.ok) throw new Error("Not found");

    const payload = await response.json().catch(() => null);
    const parsed = parseLyricsPayload(payload, instanceUrl);
    if (parsed.lines.length > 0) return parsed;
    throw new Error("No lines");
  };

  try {
    const result = await Promise.any(instanceUrls.map(fetchFromInstance));
    lyricsCache.set(trackId, result);
    return result;
  } catch {
    return createEmptyLyricsResult();
  }
}

function mergeInstanceUrls(primary: string[], secondary: readonly string[]) {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const candidate of [...primary, ...secondary]) {
    const normalized = normalizeOrigin(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

async function getLyricsInstanceUrls() {
  if (
    cachedLyricsInstanceUrls &&
    Date.now() - cachedLyricsInstanceUrls.timestamp < LYRICS_INSTANCE_CACHE_TTL_MS
  ) {
    return cachedLyricsInstanceUrls.urls;
  }

  const uptimeUrls = await (async () => {
    try {
      const payload = await Promise.any(
        UPTIME_URLS.map(async (url) => {
          const response = await fetchJsonWithTimeout(url, 2500);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        }),
      );

      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { api?: unknown[] }).api)) {
        return [] as string[];
      }

      return ((payload as { api: Array<{ url?: string }> }).api)
        .map((entry) => (typeof entry?.url === "string" ? entry.url : ""))
        .filter(Boolean);
    } catch {
      return [] as string[];
    }
  })();

  const urls = mergeInstanceUrls(uptimeUrls, API_INSTANCE_POOL);
  cachedLyricsInstanceUrls = {
    urls,
    timestamp: Date.now(),
  };
  return urls;
}

function parseTimedLyrics(subtitles: string) {
  return subtitles
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(\d+):(\d{1,2}(?:[.,]\d+)?)\]\s*(.*)/);
      if (!match) return null;

      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseFloat(match[2].replace(",", "."));
      const text = match[3].trim();
      if (!text) return null;

      return {
        time: minutes * 60 + seconds,
        text,
      };
    })
    .filter((line): line is TidalLyricLine => Boolean(line));
}

function parseStaticLyrics(lyrics: string) {
  return lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      time: index * 4,
      text,
    }));
}

function createEmptyLyricsResult(): LyricsResult {
  return {
    lines: [],
    provider: null,
    sourceLabel: "Knobb API",
    sourceHost: null,
    isSynced: false,
    isRightToLeft: false,
    rawLyrics: null,
    rawSubtitles: null,
  };
}

function parseLyricsPayload(payload: unknown, instanceUrl: string): LyricsResult {
  if (!payload || typeof payload !== "object") return createEmptyLyricsResult();

  const result = payload as {
    lyrics?: { subtitles?: unknown; lyrics?: unknown; lyricsProvider?: unknown; isRightToLeft?: unknown };
    data?: {
      lyrics?: { subtitles?: unknown; lyrics?: unknown; lyricsProvider?: unknown; isRightToLeft?: unknown };
      subtitles?: unknown;
    };
    subtitles?: unknown;
  };

  const provider =
    typeof result.lyrics?.lyricsProvider === "string"
      ? result.lyrics.lyricsProvider
      : typeof result.data?.lyrics?.lyricsProvider === "string"
        ? result.data.lyrics.lyricsProvider
        : null;
  const isRightToLeft =
    result.lyrics?.isRightToLeft === true || result.data?.lyrics?.isRightToLeft === true;
  const candidates = [result.lyrics, result.data?.lyrics, result.data, result];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    const subtitlesValue = (candidate as { subtitles?: unknown }).subtitles;
    if (typeof subtitlesValue === "string" && subtitlesValue.trim()) {
      const parsed = parseTimedLyrics(subtitlesValue);
      if (parsed.length > 0) {
        return {
          lines: parsed,
          provider,
          sourceLabel: "Knobb API",
          sourceHost: normalizeOrigin(instanceUrl),
          isSynced: true,
          isRightToLeft,
          rawLyrics:
            typeof (candidate as { lyrics?: unknown }).lyrics === "string"
              ? (candidate as { lyrics?: string }).lyrics || null
              : null,
          rawSubtitles: subtitlesValue,
        };
      }
    }

    const lyricsValue = (candidate as { lyrics?: unknown }).lyrics;
    if (typeof lyricsValue === "string" && lyricsValue.trim()) {
      const parsed = parseStaticLyrics(lyricsValue);
      if (parsed.length > 0) {
        return {
          lines: parsed,
          provider,
          sourceLabel: "Knobb API",
          sourceHost: normalizeOrigin(instanceUrl),
          isSynced: false,
          isRightToLeft,
          rawLyrics: lyricsValue,
          rawSubtitles: null,
        };
      }
    }
  }

  return createEmptyLyricsResult();
}

async function findLyricsFallbackTracks(track: TidalTrack) {
  const query = getCleanLyricsSearchQuery(track);
  if (!query) return [];

  try {
    const candidates = await searchTracks(query, 30);
    return getLyricsFallbackCandidateIds(track, candidates);
  } catch {
    return [];
  }
}

export async function getLyrics(trackId: number): Promise<LyricsResult> {
  const attemptedIds = new Set<number>();

  const tryTrack = async (candidateId: number) => {
    if (!candidateId || attemptedIds.has(candidateId)) throw new Error("Invalid or tried");
    attemptedIds.add(candidateId);
    const result = await requestLyrics(candidateId);
    if (result.lines.length > 0) return result;
    throw new Error("No lines");
  };

  try {
    // Try direct track first
    return await tryTrack(trackId);
  } catch {
    // If direct fails, try all fallbacks in parallel
    try {
      const track = await getTrackInfo(trackId);
      if (!track) return createEmptyLyricsResult();

      const fallbackIds = await findLyricsFallbackTracks(track);
      if (fallbackIds.length === 0) return createEmptyLyricsResult();

      return await Promise.any(fallbackIds.map(id => tryTrack(id)));
    } catch {
      return createEmptyLyricsResult();
    }
  }
}
