import { getTidalImageUrl, mapAlbum, mapArtist, mapPlaylist, mapTrack, tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
import type { TidalPlaylist } from "@/lib/musicApiTypes";
import type { SourceAlbum, SourceArtist, SourcePlaylist, SourceTrack } from "@/lib/musicCore";
import type { Track } from "@/types/music";

export type TidalBrowseGenre = {
  id: string;
  label: string;
  query: string;
  apiPath?: string;
};

export type TidalBrowseAlbum = {
  id: number;
  title: string;
  artist: string;
  artistId?: number;
  coverUrl: string;
  releaseDate?: string;
};

export type TidalBrowseArtist = {
  id: number;
  name: string;
  imageUrl: string;
};

export type TidalBrowseSection =
  | {
      id: string;
      title: string;
      type: "genres";
      items: TidalBrowseGenre[];
      source: "tidal-api";
    }
  | {
      id: string;
      title: string;
      type: "albums";
      items: TidalBrowseAlbum[];
      source: "tidal-api";
    }
  | {
      id: string;
      title: string;
      type: "artists";
      items: TidalBrowseArtist[];
      source: "tidal-api";
    }
  | {
      id: string;
      title: string;
      type: "tracks";
      items: Track[];
      source: "tidal-api";
    }
  | {
      id: string;
      title: string;
      type: "videos";
      items: Track[];
      source: "tidal-api";
    }
  | {
      id: string;
      title: string;
      type: "playlists";
      items: TidalPlaylist[];
      source: "tidal-api";
    };

type TidalPageModule = {
  title?: string;
  type?: string;
  items?: unknown[];
  pagedList?: {
    items?: unknown[];
    dataApiPath?: string;
    limit?: number;
    offset?: number;
    totalNumberOfItems?: number;
  };
};

type TidalPageResponse = {
  rows?: Array<{
    modules?: TidalPageModule[];
  }>;
};

type TidalPagedListResponse = {
  items?: unknown[];
  limit?: number;
  offset?: number;
  totalNumberOfItems?: number;
};

const TIDAL_BROWSE_PROXY_URL = "/api/tidal-browse";
const DEFAULT_LOCALE = "en_US";
const DEFAULT_COUNTRY_CODE = "US";
const DEFAULT_DEVICE_TYPE = "BROWSER";
const SUPPORTED_MODULE_TYPES = new Set([
  "ALBUM_LIST",
  "ARTIST_LIST",
  "PAGE_LINKS_CLOUD",
  "PLAYLIST_LIST",
  "TRACK_LIST",
  "VIDEO_LIST",
]);

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dedupeByKey<T>(items: T[], resolveKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = resolveKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectModules(page: TidalPageResponse) {
  return (page.rows || []).flatMap((row) => row.modules || []);
}

async function requestTidalBrowse<T>(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({
    path,
    locale: DEFAULT_LOCALE,
    countryCode: DEFAULT_COUNTRY_CODE,
    deviceType: DEFAULT_DEVICE_TYPE,
    ...params,
  });

  const response = await fetch(`${TIDAL_BROWSE_PROXY_URL}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load TIDAL browse path ${path}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAllModuleItems(module: TidalPageModule) {
  const inlineItems = Array.isArray(module.pagedList?.items)
    ? module.pagedList?.items
    : Array.isArray(module.items)
      ? module.items
      : [];
  const dataApiPath = module.pagedList?.dataApiPath;
  const total = module.pagedList?.totalNumberOfItems || inlineItems.length;
  const limit = Math.max(1, module.pagedList?.limit || inlineItems.length || 10);

  if (!dataApiPath || total <= inlineItems.length) {
    return inlineItems;
  }

  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += limit) {
    offsets.push(offset);
  }

  const pages = await Promise.all(
    offsets.map((offset) =>
      requestTidalBrowse<TidalPagedListResponse>(dataApiPath, {
        limit: String(limit),
        offset: String(offset),
      }).catch(() => ({ items: offset === 0 ? inlineItems : [] })),
    ),
  );

  return pages.flatMap((page) => (Array.isArray(page.items) ? page.items : []));
}

function mapBrowseAlbum(value: SourceAlbum | null | undefined): TidalBrowseAlbum | null {
  const album = mapAlbum(value);
  if (!album) return null;

  const artist =
    album.artist?.name ||
    album.artists?.map((entry) => entry.name).filter(Boolean).join(", ") ||
    "Various Artists";

  return {
    id: album.id,
    title: album.title,
    artist,
    artistId: album.artist?.id ?? album.artists?.[0]?.id,
    coverUrl: album.cover ? getTidalImageUrl(album.cover, "750x750") : "/placeholder.svg",
    releaseDate: album.releaseDate,
  };
}

function mapBrowseArtist(value: SourceArtist | null | undefined): TidalBrowseArtist | null {
  const artist = mapArtist(value);
  if (!artist) return null;

  return {
    id: artist.id,
    name: artist.name,
    imageUrl: artist.picture ? getTidalImageUrl(artist.picture, "750x750") : "/placeholder.svg",
  };
}

function mapBrowseTrack(value: SourceTrack | null | undefined): Track | null {
  const track = mapTrack(value);
  if (!track) return null;
  return tidalTrackToAppTrack(track);
}

function mapBrowsePlaylist(value: SourcePlaylist | null | undefined): TidalPlaylist | null {
  return mapPlaylist(value);
}

function mapBrowseGenres(items: unknown[]) {
  return dedupeByKey(
    items
      .map((item) => {
        const entry = item as { title?: string; apiPath?: string } | null | undefined;
        const label = typeof entry?.title === "string" ? entry.title.trim() : "";
        if (!label) return null;

        return {
          id: slugify(label),
          label,
          query: label,
          ...(entry?.apiPath ? { apiPath: entry.apiPath } : {}),
        } satisfies TidalBrowseGenre;
      })
      .filter((item): item is TidalBrowseGenre => Boolean(item)),
    (genre) => genre.id,
  );
}

async function buildSection(module: TidalPageModule): Promise<TidalBrowseSection | null> {
  const title = String(module.title || "").trim();
  const type = String(module.type || "").toUpperCase();
  if (!title || !type) return null;

  const items = await fetchAllModuleItems(module);
  if (items.length === 0) return null;

  if (type === "ALBUM_LIST") {
    const albums = dedupeByKey(
      items.map((item) => mapBrowseAlbum(item as SourceAlbum)).filter((item): item is TidalBrowseAlbum => Boolean(item)),
      (album) => String(album.id),
    );

    return albums.length > 0
      ? { id: slugify(title), title, type: "albums", items: albums, source: "tidal-api" }
      : null;
  }

  if (type === "TRACK_LIST") {
    const tracks = dedupeByKey(
      items.map((item) => mapBrowseTrack(item as SourceTrack)).filter((item): item is Track => Boolean(item)),
      (track) => track.id,
    );

    return tracks.length > 0
      ? { id: slugify(title), title, type: "tracks", items: tracks, source: "tidal-api" }
      : null;
  }

  if (type === "VIDEO_LIST") {
    const videos = dedupeByKey(
      items.map((item) => mapBrowseTrack(item as SourceTrack)).filter((item): item is Track => Boolean(item)),
      (track) => track.id,
    ).filter((track) => track.isVideo === true);

    return videos.length > 0
      ? { id: slugify(title), title, type: "videos", items: videos, source: "tidal-api" }
      : null;
  }

  if (type === "PLAYLIST_LIST") {
    const playlists = dedupeByKey(
      items.map((item) => mapBrowsePlaylist(item as SourcePlaylist)).filter((item): item is TidalPlaylist => Boolean(item)),
      (playlist) => playlist.uuid,
    );

    return playlists.length > 0
      ? { id: slugify(title), title, type: "playlists", items: playlists, source: "tidal-api" }
      : null;
  }

  if (type === "ARTIST_LIST") {
    const artists = dedupeByKey(
      items.map((item) => mapBrowseArtist(item as SourceArtist)).filter((item): item is TidalBrowseArtist => Boolean(item)),
      (artist) => String(artist.id),
    );

    return artists.length > 0
      ? { id: slugify(title), title, type: "artists", items: artists, source: "tidal-api" }
      : null;
  }

  if (type === "PAGE_LINKS_CLOUD") {
    const genres = mapBrowseGenres(items);
    return genres.length > 0
      ? { id: slugify(title), title, type: "genres", items: genres, source: "tidal-api" }
      : null;
  }

  return null;
}

function pickModule(modules: TidalPageModule[], title: string) {
  return modules.find((module) => String(module.title || "").trim().toLowerCase() === title.toLowerCase());
}

function collectSupportedModules(modules: TidalPageModule[], limit: number) {
  const supported: TidalPageModule[] = [];

  for (const module of modules) {
    const type = String(module.type || "").toUpperCase();
    if (!SUPPORTED_MODULE_TYPES.has(type)) continue;

    supported.push(module);
    if (supported.length >= limit) {
      break;
    }
  }

  return supported;
}

export async function fetchTidalHotNewSections() {
  const [homePage, explorePage, newMusicPage] = await Promise.all([
    requestTidalBrowse<TidalPageResponse>("pages/home"),
    requestTidalBrowse<TidalPageResponse>("pages/explore"),
    requestTidalBrowse<TidalPageResponse>("pages/explore_new_music"),
  ]);

  const homeModules = collectModules(homePage);
  const exploreModules = collectModules(explorePage);
  const newMusicModules = collectModules(newMusicPage);

  const selectedModules = [
    pickModule(homeModules, "The Hits"),
    pickModule(homeModules, "New Tracks"),
    pickModule(homeModules, "New Albums"),
    pickModule(newMusicModules, "New Arrivals"),
    pickModule(exploreModules, "Genres"),
    ...collectSupportedModules(homeModules, 8),
    ...collectSupportedModules(newMusicModules, 6),
    ...collectSupportedModules(exploreModules, 6),
  ].filter((module): module is TidalPageModule => Boolean(module));

  const dedupedModules = Array.from(new Map(
    selectedModules.map((module) => [`${String(module.type || "").toUpperCase()}:${String(module.title || "").trim().toLowerCase()}`, module]),
  ).values());

  const sections = await Promise.all(dedupedModules.map((module) => buildSection(module)));
  return sections.filter((section): section is TidalBrowseSection => Boolean(section)).slice(0, 12);
}
