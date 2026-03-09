import { useEffect, useMemo, useState } from "react";

import type { HomeAlbum, HomeArtist } from "@/hooks/useHomeFeeds";
import {
  getAlbumTracks,
  getPlaylistWithTracks,
  searchPlaylists,
} from "@/lib/musicApi";
import type { TidalPlaylist } from "@/lib/musicApiTypes";
import { mapAlbum, mapArtist, mapPlaylist, mapTrack, tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
import { musicCore, type SourceAlbum, type SourceArtist, type SourcePlaylist, type SourceTrack } from "@/lib/musicCore";
import type { Track } from "@/types/music";

type BrowseGenre = {
  id: string;
  label: string;
  query: string;
};

export type BrowseHotNewSection =
  | {
      id: string;
      title: string;
      type: "genres";
      items: BrowseGenre[];
      source: "browse-file" | "fallback";
    }
  | {
      id: string;
      title: string;
      type: "albums";
      items: HomeAlbum[];
      source: "browse-file" | "fallback";
    }
  | {
      id: string;
      title: string;
      type: "artists";
      items: HomeArtist[];
      source: "browse-file" | "fallback";
    }
  | {
      id: string;
      title: string;
      type: "tracks";
      items: Track[];
      source: "browse-file" | "fallback";
    }
  | {
      id: string;
      title: string;
      type: "playlists";
      items: TidalPlaylist[];
      source: "browse-file" | "fallback";
    };

type UseBrowseHotNewOptions = {
  baseLoaded: boolean;
  newReleases: HomeAlbum[];
  recommendedAlbums: HomeAlbum[];
  recommendedArtists: HomeArtist[];
  recommendedTracks: Track[];
  recentTracks: Track[];
};

type RawSection = {
  title: string;
  type: string | null;
  items: unknown[];
};

const BROWSE_GENRES: BrowseGenre[] = [
  { id: "hip-hop-rap", label: "Hip Hop / Rap", query: "hip hop rap" },
  { id: "pop", label: "Pop", query: "pop" },
  { id: "rock", label: "Rock", query: "rock" },
  { id: "electronic", label: "Electronic", query: "electronic" },
  { id: "country", label: "Country", query: "country" },
  { id: "jazz", label: "Jazz", query: "jazz" },
  { id: "classical", label: "Classical", query: "classical" },
  { id: "latin", label: "Latin", query: "latin" },
  { id: "reggae-dancehall", label: "Reggae / Dancehall", query: "reggae dancehall" },
  { id: "blues", label: "Blues", query: "blues" },
  { id: "soundtrack", label: "Soundtrack", query: "soundtrack" },
  { id: "alternative", label: "Alternative", query: "alternative" },
];

const HIT_PLAYLIST_TITLES = [
  "TIDAL's Top Hits",
  "Pop Hits",
  "Rock Hits",
  "Country Hits",
  "Rap Hits",
  "R&B Hits",
  "Indie Hits",
  "Exitos De Hoy",
  "Gospel Hits",
  "DJ Hits",
  "Latin Hits",
  "Dance Hits",
  "Alternative Hits",
  "Afrobeats Hits",
];

const FEATURED_PLAYLIST_TITLES = [
  "New Arrivals",
  "New Arrivals: Hip-Hop & R&B",
  "New Arrivals: Pop and R&B",
  "New Arrivals: Hip-Hop and Latin",
  "Rihanna Essentials",
  "Smokey Robinson Essentials",
  "The Weeknd Essentials",
  "Beyonce Essentials",
  "Drake Essentials",
  "Kendrick Lamar Essentials",
  "Taylor Swift Essentials",
  "Bad Bunny Essentials",
];

const SECTION_MIN_COUNTS: Partial<Record<string, number>> = {
  "trending albums": 18,
  "new albums": 18,
  "the hits": 12,
  "new tracks": 24,
  "trending tracks": 20,
  "featured playlists": 10,
  "spotlighted uploads": 16,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (isRecord(value)) {
    return (
      getString(value.title) ||
      getString(value.name) ||
      getString(value.label) ||
      getString(value.text) ||
      null
    );
  }

  return null;
}

function extractSectionItems(source: unknown): unknown[] {
  if (Array.isArray(source)) return source;
  if (!isRecord(source)) return [];

  const directKeys = ["items", "values", "genres", "chips", "tags", "buttons"];
  for (const key of directKeys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.items)) return value.items;
  }

  if (isRecord(source.pagedList) && Array.isArray(source.pagedList.items)) {
    return source.pagedList.items;
  }

  if (isRecord(source.content) && Array.isArray(source.content.items)) {
    return source.content.items;
  }

  return [];
}

