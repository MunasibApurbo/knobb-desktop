export type FilterType = "all" | "playlists" | "albums" | "artists";
export type LibrarySort = "recents" | "alphabetical";

export type SidebarLibraryItem = {
  type: "liked" | "local" | "playlist" | "album" | "artist";
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string | null;
  artistId?: number;
  albumId?: number;
  albumArtist?: string;
  playlistId?: string;
  playlistKind?: "liked" | "tidal" | "user";
  playlistShareToken?: string;
  createdAt: number;
  active: boolean;
  variant: "default" | "artist";
  onClick: () => void;
};
