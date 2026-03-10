import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { MetadataProvider } from "@/components/MetadataProvider";
import ArtistPage from "@/pages/ArtistPage";
import BrowsePage from "@/pages/BrowsePage";
import Index from "@/pages/Index";
import SearchPage from "@/pages/SearchPage";

const responsiveMocks = vi.hoisted(() => {
  const tracks = Array.from({ length: 5 }, (_value, index) => ({
    id: `track-${index + 1}`,
    title: `Track ${index + 1}`,
    artist: `Artist ${index + 1}`,
    album: `Album ${index + 1}`,
    duration: 200 + index * 5,
    year: 2024,
    coverUrl: `/track-${index + 1}.jpg`,
    canvasColor: "210 80% 56%",
    artistId: index + 1,
    albumId: 100 + index,
    artists: [{ id: index + 1, name: `Artist ${index + 1}` }],
  }));

  const albums = Array.from({ length: 5 }, (_value, index) => ({
    id: 100 + index,
    title: `Album ${index + 1}`,
    artist: `Artist ${index + 1}`,
    artistId: index + 1,
    coverUrl: `/album-${index + 1}.jpg`,
    releaseDate: `2024-0${(index % 9) + 1}-01`,
    year: 2024,
  }));

  const artists = Array.from({ length: 5 }, (_value, index) => ({
    id: index + 1,
    name: `Artist ${index + 1}`,
    imageUrl: `/artist-${index + 1}.jpg`,
    picture: `/artist-${index + 1}.jpg`,
  }));

  const playlists = [
    {
      uuid: "playlist-1",
      id: "playlist-1",
      title: "Night Drive",
      image: "/playlist-1.jpg",
      squareImage: "/playlist-1.jpg",
      coverUrl: "/playlist-1.jpg",
      numberOfTracks: 24,
      trackCount: 24,
    },
  ];

  return {
    viewport: { isMobile: true },
    play: vi.fn(),
    playArtist: vi.fn(),
    togglePlay: vi.fn(),
    currentTrack: null as null | (typeof tracks)[number],
    isPlaying: false,
    toggleFavorite: vi.fn(async () => true),
    toggleSavedAlbum: vi.fn(async () => true),
    toggleLike: vi.fn(async () => true),
    searchTidalReference: vi.fn(async () => ({
      tracks,
      artists,
      albums: albums.map((album) => ({
        id: album.id,
        title: album.title,
        artist: album.artist,
        coverUrl: album.coverUrl,
      })),
      playlists: playlists.map((playlist) => ({
        id: playlist.id,
        title: playlist.title,
        coverUrl: playlist.coverUrl,
        trackCount: playlist.trackCount,
      })),
    })),
    tracks,
    albums,
    artists,
    playlists,
  };
});

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => responsiveMocks.viewport.isMobile,
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    play: responsiveMocks.play,
    playArtist: responsiveMocks.playArtist,
    togglePlay: responsiveMocks.togglePlay,
    currentTrack: responsiveMocks.currentTrack,
    isPlaying: responsiveMocks.isPlaying,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    likedSongs: [],
    isLiked: () => false,
    toggleLike: responsiveMocks.toggleLike,
  }),
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => ({
    favoriteArtists: [],
    isFavorite: () => false,
    toggleFavorite: responsiveMocks.toggleFavorite,
  }),
}));

vi.mock("@/hooks/usePlayHistory", () => ({
  usePlayHistory: () => ({
    getHistory: vi.fn(async () => []),
    clearHistory: vi.fn(async () => {}),
  }),
}));

