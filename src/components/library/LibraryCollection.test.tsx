import type { DragEventHandler, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LibraryCollection } from "@/components/library/LibraryCollection";
import { dispatchLibraryShortcutCommand } from "@/lib/keyboardShortcuts";

const libraryCollectionMocks = vi.hoisted(() => {
  const navigate = vi.fn();
  const setActiveScope = vi.fn();
  const deletePlaylist = vi.fn(async () => undefined);
  const removeFavoritePlaylist = vi.fn(async () => true);
  const toasts = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => "toast-id"),
  };

  let lastNonNullScope: {
    id: string;
    selectedCount: number;
    selectAll: () => void;
    clearSelection: () => void;
    deleteSelection: () => void | Promise<void>;
    libraryActions?: {
      closeSearch?: () => void;
      createPlaylist?: () => void;
      focusSearch?: () => void;
      setFilter?: (filter: "all" | "playlists" | "albums" | "artists") => void;
      setSort?: (sort: "recents" | "alphabetical") => void;
    };
  } | null = null;

  return {
    navigate,
    setActiveScope: vi.fn((scope) => {
      setActiveScope(scope);
      if (scope) {
        lastNonNullScope = scope;
      }
    }),
    getLastScope: () => lastNonNullScope,
    resetLastScope: () => {
      lastNonNullScope = null;
    },
    deletePlaylist,
    removeFavoritePlaylist,
    toasts,
  };
});

const playlistItems = [
  {
    type: "playlist" as const,
    id: "playlist-1",
    title: "Roadtrip",
    subtitle: "12 tracks",
    imageUrl: null,
    playlistId: "owned-1",
    playlistKind: "user" as const,
    playlistShareToken: null,
    createdAt: 3,
    active: false,
    variant: "default" as const,
    onClick: vi.fn(),
  },
  {
    type: "playlist" as const,
    id: "playlist-2",
    title: "Saved Mix",
    subtitle: "Saved playlist",
    imageUrl: null,
    playlistId: "tidal-2",
    playlistKind: "tidal" as const,
    playlistShareToken: null,
    createdAt: 2,
    active: false,
    variant: "default" as const,
    onClick: vi.fn(),
  },
  {
    type: "playlist" as const,
    id: "playlist-3",
    title: "Workout",
    subtitle: "9 tracks",
    imageUrl: null,
    playlistId: "owned-3",
    playlistKind: "user" as const,
    playlistShareToken: null,
    createdAt: 1,
    active: true,
    variant: "default" as const,
    onClick: vi.fn(),
  },
];

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => libraryCollectionMocks.navigate,
    useLocation: () => ({ pathname: "/library", search: "" }),
  };
});

vi.mock("sonner", () => ({
  toast: libraryCollectionMocks.toasts,
}));

vi.mock("@/components/sidebar/useSidebarLibraryItems", () => ({
  useSidebarLibraryItems: () => playlistItems,
}));

vi.mock("@/components/sidebar/SidebarLibraryCard", () => ({
  SidebarLibraryCard: ({
    title,
    selected,
    onClick,
    onFocus,
    onDragLeave,
    onDragOver,
    onDrop,
    onDragStart,
    onDragEnd,
    draggable,
  }: {
    title: string;
    selected?: boolean;
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    onFocus?: () => void;
    onDragLeave?: DragEventHandler<HTMLButtonElement>;
    onDragOver?: DragEventHandler<HTMLButtonElement>;
    onDrop?: DragEventHandler<HTMLButtonElement>;
    onDragStart?: DragEventHandler<HTMLButtonElement>;
    onDragEnd?: DragEventHandler<HTMLButtonElement>;
    draggable?: boolean;
  }) => (
    <button
      type="button"
      aria-label={title}
      data-selected={selected ? "true" : "false"}
      onClick={onClick}
      onFocus={onFocus}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      draggable={draggable}
    >
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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (_key: string, values?: Record<string, string | number>) => values?.name || values?.count || "label",
  }),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({ likedSongs: [], addLikedSong: vi.fn(async () => true) }),
}));

vi.mock("@/contexts/LocalFilesContext", () => ({
  useLocalFiles: () => ({ localFiles: [] }),
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => ({ favoriteArtists: [] }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    libraryItemStyle: "list",
    librarySortDefault: "recents",
  }),
}));

vi.mock("@/contexts/TrackSelectionShortcutsContext", () => ({
  useTrackSelectionShortcutsContext: () => ({
    setActiveScope: libraryCollectionMocks.setActiveScope,
  }),
}));

