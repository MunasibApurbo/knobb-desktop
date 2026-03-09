import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTidalImageUrl,
  searchAlbums,
  searchArtists,
  searchPlaylists,
} from "@/lib/musicApi";
import {
  TidalReferenceAlbumResult,
  TidalReferenceArtistResult,
  TidalReferencePlaylistResult,
} from "@/lib/tidalReferenceMappers";

type LibraryState = {
  loading: boolean;
  albums: TidalReferenceAlbumResult[];
  artists: TidalReferenceArtistResult[];
  playlists: TidalReferencePlaylistResult[];
};

const INITIAL_STATE: LibraryState = {
  loading: false,
  albums: [],
  artists: [],
  playlists: [],
};

function imageUrl(value: string | null | undefined, size = "640x640") {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return getTidalImageUrl(value, size);
}

export function useTidalReferenceLibrary() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LibraryState>(INITIAL_STATE);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void (async () => {
      const [playlists, albums, artists] = await Promise.all([
        searchPlaylists("my mix", 12).catch(() => []),
        searchAlbums("new releases", 12).catch(() => []),
        searchArtists("top artists", 12).catch(() => []),
      ]);

      if (cancelled) return;

      setState({
        loading: false,
        playlists: playlists.map((playlist) => ({
          id: playlist.uuid || `playlist-${playlist.title.toLowerCase().replace(/\s+/g, "-")}`,
          title: playlist.title,
          description: playlist.description || "",
          trackCount: playlist.numberOfTracks || 0,
          coverUrl: imageUrl(playlist.squareImage || playlist.image),
        })),
        albums: albums.map((album) => ({
          id: album.id,
          title: album.title,
          artist: album.artist?.name || album.artists?.map((artist) => artist.name).join(", ") || "Unknown Artist",
          coverUrl: imageUrl(album.cover),
          releaseDate: album.releaseDate,
        })),
        artists: artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          imageUrl: imageUrl(artist.picture, "1080x720"),
        })),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return useMemo(
    () => ({
      loading: state.loading,
      albums: state.albums,
      artists: state.artists,
      playlists: state.playlists,
    }),
    [state],
  );
}
