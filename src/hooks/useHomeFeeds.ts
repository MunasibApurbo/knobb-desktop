import { useCallback, useEffect, useRef, useState } from "react";
import { FavoriteArtist } from "@/contexts/FavoriteArtistsContext";
import { PlayHistoryEntry } from "@/hooks/usePlayHistory";
import { fetchEditorsPicks, getSeedEditorsPicks } from "@/lib/editorsPicks";
import { createNewReleaseNotification } from "@/lib/notifications";
import { fetchTidalHotNewSections, type TidalBrowseSection } from "@/lib/tidalBrowseApi";
import {
  getArtistAlbums,
  getArtistPopularTracks,
  getRecommendations,
  getSimilarAlbums,
  getSimilarArtists,
  getTidalImageUrl,
  TidalAlbum,
  TidalArtist,
  TidalTrack,
  tidalTrackToAppTrack,
} from "@/lib/musicApi";
import { filterPlayableTracks } from "@/lib/trackPlayback";
import { Track } from "@/types/music";
import { buildTrackKey } from "@/lib/librarySources";
import { sanitizeTrackRecords } from "@/lib/trackNormalization";

export type HomeArtist = {
  id: number | string;
  name: string;
  imageUrl: string;
  source?: "tidal" | "youtube-music";
};

export type HomeAlbum = {
  id: number | string;
  title: string;
  artist: string;
  artistId?: number | string;
  coverUrl: string;
  releaseDate?: string;
  source?: "tidal" | "youtube-music";
};

type SecondaryHomeRecommendations = {
  recommendedAlbums: HomeAlbum[];
  recommendedArtists: HomeArtist[];
  recommendedAlbumsPersonalized: boolean;
  recommendedArtistsPersonalized: boolean;
};

type UseHomeFeedsOptions = {
  authLoading?: boolean;
  favoriteArtists: FavoriteArtist[];
  favoriteArtistsLoading?: boolean;
  getHistory: (limit?: number) => Promise<PlayHistoryEntry[]>;
  userId?: string;
};

type HomeFeedSnapshot = {
  recommendedArtists: HomeArtist[];
  recommendedArtistsPersonalized: boolean;
  recommendedAlbums: HomeAlbum[];
  recommendedAlbumsPersonalized: boolean;
  recommendedTracks: Track[];
  newReleases: HomeAlbum[];
  recentTracks: Track[];
  timestamp: number;
  version: number;
};

const sanitizeHomeFeedSnapshot = (snapshot: HomeFeedSnapshot): HomeFeedSnapshot => ({
  ...snapshot,
  recommendedTracks: filterPlayableTracks(sanitizeTrackRecords(snapshot.recommendedTracks)),
  recentTracks: sanitizeTrackRecords(snapshot.recentTracks),
});

const HOME_FEEDS_CACHE_VERSION = 3;
const HOME_FEEDS_CACHE_TTL_MS = 1000 * 60 * 30;
const HOME_FEEDS_STORAGE_PREFIX = "knobb-home-feeds";
const homeFeedSnapshotMemory = new Map<string, HomeFeedSnapshot>();
const preloadedHomeFeedArtwork = new Set<string>();

const getTrackHistoryKey = (track: Track) => {
  return buildTrackKey(track);
};

const dedupeLatestHistoryTracks = (tracks: Track[]) => {
  const seen = new Set<string>();
  const deduped: Track[] = [];

  for (const track of tracks) {
    const key = getTrackHistoryKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(track);
  }

  return deduped;
};

const dedupeById = <T extends { id: string | number }>(items: T[]) => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

const rotateForRefresh = <T,>(items: T[], shouldRotate: boolean): T[] => {
  if (!shouldRotate || items.length < 2) return items;
  const offset = 1 + Math.floor(Math.random() * (items.length - 1));
  return [...items.slice(offset), ...items.slice(0, offset)];
};

const HISTORY_EVENT_WEIGHTS: Record<PlayHistoryEntry["eventType"], number> = {
  repeat: 3.5,
  complete: 2.2,
  progress: 1,
  skip: -2.5,
  start: 0.3,
};

const getRecencyWeight = (playedAt: string) => {
  const ageMs = Date.now() - new Date(playedAt).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return Math.exp(-ageDays / 12);
};

