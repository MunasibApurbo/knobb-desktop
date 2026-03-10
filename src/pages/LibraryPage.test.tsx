import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import LibraryPage from "@/pages/LibraryPage";

const libraryPageMocks = vi.hoisted(() => ({
  isMobile: true,
  createPlaylist: vi.fn(),
  addLikedSong: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => libraryPageMocks.isMobile,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    loading: false,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "sidebar.yourLibrary": "Your Library",
        "sidebar.newPlaylist": "New Playlist",
        "sidebar.playlists": "Playlists",
        "sidebar.albums": "Albums",
        "sidebar.artists": "Artists",
        "sidebar.searchLibraryPlaceholder": "Search in library",
        "sidebar.recents": "Recents",
        "sidebar.alphabetical": "Alphabetical",
        "sidebar.noMatchesFound": "No matches found",
        "sidebar.playlistNamePlaceholder": "Playlist name",
        "sidebar.createPlaylist": "Create Playlist",
        "nav.settings": "Settings",
        "nav.library": "Library",
      };

      if (key === "sidebar.playlistCreated" && values?.name) {
        return `Created ${values.name}`;
      }

      if (key === "sidebar.playlistCreateFailed") {
        return "Could not create playlist";
      }

      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    likedSongs: [],
    addLikedSong: libraryPageMocks.addLikedSong,
  }),
}));

vi.mock("@/contexts/LocalFilesContext", () => ({
  useLocalFiles: () => ({
    localFiles: [],
  }),
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => ({
    favoriteArtists: [],
  }),
}));

vi.mock("@/hooks/useFavoritePlaylists", () => ({
  useFavoritePlaylists: () => ({
    favoritePlaylists: [],
  }),
}));

vi.mock("@/hooks/useSavedAlbums", () => ({
  useSavedAlbums: () => ({
    savedAlbums: [],
  }),
}));

vi.mock("@/hooks/usePlaylists", () => ({
  usePlaylists: () => ({
    playlists: [],
    createPlaylist: libraryPageMocks.createPlaylist,
    importTracksToPlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    getLastPlaylistError: () => null,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    libraryItemStyle: "list",
    librarySortDefault: "recents",
    showLocalFiles: true,
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
  }),
}));

vi.mock("@/components/sidebar/useSidebarLibraryItems", () => ({
  useSidebarLibraryItems: () => [
    {
      type: "liked",
      id: "liked-songs",
      title: "Liked Songs",
      subtitle: "Playlist",
      imageUrl: null,
      playlistKind: "liked",
      createdAt: 1,
      active: false,
      variant: "default",
      onClick: vi.fn(),
    },
  ],
}));

vi.mock("@/components/sidebar/SidebarLibraryCard", () => ({
  SidebarLibraryCard: ({
    title,
    onClick,
  }: {
    title: string;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock("@/components/PlaylistContextMenu", () => ({
  PlaylistContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AlbumContextMenu", () => ({
  AlbumContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/scroll-area", async () => {
  const React = await import("react");

  return {
    ScrollArea: React.forwardRef(function ScrollArea(
      {
        children,
        className,
      }: {
        children: ReactNode;
        className?: string;
      },
      ref: React.ForwardedRef<HTMLDivElement>,
    ) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      );
    }),
  };
});

vi.mock("@/components/PlaylistCreateDialog", () => ({
  PlaylistCreateDialog: () => <div>Create playlist dialog</div>,
}));

function renderLibraryPage(initialEntry = "/library") {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/settings" element={<div>Settings page</div>} />
        <Route path="/app" element={<div>App home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LibraryPage", () => {
  beforeEach(() => {
    libraryPageMocks.isMobile = true;
    libraryPageMocks.createPlaylist.mockReset();
    libraryPageMocks.addLikedSong.mockReset();
  });

  it("renders the mobile library controls and navigates to settings", () => {
    renderLibraryPage();

    expect(screen.getByText("Your collection, in color.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Playlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Playlists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search in library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort library" })).toHaveTextContent("Recents");
    expect(screen.getByText("Quick Access")).toBeInTheDocument();
    expect(screen.getByText("Liked Songs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });

  it("redirects desktop visits back to app home", () => {
    libraryPageMocks.isMobile = false;

    renderLibraryPage();

    expect(screen.getByText("App home")).toBeInTheDocument();
  });
});
