import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Track, allTracks, albums, playlists } from "@/data/mockData";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";

type SearchTab = "tidal" | "tracks" | "albums" | "playlists";

interface SearchContextType {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  searchTab: SearchTab;
  setSearchTab: (tab: SearchTab) => void;
  tidalResults: Track[];
  isSearching: boolean;
  handleSearch: (q: string) => void;
  onQueryChange: (value: string) => void;
  filteredTracks: Track[];
  filteredAlbums: typeof albums;
  filteredPlaylists: typeof playlists;
  closeSearch: () => void;
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
  const [searchTab, setSearchTab] = useState<SearchTab>("tidal");
  const [tidalResults, setTidalResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.toLowerCase();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setTidalResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchTracks(searchQuery);
      setTidalResults(results.map(tidalTrackToAppTrack));
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (searchTab === "tidal") handleSearch(value);
    }, 400);
  }, [searchTab, handleSearch]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setTidalResults([]);
  }, []);

  const filteredTracks = q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 15);
  const filteredAlbums = q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums;
  const filteredPlaylists = q ? playlists.filter((p) => p.title.toLowerCase().includes(q)) : playlists;

  return (
    <SearchContext.Provider value={{
      searchOpen, setSearchOpen,
      query, setQuery,
      searchTab, setSearchTab,
      tidalResults, isSearching,
      handleSearch, onQueryChange,
      filteredTracks, filteredAlbums, filteredPlaylists,
      closeSearch,
    }}>
      {children}
    </SearchContext.Provider>
  );
}
