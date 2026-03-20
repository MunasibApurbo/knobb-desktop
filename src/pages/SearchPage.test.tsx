import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { Track } from "@/types/music";
import SearchPage from "@/pages/SearchPage";

const searchPageMocks = vi.hoisted(() => {
  type SettingsState = {
    librarySource: "tidal" | "youtube-music";
  };

  const listeners = new Set<() => void>();
  let settingsState: SettingsState = {
    librarySource: "tidal",
  };

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const tidalTrack: Track = {
    id: "tidal-track-1",
    title: "Tidal Song",
    artist: "Tidal Artist",
    album: "Tidal Album",
    duration: 201,
    year: 2024,
    coverUrl: "/tidal-song.jpg",
    canvasColor: "210 70% 50%",
    source: "tidal",
  };

  const youtubeTrack: Track = {
    id: "ytm-track-1",
    sourceId: "ytm-track-1",
    title: "YT Song",
    artist: "YT Artist",
    album: "YT Album",
    duration: 190,
    year: 2024,
    coverUrl: "/yt-song.jpg",
    canvasColor: "160 70% 45%",
    source: "youtube-music",
  };

  const createTidalResults = () => ({
    topResult: null,
    rankedResults: [],
    tracks: [tidalTrack],
    videos: [],
    artists: [{
      id: 1001,
      name: "Tidal Artist",
      imageUrl: "/tidal-artist.jpg",
      source: "tidal" as const,
    }],
    albums: [],
    playlists: [],
  });

  const createYoutubeResults = () => ({
    topResult: null,
    rankedResults: [],
    tracks: [youtubeTrack],
    videos: [],
    artists: [],
    albums: [],
    playlists: [],
  });

  return {
    player: {
      currentTrack: null as Track | null,
      isPlaying: false,
      play: vi.fn(),
      togglePlay: vi.fn(),
      warmTrackPlayback: vi.fn(),
      playArtist: vi.fn(),
    },
    favoriteArtists: {
      isFavorite: vi.fn(() => false),
      toggleFavorite: vi.fn(async () => true),
    },
    auth: {
      user: null,
    },
    tidalSearch: vi.fn(async () => createTidalResults()),
    youtubeSearch: vi.fn(async () => createYoutubeResults()),
    createTidalResults,
    createYoutubeResults,
    settingsStore: {
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot() {
        return settingsState;
      },
      setLibrarySource(source: "tidal" | "youtube-music") {
        if (settingsState.librarySource === source) return;
        settingsState = { librarySource: source };
        emit();
      },
      reset() {
        settingsState = { librarySource: "tidal" };
        listeners.clear();
      },
    },
  };
});

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => searchPageMocks.player,
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => searchPageMocks.favoriteArtists,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => searchPageMocks.auth,
}));

vi.mock("@/contexts/SettingsContext", async () => {
  const React = await import("react");

  return {
    useSettings: () => {
      const snapshot = React.useSyncExternalStore(
        searchPageMocks.settingsStore.subscribe,
        searchPageMocks.settingsStore.getSnapshot,
        searchPageMocks.settingsStore.getSnapshot,
      );

      return {
        ...snapshot,
        setLibrarySource: searchPageMocks.settingsStore.setLibrarySource,
      };
    },
  };
});

vi.mock("@/hooks/useResolvedArtistImage", () => ({
  useResolvedArtistImage: (_artistId: number | undefined, imageUrl?: string) => imageUrl,
}));

vi.mock("@/lib/tidalReferenceSearch", () => ({
  searchTidalReference: (...args: unknown[]) => searchPageMocks.tidalSearch(...args),
}));

vi.mock("@/lib/youtubeMusicApi", () => ({
  searchYoutubeMusicReference: (...args: unknown[]) => searchPageMocks.youtubeSearch(...args),
}));

vi.mock("@/lib/musicApi", () => ({
  warmArtistPageData: vi.fn(),
}));

