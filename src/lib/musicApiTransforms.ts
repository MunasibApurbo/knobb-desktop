import type {
  SourceAlbum,
  SourceArtist,
  SourcePlaylist,
  SourceTrack,
} from "@/lib/musicCore";
import type {
  TidalAlbum,
  TidalArtist,
  TidalPlaylist,
  TidalTrack,
} from "@/lib/musicApiTypes";
import { getReleaseYear } from "@/lib/releaseDates";
import type { Track } from "@/types/music";

const TIDAL_IMAGE_BASE = "https://resources.tidal.com/images";
const DEFAULT_TRACK_CANVAS_COLOR = "220 70% 55%";

function isLikelyVideoTrack(track: { type?: string } | null | undefined) {
  const rawType = String(track?.type || "").toLowerCase();
  return rawType.includes("video");
}

function normalizeTrackAudioQuality(quality: string): Track["audioQuality"] {
  const token = String(quality || "HIGH").trim().toUpperCase();
  if (token === "HI_RES_LOSSLESS" || token === "MAX" || token === "MASTER") return "MAX";
  if (token === "LOSSLESS") return "LOSSLESS";
  if (token === "MEDIUM") return "MEDIUM";
  if (token === "LOW") return "LOW";
  return "HIGH";
}

function normalizeQuality(quality: string) {
  const token = String(quality || "HIGH").trim().toUpperCase();
  if (token === "AUTO") return "HI_RES_LOSSLESS";
  if (token === "MEDIUM") return "HIGH";
  if (token === "MAX") return "HI_RES_LOSSLESS";
  return token;
}

export function mapArtist(value: SourceArtist | null | undefined): TidalArtist | null {
  if (!value?.id || !value.name) return null;
  return {
    id: value.id,
    name: value.name,
    picture: value.picture || null,
    popularity: value.popularity || 0,
    url: value.url || "",
    bio: value.bio || value.description || value.about || undefined,
    type: value.type,
    artistTypes: Array.isArray(value.artistTypes) ? value.artistTypes : undefined,
    mixes: value.mixes || null,
  };
}

export function mapAlbum(value: SourceAlbum | null | undefined): TidalAlbum | null {
  if (!value?.id || !value.title) return null;
  return {
    id: value.id,
    title: value.title,
    cover: value.cover || value.squareImage || value.image || "",
    vibrantColor: value.vibrantColor || null,
    releaseDate: value.releaseDate,
    numberOfTracks: value.numberOfTracks,
    type: value.type,
    artist: value.artist?.id && value.artist.name
      ? { id: value.artist.id, name: value.artist.name }
      : undefined,
    artists: Array.isArray(value.artists)
      ? value.artists
          .filter((artist): artist is SourceArtist => Boolean(artist?.id && artist?.name))
          .map((artist) => ({ id: artist.id, name: artist.name }))
      : undefined,
  };
}

export function mapPlaylist(value: SourcePlaylist | null | undefined): TidalPlaylist | null {
  if (!value?.uuid || !value.title) return null;
  return {
    uuid: value.uuid,
    title: value.title,
    description: value.description || "",
    image: value.image || null,
    squareImage: value.squareImage || null,
    numberOfTracks: value.numberOfTracks || 0,
    duration: value.duration,
    type: value.type,
    publicPlaylist: value.publicPlaylist,
    popularity: value.popularity,
    url: value.url,
  };
}

export function mapTrack(value: SourceTrack | null | undefined): TidalTrack | null {
  if (!value?.id || !value.title) return null;

  const artist = mapArtist(value.artist) || {
    id: 0,
    name: value.artists?.[0]?.name || "Unknown Artist",
    picture: value.artists?.[0]?.picture || null,
    popularity: 0,
    url: "",
  };
  const album = mapAlbum(value.album) || {
    id: 0,
    title: "Unknown Album",
    cover: "",
    vibrantColor: null,
  };

  return {
    id: value.id,
    title: value.title,
    duration: value.duration || 0,
    mixes: value.mixes || null,
    artist: {
      id: artist.id,
      name: artist.name,
      picture: artist.picture,
    },
    artists: Array.isArray(value.artists) && value.artists.length > 0
      ? value.artists
          .filter((item): item is SourceArtist => Boolean(item?.id && item?.name))
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type || "MAIN",
          }))
      : [{ id: artist.id, name: artist.name, type: "MAIN" }],
    album: {
      id: album.id,
      title: album.title,
      cover: album.cover,
      vibrantColor: album.vibrantColor,
      releaseDate: album.releaseDate,
    },
    version: value.version || null,
    popularity: value.popularity || 0,
    explicit: Boolean(value.explicit),
    audioQuality: value.audioQuality || "HIGH",
    replayGain: value.replayGain || 0,
    peak: value.peak || 1,
    imageId: value.imageId || null,
    type: value.type,
    isVideo: isLikelyVideoTrack(value),
    isUnavailable: value.isUnavailable,
  };
}

