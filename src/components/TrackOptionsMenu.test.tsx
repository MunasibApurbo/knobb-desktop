import type { ButtonHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { TrackOptionsMenu } from "@/components/TrackOptionsMenu";
import type { Track } from "@/types/music";

const navigate = vi.fn();
const play = vi.fn();
const startTrackMix = vi.fn();
const addToQueue = vi.fn();
const toggleLike = vi.fn();
const onConnectDevice = vi.fn();
const onShareTrack = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/CreditsDialog", () => ({
  CreditsDialog: () => null,
}));

vi.mock("@/components/TrackPlaylistDialog", () => ({
  TrackPlaylistDialog: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
  }),
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
    play,
    startTrackMix,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    downloadFormat: "mp3",
  }),
}));

vi.mock("@/lib/downloadHelpers", () => ({
  downloadTrack: vi.fn(),
}));

vi.mock("@/lib/mediaNavigation", () => ({
  buildArtistPath: vi.fn(() => "/artist/1?name=Artist"),
  buildTrackMixPath: vi.fn(() => "/mix/track-1"),
  buildTrackShareUrl: vi.fn(() => "https://example.com/track/track-1"),
  copyPlainTextToClipboard: vi.fn(),
  navigateToTrackAlbum: vi.fn(),
}));

vi.mock("@/lib/trackMix", () => ({
  getTrackMixId: vi.fn(() => "mix-track-1"),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const track: Track = {
  id: "track-1",
  title: "Here All Night",
  artist: "Demi Lovato",
  album: "Holy Fvck",
  artists: [{ id: 3544816, name: "Demi Lovato" }],
  artistId: 3544816,
  coverUrl: "/cover.jpg",
  duration: 180,
  year: 2022,
  canvasColor: "0 0% 0%",
  source: "tidal",
  isVideo: false,
};

describe("TrackOptionsMenu", () => {
  beforeEach(() => {
    navigate.mockReset();
    play.mockReset();
    startTrackMix.mockReset();
    addToQueue.mockReset();
    toggleLike.mockReset();
    onConnectDevice.mockReset();
    onShareTrack.mockReset();
  });

  it("renders connect and share actions in the overflow menu when fullscreen handlers are provided", () => {
    render(
      <TrackOptionsMenu
        track={track}
        onConnectDevice={onConnectDevice}
        onShareTrack={onShareTrack}
        shareLabel="Share track"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect to a device/i }));
    fireEvent.click(screen.getByRole("button", { name: /Share track/i }));

    expect(onConnectDevice).toHaveBeenCalledTimes(1);
    expect(onShareTrack).toHaveBeenCalledTimes(1);
  });
});
