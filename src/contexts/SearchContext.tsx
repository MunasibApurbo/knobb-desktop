import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Track, allTracks, albums, playlists } from "@/data/mockData";
import { searchTracks, searchAlbums, tidalTrackToAppTrack, TidalAlbum, getTidalImageUrl } from "@/lib/monochromeApi";

type SearchTab = "all" | "tracks" | "artists" | "albums" | "playlists";

export interface SearchArtistResult {
  id: number;
  name: string;
  imageUrl: string;
}

export interface SearchAlbumResult {
  id: number;
  title: string;
  artist: string;
  coverUrl: string;
}

interface SearchContextType {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  searchTab: SearchTab;
  setSearchTab: (tab: SearchTab) => void;
  tidalTracks: Track[];
  tidalArtists: SearchArtistResult[];
  tidalAlbums: SearchAlbumResult[];
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
  const [searchTab, setSearchTab] = useState<SearchTab>("all");
  const [tidalTracks, setTidalTracks] = useState<Track[]>([]);
  const [tidalArtists, setTidalArtists] = useState<SearchArtistResult[]>([]);
  const [tidalAlbums, setTidalAlbums] = useState<SearchAlbumResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.toLowerCase();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTidalTracks([]);
      setTidalArtists([]);
      setTidalAlbums([]);
      return;
    }
    setIsSearching(true);
    try {
      // Search tracks (which also gives us artists and albums)
      const [trackResults, albumResults] = await Promise.all([
        searchTracks(searchQuery, 30),
        searchAlbums(searchQuery, 15),
      ]);

      const tracks = trackResults.map(tidalTrackToAppTrack);
      setTidalTracks(tracks);

      // Extract unique artists from track results
      const artistMap = new Map<number, SearchArtistResult>();
      for (const t of trackResults) {
        if (t.artist && !artistMap.has(t.artist.id)) {
          artistMap.set(t.artist.id, {
            id: t.artist.id,
            name: t.artist.name,
            imageUrl: t.artist.picture ? getTidalImageUrl(t.artist.picture, "320x320") : "",
          });
        }
        // Also add featured artists
        if (t.artists) {
          for (const a of t.artists) {
            if (!artistMap.has(a.id)) {
              artistMap.set(a.id, {
                id: a.id,
                name: a.name,
                imageUrl: "",
              });
            }
          }
        }
      }
      setTidalArtists(Array.from(artistMap.values()).slice(0, 10));

      // Albums from dedicated search
      setTidalAlbums(albumResults.map((a) => ({
        id: a.id,
        title: a.title,
        artist: a.artist?.name || a.artists?.map((ar) => ar.name).join(", ") || "Unknown",
        coverUrl: getTidalImageUrl(a.cover || "", "320x320"),
      })));
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
      handleSearch(value);
    }, 400);
  }, [handleSearch]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setTidalTracks([]);
    setTidalArtists([]);
    setTidalAlbums([]);
  }, []);

  const filteredTracks = q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 15);
  const filteredAlbums = q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums;
  const filteredPlaylists = q ? playlists.filter((p) => p.title.toLowerCase().includes(q)) : playlists;

  return (
    <SearchContext.Provider value={{
      searchOpen, setSearchOpen,
      query, setQuery,
      searchTab, setSearchTab,
      tidalTracks, tidalArtists, tidalAlbums,
      isSearching,
      handleSearch, onQueryChange,
      filteredTracks, filteredAlbums, filteredPlaylists,
      closeSearch,
    }}>
      {children}
    </SearchContext.Provider>
  );
}