const getHistorySignalWeight = (entry: PlayHistoryEntry) =>
  (HISTORY_EVENT_WEIGHTS[entry.eventType] ?? 1) * getRecencyWeight(entry.playedAt);

const getPrimaryArtistName = (album: TidalAlbum): string =>
  album.artist?.name || album.artists?.[0]?.name || "Various Artists";

const getArtistImageUrl = (artist: Pick<TidalArtist, "picture">): string =>
  artist.picture ? getTidalImageUrl(artist.picture, "750x750") : "/placeholder.svg";

const getAlbumCoverUrl = (album: TidalAlbum): string =>
  album.cover ? getTidalImageUrl(album.cover, "750x750") : "/placeholder.svg";

const EMPTY_SECONDARY_RECOMMENDATIONS: SecondaryHomeRecommendations = {
  recommendedAlbums: [],
  recommendedArtists: [],
  recommendedAlbumsPersonalized: false,
  recommendedArtistsPersonalized: false,
};
const FALLBACK_HOME_SEED_ALBUMS = getSeedEditorsPicks();

const getHomeFeedStorageKey = (userId?: string) =>
  `${HOME_FEEDS_STORAGE_PREFIX}:${userId || "guest"}`;

function preloadImageUrl(url?: string | null) {
  if (typeof window === "undefined" || !url || url === "/placeholder.svg" || preloadedHomeFeedArtwork.has(url)) {
    return;
  }

  preloadedHomeFeedArtwork.add(url);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
}

function preloadHomeFeedArtwork(snapshot: Pick<
  HomeFeedSnapshot,
  "recommendedArtists" | "recommendedAlbums" | "recommendedTracks" | "newReleases" | "recentTracks"
>) {
  snapshot.recommendedTracks.slice(0, 8).forEach((track) => preloadImageUrl(track.coverUrl));
  snapshot.recentTracks.slice(0, 8).forEach((track) => preloadImageUrl(track.coverUrl));
  snapshot.recommendedAlbums.slice(0, 8).forEach((album) => preloadImageUrl(album.coverUrl));
  snapshot.newReleases.slice(0, 8).forEach((album) => preloadImageUrl(album.coverUrl));
  snapshot.recommendedArtists.slice(0, 8).forEach((artist) => preloadImageUrl(artist.imageUrl));
}

const isUsableHomeFeedSnapshot = (value: unknown): value is HomeFeedSnapshot => {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<HomeFeedSnapshot>;
  return (
    snapshot.version === HOME_FEEDS_CACHE_VERSION &&
    typeof snapshot.timestamp === "number" &&
    Array.isArray(snapshot.recommendedArtists) &&
    typeof snapshot.recommendedArtistsPersonalized === "boolean" &&
    Array.isArray(snapshot.recommendedAlbums) &&
    typeof snapshot.recommendedAlbumsPersonalized === "boolean" &&
    Array.isArray(snapshot.recommendedTracks) &&
    Array.isArray(snapshot.newReleases) &&
    Array.isArray(snapshot.recentTracks)
  );
};

const isFreshHomeFeedSnapshot = (snapshot: HomeFeedSnapshot) =>
  Date.now() - snapshot.timestamp < HOME_FEEDS_CACHE_TTL_MS;

const buildFallbackArtistsFromAlbums = (albums: HomeAlbum[]): HomeArtist[] => {
  const seen = new Set<string>();
  const artists: HomeArtist[] = [];

  for (const album of albums) {
    const artistName = album.artist?.trim();
    if (!artistName) continue;

    const artistId = album.artistId ?? artistName.toLowerCase();
    const key = String(artistId);
    if (seen.has(key)) continue;
    seen.add(key);
    artists.push({
      id: artistId,
      name: artistName,
      imageUrl: album.coverUrl || "/placeholder.svg",
      source: album.source,
    });
  }

  return artists;
};

