import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { HomeAlbumCard, PlaylistCard, TrackCard } from "@/components/home/HomeMediaCards";
import type { HomeAlbum } from "@/hooks/useHomeFeeds";
import type { Track } from "@/types/music";

const mockPlay = vi.fn();
const mockPlayAlbum = vi.fn();
const mockWarmTrackPlayback = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      transition: _transition,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
      transition?: unknown;
    }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  },
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayerCommands: () => ({
    play: mockPlay,
    playAlbum: mockPlayAlbum,
    warmTrackPlayback: mockWarmTrackPlayback,
  }),
  usePlayerCurrentTrack: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
    websiteMode: false,
  }),
}));

vi.mock("@/hooks/useFavoritePlaylists", () => ({
  useFavoritePlaylists: () => ({
    isFavoritePlaylist: () => false,
    toggleFavoritePlaylist: vi.fn(),
  }),
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="track-context-menu">{children}</div>
  ),
}));

vi.mock("@/components/AlbumContextMenu", () => ({
  AlbumContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="album-context-menu">{children}</div>
  ),
}));

vi.mock("@/components/PlaylistContextMenu", () => ({
  PlaylistContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="playlist-context-menu">{children}</div>
  ),
}));

vi.mock("@/components/ArtistsLink", () => ({
  ArtistsLink: ({ artists }: { artists: Array<{ name: string }> }) => <div>{artists.map((artist) => artist.name).join(", ")}</div>,
}));

vi.mock("@/components/AlbumLink", () => ({
  AlbumLink: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/MediaCardShell", () => ({
  MediaCardShell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/media-card", () => ({
  MediaCardArtworkBackdrop: () => null,
}));

vi.mock("@/components/mediaCardStyles", () => ({
  MEDIA_CARD_ACTION_ICON_CLASS: "media-card-action-icon",
  MEDIA_CARD_ARTWORK_CLASS: "media-card-artwork",
  MEDIA_CARD_BODY_CLASS: "media-card-body",
  MEDIA_CARD_FAVORITE_BUTTON_CLASS: "media-card-favorite-button",
  MEDIA_CARD_META_CLASS: "media-card-meta",
  MEDIA_CARD_PLAY_BUTTON_CLASS: "media-card-play-button",
  MEDIA_CARD_TITLE_CLASS: "media-card-title",
}));

vi.mock("@/lib/motion", () => ({
  getControlHover: () => undefined,
  getControlTap: () => undefined,
  getMotionProfile: () => ({
    spring: {
      control: undefined,
    },
  }),
}));

vi.mock("@/lib/musicApi", () => ({
  filterAudioTracks: (tracks: Track[]) => tracks,
  getPlaylistWithTracks: vi.fn(),
}));

vi.mock("@/lib/musicApiTransforms", () => ({
  tidalTrackToAppTrack: vi.fn(),
}));

vi.mock("@/lib/mediaNavigation", () => ({
  buildAlbumPath: () => "/album/test",
  buildPlaylistPath: () => "/playlist/test",
}));

vi.mock("@/lib/routePreload", () => ({
  preloadRouteModule: vi.fn(),
}));

vi.mock("@/lib/trackPlayback", () => ({
  getTrackPlaybackIssue: () => null,
  isTrackPlayable: () => true,
}));

vi.mock("@/lib/trackIdentity", () => ({
  isSameTrack: () => false,
}));

const track: Track = {
  id: "track-1",
  title: "Genio Atrapado",
  artist: "Emilia",
  album: "MP3",
  duration: 204,
  coverUrl: "/cover.jpg",
  source: "tidal",
};

const album: HomeAlbum = {
  id: 1,
  title: "MP3",
  artist: "Emilia",
  artistId: 7,
  coverUrl: "/album.jpg",
  source: "tidal",
};

describe("HomeMediaCards lightweight context menus", () => {
  beforeEach(() => {
    mockPlay.mockReset();
    mockPlayAlbum.mockReset();
    mockWarmTrackPlayback.mockReset();
  });

  it("keeps the track card wrapped in its context menu when lightweight", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TrackCard
          track={track}
          tracks={[track]}
          liked={false}
          onToggleLike={vi.fn()}
          lightweight
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("track-context-menu")).toBeInTheDocument();
    expect(screen.getByText("Genio Atrapado")).toBeInTheDocument();
  });

  it("keeps the album card wrapped in its context menu when lightweight", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomeAlbumCard
          album={album}
          saved={false}
          onToggleSave={vi.fn()}
          lightweight
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("album-context-menu")).toBeInTheDocument();
    expect(screen.getByText("MP3")).toBeInTheDocument();
  });

  it("keeps the playlist card wrapped in its context menu when lightweight", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PlaylistCard
          playlistId="playlist-1"
          title="Best Of Emilia"
          coverUrl="/playlist.jpg"
          trackCount={12}
          lightweight
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("playlist-context-menu")).toBeInTheDocument();
    expect(screen.getByText("Best Of Emilia")).toBeInTheDocument();
  });
});
