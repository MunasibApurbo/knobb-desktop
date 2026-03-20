import { FormEvent, forwardRef, memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Heart, Loader2, Play, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Track } from "@/types/music";
import { motion } from "framer-motion";
import { PlayingIndicator } from "@/components/PlayingIndicator";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { warmArtistPageData } from "@/lib/musicApi";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";
import { toast } from "sonner";
import { DESTRUCTIVE_ICON_BUTTON_CLASS } from "@/components/ui/surfaceStyles";
import type { SearchAlbumResult, SearchArtistResult, SearchPlaylistResult } from "@/contexts/SearchContext";
import { buildAlbumPath, buildArtistPath } from "@/lib/mediaNavigation";
import { DEFAULT_LIBRARY_SOURCE, isLibrarySource, type LibrarySource } from "@/lib/librarySources";

type TabKey = "top" | "profiles" | "tracks" | "videos" | "albums" | "playlists";

type SearchResultsState = {
  topResult: null;
  rankedResults: [];
  tracks: Track[];
  videos: Track[];
  artists: SearchArtistResult[];
  albums: SearchAlbumResult[];
  playlists: SearchPlaylistResult[];
};

const EMPTY_RESULTS: SearchResultsState = {
  topResult: null,
  rankedResults: [],
  tracks: [],
  videos: [],
  artists: [],
  albums: [],
  playlists: [],
};

type SearchSourceStatus = "idle" | "loading" | "ready" | "error";

type SearchSourceState = {
  error: string | null;
  query: string;
  results: SearchResultsState;
  status: SearchSourceStatus;
};

type SearchStateBySource = Record<LibrarySource, SearchSourceState>;

type SearchCacheEntry = {
  expiresAt: number;
  results: SearchResultsState;
};

const SEARCH_RESULTS_TTL_MS = 5 * 60 * 1000;

function shouldAutoFocusSearchInput() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  if (window.innerWidth < 1024) {
    return false;
  }

  return !window.matchMedia("(pointer: coarse)").matches;
}

function createInitialSearchStateBySource(): SearchStateBySource {
  return {
    tidal: {
      error: null,
      query: "",
      results: EMPTY_RESULTS,
      status: "idle",
    },
    "youtube-music": {
      error: null,
      query: "",
      results: EMPTY_RESULTS,
      status: "idle",
    },
  };
}

function normalizeSearchResults(next: Pick<SearchResultsState, "tracks" | "videos" | "artists" | "albums" | "playlists">): SearchResultsState {
  return {
    topResult: null,
    rankedResults: [],
    tracks: next.tracks,
    videos: next.videos,
    artists: next.artists,
    albums: next.albums,
    playlists: next.playlists,
  };
}

function getAlternateLibrarySource(source: LibrarySource): LibrarySource {
  return source === "tidal" ? "youtube-music" : "tidal";
}

function hasReadyResultsForQuery(state: SearchSourceState | null | undefined, query: string) {
  return state?.query === query && state.status === "ready";
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "top", label: "Top Results" },
  { key: "profiles", label: "Profiles" },
  { key: "tracks", label: "Songs" },
  { key: "videos", label: "Videos" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
];

const SEARCH_ONLY_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "tracks", label: "Songs" },
  { key: "videos", label: "Music Videos" },
];

const SEARCH_SOURCES: Array<{ value: LibrarySource; label: string }> = [
  { value: "tidal", label: "TIDAL" },
  { value: "youtube-music", label: "YT Music" },
];

const DEFAULT_TAB_BY_SOURCE: Record<LibrarySource, TabKey> = {
  tidal: "top",
  "youtube-music": "tracks",
};

function SearchTabButton({
  active,
  label,
  onClick,
  className,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "menu-sweep-hover relative inline-flex h-11 min-w-0 items-center justify-center overflow-hidden rounded-[var(--control-radius)] border border-white/10 px-3 text-center font-semibold text-[10px] uppercase tracking-[0.16em] transition-colors min-[920px]:h-14 min-[920px]:min-w-0 min-[920px]:rounded-none min-[920px]:border-0 min-[920px]:border-r min-[920px]:px-4 min-[920px]:text-base min-[920px]:normal-case min-[920px]:tracking-normal last:min-[920px]:border-r-0 " +
        (active ? "text-black" : "text-muted-foreground") +
        (className ? ` ${className}` : "")
      }
      style={active ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
    >
      <span>{label}</span>
    </button>
  );
}

