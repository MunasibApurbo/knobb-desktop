// Monochrome API client for Tidal streaming

const TIDAL_IMAGE_BASE = "https://resources.tidal.com/images";
export const API_INSTANCE_POOL = [
  "https://us-west.monochrome.tf",
  "https://eu-central.monochrome.tf",
  "https://api.monochrome.tf",
  "https://arran.monochrome.tf",
  "https://triton.squid.wtf",
  "https://monochrome-api.samidy.com",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
  "https://tidal.kinoplus.online",
] as const;

export const STREAMING_INSTANCE_POOL = [
  "https://api.monochrome.tf",
  "https://arran.monochrome.tf",
  "https://triton.squid.wtf",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
] as const;

type InstancePoolType = "api" | "streaming";

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
  bio?: string;
}

export interface TidalAlbum {
  id: number;
  title: string;
  cover: string;
  vibrantColor: string | null;
  releaseDate?: string;
  numberOfTracks?: number;
  type?: string; // 'ALBUM' | 'EP' | 'SINGLE'
  artist?: { id: number; name: string };
  artists?: { id: number; name: string }[];
}

export interface TidalPlaylist {
  uuid: string;
  title: string;
  description?: string;
  image?: string | null;
  squareImage?: string | null;
  numberOfTracks: number;
  duration?: number;
  type?: string;
  publicPlaylist?: boolean;
  popularity?: number;
  url?: string;
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

// Create an in-memory cache to mirror Monochrome's zero-latency technique
const apiCache = new Map<string, any>();

function normalizeInstance(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function getStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getOrderedInstances(storageKey: string, fallback: readonly string[]): string[] {
  const stored = getStorageValue(storageKey);
  if (!stored) return [...fallback];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [...fallback];

    const normalized = parsed
      .map((item) => (typeof item === "string" ? normalizeInstance(item) : null))
      .filter((item): item is string => !!item);

    const preferred = normalized.filter((item) => fallback.includes(item as any));
    const remaining = fallback.filter((item) => !preferred.includes(item));
    return [...preferred, ...remaining];
  } catch {
    return [...fallback];
  }
}

function getInstanceConfig(endpoint: string): { pool: InstancePoolType; instances: string[] } {
  if (endpoint === "track") {
    return {
      pool: "streaming",
      instances: getOrderedInstances("streaming-instance-priority", STREAMING_INSTANCE_POOL),
    };
  }

  return {
    pool: "api",
    instances: getOrderedInstances("api-instance-priority", API_INSTANCE_POOL),
  };
}

async function proxyRequest(endpoint: string, params: Record<string, string> = {}) {
  const { pool, instances } = getInstanceConfig(endpoint);
  const searchParams = new URLSearchParams({
    endpoint,
    pool,
    instances: instances.join(","),
    instance: instances[0] || "",
    ...params,
  });
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tidal-proxy?${searchParams.toString()}`;

  // Cache key based on the full URL (endpoint + all params)
  const cacheKey = url;

  // Return cached result instantly if it exists
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  const controller = new AbortController();
  const timeoutMs = endpoint === "track" ? 15000 : 10000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  // Save to cache for future requests
  apiCache.set(cacheKey, data);

  return data;
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
    if (track.album && track.album.id && !albumMap.has(track.album.id)) {
      // Only include albums with valid cover art
      const cover = track.album.cover || track.album?.cover || "";
      albumMap.set(track.album.id, {
        id: track.album.id,
        title: track.album.title,
        cover: cover,
        vibrantColor: track.album.vibrantColor || null,
        artist: track.artist,
        artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })),
      });
    }
  }
  return Array.from(albumMap.values()).slice(0, limit);
}

export async function searchPlaylists(query: string, limit = 20): Promise<TidalPlaylist[]> {
  const result = await proxyRequest("search", { p: query, limit: String(limit) });
  const items: TidalPlaylist[] =
    result?.data?.playlists?.items ||
    result?.playlists?.items ||
    result?.data?.items ||
    [];
  return items.slice(0, limit);
}

export async function getArtistTopTracks(artistId: number, limit = 20): Promise<TidalTrack[]> {
  const result = await proxyRequest("artist/top", { id: String(artistId), limit: String(limit) });
  return result?.data?.items || [];
}

export async function getArtistAlbums(artistId: number): Promise<TidalAlbum[]> {
  try {
    const result = await proxyRequest("artist", { f: String(artistId), skip_tracks: "true" });

    // The API returns { albums: { items: [...] } }
    const items: any[] = result?.albums?.items
      || result?.data?.albums?.items
      || [];

    // Fallback: deep scan if structured path doesn't exist
    if (items.length === 0) {
      const contentData = result?.data || result;
      const entries: any[] = Array.isArray(contentData) ? contentData : [contentData];
      const found: any[] = [];
      const scan = (value: any, visited = new Set<any>()) => {
        if (!value || typeof value !== "object" || visited.has(value)) return;
        visited.add(value);
        if (Array.isArray(value)) { value.forEach(item => scan(item, visited)); return; }
        const item = value.item || value;
        if (item?.id && item.title && ("numberOfTracks" in item || "type" in item)) {
          found.push(item);
        }
        Object.values(value).forEach(nested => scan(nested, visited));
      };
      entries.forEach(entry => scan(entry));
      items.push(...found);
    }

    // Deduplicate by title + releaseDate, preferring STEREO versions (they have working tracks endpoints)
    const deduped = new Map<string, TidalAlbum>();
    for (const item of items) {
      const key = `${(item.title || "").trim().toLowerCase()}|${item.releaseDate || ""}`;
      const existing = deduped.get(key);
      const audioModes: string[] = item.audioModes || [];
      const isStereo = audioModes.includes("STEREO") || audioModes.length === 0;

      if (!existing || isStereo) {
        deduped.set(key, {
          id: item.id,
          title: item.title,
          cover: item.cover || item.squareImage || item.image || "",
          vibrantColor: item.vibrantColor || null,
          releaseDate: item.releaseDate,
          numberOfTracks: item.numberOfTracks,
          type: item.type,
          artist: item.artist,
          artists: item.artists,
        });
      }
    }

    // Sort newest first
    return Array.from(deduped.values()).sort((a, b) =>
      new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime()
    );
  } catch {
    return [];
  }
}

export async function getArtistAlbumsWithType(artistId: number, filter: "ALBUMS" | "SINGLES" | "EPS"): Promise<TidalAlbum[]> {
  try {
    const allAlbums = await getArtistAlbums(artistId);

    if (filter === "ALBUMS") {
      // Full albums: type is ALBUM, or no type tag and has many tracks
      return allAlbums.filter(a => {
        if (a.type) return a.type === "ALBUM";
        return (a.numberOfTracks || 10) > 5;
      });
    } else if (filter === "SINGLES") {
      return allAlbums.filter(a => {
        if (a.type) return a.type === "SINGLE";
        return (a.numberOfTracks || 0) === 1;
      });
    } else if (filter === "EPS") {
      return allAlbums.filter(a => {
        if (a.type) return a.type === "EP";
        return (a.numberOfTracks || 0) > 1 && (a.numberOfTracks || 0) <= 5;
      });
    }

    return allAlbums;
  } catch {
    return [];
  }
}

export async function getArtistBio(artistId: number): Promise<string> {
  try {
    const result = await proxyRequest("artist/bio", { id: String(artistId) });
    return result?.data?.text || result?.text || "";
  } catch {
    return "";
  }
}

export interface ArtistCredit {
  name: string;
  role: string;
  id?: number;
}

export async function getArtistCredits(artistId: number): Promise<ArtistCredit[]> {
  try {
    const tracks = await getArtistTopTracks(artistId, 20);
    const creditMap = new Map<string, ArtistCredit>();

    for (const track of tracks) {
      // Extract featured artists and collaborators
      if (track.artists) {
        for (const a of track.artists) {
          if (a.id !== artistId && !creditMap.has(a.name)) {
            creditMap.set(a.name, {
              name: a.name,
              role: a.type === "FEATURED" ? "Featured Artist" : a.type === "MAIN" ? "Collaborator" : a.type || "Contributor",
              id: a.id,
            });
          }
        }
      }
      // Extract from artist field
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

// Keep legacy getAlbumTracks for the search fallback
export async function getAlbumTracks(albumId: number): Promise<TidalTrack[]> {
  try {
    const result = await proxyRequest("album/tracks", { id: String(albumId) });
    return result?.data?.items || [];
  } catch {
    return [];
  }
}

// ─── Monochrome-style single-call album fetch ───────────────────────
// Mirrors Monochrome's getAlbum(): single /album endpoint returns both
// metadata and tracks. Parses both from one response, handles pagination,
// and falls back to search only as last resort.
export interface AlbumResult {
  album: TidalAlbum | null;
  tracks: TidalTrack[];
}

export interface PlaylistResult {
  playlist: TidalPlaylist | null;
  tracks: TidalTrack[];
}

export async function getAlbumWithTracks(albumId: number): Promise<AlbumResult> {
  try {
    const result = await proxyRequest("album", { id: String(albumId) });
    const data = result?.data || result;

    let album: TidalAlbum | null = null;
    let tracks: TidalTrack[] = [];

    if (data && typeof data === "object" && !Array.isArray(data)) {
      // Extract album metadata from root level (like Monochrome)
      if ("numberOfTracks" in data || "title" in data) {
        album = data as TidalAlbum;
      }

      // Extract tracks from items array
      if ("items" in data && Array.isArray(data.items)) {
        tracks = data.items.map((i: any) => i.item || i);

        // If no album metadata but we have tracks, extract from first track
        if (!album && tracks.length > 0 && tracks[0]?.album) {
          album = tracks[0].album as TidalAlbum;
        }
      }
    }

    // Handle pagination: if album says more tracks exist, fetch them (like Monochrome)
    if (album && album.numberOfTracks && album.numberOfTracks > tracks.length) {
      let offset = tracks.length;
      const maxTracks = 500;

      while (tracks.length < (album.numberOfTracks || 0) && tracks.length < maxTracks) {
        try {
          const nextResult = await proxyRequest("album", {
            id: String(albumId),
            offset: String(offset),
            limit: "100",
          });
          const nextData = nextResult?.data || nextResult;
          const nextItems: TidalTrack[] = (nextData?.items || []).map((i: any) => i.item || i);

          if (nextItems.length === 0) break;

          // Safeguard: detect if API ignores offset and returns same page
          if (tracks.length > 0 && nextItems[0]?.id === tracks[0]?.id) break;

          tracks = [...tracks, ...nextItems];
          offset += nextItems.length;
        } catch {
          break;
        }
      }
    }

    return { album, tracks };
  } catch {
    return { album: null, tracks: [] };
  }
}

function parsePlaylistTracks(items: any[]): TidalTrack[] {
  return (items || [])
    .map((item) => item?.item || item)
    .filter((track): track is TidalTrack => !!track && typeof track.id === "number");
}

export async function getPlaylistWithTracks(playlistId: string): Promise<PlaylistResult> {
  try {
    const result = await proxyRequest("playlist", { id: playlistId });
    let playlist: TidalPlaylist | null = result?.playlist || result?.data?.playlist || null;
    let tracks = parsePlaylistTracks(result?.items || result?.data?.items || []);

    const expectedTracks = playlist?.numberOfTracks || tracks.length;
    let offset = tracks.length;
    const maxTracks = 500;

    while (tracks.length < expectedTracks && tracks.length < maxTracks) {
      try {
        const nextResult = await proxyRequest("playlist", {
          id: playlistId,
          offset: String(offset),
          limit: "100",
        });

        if (!playlist) {
          playlist = nextResult?.playlist || nextResult?.data?.playlist || null;
        }

        const nextTracks = parsePlaylistTracks(nextResult?.items || nextResult?.data?.items || []);
        if (nextTracks.length === 0) break;

        // Safeguard if API repeats first page.
        if (tracks.length > 0 && nextTracks[0]?.id === tracks[0]?.id) break;

        tracks = [...tracks, ...nextTracks];
        offset += nextTracks.length;
      } catch {
        break;
      }
    }

    return { playlist, tracks };
  } catch {
    return { playlist: null, tracks: [] };
  }
}

// Search-based fallback for when getAlbumWithTracks returns empty tracks.
export async function searchAlbumTracksByName(albumTitle: string, artistName: string): Promise<TidalTrack[]> {
  const albumLower = albumTitle.toLowerCase().trim();
  const artistLower = (artistName || "").toLowerCase().trim();

  const findByAlbumTitle = (results: TidalTrack[]): TidalTrack | undefined =>
    results.find(t => t.album?.title?.toLowerCase() === albumLower) ||
    results.find(t => {
      const ta = t.album?.title?.toLowerCase() || "";
      return (ta.includes(albumLower) || albumLower.includes(ta)) && ta.length > 2;
    });

  const fetchFullViaAlbum = async (track: TidalTrack | undefined): Promise<AlbumResult> => {
    if (!track?.album?.id) return { album: null, tracks: [] };
    try { return await getAlbumWithTracks(track.album.id); } catch { return { album: null, tracks: [] }; }
  };

  try {
    // Tier 1: Search "artist album"
    if (artistName) {
      const r1 = await searchTracks(`${artistName} ${albumTitle}`, 50);
      const { tracks: t1 } = await fetchFullViaAlbum(findByAlbumTitle(r1));
      if (t1.length > 0) return t1;
    }

    // Tier 2: Search just album title
    const r2 = await searchTracks(albumTitle, 50);
    const { tracks: t2 } = await fetchFullViaAlbum(findByAlbumTitle(r2));
    if (t2.length > 0) return t2;

    // Tier 3: Filter by artist from results
    if (artistName) {
      const artistMatches = r2.filter(t =>
        (t.artist?.name?.toLowerCase() === artistLower ||
          t.artists?.some(a => a.name.toLowerCase() === artistLower)) &&
        t.album?.title?.toLowerCase() === albumLower
      );
      if (artistMatches.length > 0) {
        const { tracks: t3 } = await fetchFullViaAlbum(artistMatches[0]);
        if (t3.length > 0) return t3;
        return artistMatches;
      }
    }

    // Tier 4: Return any artist matches as fallback
    if (artistName) {
      const byArtist = r2.filter(t =>
        t.artist?.name?.toLowerCase() === artistLower ||
        t.artists?.some(a => a.name.toLowerCase() === artistLower)
      );
      if (byArtist.length > 0) return byArtist;
    }
  } catch { /* search failed */ }
  return [];
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
    albumId: t.album?.id,
    artistId: t.artist?.id,
    artists: t.artists?.map((a) => ({ id: a.id, name: a.name })),
    title: t.version ? `${t.title} (${t.version})` : t.title,
    artist: t.artists?.map((a) => a.name).join(", ") || t.artist?.name || "Unknown",
    album: t.album?.title || "Unknown Album",
    duration: t.duration,
    year: new Date().getFullYear(),
    coverUrl: getTidalImageUrl(t.album?.cover || ""),
    canvasColor: hexToHsl(t.album?.vibrantColor || "#6366f1"),
    replayGain: t.replayGain,
    peak: t.peak,
    audioQuality: t.audioQuality as any,
    explicit: t.explicit,
  };
}

export function hexToHsl(hex: string): string {
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
