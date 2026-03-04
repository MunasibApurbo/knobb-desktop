import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Track } from "@/types/music";
import {
  searchTracks,
  searchArtists,
  searchAlbums,
  searchPlaylists,
  tidalTrackToAppTrack,
  getTidalImageUrl,
} from "@/lib/monochromeApi";

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

export interface SearchPlaylistResult {
  id: string;
  title: string;
  description: string;
  trackCount: number;
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
  tidalPlaylists: SearchPlaylistResult[];
  isSearching: boolean;
  handleSearch: (q: string) => void;
  onQueryChange: (value: string) => void;
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
  const [tidalPlaylists, setTidalPlaylists] = useState<SearchPlaylistResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTidalTracks([]);
      setTidalArtists([]);
      setTidalAlbums([]);
      setTidalPlaylists([]);
      return;
    }
    setIsSearching(true);
    try {
      // Search tracks (which also gives us artists and albums)
      const [trackResults, directArtistResults, albumResults, playlistResults] = await Promise.all([
        searchTracks(searchQuery, 30),
        searchArtists(searchQuery),
        searchAlbums(searchQuery, 15),
        searchPlaylists(searchQuery, 15),
      ]);

      const tracks = trackResults.map(tidalTrackToAppTrack);
      setTidalTracks(tracks);

      // Seed with dedicated artist search first (higher quality / closer to Monochrome)
      const artistMap = new Map<number, SearchArtistResult>();
      for (const a of directArtistResults.slice(0, 16)) {
        artistMap.set(a.id, {
          id: a.id,
          name: a.name,
          imageUrl: a.picture ? getTidalImageUrl(a.picture, "1080x720") : "",
        });
      }

      // Then enrich with artists from track results
      for (const t of trackResults) {
        if (t.artist && !artistMap.has(t.artist.id)) {
          artistMap.set(t.artist.id, {
            id: t.artist.id,
            name: t.artist.name,
            imageUrl: t.artist.picture ? getTidalImageUrl(t.artist.picture, "1080x720") : "",
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

      const normalizedQuery = searchQuery.trim().toLowerCase();
      const rankedArtists = Array.from(artistMap.values()).sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(normalizedQuery) ? 1 : 0;
        const bStarts = bName.startsWith(normalizedQuery) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aIncludes = aName.includes(normalizedQuery) ? 1 : 0;
        const bIncludes = bName.includes(normalizedQuery) ? 1 : 0;
        if (aIncludes !== bIncludes) return bIncludes - aIncludes;

        const aHasImage = a.imageUrl ? 1 : 0;
        const bHasImage = b.imageUrl ? 1 : 0;
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;

        return aName.localeCompare(bName);
      });

      setTidalArtists(rankedArtists.slice(0, 12));

      // Albums from dedicated search
      setTidalAlbums(albumResults.map((a) => ({
        id: a.id,
        title: a.title,
        artist: a.artist?.name || a.artists?.map((ar) => ar.name).join(", ") || "Unknown",
        coverUrl: getTidalImageUrl(a.cover || "", "320x320"),
      })));

      setTidalPlaylists(playlistResults.map((p) => ({
        id: p.uuid,
        title: p.title,
        description: p.description || "",
        trackCount: p.numberOfTracks || 0,
        coverUrl: getTidalImageUrl(p.squareImage || p.image || "", "320x320"),
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
    setTidalPlaylists([]);
  }, []);

  return (
    <SearchContext.Provider value={{
      searchOpen, setSearchOpen,
      query, setQuery,
      searchTab, setSearchTab,
      tidalTracks, tidalArtists, tidalAlbums,
      tidalPlaylists,
      isSearching,
      handleSearch, onQueryChange,
      closeSearch,
    }}>
      {children}
    </SearchContext.Provider>
  );
}