vi.mock("@/hooks/useHomeFeeds", () => ({
  useHomeFeeds: () => ({
    error: null,
    loaded: true,
    newReleases: responsiveMocks.albums,
    recommendedAlbums: responsiveMocks.albums,
    recommendedArtists: responsiveMocks.artists,
    recommendedTracks: responsiveMocks.tracks,
    recentTracks: responsiveMocks.tracks,
    reloadingSection: null,
    reloadSection: vi.fn(),
    retryInitialLoad: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBrowseHotNew", () => ({
  useBrowseHotNew: () => ({
    error: null,
    loaded: true,
    sections: [
      {
        id: "hot-albums",
        type: "albums",
        title: "Hot Albums",
        items: responsiveMocks.albums,
      },
      {
        id: "hot-artists",
        type: "artists",
        title: "Hot Artists",
        items: responsiveMocks.artists,
      },
      {
        id: "hot-playlists",
        type: "playlists",
        title: "Playlist Picks",
        items: responsiveMocks.playlists,
      },
    ],
  }),
}));

vi.mock("@/hooks/useUnreleasedArtists", () => ({
  useUnreleasedArtists: () => ({
    artists: responsiveMocks.artists.map((artist, index) => ({
      sheetId: `sheet-${index + 1}`,
      name: artist.name,
      url: `https://example.com/${index + 1}`,
      imageUrl: artist.imageUrl,
      popularity: 100 - index,
    })),
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useSavedAlbums", () => ({
  useSavedAlbums: () => ({
    isSaved: () => false,
    toggleSavedAlbum: responsiveMocks.toggleSavedAlbum,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    cardSize: "default",
    blurEffects: false,
  }),
}));

vi.mock("@/hooks/useResponsiveMediaCardCount", () => ({
  useResponsiveMediaCardCount: () => ({
    containerRef: { current: null },
    collapsedCount: responsiveMocks.viewport.isMobile ? 2 : 3,
  }),
}));

vi.mock("@/hooks/useMainScrollY", () => ({
  useMainScrollY: () => 0,
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
    allowAmbientMotion: false,
    allowDepthMotion: false,
    lowEndDevice: false,
  }),
}));

vi.mock("@/hooks/useArtistPageData", () => ({
  useArtistPageData: () => ({
    albums: responsiveMocks.albums.map((album) => ({
      id: album.id,
      title: album.title,
      artist: { id: album.artistId, name: album.artist },
      artists: [{ id: album.artistId, name: album.artist }],
      cover: album.coverUrl,
      releaseDate: album.releaseDate,
    })),
    artist: {
      id: 7,
      name: "Artist 1",
      picture: "/artist-1.jpg",
      bio: "Artist 1 fuses sleek electronics with widescreen pop hooks.",
      mixes: { ARTIST_MIX: "artist-mix-1" },
    },
    bio: "Artist 1 fuses sleek electronics with widescreen pop hooks.",
    loading: false,
    relatedArtists: responsiveMocks.artists.slice(1).map((artist) => ({
      id: artist.id,
      name: artist.name,
      picture: artist.picture,
    })),
    scrollY: 0,
    setShowAllTracks: vi.fn(),
    showAllTracks: false,
    singlesAndEps: responsiveMocks.albums.slice(0, 3).map((album) => ({
      id: album.id + 1000,
      title: `${album.title} EP`,
      artist: { id: album.artistId, name: album.artist },
      artists: [{ id: album.artistId, name: album.artist }],
      cover: album.coverUrl,
      releaseDate: album.releaseDate,
    })),
    topTracks: responsiveMocks.tracks,
    tracksLoading: false,
  }),
}));

vi.mock("@/hooks/useResolvedArtistImage", () => ({
  useResolvedArtistImage: (_artistId?: number, imageUrl?: string) => imageUrl || "/placeholder.svg",
}));

vi.mock("@/lib/tidalReferenceSearch", () => ({
  searchTidalReference: responsiveMocks.searchTidalReference,
}));

vi.mock("@/lib/musicApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/musicApi")>();

  return {
    ...actual,
    getTidalImageUrl: (value: string) => value || "/placeholder.svg",
    warmArtistPageData: vi.fn(),
  };
});

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AlbumContextMenu", () => ({
  AlbumContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/PlaylistContextMenu", () => ({
  PlaylistContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/VirtualizedTrackList", () => ({
  VirtualizedTrackList: ({
    items,
    renderRow,
  }: {
    items: unknown[];
    renderRow: (item: unknown, index: number) => ReactNode;
  }) => <div>{items.map((item, index) => renderRow(item, index))}</div>,
}));

vi.mock("@/components/home/HomeMediaCards", () => ({
  HomeAlbumCard: ({ album }: { album: { title: string } }) => <div>{album.title}</div>,
  TrackCard: ({ track }: { track: { title: string } }) => <div>{track.title}</div>,
  ArtistCardWrapper: ({ artist }: { artist: { name: string } }) => <div>{artist.name}</div>,
}));

