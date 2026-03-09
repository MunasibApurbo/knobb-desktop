import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlaylistShareDropdownButton } from "@/components/PlaylistShareDropdownButton";
import { TrackOptionsMenu } from "@/components/TrackOptionsMenu";
import type { Track } from "@/types/music";

const shareMenuMocks = vi.hoisted(() => ({
  auth: { user: { id: "user-1" } },
  player: {
    addToQueue: vi.fn(),
    play: vi.fn(),
    startTrackMix: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => shareMenuMocks.auth,
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike: vi.fn(),
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => shareMenuMocks.player,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    downloadFormat: "high",
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" data-disabled={disabled ? "" : undefined} disabled={disabled} onClick={onClick}>
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

vi.mock("@/components/TrackEmbedDialog", () => ({
  TrackEmbedDialog: () => null,
}));

vi.mock("@/components/PlaylistEmbedDialog", () => ({
  PlaylistEmbedDialog: () => null,
}));

const track: Track = {
  id: "tidal-123",
  tidalId: 123,
  albumId: 456,
  artistId: 789,
  title: "Levitating",
  artist: "Dua Lipa",
  album: "Future Nostalgia",
  duration: 203,
  year: 2020,
  coverUrl: "/levitating.jpg",
  canvasColor: "210 48% 40%",
};

describe("share menus", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it("copies the track embed link from the track share action", async () => {
    render(
      <MemoryRouter>
        <TrackOptionsMenu track={track} tracks={[track]} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://knobb.netlify.app/track/tidal-123?title=Levitating&artist=Dua+Lipa&album=Future+Nostalgia&cover=%2Flevitating.jpg&redirect=%2Fembed%2Ftrack%2Ftidal-123",
    );
    expect(screen.queryByText("Copy song link")).not.toBeInTheDocument();
    expect(screen.queryByText("Embed track")).not.toBeInTheDocument();
  });

  it("falls back to the track route for local tracks", async () => {
    render(
      <MemoryRouter>
        <TrackOptionsMenu
          track={{ ...track, id: "local-1", tidalId: undefined, localFileId: "local-1" }}
          tracks={[track]}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://knobb.netlify.app/track/local-local-1?title=Levitating&artist=Dua+Lipa&album=Future+Nostalgia&cover=%2Flevitating.jpg&redirect=%2Falbum%2Ftidal-456%3Ftitle%3DFuture%2BNostalgia%26artist%3DDua%2BLipa%26trackId%3Dlocal-local-1",
    );
  });

  it("copies the playlist link when the playlist share button is clicked", async () => {
    render(
      <MemoryRouter>
        <PlaylistShareDropdownButton
          title="Night Drive"
          kind="tidal"
          playlistId="playlist-1"
          visibility="public"
          className="share-button"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://knobb.netlify.app/playlist/playlist-1");
  });

  it("disables the playlist share button when no share url can be built", async () => {
    render(
      <MemoryRouter>
        <PlaylistShareDropdownButton
          title="Night Drive"
          kind="user"
          visibility="shared"
          className="share-button"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("copies a shared playlist link when a share token exists", async () => {
    render(
      <MemoryRouter>
        <PlaylistShareDropdownButton
          title="Night Drive"
          kind="user"
          playlistId="playlist-1"
          shareToken="token-1"
          visibility="shared"
          className="share-button"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://knobb.netlify.app/shared-playlist/token-1");
  });
});