vi.mock("@/lib/playlistDrag", () => ({
  startPlaylistDrag: vi.fn(),
}));

vi.mock("@/lib/trackIdentity", () => ({
  isSameTrack: vi.fn(() => false),
}));

vi.mock("@/lib/mediaNavigation", () => ({
  buildAlbumPath: vi.fn(() => "/album/test"),
  buildArtistPath: vi.fn(() => "/artist/test"),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/detail/TrackListRow", () => ({
  TrackListRow: ({ track, onPlay }: { track: Track; onPlay?: () => void }) => (
    <button type="button" onClick={onPlay}>
      {track.title}
    </button>
  ),
}));

vi.mock("@/components/AlbumContextMenu", () => ({
  AlbumContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/PlaylistContextMenu", () => ({
  PlaylistContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ArtistsLink", () => ({
  ArtistsLink: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/PlaylistLink", () => ({
  PlaylistLink: ({ title }: { title: string }) => <span>{title}</span>,
}));

function renderSearchPage(initialEntry = "/search?q=girl") {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SearchPage source tabs", () => {
  beforeEach(() => {
    searchPageMocks.settingsStore.reset();
    searchPageMocks.player.currentTrack = null;
    searchPageMocks.player.isPlaying = false;
    searchPageMocks.player.play.mockReset();
    searchPageMocks.player.togglePlay.mockReset();
    searchPageMocks.player.warmTrackPlayback.mockReset();
    searchPageMocks.player.playArtist.mockReset();
    searchPageMocks.favoriteArtists.isFavorite.mockClear();
    searchPageMocks.favoriteArtists.toggleFavorite.mockClear();
    searchPageMocks.tidalSearch.mockReset();
    searchPageMocks.tidalSearch.mockImplementation(async () => searchPageMocks.createTidalResults());
    searchPageMocks.youtubeSearch.mockReset();
    searchPageMocks.youtubeSearch.mockImplementation(async () => searchPageMocks.createYoutubeResults());
  });

  it("restores the last TIDAL tab after toggling to YouTube Music and back", async () => {
    renderSearchPage();

    await waitFor(() => {
      expect(screen.getByText("Tidal Artist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "YT Music" }));

    await waitFor(() => {
      expect(screen.getByText("YT Song")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "TIDAL" }));

    await waitFor(() => {
      expect(screen.getByText("Tidal Artist")).toBeInTheDocument();
    });
  });

  it("switches the visible source immediately when YT Music is selected", async () => {
    searchPageMocks.youtubeSearch.mockImplementation(() => new Promise(() => {}));

    renderSearchPage();

    await waitFor(() => {
      expect(screen.getByText("Tidal Artist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "YT Music" }));

    expect(screen.getByRole("tab", { name: "YT Music" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Searching...")).toBeInTheDocument();
    expect(screen.getByText(/Playback note:/i)).toBeInTheDocument();
  });

  it("resumes the current search track instead of reloading it", async () => {
    const { isSameTrack } = await import("@/lib/trackIdentity");
    vi.mocked(isSameTrack).mockImplementation((currentTrack, track) => (
      String(currentTrack?.id) === String(track?.id)
    ));

    searchPageMocks.player.currentTrack = {
      id: "ytm-track-1",
      sourceId: "ytm-track-1",
      title: "YT Song",
      artist: "YT Artist",
      album: "YT Album",
      duration: 190,
      year: 2024,
      coverUrl: "/yt-song.jpg",
      canvasColor: "160 70% 45%",
      source: "youtube-music",
    };
    searchPageMocks.player.isPlaying = false;

    renderSearchPage();

    await waitFor(() => {
      expect(screen.getByText("Tidal Artist")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "YT Music" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "YT Song" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "YT Song" }));

    expect(searchPageMocks.player.togglePlay).toHaveBeenCalledTimes(1);
    expect(searchPageMocks.player.play).not.toHaveBeenCalled();
  });
});
