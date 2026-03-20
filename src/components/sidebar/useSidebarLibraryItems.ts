import { useMemo } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { FavoriteArtist } from "@/contexts/FavoriteArtistsContext";
import { useLocalFiles } from "@/contexts/LocalFilesContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FavoritePlaylist } from "@/hooks/useFavoritePlaylists";
import { useSettings } from "@/contexts/SettingsContext";
import type { SavedAlbum } from "@/hooks/useSavedAlbums";
import type { UserPlaylist } from "@/hooks/usePlaylists";
import type { Track } from "@/types/music";
import type { FilterType, LibrarySort, SidebarLibraryItem } from "@/components/sidebar/sidebarTypes";
import { getLatestLikedSongsArtwork } from "@/lib/likedSongsArtwork";

type UseSidebarLibraryItemsOptions = {
  favoriteArtists: FavoriteArtist[];
  favoritePlaylists: FavoritePlaylist[];
  filter: FilterType;
  librarySearch: string;
  librarySort: LibrarySort;
  likedSongs: Track[];
  navigate: NavigateFunction;
  openSavedAlbum: (album: SavedAlbum) => void;
  pathname: string;
  search: string;
  savedAlbums: SavedAlbum[];
  userPlaylists: UserPlaylist[];
};

export function useSidebarLibraryItems({
  favoriteArtists,
  favoritePlaylists,
  filter,
  librarySearch,
  librarySort,
  likedSongs,
  navigate,
  openSavedAlbum,
  pathname,
  search,
  savedAlbums,
  userPlaylists,
}: UseSidebarLibraryItemsOptions) {
  const { t } = useLanguage();
  const { localFiles } = useLocalFiles();
  const { showLocalFiles } = useSettings();

  return useMemo(() => {
    const likedSongsCoverUrl = getLatestLikedSongsArtwork(likedSongs);
    const ownedPlaylistIds = new Set(userPlaylists.map((playlist) => playlist.id));
    const normalizedArtistNameFromSearch = (() => {
      const params = new URLSearchParams(search);
      return params.get("name")?.trim().toLocaleLowerCase() ?? "";
    })();

    let items: SidebarLibraryItem[] = [
      {
        type: "liked",
        id: "liked-songs",
        title: t("sidebar.likedSongs"),
        subtitle: t("sidebar.playlistMeta", { count: likedSongs.length }),
        imageUrl: likedSongsCoverUrl,
        playlistKind: "liked",
        createdAt: Date.now(),
        active: pathname === "/liked",
        variant: "default",
        onClick: () => navigate("/liked"),
      },
    ];

    if (showLocalFiles) {
      items.push({
        type: "local",
        id: "local-files",
        title: t("sidebar.localFiles"),
        subtitle: t("sidebar.localFilesMeta", { count: localFiles.length }),
        imageUrl: null,
        createdAt: localFiles.reduce((latest, track) => {
          const importedAt = track.localImportedAt ? Date.parse(track.localImportedAt) : Number.NaN;
          return Number.isFinite(importedAt) ? Math.max(latest, importedAt) : latest;
        }, 0),
        active: pathname === "/local-files",
        variant: "default",
        onClick: () => navigate("/local-files"),
      });
    }

    favoritePlaylists.forEach((playlist) => {
      const normalizedSource = playlist.source.trim().toLowerCase();
      if (normalizedSource === "local" && ownedPlaylistIds.has(playlist.playlist_id)) {
        return;
      }

      const createdAt = Date.parse(playlist.created_at);
      const isTidalPlaylist = normalizedSource !== "local";
      const playlistKind = isTidalPlaylist ? "tidal" : "user";
      const playlistPath = isTidalPlaylist
        ? `/playlist/${playlist.playlist_id}`
        : `/my-playlist/${playlist.playlist_id}`;

      items.push({
        type: "playlist",
        id: `favorite-playlist-${playlist.source}-${playlist.playlist_id}`,
        title: playlist.playlist_title,
        subtitle: "Saved playlist",
        imageUrl: playlist.playlist_cover_url,
        playlistId: playlist.playlist_id,
        playlistKind,
        createdAt: Number.isFinite(createdAt) ? createdAt : 0,
        active: pathname === playlistPath,
        variant: "default",
        onClick: () => navigate(playlistPath),
      });
    });

    userPlaylists.forEach((playlist) => {
      items.push({
        type: "playlist",
        id: `playlist-${playlist.id}`,
        title: playlist.name,
        subtitle: t("sidebar.playlistMeta", { count: playlist.track_count }),
        imageUrl: playlist.cover_url || playlist.tracks[0]?.coverUrl || null,
        playlistId: playlist.id,
        playlistKind: "user",
        playlistShareToken: playlist.share_token,
        createdAt: new Date(playlist.created_at).getTime(),
        active: pathname === `/my-playlist/${playlist.id}`,
        variant: "default",
        onClick: () => navigate(`/my-playlist/${playlist.id}`),
      });
    });

    savedAlbums.forEach((album) => {
      items.push({
        type: "album",
        id: `album-${album.album_id}`,
        title: album.album_title,
        subtitle: album.album_artist,
        imageUrl: album.album_cover_url,
        albumId: album.album_id,
        albumArtist: album.album_artist,
        createdAt: new Date(album.created_at).getTime(),
        active: pathname.includes(`/album/tidal-${album.album_id}`),
        variant: "default",
        onClick: () => openSavedAlbum(album),
      });
    });

    favoriteArtists.forEach((artist) => {
      const isArtistRouteMatch = pathname.includes(`/artist/${artist.artist_id}`);
      const isArtistSearchMatch =
        pathname.startsWith("/artist/search") &&
        normalizedArtistNameFromSearch === artist.artist_name.trim().toLocaleLowerCase();

      items.push({
        type: "artist",
        id: `artist-${artist.id}`,
        title: artist.artist_name,
        subtitle: t("sidebar.artist"),
        imageUrl: artist.artist_image_url,
        artistId: artist.artist_id,
        createdAt: new Date(artist.created_at).getTime(),
        active: isArtistRouteMatch || isArtistSearchMatch,
        variant: "artist",
        onClick: () => navigate(`/artist/${artist.artist_id}?name=${encodeURIComponent(artist.artist_name)}`),
      });
    });

    if (filter === "playlists") {
      items = items.filter((item) => item.type === "playlist" || item.type === "liked" || item.type === "local");
    } else if (filter === "albums") {
      items = items.filter((item) => item.type === "album");
    } else if (filter === "artists") {
      items = items.filter((item) => item.type === "artist");
    }

    if (librarySearch.trim()) {
      const query = librarySearch.toLowerCase();
      items = items.filter((item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query),
      );
    }

    if (librarySort === "recents") {
      items.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }

    return items;
  }, [
    favoriteArtists,
    favoritePlaylists,
    filter,
    librarySearch,
    librarySort,
    likedSongs,
    navigate,
    openSavedAlbum,
    pathname,
    search,
    savedAlbums,
    showLocalFiles,
    t,
    userPlaylists,
    localFiles,
  ]);
}