function extractRawSections(payload: unknown): RawSection[] {
  const roots = Array.isArray(payload) ? payload : [payload];
  const sections: RawSection[] = [];

  for (const root of roots) {
    if (!isRecord(root)) continue;

    const rows = asArray<unknown>(root.rows);
    if (rows.length === 0) continue;

    for (const row of rows) {
      if (!isRecord(row)) continue;

      const rowTitle =
        getString(row.title) ||
        getString(row.heading) ||
        getString(row.headline) ||
        getString(row.header);

      const modules = asArray<unknown>(row.modules);
      if (modules.length === 0) {
        const rowItems = extractSectionItems(row);
        if (rowTitle && rowItems.length > 0) {
          sections.push({
            title: rowTitle,
            type: getString(row.type),
            items: rowItems,
          });
        }
        continue;
      }

      for (const module of modules) {
        if (!isRecord(module)) continue;
        const title =
          getString(module.title) ||
          getString(module.heading) ||
          getString(module.header) ||
          rowTitle;
        const items = extractSectionItems(module);
        if (!title || items.length === 0) continue;

        sections.push({
          title,
          type: getString(module.type),
          items,
        });
      }
    }
  }

  return sections;
}

function mapToHomeAlbum(value: SourceAlbum | null | undefined): HomeAlbum | null {
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
    coverUrl: album.cover ? `https://resources.tidal.com/images/${album.cover.replace(/-/g, "/")}/750x750.jpg` : "/placeholder.svg",
    releaseDate: album.releaseDate,
  };
}

function mapToHomeArtist(value: SourceArtist | null | undefined): HomeArtist | null {
  const artist = mapArtist(value);
  if (!artist) return null;

  return {
    id: artist.id,
    name: artist.name,
    imageUrl: artist.picture
      ? `https://resources.tidal.com/images/${artist.picture.replace(/-/g, "/")}/750x750.jpg`
      : "/placeholder.svg",
  };
}

function mapToTrack(value: SourceTrack | null | undefined): Track | null {
  const track = mapTrack(value);
  if (!track) return null;
  return tidalTrackToAppTrack(track);
}

function mapToPlaylist(value: SourcePlaylist | null | undefined): TidalPlaylist | null {
  return mapPlaylist(value);
}

function normalizeGenreItems(items: unknown[]) {
  return items
    .map((item) => getString(item))
    .filter((item): item is string => Boolean(item))
    .map((label) => ({
      id: slugify(label),
      label,
      query: label,
    }));
}

function normalizeRawSection(section: RawSection): BrowseHotNewSection | null {
  const title = section.title.trim();
  const titleKey = title.toLowerCase();
  const firstItem = section.items[0];
  const moduleType = String(section.type || "").toUpperCase();

  if (titleKey === "from our editors") {
    return null;
  }

  if (titleKey.includes("genre")) {
    const genres = normalizeGenreItems(section.items);
    return genres.length > 0
      ? {
          id: slugify(title),
          title,
          type: "genres",
          items: genres,
          source: "browse-file",
        }
      : null;
  }

  if (
    moduleType.includes("PLAYLIST") ||
    (isRecord(firstItem) && typeof firstItem.uuid === "string")
  ) {
    const playlists = section.items
      .map((item) => mapToPlaylist(item as SourcePlaylist))
      .filter((item): item is TidalPlaylist => Boolean(item));

    return playlists.length > 0
      ? {
          id: slugify(title),
          title,
          type: "playlists",
          items: playlists,
          source: "browse-file",
        }
      : null;
  }

  if (
    moduleType.includes("TRACK") ||
    (isRecord(firstItem) && typeof firstItem.duration === "number" && ("album" in firstItem || "artists" in firstItem))
  ) {
    const tracks = section.items
      .map((item) => mapToTrack(item as SourceTrack))
      .filter((item): item is Track => Boolean(item));

    return tracks.length > 0
      ? {
          id: slugify(title),
          title,
          type: "tracks",
          items: tracks,
          source: "browse-file",
        }
      : null;
  }

  if (
    moduleType.includes("ARTIST") ||
    (isRecord(firstItem) && typeof firstItem.id === "number" && typeof firstItem.name === "string" && ("picture" in firstItem || "artistTypes" in firstItem))
  ) {
    const artists = section.items
      .map((item) => mapToHomeArtist(item as SourceArtist))
      .filter((item): item is HomeArtist => Boolean(item));

    return artists.length > 0
      ? {
          id: slugify(title),
          title,
          type: "artists",
          items: artists,
          source: "browse-file",
        }
      : null;
  }

  const albums = section.items
    .map((item) => mapToHomeAlbum(item as SourceAlbum))
    .filter((item): item is HomeAlbum => Boolean(item));

  return albums.length > 0
    ? {
        id: slugify(title),
        title,
        type: "albums",
        items: albums,
        source: "browse-file",
      }
    : null;
}

