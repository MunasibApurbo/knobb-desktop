// Monochrome API client for Tidal streaming

const TIDAL_IMAGE_BASE = "https://resources.tidal.com/images";

export interface TidalTrack {
  id: number;
  title: string;
  duration: number;
  artist: { id: number; name: string; picture: string | null };
  artists: { id: number; name: string; type: string }[];
  album: {
    id: number;
    title: string;
    cover: string;
    vibrantColor: string | null;
  };
  version: string | null;
  popularity: number;
  explicit: boolean;
  audioQuality: string;
  replayGain: number;
  peak: number;
}

export interface TidalArtist {
  id: number;
  name: string;
  picture: string | null;
  popularity: number;
  url: string;
}

export interface TidalAlbum {
  id: number;
  title: string;
  cover: string;
  vibrantColor: string | null;
  releaseDate?: string;
  numberOfTracks?: number;
  artist?: { id: number; name: string };
  artists?: { id: number; name: string }[];
}

export interface TidalSearchResult {
  version: string;
  data: {
    limit: number;
    offset: number;
    totalNumberOfItems: number;
    items: TidalTrack[];
  };
}

export interface TidalTrackInfo {
  version: string;
  data: TidalTrack;
}

export interface TidalStreamResult {
  version: string;
  data: {
    trackId: number;
    audioQuality: string;
    manifestMimeType: string;
    manifest: string;
    decodedManifest?: {
      mimeType?: string;
      urls?: string[];
      type?: string;
      xml?: string;
    };
    trackReplayGain: number;
    trackPeakAmplitude: number;
    bitDepth?: number;
    sampleRate?: number;
  };
}

async function proxyRequest(endpoint: string, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams({ endpoint, ...params });
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tidal-proxy?${searchParams.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function searchTracks(query: string, limit = 25): Promise<TidalTrack[]> {
  const result: TidalSearchResult = await proxyRequest("search", { s: query, limit: String(limit) });
  return result?.data?.items || [];
}

export async function searchArtists(query: string): Promise<TidalArtist[]> {
  const result = await proxyRequest("search", { a: query });
  return result?.data?.artists?.items || result?.data?.items || [];
}

export async function searchAlbums(query: string, limit = 20): Promise<TidalAlbum[]> {
  const result = await proxyRequest("search", { s: query, limit: String(limit) });
  // Extract unique albums from track results
  const albumMap = new Map<number, TidalAlbum>();
  const items = result?.data?.items || [];
  for (const track of items) {
    if (track.album && !albumMap.has(track.album.id)) {
      albumMap.set(track.album.id, {
        id: track.album.id,
        title: track.album.title,
        cover: track.album.cover,
        vibrantColor: track.album.vibrantColor,
        artist: track.artist,
        artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })),
      });
    }
  }
  return Array.from(albumMap.values()).slice(0, limit);
}

export async function getArtistTopTracks(artistId: number, limit = 20): Promise<TidalTrack[]> {
  const result = await proxyRequest("artist/top", { id: String(artistId), limit: String(limit) });
  return result?.data?.items || [];
}

export async function getArtistAlbums(artistId: number): Promise<TidalAlbum[]> {
  try {
    const result = await proxyRequest("artist/albums", { id: String(artistId) });
    return result?.data?.items || [];
  } catch {
    return [];
  }
}

export async function getAlbumTracks(albumId: number): Promise<TidalTrack[]> {
  try {
    const result = await proxyRequest("album/tracks", { id: String(albumId) });
    return result?.data?.items || [];
  } catch {
    // Fallback: search by album name
    return [];
  }
}

export async function getAlbumInfo(albumId: number): Promise<TidalAlbum | null> {
  try {
    const result = await proxyRequest("album", { id: String(albumId) });
    return result?.data || result || null;
  } catch {
    return null;
  }
}

export async function getTrackInfo(trackId: number): Promise<TidalTrack | null> {
  const result: TidalTrackInfo = await proxyRequest("info", { id: String(trackId) });
  return result?.data || null;
}

export async function getStreamUrl(trackId: number, quality = "HIGH"): Promise<string | null> {
  const result: TidalStreamResult = await proxyRequest("track", {
    id: String(trackId),
    quality,
  });

  const manifest = result?.data?.decodedManifest;
  if (manifest?.urls && manifest.urls.length > 0) {
    return manifest.urls[0];
  }

  if (result?.data?.manifest) {
    try {
      const decoded = JSON.parse(atob(result.data.manifest));
      if (decoded.urls?.[0]) return decoded.urls[0];
    } catch {
      // Might be DASH XML
    }
  }

  return null;
}

export async function getRecommendations(trackId: number): Promise<TidalTrack[]> {
  const result = await proxyRequest("recommendations", { id: String(trackId) });
  return result?.data?.items?.map((item: any) => item.track).filter(Boolean) || [];
}

export interface TidalLyricLine {
  time: number;
  text: string;
}

export async function getLyrics(trackId: number): Promise<TidalLyricLine[]> {
  try {
    const result = await proxyRequest("lyrics", { id: String(trackId) });
    
    // Format: result.lyrics.subtitles as "[MM:SS.ms] text" lines
    if (result?.lyrics?.subtitles) {
      const subtitles = result.lyrics.subtitles as string;
      const lines = subtitles.split("\n").filter((l: string) => l.trim());
      return lines.map((line: string) => {
        const match = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
        if (match) {
          const mins = parseInt(match[1]);
          const secs = parseFloat(match[2]);
          return { time: mins * 60 + secs, text: match[3] };
        }
        return null;
      }).filter((l): l is TidalLyricLine => l !== null && l.text.trim().length > 0);
    }

    // Fallback: plain lyrics without timestamps
    if (result?.lyrics?.lyrics) {
      const lines = (result.lyrics.lyrics as string).split("\n").filter((l: string) => l.trim());
      return lines.map((text: string, i: number) => ({ time: i * 4, text }));
    }
  } catch (e) {
    console.warn("Lyrics not available:", e);
  }
  return [];
}

export function getTidalImageUrl(coverId: string, size = "750x750"): string {
  if (!coverId) return "/placeholder.svg";
  return `${TIDAL_IMAGE_BASE}/${coverId.replace(/-/g, "/")}/${size}.jpg`;
}

export function tidalTrackToAppTrack(t: TidalTrack): import("@/data/mockData").Track {
  return {
    id: `tidal-${t.id}`,
    tidalId: t.id,
    artistId: t.artist?.id,
    title: t.version ? `${t.title} (${t.version})` : t.title,
    artist: t.artists?.map((a) => a.name).join(", ") || t.artist?.name || "Unknown",
    album: t.album?.title || "Unknown Album",
    duration: t.duration,
    year: new Date().getFullYear(),
    coverUrl: getTidalImageUrl(t.album?.cover || ""),
    canvasColor: hexToHsl(t.album?.vibrantColor || "#6366f1"),
    replayGain: t.replayGain,
    peak: t.peak,
  };
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "220 70% 55%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
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