vi.mock("@/hooks/useFavoritePlaylists", () => ({
  useFavoritePlaylists: () => ({
    favoritePlaylists: [],
    removeFavoritePlaylist: libraryCollectionMocks.removeFavoritePlaylist,
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({ motionEnabled: false }),
}));

vi.mock("@/hooks/usePlaylists", () => ({
  usePlaylists: () => ({
    playlists: [
      { id: "owned-1", name: "Roadtrip", tracks: [], visibility: "private" },
      { id: "owned-3", name: "Workout", tracks: [], visibility: "private" },
    ],
    createPlaylist: vi.fn(),
    importTracksToPlaylist: vi.fn(),
    deletePlaylist: libraryCollectionMocks.deletePlaylist,
    getLastPlaylistError: vi.fn(() => null),
  }),
}));

vi.mock("@/hooks/useSavedAlbums", () => ({
  useSavedAlbums: () => ({ savedAlbums: [] }),
}));

vi.mock("@/lib/musicApi", () => ({
  filterAudioTracks: vi.fn(),
  getAlbumWithTracks: vi.fn(),
  getPlaylistWithTracks: vi.fn(),
  tidalTrackToAppTrack: vi.fn(),
}));

vi.mock("@/lib/playlistDrag", () => ({
  clearActivePlaylistDrag: vi.fn(),
  consumePlaylistDrag: vi.fn(),
  getPlaylistDragSummary: vi.fn(),
  hasPlaylistDragPayload: vi.fn(() => false),
  startDeferredPlaylistDrag: vi.fn(),
  startPlaylistDrag: vi.fn(),
}));

describe("LibraryCollection playlist selection", () => {
  beforeEach(() => {
    libraryCollectionMocks.navigate.mockReset();
    libraryCollectionMocks.setActiveScope.mockClear();
    libraryCollectionMocks.resetLastScope();
    libraryCollectionMocks.deletePlaylist.mockReset();
    libraryCollectionMocks.removeFavoritePlaylist.mockReset();
    libraryCollectionMocks.removeFavoritePlaylist.mockResolvedValue(true);
    Object.values(libraryCollectionMocks.toasts).forEach((mock) => mock.mockReset());
    playlistItems.forEach((item) => item.onClick.mockReset());
    window.confirm = vi.fn(() => true);
  });

  it("supports modifier and range selection across playlist cards", async () => {
    render(<LibraryCollection />);

    const roadtrip = screen.getByRole("button", { name: "Roadtrip" });
    const savedMix = screen.getByRole("button", { name: "Saved Mix" });
    const workout = screen.getByRole("button", { name: "Workout" });

    fireEvent.click(roadtrip, { metaKey: true });
    fireEvent.click(workout, { shiftKey: true });

    await waitFor(() => {
      expect(roadtrip).toHaveAttribute("data-selected", "true");
      expect(savedMix).toHaveAttribute("data-selected", "true");
      expect(workout).toHaveAttribute("data-selected", "true");
    });
  });

  it("selects all playlists and batch deletes owned plus saved playlists", async () => {
    render(<LibraryCollection />);

    fireEvent.focus(screen.getByRole("button", { name: "Roadtrip" }));

    await waitFor(() => {
      expect(libraryCollectionMocks.getLastScope()).not.toBeNull();
    });

    await act(async () => {
      libraryCollectionMocks.getLastScope()?.selectAll();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Roadtrip" })).toHaveAttribute("data-selected", "true");
      expect(screen.getByRole("button", { name: "Saved Mix" })).toHaveAttribute("data-selected", "true");
      expect(screen.getByRole("button", { name: "Workout" })).toHaveAttribute("data-selected", "true");
    });

    await act(async () => {
      await libraryCollectionMocks.getLastScope()?.deleteSelection();
    });

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(libraryCollectionMocks.deletePlaylist).toHaveBeenCalledTimes(2);
    expect(libraryCollectionMocks.deletePlaylist).toHaveBeenNthCalledWith(1, "owned-1");
    expect(libraryCollectionMocks.deletePlaylist).toHaveBeenNthCalledWith(2, "owned-3");
    expect(libraryCollectionMocks.removeFavoritePlaylist).toHaveBeenCalledWith("tidal-2", "tidal");
    expect(libraryCollectionMocks.navigate).toHaveBeenCalledWith("/app");
  });

  it("exposes library productivity actions through the active shortcut scope", async () => {
    render(<LibraryCollection />);

    fireEvent.focus(screen.getByRole("button", { name: "Roadtrip" }));

    await waitFor(() => {
      expect(libraryCollectionMocks.getLastScope()?.libraryActions).toBeDefined();
    });

    act(() => {
      libraryCollectionMocks.getLastScope()?.libraryActions?.focusSearch?.();
    });

    expect(screen.getByPlaceholderText("label")).toHaveFocus();

    act(() => {
      libraryCollectionMocks.getLastScope()?.libraryActions?.setFilter?.("albums");
    });

    act(() => {
      libraryCollectionMocks.getLastScope()?.libraryActions?.setSort?.("alphabetical");
    });

    act(() => {
      libraryCollectionMocks.getLastScope()?.libraryActions?.createPlaylist?.();
    });

    expect(libraryCollectionMocks.navigate).not.toHaveBeenCalledWith("/auth", expect.anything());
  });

  it("responds to global library shortcut commands", async () => {
    render(<LibraryCollection />);

    act(() => {
      dispatchLibraryShortcutCommand({ type: "focus-search" });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("label")).toHaveFocus();
    });
  });

  it("keeps the collection root as a flex column so the library list can scroll", () => {
    const { container } = render(<LibraryCollection className="custom-library-class" />);

    expect(container.firstElementChild).toHaveClass(
      "flex",
      "min-h-0",
      "flex-1",
      "flex-col",
      "custom-library-class",
    );
  });
});