function dedupeTracks(tracks: Track[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    const key = track.id || `fallback:${track.title}:${track.artist}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePlaylistTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickBestPlaylistMatch(query: string, results: TidalPlaylist[]) {
  const normalizedQuery = normalizePlaylistTitle(query);

  return [...results]
    .sort((left, right) => {
      const leftTitle = normalizePlaylistTitle(left.title);
      const rightTitle = normalizePlaylistTitle(right.title);

      const leftExact = leftTitle === normalizedQuery ? 3 : leftTitle.includes(normalizedQuery) ? 2 : 1;
      const rightExact = rightTitle === normalizedQuery ? 3 : rightTitle.includes(normalizedQuery) ? 2 : 1;

      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }

      return (right.popularity || 0) - (left.popularity || 0);
    })[0] || null;
}

async function loadNamedPlaylists(titles: string[]) {
  const matches = await Promise.all(
    titles.map(async (title) => {
      try {
        const result = await searchPlaylists(title, 16);
        return pickBestPlaylistMatch(title, result);
      } catch {
        return null;
      }
    }),
  );

  const seen = new Set<string>();

  return matches.filter((playlist): playlist is TidalPlaylist => {
    if (!playlist) return false;
    if (seen.has(playlist.uuid)) return false;
    seen.add(playlist.uuid);
    return true;
  });
}

async function loadNewReleaseTracks(albums: HomeAlbum[]) {
  const selected = albums.slice(0, 12);
  const settled = await Promise.allSettled(
    selected.map(async (album) => {
      const result = await getAlbumTracks(album.id);
      return result.slice(0, 4).map((track) => tidalTrackToAppTrack(track));
    }),
  );

  const tracks = settled
    .flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []))
    .filter((track) => !track.isVideo);

  return dedupeTracks(tracks).slice(0, 36);
}

async function hydratePlaylistsWithTrackCounts(playlists: TidalPlaylist[]) {
  const settled = await Promise.allSettled(
    playlists.map(async (playlist) => {
      const detailed = await getPlaylistWithTracks(playlist.uuid);
      return {
        ...playlist,
        numberOfTracks: detailed.tracks.length || playlist.numberOfTracks,
      };
    }),
  );

  return settled.map((entry, index) =>
    entry.status === "fulfilled" ? entry.value : playlists[index],
  );
}

async function loadBrowseFileSections() {
  const payload = await musicCore.requestJson("/home/");
  const rawSections = extractRawSections(payload);
  const normalized = rawSections
    .map((section) => normalizeRawSection(section))
    .filter((section): section is BrowseHotNewSection => Boolean(section));

  const deduped = new Map<string, BrowseHotNewSection>();
  for (const section of normalized) {
    const key = section.title.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, section);
    }
  }

  return Array.from(deduped.values());
}

async function buildFallbackSections({
  newReleases,
  recommendedAlbums,
  recommendedTracks,
  recentTracks,
}: Omit<UseBrowseHotNewOptions, "baseLoaded" | "recommendedArtists">) {
  const [hits, featured, newTracks] = await Promise.all([
    loadNamedPlaylists(HIT_PLAYLIST_TITLES).then((items) => hydratePlaylistsWithTrackCounts(items)),
    loadNamedPlaylists(FEATURED_PLAYLIST_TITLES).then((items) => hydratePlaylistsWithTrackCounts(items)),
    loadNewReleaseTracks(newReleases).catch(() => [] as Track[]),
  ]);

  const sections: BrowseHotNewSection[] = [
    {
      id: "genres",
      title: "Genres",
      type: "genres",
      items: BROWSE_GENRES,
      source: "fallback",
    },
  ];

  if (recommendedAlbums.length > 0) {
    sections.push({
      id: "trending-albums",
      title: "Trending Albums",
      type: "albums",
      items: recommendedAlbums,
      source: "fallback",
    });
  }

  if (newReleases.length > 0) {
    sections.push({
      id: "new-albums",
      title: "New Albums",
      type: "albums",
      items: newReleases,
      source: "fallback",
    });
  }

  if (hits.length > 0) {
    sections.push({
      id: "the-hits",
      title: "The Hits",
      type: "playlists",
      items: hits,
      source: "fallback",
    });
  }

  if (newTracks.length > 0) {
    sections.push({
      id: "new-tracks",
      title: "New Tracks",
      type: "tracks",
      items: newTracks,
      source: "fallback",
    });
  }

  if (recommendedTracks.length > 0) {
    sections.push({
      id: "trending-tracks",
      title: "Trending Tracks",
      type: "tracks",
      items: recommendedTracks.slice(0, 24),
      source: "fallback",
    });
  }

  if (featured.length > 0) {
    sections.push({
      id: "featured-playlists",
      title: "Featured Playlists",
      type: "playlists",
      items: featured,
      source: "fallback",
    });
  }

  if (recentTracks.length > 0) {
    sections.push({
      id: "spotlighted-uploads",
      title: "Spotlighted Uploads",
      type: "tracks",
      items: recentTracks.slice(0, 20),
      source: "fallback",
    });
  }

  return sections;
}

function ensurePinnedSections(sections: BrowseHotNewSection[]) {
  const next = [...sections];
  const sectionTitles = new Set(next.map((section) => section.title.toLowerCase()));

  if (!sectionTitles.has("genres")) {
    next.unshift({
      id: "genres",
      title: "Genres",
      type: "genres",
      items: BROWSE_GENRES,
      source: "fallback",
    });
  }

  return next;
}

function mergeWithFallbackSections(
  primarySections: BrowseHotNewSection[],
  fallbackSections: BrowseHotNewSection[],
) {
  const fallbackByTitle = new Map(
    fallbackSections.map((section) => [section.title.toLowerCase(), section] as const),
  );
  const merged: BrowseHotNewSection[] = [];
  const seen = new Set<string>();

  for (const primary of primarySections) {
    const titleKey = primary.title.toLowerCase();
    seen.add(titleKey);

    if (titleKey === "from our editors") {
      continue;
    }

    const minCount = SECTION_MIN_COUNTS[titleKey] ?? 0;
    const fallback = fallbackByTitle.get(titleKey);

    if (fallback && primary.items.length < minCount && fallback.items.length > primary.items.length) {
      merged.push(fallback);
      continue;
    }

    merged.push(primary);
  }

  for (const fallback of fallbackSections) {
    const titleKey = fallback.title.toLowerCase();
    if (titleKey === "from our editors" || seen.has(titleKey)) continue;
    merged.push(fallback);
  }

  return merged;
}

export function useBrowseHotNew({
  baseLoaded,
  newReleases,
  recommendedAlbums,
  recommendedArtists,
  recommendedTracks,
  recentTracks,
}: UseBrowseHotNewOptions) {
  const [sections, setSections] = useState<BrowseHotNewSection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const fallbackInputs = useMemo(
    () => ({
      newReleases,
      recommendedAlbums,
      recommendedArtists,
      recommendedTracks,
      recentTracks,
    }),
    [newReleases, recommendedAlbums, recommendedArtists, recommendedTracks, recentTracks],
  );

  useEffect(() => {
    if (!baseLoaded) return;

    let cancelled = false;

    async function load() {
      setLoaded(false);
      setError(false);

      try {
        const fromFile = await loadBrowseFileSections().catch(() => [] as BrowseHotNewSection[]);
        const fallbackSections = await buildFallbackSections(fallbackInputs);
        const finalSections =
          fromFile.length > 0
            ? ensurePinnedSections(mergeWithFallbackSections(fromFile, fallbackSections))
            : fallbackSections;

        if (cancelled) return;
        setSections(finalSections);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        setError(true);
        setSections(await buildFallbackSections(fallbackInputs).catch(() => [] as BrowseHotNewSection[]));
        setLoaded(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [baseLoaded, fallbackInputs]);

  return {
    error,
    loaded,
    sections,
  };
}
