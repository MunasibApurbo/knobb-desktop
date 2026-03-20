import { render, screen, waitFor } from "@testing-library/react";

import ArtistGridTrackerPage from "@/pages/ArtistGridTrackerPage";

const navigate = vi.fn();
const setSearchParams = vi.fn();
const play = vi.fn();
const togglePlay = vi.fn();
const addToQueue = vi.fn();
const toggleLike = vi.fn();
const trackContextMenuProps: Array<{ track: { isUnavailable?: boolean }; tracks?: unknown[] }> = [];

const mockTrackerResponse = {
  name: "Kendrick Lamar",
  current_tab: "Leaks",
  tabs: ["Leaks"],
  eras: {
    untitled: {
      name: "Untitled Era",
      image: "/kendrick-era.jpg",
      backgroundColor: "#101010",
      data: {
        Demos: [
          {
            name: "Leak One",
            url: "https://pillows.su/f/leak-one",
            quality: "MP3",
            type: "Demo",
            leak_date: "2024",
          },
        ],
      },
    },
  },
};

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ sheetId: "a".repeat(44) }),
  useSearchParams: () => [new URLSearchParams("artist=Kendrick%20Lamar"), setSearchParams],
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/detail/DetailActionBar", () => ({
  DETAIL_ACTION_BUTTON_CLASS: "detail-action-button",
  DetailActionBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/detail/DetailHero", () => ({
  DetailHero: ({
    title,
    body,
    meta,
    cornerAction,
  }: {
    title: string;
    body?: React.ReactNode;
    meta?: React.ReactNode;
    cornerAction?: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      {body}
      {meta}
      {cornerAction}
    </section>
  ),
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({
    track,
    tracks,
    children,
  }: {
    track: { isUnavailable?: boolean };
    tracks?: unknown[];
    children: React.ReactNode;
  }) => {
    trackContextMenuProps.push({ track, tracks });
    return <>{children}</>;
  },
}));

vi.mock("@/components/detail/TrackListRow", () => ({
  TrackListRow: ({
    title,
    subtitle,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike,
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    addToQueue,
    currentTrack: null,
    isPlaying: false,
    play,
    togglePlay,
  }),
}));

vi.mock("@/lib/colorExtractor", () => ({
  extractDominantColor: vi.fn(async () => null),
}));

vi.mock("@/lib/mediaNavigation", () => ({
  copyPlainTextToClipboard: vi.fn(async () => {}),
}));

vi.mock("@/lib/artistGridTrackColors", () => ({
  resolveArtistGridTrackCanvasColor: () => "0 0% 0%",
}));

vi.mock("@/lib/trackArtwork", () => ({
  getArtworkColorSampleUrl: (url: string) => url,
}));

vi.mock("@/lib/artistGridPlayback", () => ({
  buildArtistGridPlaybackProxyUrl: (url: string) => `/api/audio-proxy?url=${encodeURIComponent(url)}`,
  normalizeArtistGridSourceUrl: (url: string) => url.trim(),
  resolveArtistGridPlayableUrl: vi.fn(async () => null),
}));

vi.mock("@/lib/unreleasedArchiveApi", () => ({
  buildArtistGridTrackerUrl: (sheetId: string) => `https://artistgrid.cx/tracker/${sheetId}`,
  fetchArtistGridTracker: vi.fn(async () => mockTrackerResponse),
  getArtistGridSheetEditUrl: (url: string) => url,
  getArtistGridTrackCount: () => 1,
  normalizeArtistGridArtistName: (name: string) => name,
}));

vi.mock("@/components/ui/surfaceStyles", () => ({
  PANEL_SURFACE_CLASS: "panel-surface",
}));

describe("ArtistGridTrackerPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    setSearchParams.mockReset();
    play.mockReset();
    togglePlay.mockReset();
    addToQueue.mockReset();
    toggleLike.mockReset();
    trackContextMenuProps.length = 0;
  });

  it("renders tracker rows without referencing an undefined playable queue", async () => {
    render(<ArtistGridTrackerPage />);

    expect(await screen.findByText("Leak One")).toBeInTheDocument();

    await waitFor(() => {
      expect(trackContextMenuProps).toHaveLength(1);
    });

    expect(trackContextMenuProps[0]?.tracks).toEqual([]);
    expect(trackContextMenuProps[0]?.track.isUnavailable).toBe(true);
  });
});