vi.mock("@/components/ArtistCard", () => ({
  ArtistCard: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("@/components/MediaCardShell", () => ({
  MediaCardShell: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

function renderWithRouter(node: ReactNode, initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={initialEntries}
    >
      <MetadataProvider>{node}</MetadataProvider>
    </MemoryRouter>,
  );
}

describe("responsive routes", () => {
  beforeEach(() => {
    responsiveMocks.viewport.isMobile = true;
    responsiveMocks.play.mockReset();
    responsiveMocks.playArtist.mockReset();
    responsiveMocks.togglePlay.mockReset();
    responsiveMocks.currentTrack = null;
    responsiveMocks.isPlaying = false;
    responsiveMocks.toggleFavorite.mockClear();
    responsiveMocks.toggleSavedAlbum.mockClear();
    responsiveMocks.toggleLike.mockClear();
    responsiveMocks.searchTidalReference.mockClear();
  });

  it("renders the home page content on mobile", () => {
    renderWithRouter(<Index />);

    expect(screen.getByText("Knobb Mobile")).toBeInTheDocument();
    expect(screen.getByText("Your richest listening canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Session" })).toBeInTheDocument();
    expect(screen.getByText("Picked For You")).toBeInTheDocument();
  });

  it("renders browse collections as horizontal mobile shelves", () => {
    const { container } = renderWithRouter(<BrowsePage />);

    expect(screen.getByText("Hot Albums")).toBeInTheDocument();
    expect(container.querySelector(".home-section-inline-row")).not.toBeNull();
  });

  it("renders the search page with the mobile top-result treatment", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>,
      ["/search?q=artist"],
    );

    await waitFor(() => {
      expect(responsiveMocks.searchTidalReference).toHaveBeenCalled();
    });

    expect(await screen.findByText("Top result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Top Results" })).toHaveClass("menu-sweep-hover");
  });

  it("shows a mobile browse action in search and navigates to browse", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/search" element={<SearchPage />} />
        <Route path="/browse" element={<div>Browse destination</div>} />
      </Routes>,
      ["/search?q=artist"],
    );

    await waitFor(() => {
      expect(responsiveMocks.searchTidalReference).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    expect(screen.getByText("Browse destination")).toBeInTheDocument();
  });

  it("renders top-result search tracks through the shared track row and keeps the current track highlighted while playing", async () => {
    responsiveMocks.viewport.isMobile = false;
    responsiveMocks.currentTrack = responsiveMocks.tracks[0];
    responsiveMocks.isPlaying = true;

    const { container } = renderWithRouter(
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>,
      ["/search?q=artist"],
    );

    await waitFor(() => {
      expect(responsiveMocks.searchTidalReference).toHaveBeenCalled();
    });

    const currentRow = await screen.findByLabelText("Drag Track 1 to a playlist");

    expect(currentRow).toHaveAttribute("draggable", "true");
    expect(currentRow).toHaveClass("detail-track-row", "is-current");
    expect(container.querySelector(".detail-track-row.is-current")).toBe(currentRow);
  });

  it("renders tracks-tab search tracks through the shared track row and keeps the current track highlighted while paused", async () => {
    responsiveMocks.viewport.isMobile = false;
    responsiveMocks.currentTrack = responsiveMocks.tracks[1];
    responsiveMocks.isPlaying = false;

    renderWithRouter(
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>,
      ["/search?q=artist"],
    );

    await waitFor(() => {
      expect(responsiveMocks.searchTidalReference).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tracks" }));

    const currentRow = await screen.findByLabelText("Drag Track 2 to a playlist");

    expect(currentRow).toHaveAttribute("draggable", "true");
    expect(currentRow).toHaveClass("detail-track-row", "is-current");
  });

  it("renders artist detail sections as mobile shelves with the shared action rail", () => {
    const { container } = renderWithRouter(
      <Routes>
        <Route path="/artist/:id" element={<ArtistPage />} />
      </Routes>,
      ["/artist/7?name=Artist%201"],
    );

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
    expect(container.querySelector(".home-section-inline-row")).not.toBeNull();
    expect(screen.queryByLabelText(/Next Albums/i)).not.toBeInTheDocument();
  });

  it("renders artist popular tracks through the shared draggable track row", () => {
    responsiveMocks.currentTrack = responsiveMocks.tracks[0];
    responsiveMocks.isPlaying = true;

    const { container } = renderWithRouter(
      <Routes>
        <Route path="/artist/:id" element={<ArtistPage />} />
      </Routes>,
      ["/artist/7?name=Artist%201"],
    );

    const currentRow = screen.getByLabelText("Drag Track 1 to a playlist");

    expect(currentRow).toHaveAttribute("draggable", "true");
    expect(currentRow).toHaveClass("detail-track-row", "is-current");
    expect(container.querySelector(".detail-track-row.is-current")).toBe(currentRow);
  });

  it("renders the home page content on desktop", () => {
    responsiveMocks.viewport.isMobile = false;

    renderWithRouter(<Index />);

    expect(screen.getByText("For You")).toBeInTheDocument();
    expect(screen.getByText("Fresh picks, recent plays, and artists worth revisiting.")).toBeInTheDocument();
    expect(screen.getByText("Recommended Songs")).toBeInTheDocument();
  });

  it("keeps desktop artist carousels and pager controls", () => {
    responsiveMocks.viewport.isMobile = false;

    const { container } = renderWithRouter(
      <Routes>
        <Route path="/artist/:id" element={<ArtistPage />} />
      </Routes>,
      ["/artist/7?name=Artist%201"],
    );

    expect(container.querySelector(".home-section-inline-row")).toBeNull();
    expect(container.querySelector(".home-section-carousel-track")).not.toBeNull();
    expect(screen.getByLabelText(/Next Albums/i)).toBeInTheDocument();
  });
});
