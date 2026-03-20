import React, { createContext, useCallback, useContext, useEffect, useRef, useState, startTransition } from "react";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";
import { Track } from "@/types/music";
import type { LibrarySource } from "@/lib/librarySources";

export type SearchArtistResult = {
  id: number | string;
  name: string;
  imageUrl: string;
  source?: LibrarySource;
};
export type SearchAlbumResult = {
  id: number | string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseDate?: string;
  source?: LibrarySource;
};
export type SearchPlaylistResult = {
  id: number | string;
  title: string;
  description: string;
  trackCount: number;
  coverUrl: string;
  source?: LibrarySource;
};
type SearchResultBundle = {
  tracks: Track[];
  videos: Track[];
  artists: SearchArtistResult[];
  albums: SearchAlbumResult[];
  playlists: SearchPlaylistResult[];
};

let tidalReferenceSearchModulePromise: Promise<typeof import("@/lib/tidalReferenceSearch")> | null = null;

function loadTidalReferenceSearch() {
  if (!tidalReferenceSearchModulePromise) {
    tidalReferenceSearchModulePromise = import("@/lib/tidalReferenceSearch");
  }
  return tidalReferenceSearchModulePromise;
}

async function reportSearchFailure(error: unknown, query: string) {
  try {
    const module = await import("@/lib/observability");
    await module.reportClientError(error, "search_failed", { query });
  } catch {
    // Diagnostics should never block search UX.
  }
}

const SEARCH_RECENTS_KEY = "search-recents";
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_RECENTS_LIMIT = 8;

interface SearchContextType {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  tidalTracks: Track[];
  tidalVideos: Track[];
  tidalArtists: SearchArtistResult[];
  tidalAlbums: SearchAlbumResult[];
  tidalPlaylists: SearchPlaylistResult[];
  isSearching: boolean;
  searchError: string | null;
  recentQueries: string[];
  handleSearch: (q: string) => Promise<void>;
  onQueryChange: (value: string) => void;
  closeSearch: () => void;
  removeRecentQuery: (value: string) => void;
  clearRecentQueries: () => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tidalTracks, setTidalTracks] = useState<Track[]>([]);
  const [tidalVideos, setTidalVideos] = useState<Track[]>([]);
  const [tidalArtists, setTidalArtists] = useState<SearchArtistResult[]>([]);
  const [tidalAlbums, setTidalAlbums] = useState<SearchAlbumResult[]>([]);
  const [tidalPlaylists, setTidalPlaylists] = useState<SearchPlaylistResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>(() => {
    try {
      const storedValue = safeStorageGetItem(SEARCH_RECENTS_KEY);
      if (!storedValue) return [];
      const parsed = JSON.parse(storedValue);
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
    } catch {
      return [];
    }
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef(new Map<string, { expiresAt: number; result: SearchResultBundle }>());

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const clearResults = useCallback(() => {
    startTransition(() => {
      setTidalTracks([]);
      setTidalVideos([]);
      setTidalArtists([]);
      setTidalAlbums([]);
      setTidalPlaylists([]);
    });
  }, []);

  const applyResults = useCallback((result: SearchResultBundle) => {
    startTransition(() => {
      setTidalTracks(result.tracks);
      setTidalVideos(result.videos);
      setTidalArtists(result.artists.slice(0, 12));
      setTidalAlbums(result.albums);
      setTidalPlaylists(result.playlists);
    });
  }, []);

  const persistRecentQueries = useCallback((nextQueries: string[]) => {
    safeStorageSetItem(SEARCH_RECENTS_KEY, JSON.stringify(nextQueries));
    setRecentQueries(nextQueries);
  }, []);

  const rememberQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    persistRecentQueries([
      trimmed,
      ...recentQueries.filter((queryValue) => queryValue.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, SEARCH_RECENTS_LIMIT));
  }, [persistRecentQueries, recentQueries]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchError(null);
      clearResults();
      return;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cachedEntry = cacheRef.current.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      setSearchError(null);
      applyResults(cachedEntry.result);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await loadTidalReferenceSearch().then((module) => module.searchTidalReference(trimmedQuery));
      cacheRef.current.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        result,
      });
      applyResults(result);
      rememberQuery(trimmedQuery);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search is temporarily unavailable.";
      setSearchError(message);
      clearResults();
      pushAppDiagnostic({
        level: "warn",
        title: "Search is unavailable",
        message: "Knobb could not reach the music search service. Try again in a moment.",
        source: "search",
        dedupeKey: "search-unavailable",
      });
      void reportSearchFailure(error, trimmedQuery);
    } finally {
      setIsSearching(false);
    }
  }, [applyResults, clearResults, rememberQuery]);

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSearchError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void handleSearch(value);
    }, 400);
  }, [handleSearch]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setSearchError(null);
    clearResults();
  }, [clearResults]);

  const removeRecentQuery = useCallback((value: string) => {
    persistRecentQueries(recentQueries.filter((queryValue) => queryValue !== value));
  }, [persistRecentQueries, recentQueries]);

  const clearRecentQueries = useCallback(() => {
    persistRecentQueries([]);
  }, [persistRecentQueries]);

  return (
    <SearchContext.Provider value={{
      searchOpen, setSearchOpen,
      query, setQuery,
      tidalTracks, tidalVideos, tidalArtists, tidalAlbums,
      tidalPlaylists,
      isSearching,
      searchError,
      recentQueries,
      handleSearch, onQueryChange,
      closeSearch,
      removeRecentQuery,
      clearRecentQueries,
    }}>
      {children}
    </SearchContext.Provider>
  );
}