function buildLiveFallbackContentFromBrowseSections(sections: TidalBrowseSection[]) {
  const albumSections = sections.filter(
    (section): section is Extract<TidalBrowseSection, { type: "albums" }> =>
      section.type === "albums" && Array.isArray(section.items) && section.items.length > 0,
  );
  const artistSections = sections.filter(
    (section): section is Extract<TidalBrowseSection, { type: "artists" }> =>
      section.type === "artists" && Array.isArray(section.items) && section.items.length > 0,
  );
  const trackSections = sections
    .filter(
      (section): section is Extract<TidalBrowseSection, { type: "tracks" }> =>
        section.type === "tracks" && Array.isArray(section.items) && section.items.length > 0,
    )
    .map((section) => ({
      ...section,
      items: filterPlayableTracks(section.items.filter((track) => track.isVideo !== true)),
    }))
    .filter((section) => section.items.length > 0);

  const releaseSection = albumSections.find((section) => /new|arrival|release/i.test(section.title)) || albumSections[0] || null;
  const recommendedAlbumSection = albumSections.find((section) => section.id !== releaseSection?.id) || albumSections[1] || releaseSection;
  const recommendedArtistSection = artistSections[0] || null;
  const recommendedTrackSection =
    trackSections.find((section) => /new tracks|hits|trending|popular/i.test(section.title.toLowerCase())) || trackSections[0] || null;

  const newReleases = dedupeById(
    (releaseSection?.items || []).map((album) => ({
      ...album,
      source: "tidal" as const,
    })),
  ).slice(0, 20);
  const recommendedAlbums = dedupeById(
    (recommendedAlbumSection?.items || []).map((album) => ({
      ...album,
      source: "tidal" as const,
    })),
  ).slice(0, 20);
  const recommendedArtists = dedupeById(
    (recommendedArtistSection?.items || []).map((artist) => ({
      ...artist,
      source: "tidal" as const,
    })),
  ).slice(0, 20);
  const recommendedTracks = dedupeById(recommendedTrackSection?.items || []).slice(0, 20);

  if (
    newReleases.length === 0 &&
    recommendedAlbums.length === 0 &&
    recommendedArtists.length === 0 &&
    recommendedTracks.length === 0
  ) {
    return null;
  }

  return {
    newReleases,
    recommendedAlbums: recommendedAlbums.length > 0 ? recommendedAlbums : newReleases,
    recommendedAlbumsPersonalized: false,
    recommendedArtists: recommendedArtists.length > 0
      ? recommendedArtists
      : buildFallbackArtistsFromAlbums(recommendedAlbums.length > 0 ? recommendedAlbums : newReleases).slice(0, 20),
    recommendedArtistsPersonalized: false,
    recommendedTracks,
  };
}

const buildSeedHomeFeedSnapshot = (): Pick<
  HomeFeedSnapshot,
  "recommendedArtists" | "recommendedAlbums" | "recommendedTracks" | "newReleases" | "recentTracks"
> => {
  const fallbackAlbums = FALLBACK_HOME_SEED_ALBUMS.slice(0, 20);

  return {
    recommendedArtists: buildFallbackArtistsFromAlbums(fallbackAlbums).slice(0, 20),
    recommendedArtistsPersonalized: false,
    recommendedAlbums: fallbackAlbums,
    recommendedAlbumsPersonalized: false,
    recommendedTracks: [],
    newReleases: [...fallbackAlbums]
      .sort((a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime())
      .slice(0, 20),
    recentTracks: [],
  };
};

const FALLBACK_HOME_FEED_SNAPSHOT = buildSeedHomeFeedSnapshot();

const readHomeFeedSnapshot = (
  userId?: string,
  options: { allowStale?: boolean } = {},
): HomeFeedSnapshot | null => {
  const allowStale = options.allowStale === true;
  const storageKey = getHomeFeedStorageKey(userId);
  const memorySnapshot = homeFeedSnapshotMemory.get(storageKey);
  if (memorySnapshot && (allowStale || isFreshHomeFeedSnapshot(memorySnapshot))) {
    return sanitizeHomeFeedSnapshot(memorySnapshot);
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isUsableHomeFeedSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (!allowStale && !isFreshHomeFeedSnapshot(parsed)) {
      return null;
    }

    homeFeedSnapshotMemory.set(storageKey, parsed);
    return sanitizeHomeFeedSnapshot(parsed);
  } catch {
    return null;
  }
};

const writeHomeFeedSnapshot = (
  userId: string | undefined,
  snapshot: Omit<HomeFeedSnapshot, "timestamp" | "version">,
) => {
  const storageKey = getHomeFeedStorageKey(userId);
  const payload: HomeFeedSnapshot = {
    ...snapshot,
    timestamp: Date.now(),
    version: HOME_FEEDS_CACHE_VERSION,
  };
  const sanitizedPayload = sanitizeHomeFeedSnapshot(payload);

  homeFeedSnapshotMemory.set(storageKey, sanitizedPayload);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(sanitizedPayload));
  } catch {
    // Ignore storage quota failures and continue with memory cache only.
  }
};

