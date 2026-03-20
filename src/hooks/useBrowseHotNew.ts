import { useEffect, useMemo, useState } from "react";

import type { HomeAlbum, HomeArtist } from "@/hooks/useHomeFeeds";
import {
  getAlbumTracks,
  getPlaylistWithTracks,
  searchPlaylists,
} from "@/lib/musicApi";
import type { TidalPlaylist } from "@/lib/musicApiTypes";
import { tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
import { BROWSE_GENRES } from "@/lib/browseGenres";
import { fetchEditorsPicks } from "@/lib/editorsPicks";
import { fetchTidalHotNewSections } from "@/lib/tidalBrowseApi";
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
      source: "tidal-api" | "monochrome" | "recommendations";
    }
  | {
      id: string;
      title: string;
      type: "albums";
      items: HomeAlbum[];
      source: "tidal-api" | "monochrome" | "recommendations";
    }
  | {
      id: string;
      title: string;
      type: "artists";
      items: HomeArtist[];
      source: "tidal-api" | "monochrome" | "recommendations";
    }
  | {
      id: string;
      title: string;
      type: "tracks";
      items: Track[];
      source: "tidal-api" | "monochrome" | "recommendations";
    }
  | {
      id: string;
      title: string;
      type: "videos";
      items: Track[];
      source: "tidal-api" | "monochrome" | "recommendations";
    }
  | {
      id: string;
      title: string;
      type: "playlists";
      items: TidalPlaylist[];
      source: "tidal-api" | "monochrome" | "recommendations";
    };

type UseBrowseHotNewOptions = {
  baseLoaded: boolean;
  newReleases: HomeAlbum[];
  recommendedAlbums: HomeAlbum[];
  recommendedArtists: HomeArtist[];
  recommendedTracks: Track[];
  recentTracks: Track[];
};

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

function createQuickSections({
  baseLoaded,
  editorsPicks,
  newReleases,
  recommendedAlbums,
  recommendedArtists,
  recommendedTracks,
  recentTracks,
}: UseBrowseHotNewOptions & { editorsPicks: HomeAlbum[] }) {
  const sections: BrowseHotNewSection[] = [];

  if (editorsPicks.length > 0) {
    sections.push({
      id: "editors-picks",
      title: "Editor's Picks",
      type: "albums",
      items: editorsPicks,
      source: "monochrome",
    });
  }

  if (baseLoaded && newReleases.length > 0) {
    sections.push({
      id: "new-albums",
      title: "New Albums",
      type: "albums",
      items: newReleases,
      source: "recommendations",
    });
  }

  if (baseLoaded && recommendedAlbums.length > 0) {
    sections.push({
      id: "trending-albums",
      title: "Trending Albums",
      type: "albums",
      items: recommendedAlbums,
      source: "recommendations",
    });
  }

  if (baseLoaded && recommendedArtists.length > 0) {
    sections.push({
      id: "recommended-artists",
      title: "Recommended Artists",
      type: "artists",
      items: recommendedArtists,
      source: "recommendations",
    });
  }

  if (baseLoaded && recommendedTracks.length > 0) {
    sections.push({
      id: "trending-tracks",
      title: "Trending Tracks",
      type: "tracks",
      items: recommendedTracks.slice(0, 40),
      source: "recommendations",
    });
  }

  if (baseLoaded && recentTracks.length > 0) {
    sections.push({
      id: "spotlighted-uploads",
      title: "Spotlighted Uploads",
      type: "tracks",
      items: recentTracks.slice(0, 32),
      source: "recommendations",
    });
  }

  sections.push({
    id: "genres",
    title: "Genres",
    type: "genres",
    items: BROWSE_GENRES,
    source: "monochrome",
  });

  return sections;
}

async function buildEnhancedSections(newReleases: HomeAlbum[]) {
  const [hits, featured, newTracks] = await Promise.all([
    loadNamedPlaylists(HIT_PLAYLIST_TITLES).then((items) => hydratePlaylistsWithTrackCounts(items)),
    loadNamedPlaylists(FEATURED_PLAYLIST_TITLES).then((items) => hydratePlaylistsWithTrackCounts(items)),
    newReleases.length > 0 ? loadNewReleaseTracks(newReleases).catch(() => [] as Track[]) : Promise.resolve([] as Track[]),
  ]);

  const sections: BrowseHotNewSection[] = [];

  if (newTracks.length > 0) {
    sections.push({
      id: "new-tracks",
      title: "New Tracks",
      type: "tracks",
      items: newTracks,
      source: "recommendations",
    });
  }

  if (hits.length > 0) {
    sections.push({
      id: "the-hits",
      title: "The Hits",
      type: "playlists",
      items: hits,
      source: "recommendations",
    });
  }

  if (featured.length > 0) {
    sections.push({
      id: "featured-playlists",
      title: "Featured Playlists",
      type: "playlists",
      items: featured,
      source: "recommendations",
    });
  }

  return sections;
}

function mergeSections(...collections: BrowseHotNewSection[][]) {
  const deduped = new Map<string, BrowseHotNewSection>();

  for (const sections of collections) {
    for (const section of sections) {
      const key = section.title.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, section);
      }
    }
  }

  return Array.from(deduped.values());
}

export function useBrowseHotNew({
  baseLoaded,
  newReleases,
  recommendedAlbums,
  recommendedArtists,
  recommendedTracks,
  recentTracks,
}: UseBrowseHotNewOptions) {
  const [liveSections, setLiveSections] = useState<BrowseHotNewSection[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [editorsPicks, setEditorsPicks] = useState<HomeAlbum[]>([]);
  const [editorsLoaded, setEditorsLoaded] = useState(false);
  const [enhancedSections, setEnhancedSections] = useState<BrowseHotNewSection[]>([]);
  const [enhancedLoaded, setEnhancedLoaded] = useState(false);
  const [error, setError] = useState(false);

  const quickSections = useMemo(
    () =>
      createQuickSections({
        baseLoaded,
        editorsPicks,
        newReleases,
        recommendedAlbums,
        recommendedArtists,
        recommendedTracks,
        recentTracks,
      }),
    [
      baseLoaded,
      editorsPicks,
      newReleases,
      recommendedAlbums,
      recommendedArtists,
      recommendedTracks,
      recentTracks,
    ],
  );

  const fallbackSections = useMemo(
    () => mergeSections(quickSections, enhancedSections),
    [enhancedSections, quickSections],
  );

  const sections = liveSections.length > 0 ? liveSections : fallbackSections;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextSections = await fetchTidalHotNewSections();
        if (!cancelled) {
          setLiveSections(nextSections as BrowseHotNewSection[]);
          if (nextSections.length === 0) {
            setError(true);
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLiveSections([]);
        }
      } finally {
        if (!cancelled) {
          setLiveLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (liveSections.length > 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const picks = await fetchEditorsPicks();
        if (!cancelled) {
          setEditorsPicks(picks);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setEditorsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liveSections.length]);

  useEffect(() => {
    if (liveSections.length > 0) {
      setEnhancedSections([]);
      setEnhancedLoaded(true);
      return;
    }

    if (!baseLoaded) {
      setEnhancedSections([]);
      setEnhancedLoaded(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextSections = await buildEnhancedSections(newReleases);
        if (!cancelled) {
          setEnhancedSections(nextSections);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setEnhancedSections([]);
        }
      } finally {
        if (!cancelled) {
          setEnhancedLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseLoaded, liveSections.length, newReleases]);

  return {
    error,
    loaded: sections.length > 0 || liveLoaded || editorsLoaded || (baseLoaded && enhancedLoaded),
    sections,
  };
}