export function dedupeAlbums(albums: TidalAlbum[]) {
  const unique = new Map<string, TidalAlbum>();

  for (const album of albums) {
    const key = album.id ? `id:${album.id}` : `${album.title.toLowerCase()}|${album.releaseDate || ""}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, album);
      continue;
    }

    const existingStereo = existing.type === "ALBUM";
    const nextStereo = album.type === "ALBUM";
    if (nextStereo && !existingStereo) {
      unique.set(key, album);
    }
  }

  return Array.from(unique.values());
}

export function qualityAttempts(requested: string) {
  const normalized = normalizeQuality(requested);
  if (String(requested || "").trim().toUpperCase() === "AUTO") {
    if (normalized === "HI_RES_LOSSLESS") return ["HI_RES_LOSSLESS", "LOSSLESS", "HIGH", "LOW"];
    if (normalized === "LOSSLESS") return ["LOSSLESS", "HIGH", "LOW"];
    if (normalized === "HIGH") return ["HIGH", "LOW"];
    if (normalized === "LOW") return ["LOW"];
    return [normalized, "HIGH", "LOW"];
  }

  return [normalized];
}

export function parsePlaylistTracks(tracks: SourceTrack[]): TidalTrack[] {
  return tracks
    .map((track) => mapTrack(track))
    .filter((track): track is TidalTrack => Boolean(track));
}

export function getTidalImageUrl(coverId: string, size = "750x750"): string {
  if (!coverId) return "/placeholder.svg";
  if (/^https?:\/\//i.test(coverId)) return coverId;
  return `${TIDAL_IMAGE_BASE}/${coverId.replace(/-/g, "/")}/${size}.jpg`;
}

export function getTidalVideoImageUrl(imageId: string, size = "1280x720"): string {
  if (!imageId) return "/placeholder.svg";
  if (/^https?:\/\//i.test(imageId)) return imageId;
  return `${TIDAL_IMAGE_BASE}/${imageId.replace(/-/g, "/")}/${size}.jpg`;
}

export function tidalTrackToAppTrack(track: TidalTrack): Track {
  const releaseDate = track.album?.releaseDate;
  const releaseYear = getReleaseYear(releaseDate);
  const isVideo = isLikelyVideoTrack(track);
  const coverId = isVideo
    ? track.imageId || track.album?.cover || ""
    : track.album?.cover || "";

  return {
    id: `tidal-${track.id}`,
    tidalId: track.id,
    albumId: track.album?.id,
    artistId: track.artist?.id,
    mixes: track.mixes || null,
    artists: track.artists?.map((artist) => ({ id: artist.id, name: artist.name })),
    title: track.version ? `${track.title} (${track.version})` : track.title,
    artist: track.artists?.map((artist) => artist.name).join(", ") || track.artist?.name || "Unknown",
    album: track.album?.title || "Unknown Album",
    duration: track.duration,
    year: releaseYear,
    releaseDate,
    coverUrl: isVideo
      ? getTidalVideoImageUrl(coverId, "1280x720")
      : getTidalImageUrl(coverId, "750x750"),
    canvasColor: track.album?.vibrantColor
      ? hexToHsl(track.album.vibrantColor)
      : DEFAULT_TRACK_CANVAS_COLOR,
    replayGain: track.replayGain,
    peak: track.peak,
    audioQuality: normalizeTrackAudioQuality(track.audioQuality),
    explicit: track.explicit,
    isVideo,
    isUnavailable: Boolean(track.isUnavailable),
  };
}

export function filterAudioTracks<T extends { isVideo?: boolean }>(tracks: T[]): T[] {
  return tracks.filter((track) => track.isVideo !== true);
}

export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "220 70% 55%";

  const r = Number.parseInt(result[1], 16) / 255;
  const g = Number.parseInt(result[2], 16) / 255;
  const b = Number.parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