type SearchRowProps = {
  index: number;
  imageUrl?: string;
  artistId?: number | string;
  artistName?: string;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  middleLabel?: string | React.ReactNode;
  trailing?: string;
  accessibleLabel: string;
  onSelect: () => void;
  roundedImage?: boolean;
  isCurrent?: boolean;
  onPlay?: () => void;
  onLike?: () => void;
  isLiked?: boolean;
  onRowMouseEnter?: () => void;
  onRowFocus?: () => void;
  onRowPointerDown?: () => void;
};

const SearchRow = memo(forwardRef<HTMLDivElement, SearchRowProps>(function SearchRow({
  index,
  imageUrl,
  artistId,
  artistName,
  title,
  subtitle,
  middleLabel,
  trailing,
  accessibleLabel,
  onSelect,
  roundedImage = true,
  isCurrent = false,
  onPlay,
  onLike,
  isLiked,
  onRowMouseEnter,
  onRowFocus,
  onRowPointerDown,
}, ref) {
  const numericArtistId = typeof artistId === "number" ? artistId : undefined;
  const resolvedImageUrl = useResolvedArtistImage(numericArtistId, imageUrl, artistName);
  const displayImageUrl = numericArtistId ? resolvedImageUrl : imageUrl;

  return (
    <div
      ref={ref}
      className={`content-visibility-list group relative flex w-full items-center gap-x-3 overflow-hidden border-b border-white/10 px-4 py-3 text-left last:border-b-0 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:gap-x-4 menu-sweep-row ${isCurrent ? "is-current" : ""}`}
      style={isCurrent ? { backgroundColor: "hsl(var(--dynamic-accent) / 0.94)" } : undefined}
    >
      <button
        type="button"
        aria-label={accessibleLabel}
        className="absolute inset-0 z-0 rounded-none focus-visible:outline-none"
        onClick={onSelect}
        onMouseEnter={() => onRowMouseEnter?.()}
        onFocus={() => onRowFocus?.()}
        onPointerDown={() => onRowPointerDown?.()}
      />

      <span
        className={`relative z-10 hidden w-4 shrink-0 items-center justify-center text-center text-xs tabular-nums md:flex md:w-[20px] md:text-sm ${isCurrent
          ? "h-4 text-black"
          : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
          }`}
      >
        {isCurrent ? <PlayingIndicator isPaused={false} /> : `${index + 1}.`}
      </span>

      <div className={`relative z-10 shrink-0 overflow-hidden bg-white/10 group/img ${roundedImage ? "force-round-artwork website-avatar h-11 w-11 rounded-full md:h-12 md:w-12" : "h-11 w-11 rounded-[calc(var(--control-radius)-4px)] md:h-12 md:w-12 md:rounded-[var(--cover-radius)]"}`}>
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={typeof title === "string" ? title : "Result"}
            loading="lazy"
            decoding="async"
            width="48"
            height="48"
            sizes="48px"
            className="h-full w-full object-cover"
            onError={(event) => {
              (event.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : null}
        {(onPlay || onLike) && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-100 transition-opacity md:opacity-0 md:group-hover/img:opacity-100">
            {onPlay && (
              <button
                type="button"
                aria-label={typeof title === "string" ? `Play ${title}` : "Play result"}
                onClick={(e) => { e.stopPropagation(); onPlay(); }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--dynamic-accent))] text-foreground transition-transform hover:scale-110"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            )}
            {onLike && (
              <button
                type="button"
                aria-label={typeof title === "string" ? `Save ${title}` : "Save result"}
                onClick={(e) => { e.stopPropagation(); onLike(); }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:scale-110 transition-transform"
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current text-[hsl(var(--dynamic-accent))]" : ""}`} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <p className={`truncate text-[13px] md:text-sm ${isCurrent ? "font-semibold text-black" : "font-medium group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
          {title}
        </p>
        {subtitle ? (
          <p className={`truncate text-[11px] md:text-xs ${isCurrent ? "text-black/78" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.85)]"}`}>
            {subtitle}
          </p>
        ) : null}
      </div>

      <span className={`relative z-10 hidden w-[min(28vw,11rem)] shrink-0 text-sm truncate lg:block ${isCurrent ? "text-black/82" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
        {middleLabel || ""}
      </span>

      {trailing ? (
        <span className={`relative z-10 w-14 shrink-0 text-right font-mono text-sm tabular-nums ${isCurrent ? "text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors duration-200"}`}>
          {trailing}
        </span>
      ) : (
        <span className="relative z-10" />
      )}
    </div>
  );
}));

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { play, warmTrackPlayback, currentTrack, isPlaying, playArtist, togglePlay } = usePlayer();
  const { user } = useAuth();
  const settings = useSettings();
  const librarySource = isLibrarySource(settings.librarySource) ? settings.librarySource : DEFAULT_LIBRARY_SOURCE;
  const setLibrarySource = typeof settings.setLibrarySource === "function"
    ? settings.setLibrarySource
    : (() => {});
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const initialQuery = searchParams.get("q") || "";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [searchStateBySource, setSearchStateBySource] = useState<SearchStateBySource>(() => createInitialSearchStateBySource());
  const [activeTabsBySource, setActiveTabsBySource] = useState<Record<LibrarySource, TabKey>>(() => ({
    ...DEFAULT_TAB_BY_SOURCE,
  }));
  const [renderSource, setRenderSource] = useState<LibrarySource>(librarySource);
  const pendingRequestIdRef = useRef(0);
  const searchCacheRef = useRef(new Map<string, SearchCacheEntry>());
  const inFlightSearchRef = useRef(new Map<string, Promise<SearchResultsState>>());
  const latestQueryRef = useRef(initialQuery.trim());
  const latestLibrarySourceRef = useRef(librarySource);
  const searchStateBySourceRef = useRef(searchStateBySource);
  const trimmedQuery = query.trim();
  const deferredTrimmedQuery = useDeferredValue(trimmedQuery);
  const youtubeMusicSearchOnlyMode = renderSource === "youtube-music";
  const activeTab = activeTabsBySource[renderSource];
  const renderSourceState = searchStateBySource[renderSource];
  const selectedSourceState = searchStateBySource[renderSource];
  const activeSearchQuery = deferredTrimmedQuery;
  const hasRenderableResultsForCurrentQuery = !activeSearchQuery || hasReadyResultsForQuery(renderSourceState, activeSearchQuery);
  const isSearching =
    Boolean(trimmedQuery) &&
    (trimmedQuery !== activeSearchQuery || (!hasRenderableResultsForCurrentQuery && selectedSourceState.status === "loading"));
  const visibleTabs = useMemo(
    () => (youtubeMusicSearchOnlyMode ? SEARCH_ONLY_TABS : TABS),
    [youtubeMusicSearchOnlyMode],
  );
  const visibleResults = useMemo(
    () => (
      youtubeMusicSearchOnlyMode
        ? {
            ...(hasRenderableResultsForCurrentQuery ? renderSourceState.results : EMPTY_RESULTS),
            topResult: null,
            rankedResults: [],
            artists: [],
            albums: [],
            playlists: [],
          }
        : hasRenderableResultsForCurrentQuery
          ? renderSourceState.results
          : EMPTY_RESULTS
    ),
    [hasRenderableResultsForCurrentQuery, renderSourceState.results, youtubeMusicSearchOnlyMode],
  );
  const showYoutubeMusicWarning = renderSource === "youtube-music";
  const getCachedSearchResults = useCallback((searchQuery: string, source: LibrarySource) => {
    const cacheKey = `${source}:${searchQuery.toLowerCase()}`;
    const cached = searchCacheRef.current.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      searchCacheRef.current.delete(cacheKey);
      return null;
    }
    return cached.results;
  }, []);
  const setSearchStateWithTransition = useCallback((next: React.SetStateAction<SearchStateBySource>) => {
    startTransition(() => {
      setSearchStateBySource(next);
    });
  }, []);
  const setRenderSourceWithTransition = useCallback((next: LibrarySource) => {
    startTransition(() => {
      setRenderSource((current) => (current === next ? current : next));
    });
  }, []);

  const ensureSearchResults = useCallback((searchQuery: string, source: LibrarySource) => {
    const normalizedQuery = searchQuery.trim();
    const cached = getCachedSearchResults(normalizedQuery, source);
    if (cached) {
      return Promise.resolve(cached);
    }

    const cacheKey = `${source}:${normalizedQuery.toLowerCase()}`;
    const inFlight = inFlightSearchRef.current.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      const next = source === "youtube-music"
        ? await import("@/lib/youtubeMusicApi").then((module) => module.searchYoutubeMusicReference(normalizedQuery))
        : await import("@/lib/tidalReferenceSearch").then((module) => module.searchTidalReference(normalizedQuery));
      const normalizedResults = normalizeSearchResults(next);
      searchCacheRef.current.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_RESULTS_TTL_MS,
        results: normalizedResults,
      });
      return normalizedResults;
    })()
      .finally(() => {
        inFlightSearchRef.current.delete(cacheKey);
      });

    inFlightSearchRef.current.set(cacheKey, request);
    return request;
  }, [getCachedSearchResults]);

  const prefetchSourceResults = useCallback((source: LibrarySource) => {
    const currentQuery = latestQueryRef.current;
    if (!currentQuery || hasReadyResultsForQuery(searchStateBySourceRef.current[source], currentQuery)) {
      return;
    }

    const cached = getCachedSearchResults(currentQuery, source);
    if (cached) {
      setSearchStateWithTransition((prev) => ({
        ...prev,
        [source]: {
          error: null,
          query: currentQuery,
          results: cached,
          status: "ready",
        },
      }));
      if (latestLibrarySourceRef.current === source) {
        setRenderSourceWithTransition(source);
      }
      return;
    }

    void ensureSearchResults(currentQuery, source)
      .then((results) => {
        if (latestQueryRef.current !== currentQuery) {
          return;
        }

        setSearchStateWithTransition((prev) => ({
          ...prev,
          [source]: {
            error: null,
            query: currentQuery,
            results,
            status: "ready",
          },
        }));
        if (latestLibrarySourceRef.current === source) {
          setRenderSourceWithTransition(source);
        }
      })
      .catch(() => {
        // Keep source prefetch best-effort so toggles never surface background errors.
      });
  }, [ensureSearchResults, getCachedSearchResults, setRenderSourceWithTransition, setSearchStateWithTransition]);

  const handleLibrarySourceChange = (source: LibrarySource) => {
    if (source === librarySource && source === renderSource) return;

    setRenderSourceWithTransition(source);

    if (trimmedQuery && !hasReadyResultsForQuery(searchStateBySourceRef.current[source], trimmedQuery)) {
      setSearchStateWithTransition((prev) => {
        const currentSourceState = prev[source];
        if (
          currentSourceState.query === trimmedQuery &&
          currentSourceState.status === "loading" &&
          currentSourceState.error === null
        ) {
          return prev;
        }

        return {
          ...prev,
          [source]: {
            ...currentSourceState,
            error: null,
            query: trimmedQuery,
            status: "loading",
          },
        };
      });
    }

    if (source !== librarySource) {
      setLibrarySource(source);
    }

    if (trimmedQuery && !hasReadyResultsForQuery(searchStateBySourceRef.current[source], trimmedQuery)) {
      prefetchSourceResults(source);
    }
  };

  useEffect(() => {
    if (!shouldAutoFocusSearchInput()) {
      return;
    }

    searchInputRef.current?.focus({ preventScroll: true });
  }, []);

  const setActiveTabForSource = useCallback((source: LibrarySource, tab: TabKey) => {
    setActiveTabsBySource((prev) => (
      prev[source] === tab
        ? prev
        : {
            ...prev,
            [source]: tab,
          }
    ));
  }, []);

  const renderSourceToggle = (className = "") => (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 ${className}`.trim()}
      role="tablist"
      aria-label="Search source"
    >
      {SEARCH_SOURCES.map((sourceOption) => {
        const active = renderSource === sourceOption.value;
        return (
          <button
            key={sourceOption.value}
            type="button"
            role="tab"
            aria-selected={active}
            onMouseEnter={() => prefetchSourceResults(sourceOption.value)}
            onFocus={() => prefetchSourceResults(sourceOption.value)}
            onPointerDown={() => prefetchSourceResults(sourceOption.value)}
            onClick={() => handleLibrarySourceChange(sourceOption.value)}
            className={`menu-sweep-hover relative overflow-hidden rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors focus-visible:text-black ${
              active
                ? "bg-[hsl(var(--player-waveform))] text-black"
                : "bg-transparent text-white/62 hover:text-black"
            }`}
            style={active ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
          >
            <span className="relative z-10">{sourceOption.label}</span>
          </button>
        );
      })}
    </div>
  );

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    latestQueryRef.current = activeSearchQuery;
  }, [activeSearchQuery]);

  useEffect(() => {
    latestLibrarySourceRef.current = librarySource;
  }, [librarySource]);

  useEffect(() => {
    searchStateBySourceRef.current = searchStateBySource;
  }, [searchStateBySource]);

  useEffect(() => {
    if (!trimmedQuery) {
      setRenderSourceWithTransition(librarySource);
    }
  }, [librarySource, setRenderSourceWithTransition, trimmedQuery]);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.key === activeTab)) return;
    setActiveTabForSource(renderSource, DEFAULT_TAB_BY_SOURCE[renderSource]);
  }, [activeTab, renderSource, setActiveTabForSource, visibleTabs]);

  useEffect(() => {
    if (!activeSearchQuery) {
      pendingRequestIdRef.current += 1;
      return;
    }

    const requestId = pendingRequestIdRef.current + 1;
    pendingRequestIdRef.current = requestId;

    const selectedSource = librarySource;
    const alternateSource = getAlternateLibrarySource(selectedSource);
    const timeout = setTimeout(async () => {
      const runSearch = (source: LibrarySource, showLoading: boolean) => {
        const cached = getCachedSearchResults(activeSearchQuery, source);
        if (cached) {
          if (pendingRequestIdRef.current !== requestId || latestQueryRef.current !== activeSearchQuery) {
            return;
          }

          setSearchStateWithTransition((prev) => ({
            ...prev,
            [source]: {
              error: null,
              query: activeSearchQuery,
              results: cached,
              status: "ready",
            },
          }));
          if (source === latestLibrarySourceRef.current) {
            setRenderSourceWithTransition(source);
          }
          return;
        }

        if (showLoading && !hasReadyResultsForQuery(searchStateBySourceRef.current[source], activeSearchQuery)) {
          setSearchStateWithTransition((prev) => ({
            ...prev,
            [source]: {
              ...prev[source],
              error: null,
              query: activeSearchQuery,
              status: "loading",
            },
          }));
        }

        void ensureSearchResults(activeSearchQuery, source)
          .then((results) => {
            if (pendingRequestIdRef.current !== requestId || latestQueryRef.current !== activeSearchQuery) {
              return;
            }

            setSearchStateWithTransition((prev) => ({
              ...prev,
              [source]: {
                error: null,
                query: activeSearchQuery,
                results,
                status: "ready",
              },
            }));
            if (source === latestLibrarySourceRef.current) {
              setRenderSourceWithTransition(source);
            }
          })
          .catch((error) => {
            if (pendingRequestIdRef.current !== requestId || latestQueryRef.current !== activeSearchQuery) {
              return;
            }

            console.error("Search failed:", error);
            const message = error instanceof Error ? error.message : "Search is temporarily unavailable.";
            setSearchStateWithTransition((prev) => ({
              ...prev,
              [source]: {
                error: message,
                query: activeSearchQuery,
                results: EMPTY_RESULTS,
                status: "error",
              },
            }));
          });
      };

      if (hasReadyResultsForQuery(searchStateBySourceRef.current[selectedSource], activeSearchQuery)) {
        setRenderSourceWithTransition(selectedSource);
      }

      runSearch(selectedSource, true);
      runSearch(alternateSource, false);
    }, 260);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    activeSearchQuery,
    ensureSearchResults,
    getCachedSearchResults,
    librarySource,
    setRenderSourceWithTransition,
    setSearchStateWithTransition,
  ]);

  useEffect(() => {
    if (renderSource !== "youtube-music" || !activeSearchQuery || !hasRenderableResultsForCurrentQuery) {
      return;
    }

    const warmupCandidates = [
      ...visibleResults.tracks.slice(0, 4),
      ...visibleResults.videos.slice(0, 2),
    ];

    if (warmupCandidates.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      warmupCandidates.forEach((track) => {
        warmTrackPlayback(track);
      });
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeSearchQuery,
    hasRenderableResultsForCurrentQuery,
    renderSource,
    visibleResults.tracks,
    visibleResults.videos,
    warmTrackPlayback,
  ]);

  const getArtistSource = (artist: SearchArtistResult) => artist.source || renderSource;
  const getAlbumSource = (album: SearchAlbumResult) => album.source || renderSource;
  const getPlaylistSource = (playlist: SearchPlaylistResult) => playlist.source || renderSource;
  const getArtistPath = (artist: SearchArtistResult) =>
    getArtistSource(artist) === "youtube-music"
      ? `/search?q=${encodeURIComponent(artist.name)}`
      : buildArtistPath(artist.id, artist.name, "tidal");
  const getPlaylistPath = (playlist: SearchPlaylistResult) => {
    const source = getPlaylistSource(playlist);
    const playlistId = String(playlist.id);
    return source === "youtube-music"
      ? `/search?q=${encodeURIComponent(playlist.title)}`
      : `/playlist/${playlistId}`;
  };

  const hasAnyResults = useMemo(
    () =>
      visibleResults.tracks.length > 0 ||
      visibleResults.videos.length > 0 ||
      visibleResults.artists.length > 0 ||
      visibleResults.albums.length > 0 ||
      visibleResults.playlists.length > 0,
    [visibleResults],
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: next });
  };

  const openAlbum = (album: SearchAlbumResult) => {
    if (getAlbumSource(album) === "youtube-music") {
      navigate(`/search?q=${encodeURIComponent(`${album.artist} ${album.title}`.trim())}`);
      return;
    }
    navigate(buildAlbumPath({
      albumId: album.id,
      title: album.title,
      artistName: album.artist,
      source: "tidal",
    }));
  };

  const prefetchArtist = (artistId: number | string, source = renderSource) => {
    if (source === "tidal" && typeof artistId === "number") {
      void warmArtistPageData(artistId);
    }
  };

  const prefetchTrackPlayback = (track: Track) => {
    if (track.source !== "youtube-music") {
      return;
    }

    warmTrackPlayback(track);
  };

  const handleToggleFavoriteArtist = async (artist: SearchArtistResult) => {
    if (typeof artist.id !== "number") {
      toast.error("Saving favorite artists is currently available for TIDAL artists only");
      return;
    }

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    const success = await toggleFavorite({
      artistId: artist.id,
      artistName: artist.name,
      artistImageUrl: artist.imageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite");
    }
  };

  const handleTrackPlay = useCallback((track: Track, tracks: Track[]) => {
    if (isSameTrack(currentTrack, track)) {
      togglePlay();
      return;
    }

    play(track, tracks);
  }, [currentTrack, play, togglePlay]);

  const renderTrackResultRow = (track: Track, index: number, tracks: Track[]) => {
    const isCurrent = isSameTrack(currentTrack, track);

    return (
      <TrackContextMenu key={`search-track-${track.id}-${index}`} track={track} tracks={tracks}>
        <TrackListRow
          artworkClassName="search-result-track-artwork"
          className="px-3 py-2.5 md:px-4 md:py-3"
          dragHandleLabel={`Drag ${track.title} to a playlist`}
          index={index}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          desktopMeta={track.isVideo ? "Music Video" : undefined}
          onDragHandleStart={(event) => {
            startPlaylistDrag(event.dataTransfer, {
              label: track.title,
              source: "track",
              tracks: [track],
            });
          }}
          onMouseEnter={() => prefetchTrackPlayback(track)}
          onFocus={() => prefetchTrackPlayback(track)}
          onPointerDown={() => prefetchTrackPlayback(track)}
          onPlay={() => handleTrackPlay(track, tracks)}
          track={track}
        />
      </TrackContextMenu>
    );
  };

  const renderTopResults = () => (
    <div>
      {!youtubeMusicSearchOnlyMode && visibleResults.artists[0] ? (
        <ArtistContextMenu
          artistId={visibleResults.artists[0].id}
          artistName={visibleResults.artists[0].name}
          artistImageUrl={visibleResults.artists[0].imageUrl}
          source={getArtistSource(visibleResults.artists[0])}
        >
          <SearchRow
            index={0}
            accessibleLabel={`Open artist profile for ${visibleResults.artists[0].name}`}
            imageUrl={visibleResults.artists[0].imageUrl}
            artistId={visibleResults.artists[0].id}
            artistName={visibleResults.artists[0].name}
            roundedImage
            title={visibleResults.artists[0].name}
            subtitle="Profile"
            middleLabel="Artist Profile"
            onSelect={() => navigate(getArtistPath(visibleResults.artists[0]))}
            onRowMouseEnter={() => prefetchArtist(visibleResults.artists[0].id, getArtistSource(visibleResults.artists[0]))}
            onRowFocus={() => prefetchArtist(visibleResults.artists[0].id, getArtistSource(visibleResults.artists[0]))}
            onRowPointerDown={() => prefetchArtist(visibleResults.artists[0].id, getArtistSource(visibleResults.artists[0]))}
            onPlay={() => playArtist(visibleResults.artists[0].id, visibleResults.artists[0].name)}
            onLike={typeof visibleResults.artists[0].id === "number" ? () => void handleToggleFavoriteArtist(visibleResults.artists[0]) : undefined}
            isLiked={typeof visibleResults.artists[0].id === "number" ? isFavorite(visibleResults.artists[0].id) : false}
          />
        </ArtistContextMenu>
      ) : null}
      {!youtubeMusicSearchOnlyMode && visibleResults.tracks
        .slice(0, 10)
        .map((track, i) => renderTrackResultRow(track, (visibleResults.artists[0] ? 1 : 0) + i, visibleResults.tracks))}
      {!youtubeMusicSearchOnlyMode && visibleResults.videos
        .slice(0, 4)
        .map((track, i) =>
          renderTrackResultRow(
            track,
            (visibleResults.artists[0] ? 1 : 0) + Math.min(10, visibleResults.tracks.length) + i,
            visibleResults.videos,
          ),
        )}
      {!youtubeMusicSearchOnlyMode && visibleResults.albums.slice(0, 6).map((album, i) => (
        <AlbumContextMenu
          key={`top-album-${album.id}`}
          albumId={album.id}
          title={album.title}
          artist={album.artist}
          coverUrl={album.coverUrl}
        >
          <SearchRow
            index={
              (visibleResults.artists[0] ? 1 : 0) +
              Math.min(10, visibleResults.tracks.length) +
              Math.min(4, visibleResults.videos.length) +
              i
            }
            accessibleLabel={`Open album ${album.title} by ${album.artist}`}
            imageUrl={album.coverUrl}
            title={album.title}
            subtitle={`Album · ${album.artist}`}
            middleLabel={album.artist}
            onSelect={() => openAlbum(album)}
          />
        </AlbumContextMenu>
      ))}
      {!youtubeMusicSearchOnlyMode && visibleResults.playlists.slice(0, 4).map((playlist, i) => (
        <PlaylistContextMenu
          key={`top-playlist-${playlist.id}`}
          title={playlist.title}
          playlistId={playlist.id}
          coverUrl={playlist.coverUrl}
          kind={getPlaylistSource(playlist)}
        >
          <SearchRow
            index={
              (visibleResults.artists[0] ? 1 : 0) +
              Math.min(10, visibleResults.tracks.length) +
              Math.min(4, visibleResults.videos.length) +
              Math.min(6, visibleResults.albums.length) +
              i
            }
            accessibleLabel={`Open playlist ${playlist.title}`}
            imageUrl={playlist.coverUrl}
            title={playlist.title}
            subtitle={`Playlist · ${playlist.trackCount} songs`}
            middleLabel="Playlist"
            onSelect={() => navigate(getPlaylistPath(playlist))}
          />
        </PlaylistContextMenu>
      ))}
    </div>
  );

  const renderRowsByTab = () => {
    if (activeTab === "top") return renderTopResults();
    if (youtubeMusicSearchOnlyMode && activeTab === "tracks") {
      return (
        <div>{visibleResults.tracks.map((track, i) => renderTrackResultRow(track, i, visibleResults.tracks))}</div>
      );
    }
    if (youtubeMusicSearchOnlyMode && activeTab === "videos") {
      return (
        <div>{visibleResults.videos.map((track, i) => renderTrackResultRow(track, i, visibleResults.videos))}</div>
      );
    }
    if (youtubeMusicSearchOnlyMode) return null;
    if (activeTab === "profiles") {
      return (
        <div>
          {visibleResults.artists.map((artist, i) => (
            <ArtistContextMenu
              key={`artist-${artist.id}`}
              artistId={artist.id}
              artistName={artist.name}
              artistImageUrl={artist.imageUrl}
              source={getArtistSource(artist)}
            >
              <SearchRow
                index={i}
                accessibleLabel={`Open artist profile for ${artist.name}`}
                imageUrl={artist.imageUrl}
                artistId={artist.id}
                artistName={artist.name}
                roundedImage
                title={artist.name}
                subtitle="Profile"
                middleLabel="Artist Profile"
                onSelect={() => navigate(getArtistPath(artist))}
                onRowMouseEnter={() => prefetchArtist(artist.id, getArtistSource(artist))}
                onRowFocus={() => prefetchArtist(artist.id, getArtistSource(artist))}
                onRowPointerDown={() => prefetchArtist(artist.id, getArtistSource(artist))}
                onPlay={() => playArtist(artist.id, artist.name)}
                onLike={typeof artist.id === "number" ? () => void handleToggleFavoriteArtist(artist) : undefined}
                isLiked={typeof artist.id === "number" ? isFavorite(artist.id) : false}
              />
            </ArtistContextMenu>
          ))}
        </div>
      );
    }
    if (activeTab === "tracks") {
      return (
        <div>{visibleResults.tracks.map((track, i) => renderTrackResultRow(track, i, visibleResults.tracks))}</div>
      );
    }
    if (activeTab === "videos") {
      return (
        <div>{visibleResults.videos.map((track, i) => renderTrackResultRow(track, i, visibleResults.videos))}</div>
      );
    }
    if (activeTab === "albums") {
      return (
        <div>
          {visibleResults.albums.map((album, i) => (
            <AlbumContextMenu
              key={`album-${album.id}`}
              albumId={album.id}
              title={album.title}
              artist={album.artist}
              coverUrl={album.coverUrl}
            >
              <SearchRow
                index={i}
                accessibleLabel={`Open album ${album.title} by ${album.artist}`}
                imageUrl={album.coverUrl}
                title={album.title}
                subtitle={`Album · ${album.artist}`}
                middleLabel={album.artist}
                onSelect={() => openAlbum(album)}
              />
            </AlbumContextMenu>
          ))}
        </div>
      );
    }
    if (activeTab === "playlists") {
      return (
        <div>
          {visibleResults.playlists.map((playlist, i) => (
            <PlaylistContextMenu
              key={`playlist-${playlist.id}`}
              title={playlist.title}
              playlistId={playlist.id}
              coverUrl={playlist.coverUrl}
              kind={getPlaylistSource(playlist)}
            >
              <SearchRow
                index={i}
                accessibleLabel={`Open playlist ${playlist.title}`}
                imageUrl={playlist.coverUrl}
                title={playlist.title}
                subtitle={`Playlist · ${playlist.trackCount} songs`}
                middleLabel={`${playlist.trackCount} songs`}
                onSelect={() => navigate(getPlaylistPath(playlist))}
              />
            </PlaylistContextMenu>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="page-shell hover-desaturate-page"
    >
      <div className="page-sticky-stack sticky top-0 z-20">
      <section className="page-panel overflow-hidden border border-white/10 border-b-0 seekbar-tone-box backdrop-blur-xl">
        <form onSubmit={submitSearch} className="flex min-h-14 items-center gap-3 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                youtubeMusicSearchOnlyMode
                  ? "Search songs and music videos..."
                  : "Search artists, tracks, videos, albums, playlists"
              }
              className="h-10 min-w-0 border-0 bg-transparent px-0 text-base font-semibold focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-lg md:text-xl placeholder:text-muted-foreground/85"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchParams({});
                }}
                className={`${DESTRUCTIVE_ICON_BUTTON_CLASS} h-8 w-8 shrink-0 border-0 bg-transparent`}
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <span className="w-5 h-5 shrink-0" />
            )}
          </div>
        </form>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {renderSourceToggle()}
            {showYoutubeMusicWarning ? (
              <div className="flex items-start gap-2 rounded-[var(--surface-radius-sm)] border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-100/85 backdrop-blur-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
                <p>
                  <span className="font-semibold text-amber-100">Playback note:</span> YouTube Music results can be unreliable for listening.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="page-panel overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2 px-3 py-3 min-[920px]:grid-cols-6 min-[920px]:gap-0 min-[920px]:px-0 min-[920px]:py-0">
          {visibleTabs.map((tab, index) => (
            <SearchTabButton
              key={tab.key}
              active={activeTab === tab.key}
              label={tab.label}
              onClick={() => setActiveTabForSource(renderSource, tab.key)}
              className={index === visibleTabs.length - 1 && visibleTabs.length % 2 === 1 ? "col-span-2 min-[920px]:col-span-1" : ""}
            />
          ))}
        </div>
      </section>
      </div>


      <section className="page-panel overflow-hidden border border-white/10 bg-white/[0.02]">

        {isSearching ? (
          <div className="py-12 text-center text-muted-foreground md:py-20">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Searching...
          </div>
        ) : !query.trim() ? (
          <div className="py-12 px-6 text-center text-muted-foreground md:py-20">
            {youtubeMusicSearchOnlyMode ? (
              "Type a song, artist, or music video name to search and play."
            ) : "Type a name to search."}
          </div>
        ) : !hasAnyResults ? (
          <div className="py-12 px-6 text-center text-muted-foreground md:py-20">
            {youtubeMusicSearchOnlyMode ? "No playable songs or music videos found." : "No results found."}
          </div>
        ) : (
          renderRowsByTab()
        )}
      </section>
    </motion.div>
  );
}
