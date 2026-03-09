import { useCallback, useEffect, useRef, useState } from "react";
import { FavoriteArtist } from "@/contexts/FavoriteArtistsContext";
import { PlayHistoryEntry } from "@/hooks/usePlayHistory";
import { createNewReleaseNotification } from "@/lib/notifications";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
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

export type HomeArtist = {
  id: number;
  name: string;
  imageUrl: string;
};

export type HomeAlbum = {
  id: number;
  title: string;
  artist: string;
  artistId?: number;
  coverUrl: string;
  releaseDate?: string;
};

type SecondaryHomeRecommendations = {
  recommendedAlbums: HomeAlbum[];
  recommendedArtists: HomeArtist[];
};

type UseHomeFeedsOptions = {
  favoriteArtists: FavoriteArtist[];
  getHistory: (limit?: number) => Promise<PlayHistoryEntry[]>;
  userId?: string;
};

type HomeFeedSnapshot = {
  recommendedArtists: HomeArtist[];
  recommendedAlbums: HomeAlbum[];
  recommendedTracks: Track[];
  newReleases: HomeAlbum[];
  recentTracks: Track[];
  timestamp: number;
  version: number;
};

const sanitizeHomeFeedSnapshot = (snapshot: HomeFeedSnapshot): HomeFeedSnapshot => ({
  ...snapshot,
  recommendedTracks: filterPlayableTracks(snapshot.recommendedTracks),
});

const HOME_FEEDS_CACHE_VERSION = 1;
const HOME_FEEDS_CACHE_TTL_MS = 1000 * 60 * 30;
const HOME_FEEDS_STORAGE_PREFIX = "knobb-home-feeds";
const homeFeedSnapshotMemory = new Map<string, HomeFeedSnapshot>();