const interleaveTrackGroups = (groups: TidalTrack[][]): Track[] => {
  const nonEmpty = groups.filter((group) => group.length > 0);
  if (nonEmpty.length === 0) return [];

  const maxLen = Math.max(...nonEmpty.map((group) => group.length));
  const interleaved: Track[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    for (const group of nonEmpty) {
      if (i < group.length) interleaved.push(tidalTrackToAppTrack(group[i]));
    }
  }

  return filterPlayableTracks(interleaved);
};

export function useHomeFeeds({
  authLoading = false,
  favoriteArtists,
  favoriteArtistsLoading = false,
  getHistory,
  userId,
}: UseHomeFeedsOptions) {
  const initialSnapshotRef = useRef<HomeFeedSnapshot | null>(readHomeFeedSnapshot(userId, { allowStale: true }));
  const initialVisualSnapshotRef = useRef(
    initialSnapshotRef.current
      ? sanitizeHomeFeedSnapshot(initialSnapshotRef.current)
      : sanitizeHomeFeedSnapshot({
        ...FALLBACK_HOME_FEED_SNAPSHOT,
        timestamp: 0,
        version: HOME_FEEDS_CACHE_VERSION,
      }),
  );
  const [recommendedArtists, setRecommendedArtists] = useState<HomeArtist[]>(
    () => initialVisualSnapshotRef.current.recommendedArtists,
  );
  const [recommendedArtistsPersonalized, setRecommendedArtistsPersonalized] = useState<boolean>(
    () => initialVisualSnapshotRef.current.recommendedArtistsPersonalized,
  );
  const [recommendedAlbums, setRecommendedAlbums] = useState<HomeAlbum[]>(
    () => initialVisualSnapshotRef.current.recommendedAlbums,
  );
  const [recommendedAlbumsPersonalized, setRecommendedAlbumsPersonalized] = useState<boolean>(
    () => initialVisualSnapshotRef.current.recommendedAlbumsPersonalized,
  );
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>(
    () => initialVisualSnapshotRef.current.recommendedTracks,
  );
  const [newReleases, setNewReleases] = useState<HomeAlbum[]>(
    () => initialVisualSnapshotRef.current.newReleases,
  );
  const [recentTracks, setRecentTracks] = useState<Track[]>(
    () => initialVisualSnapshotRef.current.recentTracks,
  );
  const [loaded, setLoaded] = useState(() => Boolean(initialSnapshotRef.current));
  const [error, setError] = useState(false);
  const [reloadingSection, setReloadingSection] = useState<string | null>(null);

  const initialLoadCompletedRef = useRef(Boolean(initialSnapshotRef.current));
  const loadSequenceRef = useRef(0);
  const lastAutoLoadKeyRef = useRef<string | null>(null);
  const activeUserCacheKeyRef = useRef(getHomeFeedStorageKey(userId));
  const hasVisibleFeedContent =
    recommendedArtists.length > 0 ||
    recommendedAlbums.length > 0 ||
    recommendedTracks.length > 0 ||
    newReleases.length > 0 ||
    recentTracks.length > 0;

  const applySnapshot = useCallback((snapshot: HomeFeedSnapshot) => {
    setRecommendedArtists(snapshot.recommendedArtists);
    setRecommendedArtistsPersonalized(snapshot.recommendedArtistsPersonalized);
    setRecommendedAlbums(snapshot.recommendedAlbums);
    setRecommendedAlbumsPersonalized(snapshot.recommendedAlbumsPersonalized);
    setRecommendedTracks(snapshot.recommendedTracks);
    setNewReleases(snapshot.newReleases);
    setRecentTracks(snapshot.recentTracks);
    setError(false);
    setLoaded(true);
    initialLoadCompletedRef.current = true;
    preloadHomeFeedArtwork(snapshot);
  }, []);

  const loadFallbackHomeContent = useCallback(async (refreshSection?: string) => {
    try {
      const liveSections = await fetchTidalHotNewSections();
      const liveFallback = buildLiveFallbackContentFromBrowseSections(liveSections);
      if (liveFallback) {
        return {
          recommendedAlbums: rotateForRefresh(liveFallback.recommendedAlbums, refreshSection === "recalbums"),
          recommendedArtists: rotateForRefresh(liveFallback.recommendedArtists, refreshSection === "recartists"),
          recommendedAlbumsPersonalized: false,
          recommendedArtistsPersonalized: false,
          recommendedTracks: rotateForRefresh(liveFallback.recommendedTracks, refreshSection === "recommended"),
          newReleases: rotateForRefresh(liveFallback.newReleases, refreshSection === "newreleases"),
        };
      }
    } catch {
      // Fall through to seeded picks when live discovery is unavailable.
    }

    const editorPicks = await fetchEditorsPicks();
    const fallbackAlbums = (editorPicks.length > 0 ? editorPicks : FALLBACK_HOME_SEED_ALBUMS).slice(0, 20);
    const recommendedArtists = rotateForRefresh(
      buildFallbackArtistsFromAlbums(fallbackAlbums).slice(0, 20),
      refreshSection === "recartists",
    );

    const fallbackArtistIds = recommendedArtists
      .map((artist) => artist.id)
      .filter((artistId): artistId is number => typeof artistId === "number")
      .slice(0, 4);
    const fallbackTrackGroups = await Promise.all(
      fallbackArtistIds.map((artistId) =>
        getArtistPopularTracks(artistId, 6).catch(() => [] as TidalTrack[]),
      ),
    );
    const recommendedTracks = rotateForRefresh(
      dedupeById(interleaveTrackGroups(fallbackTrackGroups)).slice(0, 20),
      refreshSection === "recommended",
    );

    const newReleaseCandidates = rotateForRefresh(
      [...fallbackAlbums]
        .sort((a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime())
        .slice(0, 20),
      refreshSection === "newreleases",
    );

    return {
      recommendedAlbums: rotateForRefresh(fallbackAlbums, refreshSection === "recalbums"),
      recommendedArtists,
      recommendedAlbumsPersonalized: false,
      recommendedArtistsPersonalized: false,
      recommendedTracks,
      newReleases: newReleaseCandidates,
    };
  }, []);

  const loadHomeFeeds = useCallback(async (refreshSection?: string) => {
    const requestId = ++loadSequenceRef.current;
    const isInitialPass = !initialLoadCompletedRef.current && !refreshSection;
    const isCurrentRequest = () => loadSequenceRef.current === requestId;
    const commit = (callback: () => void) => {
      if (isCurrentRequest()) callback();
    };
    const markInitialLoaded = () => {
      if (!initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setLoaded(true);
      }
    };

    setError(false);

    const loadNewReleases = async (): Promise<HomeAlbum[]> => {
      if (favoriteArtists.length === 0) {
        return [];
      }

      try {
        const favoriteAlbumsGroups = await Promise.all(
          favoriteArtists.slice(0, isInitialPass ? 3 : 4).map(async (artist) => {
            try {
              return await getArtistAlbums(artist.artist_id);
            } catch {
              return [] as TidalAlbum[];
            }
          }),
        );
        if (!isCurrentRequest()) return;

        const allFavoriteAlbums = favoriteAlbumsGroups.flat();
        const uniqueNewReleases = dedupeById(allFavoriteAlbums)
          .filter((album): album is TidalAlbum => Boolean(album?.id && album?.title))
          .map((album) => ({
            id: album.id,
            title: album.title,
            artist: getPrimaryArtistName(album),
            artistId: album.artist?.id || album.artists?.[0]?.id,
            coverUrl: getAlbumCoverUrl(album),
            releaseDate: album.releaseDate,
          }))
          .sort((a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime());

        if (userId) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const brandNewAlbums = uniqueNewReleases.filter((album) => {
            if (!album.releaseDate) return false;
            return new Date(album.releaseDate) >= sevenDaysAgo;
          });

          for (const album of brandNewAlbums) {
            void createNewReleaseNotification({
              userId,
              albumId: album.id,
              albumTitle: album.title,
              artistName: album.artist,
            });
          }
        }

        return rotateForRefresh(uniqueNewReleases.slice(0, 20), refreshSection === "newreleases");
      } catch (e) {
        console.error("Failed to fetch new releases for favorite artists:", e);
        return [];
      }
    };

    const loadSecondaryRecommendations = async (
      history: PlayHistoryEntry[],
      topArtists: { id: number | string; name: string; score: number }[],
      topAlbums: { id: number | string; title: string; artist: string; score: number }[],
    ): Promise<SecondaryHomeRecommendations> => {
      try {
        const [artistSimilarGroups, artistAlbumGroups, albumSimilarGroups] = await Promise.all([
          Promise.all(topArtists.map((artist) => typeof artist.id === "number" ? getSimilarArtists(artist.id).catch(() => []) : Promise.resolve([]))),
          Promise.all(topArtists.map((artist) => typeof artist.id === "number" ? getArtistAlbums(artist.id).catch(() => []) : Promise.resolve([]))),
          Promise.all(topAlbums.map((album) => typeof album.id === "number" ? getSimilarAlbums(album.id).catch(() => []) : Promise.resolve([]))),
        ]);
        if (!isCurrentRequest()) return EMPTY_SECONDARY_RECOMMENDATIONS;

        const listenedAlbumIds = new Set<string | number>(history.map((entry) => entry.albumId).filter(Boolean) as (string | number)[]);
        const albumCandidates = dedupeById(
          [...albumSimilarGroups.flat(), ...artistAlbumGroups.flat()]
            .filter((album): album is TidalAlbum => Boolean(album?.id && album?.title))
            .filter((album) => !listenedAlbumIds.has(album.id))
            .map((album) => ({
              id: album.id,
              title: album.title,
              artist: getPrimaryArtistName(album),
              artistId: album.artist?.id || album.artists?.[0]?.id,
              coverUrl: getAlbumCoverUrl(album),
            })),
        );

        const listenedArtistIds = new Set<string | number>(topArtists.map((artist) => artist.id));
        const similarArtists = dedupeById(
          artistSimilarGroups
            .flat()
            .filter((artist): artist is TidalArtist => Boolean(artist?.id && artist?.name))
            .filter((artist) => !listenedArtistIds.has(artist.id))
            .map((artist) => ({
              id: artist.id,
              name: artist.name,
              imageUrl: getArtistImageUrl(artist),
            })),
        );

        return {
          recommendedAlbums: rotateForRefresh(albumCandidates.slice(0, 20), refreshSection === "recalbums"),
          recommendedArtists: rotateForRefresh(similarArtists.slice(0, 20), refreshSection === "recartists"),
          recommendedAlbumsPersonalized: albumCandidates.length > 0,
          recommendedArtistsPersonalized: similarArtists.length > 0,
        };
      } catch (e) {
        console.error("Failed to load secondary home recommendations:", e);
        return EMPTY_SECONDARY_RECOMMENDATIONS;
      }
    };

    try {
      const historyPromise = userId ? getHistory(isInitialPass ? 120 : 200) : Promise.resolve([] as PlayHistoryEntry[]);
      const newReleasesTask = loadNewReleases();
      const history = await historyPromise;
      if (!isCurrentRequest()) return;

      const uniqueRecent = dedupeLatestHistoryTracks(history).slice(0, 20);
      const nextRecentTracks = rotateForRefresh(uniqueRecent, refreshSection === "recent");
      if (!isInitialPass) {
        commit(() => {
          setRecentTracks(nextRecentTracks);
        });
      }

      if (history.length === 0) {
        commit(() => {
          setRecentTracks(nextRecentTracks);
        });
        markInitialLoaded();

        void Promise.all([newReleasesTask, loadFallbackHomeContent(refreshSection)]).then(([nextNewReleases, fallbackContent]) => {
          if (!isCurrentRequest()) return;
          commit(() => {
            setNewReleases(nextNewReleases.length > 0 ? nextNewReleases : fallbackContent.newReleases);
            setRecommendedTracks(fallbackContent.recommendedTracks);
            setRecommendedAlbums(fallbackContent.recommendedAlbums);
            setRecommendedArtists(fallbackContent.recommendedArtists);
            setRecommendedAlbumsPersonalized(fallbackContent.recommendedAlbumsPersonalized);
            setRecommendedArtistsPersonalized(fallbackContent.recommendedArtistsPersonalized);
          });
        });
        return;
      }

      const artistScores = new Map<number | string, { id: number | string; name: string; score: number }>();
      const albumScores = new Map<number | string, { id: number | string; title: string; artist: string; score: number }>();

      for (const entry of history) {
        const weight = getHistorySignalWeight(entry);

        if (entry.artistId) {
          const existing = artistScores.get(entry.artistId);
          artistScores.set(entry.artistId, {
            id: entry.artistId,
            name: entry.artist,
            score: (existing?.score || 0) + weight,
          });
        }

        if (entry.albumId) {
          const existing = albumScores.get(entry.albumId);
          albumScores.set(entry.albumId, {
            id: entry.albumId,
            title: entry.album,
            artist: entry.artist,
            score: (existing?.score || 0) + weight,
          });
        }
      }

      const topArtists = Array.from(artistScores.values())
        .filter((artist) => artist.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, isInitialPass ? 3 : 4);

      const topAlbums = Array.from(albumScores.values())
        .filter((album) => album.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, isInitialPass ? 2 : 3);

      const artistTopTrackGroups = await Promise.all(
        topArtists.map((artist) => typeof artist.id === "number" ? getArtistPopularTracks(artist.id, isInitialPass ? 8 : 10).catch(() => []) : Promise.resolve([])),
      );
      if (!isCurrentRequest()) return;

      let recommendedTrackCandidates = interleaveTrackGroups(artistTopTrackGroups);
      if (recommendedTrackCandidates.length === 0) {
        const mostRecentTidalId = history.find((entry) => typeof entry.tidalId === "number")?.tidalId;
        if (mostRecentTidalId) {
          try {
            const recommendations = await getRecommendations(mostRecentTidalId);
            recommendedTrackCandidates = filterPlayableTracks(
              recommendations.map((track) => tidalTrackToAppTrack(track)),
            );
          } catch {
            recommendedTrackCandidates = [];
          }
        }
      }

      const recentTrackKeys = new Set(history.map(getTrackHistoryKey));
      const filteredTracks = dedupeById(recommendedTrackCandidates).filter(
        (track) => !recentTrackKeys.has(getTrackHistoryKey(track)),
      );
      const nextRecommendedTracks = rotateForRefresh(filteredTracks.slice(0, 20), refreshSection === "recommended");

      if (isInitialPass) {
        commit(() => {
          setRecentTracks(nextRecentTracks);
          setRecommendedTracks(nextRecommendedTracks);
        });
        markInitialLoaded();

        void newReleasesTask.then((nextNewReleases) => {
          if (!isCurrentRequest()) return;
          commit(() => {
            setNewReleases(nextNewReleases);
          });
        });

        void loadSecondaryRecommendations(history, topArtists, topAlbums).then((secondaryRecommendations) => {
          if (!isCurrentRequest()) return;
          commit(() => {
            setRecommendedAlbums(secondaryRecommendations.recommendedAlbums);
            setRecommendedArtists(secondaryRecommendations.recommendedArtists);
            setRecommendedAlbumsPersonalized(secondaryRecommendations.recommendedAlbumsPersonalized);
            setRecommendedArtistsPersonalized(secondaryRecommendations.recommendedArtistsPersonalized);
          });
        });

        return;
      }

      commit(() => {
        setRecommendedTracks(nextRecommendedTracks);
      });

      const [nextNewReleases, secondaryRecommendations] = await Promise.all([
        newReleasesTask,
        loadSecondaryRecommendations(history, topArtists, topAlbums),
      ]);
      if (!isCurrentRequest()) return;

      commit(() => {
        setNewReleases(nextNewReleases);
        setRecommendedAlbums(secondaryRecommendations.recommendedAlbums);
        setRecommendedArtists(secondaryRecommendations.recommendedArtists);
        setRecommendedAlbumsPersonalized(secondaryRecommendations.recommendedAlbumsPersonalized);
        setRecommendedArtistsPersonalized(secondaryRecommendations.recommendedArtistsPersonalized);
      });
    } catch (e) {
      console.error("Failed to load Tidal home feeds:", e);
      if (isCurrentRequest()) {
        setError(true);
        markInitialLoaded();
      }
    }
  }, [favoriteArtists, getHistory, loadFallbackHomeContent, userId]);

  const reloadSection = useCallback(async (section: string) => {
    switch (section) {
      case "recommended":
        setRecommendedTracks((previous) => rotateForRefresh(previous, true));
        break;
      case "newreleases":
        setNewReleases((previous) => rotateForRefresh(previous, true));
        break;
      case "recent":
        setRecentTracks((previous) => rotateForRefresh(previous, true));
        break;
      case "recalbums":
        setRecommendedAlbums((previous) => rotateForRefresh(previous, true));
        break;
      case "recartists":
        setRecommendedArtists((previous) => rotateForRefresh(previous, true));
        break;
      default:
        break;
    }

    setReloadingSection(section);
    try {
      await loadHomeFeeds(section);
    } finally {
      setReloadingSection(null);
    }
  }, [loadHomeFeeds]);

  const retryInitialLoad = useCallback(async () => {
    loadSequenceRef.current += 1;
    initialLoadCompletedRef.current = false;
    if (!hasVisibleFeedContent) {
      setLoaded(false);
    }

    try {
      await loadHomeFeeds();
    } finally {
      setLoaded(true);
    }
  }, [hasVisibleFeedContent, loadHomeFeeds]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const nextUserCacheKey = getHomeFeedStorageKey(userId);
    const userChanged = activeUserCacheKeyRef.current !== nextUserCacheKey;

    if (userChanged) {
      activeUserCacheKeyRef.current = nextUserCacheKey;
      lastAutoLoadKeyRef.current = null;
      loadSequenceRef.current += 1;

      const nextSnapshot = readHomeFeedSnapshot(userId, { allowStale: true });
      if (nextSnapshot) {
        applySnapshot(nextSnapshot);
      } else if (!hasVisibleFeedContent) {
        initialLoadCompletedRef.current = false;
        setLoaded(false);
        setError(false);
        setRecommendedArtists(FALLBACK_HOME_FEED_SNAPSHOT.recommendedArtists);
        setRecommendedArtistsPersonalized(FALLBACK_HOME_FEED_SNAPSHOT.recommendedArtistsPersonalized);
        setRecommendedAlbums(FALLBACK_HOME_FEED_SNAPSHOT.recommendedAlbums);
        setRecommendedAlbumsPersonalized(FALLBACK_HOME_FEED_SNAPSHOT.recommendedAlbumsPersonalized);
        setRecommendedTracks(FALLBACK_HOME_FEED_SNAPSHOT.recommendedTracks);
        setNewReleases(FALLBACK_HOME_FEED_SNAPSHOT.newReleases);
        setRecentTracks(FALLBACK_HOME_FEED_SNAPSHOT.recentTracks);
      } else {
        initialLoadCompletedRef.current = false;
        setError(false);
        setLoaded(true);
      }
    } else if (!loaded) {
      const cachedSnapshot = readHomeFeedSnapshot(userId, { allowStale: true });
      if (cachedSnapshot) {
        applySnapshot(cachedSnapshot);
      }
    }

    const favoriteArtistKey = favoriteArtists
      .map((artist) => artist.artist_id)
      .sort((a, b) => a - b)
      .join(",");
    const autoLoadKey = `${userId || "guest"}:${favoriteArtistKey}`;

    if (lastAutoLoadKeyRef.current !== autoLoadKey) {
      lastAutoLoadKeyRef.current = autoLoadKey;
      void loadHomeFeeds();
    }
  }, [applySnapshot, authLoading, favoriteArtists, favoriteArtistsLoading, hasVisibleFeedContent, loadHomeFeeds, loaded, userId]);

  useEffect(() => {
    if (!loaded) return;

    preloadHomeFeedArtwork({
      recommendedArtists,
      recommendedAlbums,
      recommendedTracks,
      newReleases,
      recentTracks,
    });

    writeHomeFeedSnapshot(userId, {
      recommendedArtists,
      recommendedArtistsPersonalized,
      recommendedAlbums,
      recommendedAlbumsPersonalized,
      recommendedTracks,
      newReleases,
      recentTracks,
    });
  }, [
    loaded,
    newReleases,
    recentTracks,
    recommendedAlbums,
    recommendedAlbumsPersonalized,
    recommendedArtists,
    recommendedArtistsPersonalized,
    recommendedTracks,
    userId,
  ]);

  return {
    error,
    loaded,
    newReleases,
    recommendedAlbums,
    recommendedAlbumsPersonalized,
    recommendedArtists,
    recommendedArtistsPersonalized,
    recommendedTracks,
    recentTracks,
    reloadingSection,
    reloadSection,
    retryInitialLoad,
  };
}