const getTrackHistoryKey = (track: Track) => {
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return `tidal:${track.tidalId}`;
  }
  if (track.id) return `id:${track.id}`;
  return `fallback:${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
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
};

const getHomeFeedStorageKey = (userId?: string) =>
  `${HOME_FEEDS_STORAGE_PREFIX}:${userId || "guest"}`;

const isUsableHomeFeedSnapshot = (value: unknown): value is HomeFeedSnapshot => {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<HomeFeedSnapshot>;
  return (
    snapshot.version === HOME_FEEDS_CACHE_VERSION &&
    typeof snapshot.timestamp === "number" &&
    Array.isArray(snapshot.recommendedArtists) &&
    Array.isArray(snapshot.recommendedAlbums) &&
    Array.isArray(snapshot.recommendedTracks) &&
    Array.isArray(snapshot.newReleases) &&
    Array.isArray(snapshot.recentTracks)
  );
};

const isFreshHomeFeedSnapshot = (snapshot: HomeFeedSnapshot) =>
  Date.now() - snapshot.timestamp < HOME_FEEDS_CACHE_TTL_MS;

const readHomeFeedSnapshot = (userId?: string): HomeFeedSnapshot | null => {
  const storageKey = getHomeFeedStorageKey(userId);
  const memorySnapshot = homeFeedSnapshotMemory.get(storageKey);
  if (memorySnapshot && isFreshHomeFeedSnapshot(memorySnapshot)) {
    return sanitizeHomeFeedSnapshot(memorySnapshot);
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isUsableHomeFeedSnapshot(parsed) || !isFreshHomeFeedSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey);
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

export function useHomeFeeds({ favoriteArtists, getHistory, userId }: UseHomeFeedsOptions) {
  const initialSnapshotRef = useRef<HomeFeedSnapshot | null>(readHomeFeedSnapshot(userId));
  const [recommendedArtists, setRecommendedArtists] = useState<HomeArtist[]>(
    () => initialSnapshotRef.current?.recommendedArtists ?? [],
  );
  const [recommendedAlbums, setRecommendedAlbums] = useState<HomeAlbum[]>(
    () => initialSnapshotRef.current?.recommendedAlbums ?? [],
  );
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>(
    () => initialSnapshotRef.current?.recommendedTracks ?? [],
  );
  const [newReleases, setNewReleases] = useState<HomeAlbum[]>(
    () => initialSnapshotRef.current?.newReleases ?? [],
  );
  const [recentTracks, setRecentTracks] = useState<Track[]>(
    () => initialSnapshotRef.current?.recentTracks ?? [],
  );
  const [loaded, setLoaded] = useState(() => Boolean(initialSnapshotRef.current));
  const [error, setError] = useState(false);
  const [reloadingSection, setReloadingSection] = useState<string | null>(null);

  const initialLoadCompletedRef = useRef(Boolean(initialSnapshotRef.current));
  const loadSequenceRef = useRef(0);
  const lastAutoLoadKeyRef = useRef<string | null>(null);
  const activeUserCacheKeyRef = useRef(getHomeFeedStorageKey(userId));

  const applySnapshot = useCallback((snapshot: HomeFeedSnapshot) => {
    setRecommendedArtists(snapshot.recommendedArtists);
    setRecommendedAlbums(snapshot.recommendedAlbums);
    setRecommendedTracks(snapshot.recommendedTracks);
    setNewReleases(snapshot.newReleases);
    setRecentTracks(snapshot.recentTracks);
    setError(false);
    setLoaded(true);
    initialLoadCompletedRef.current = true;
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
      topArtists: { id: number; name: string; score: number }[],
      topAlbums: { id: number; title: string; artist: string; score: number }[],
    ): Promise<SecondaryHomeRecommendations> => {
      try {
        const [artistSimilarGroups, artistAlbumGroups, albumSimilarGroups] = await Promise.all([
          Promise.all(topArtists.map((artist) => getSimilarArtists(artist.id).catch(() => []))),
          Promise.all(topArtists.map((artist) => getArtistAlbums(artist.id).catch(() => []))),
          Promise.all(topAlbums.map((album) => getSimilarAlbums(album.id).catch(() => []))),
        ]);
        if (!isCurrentRequest()) return EMPTY_SECONDARY_RECOMMENDATIONS;

        const listenedAlbumIds = new Set<number>(history.map((entry) => entry.albumId).filter(Boolean) as number[]);
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

        const listenedArtistIds = new Set<number>(topArtists.map((artist) => artist.id));
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
        const nextNewReleases = await newReleasesTask;
        if (!isCurrentRequest()) return;

        commit(() => {
          setRecentTracks(nextRecentTracks);
          setNewReleases(nextNewReleases);
          setRecommendedTracks([]);
          setRecommendedAlbums([]);
          setRecommendedArtists([]);
        });
        markInitialLoaded();
        return;
      }

      const artistScores = new Map<number, { id: number; name: string; score: number }>();
      const albumScores = new Map<number, { id: number; title: string; artist: string; score: number }>();

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
        topArtists.map((artist) => getArtistPopularTracks(artist.id, isInitialPass ? 8 : 10).catch(() => [])),
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
        const nextNewReleases = await newReleasesTask;
        if (!isCurrentRequest()) return;

        commit(() => {
          setRecentTracks(nextRecentTracks);
          setRecommendedTracks(nextRecommendedTracks);
          setNewReleases(nextNewReleases);
        });
        markInitialLoaded();

        scheduleBackgroundTask(() => {
          void loadSecondaryRecommendations(history, topArtists, topAlbums).then((secondaryRecommendations) => {
            if (!isCurrentRequest()) return;
            commit(() => {
              setRecommendedAlbums(secondaryRecommendations.recommendedAlbums);
              setRecommendedArtists(secondaryRecommendations.recommendedArtists);
            });
          });
        }, 1200);

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
      });
    } catch (e) {
      console.error("Failed to load Tidal home feeds:", e);
      if (isCurrentRequest()) {
        setError(true);
        markInitialLoaded();
      }
    }
  }, [favoriteArtists, getHistory, userId]);

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
    setLoaded(false);

    try {
      await loadHomeFeeds();
    } finally {
      setLoaded(true);
    }
  }, [loadHomeFeeds]);

  useEffect(() => {
    const nextUserCacheKey = getHomeFeedStorageKey(userId);
    const userChanged = activeUserCacheKeyRef.current !== nextUserCacheKey;

    if (userChanged) {
      activeUserCacheKeyRef.current = nextUserCacheKey;
      lastAutoLoadKeyRef.current = null;
      loadSequenceRef.current += 1;

      const nextSnapshot = readHomeFeedSnapshot(userId);
      if (nextSnapshot) {
        applySnapshot(nextSnapshot);
      } else {
        initialLoadCompletedRef.current = false;
        setLoaded(false);
        setError(false);
        setRecommendedArtists([]);
        setRecommendedAlbums([]);
        setRecommendedTracks([]);
        setNewReleases([]);
        setRecentTracks([]);
      }
    } else if (!loaded) {
      const cachedSnapshot = readHomeFeedSnapshot(userId);
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
  }, [applySnapshot, favoriteArtists, loadHomeFeeds, loaded, userId]);

  useEffect(() => {
    if (!loaded) return;

    writeHomeFeedSnapshot(userId, {
      recommendedArtists,
      recommendedAlbums,
      recommendedTracks,
      newReleases,
      recentTracks,
    });
  }, [
    loaded,
    newReleases,
    recentTracks,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    userId,
  ]);

  return {
    error,
    loaded,
    newReleases,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    recentTracks,
    reloadingSection,
    reloadSection,
    retryInitialLoad,
  };
}
