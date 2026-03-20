import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import {
  bottomPlayerPauseIconClassName,
  bottomPlayerPlayIconClassName,
  bottomPlayerPrimaryTransportControlClassName,
  bottomPlayerSkipIconClassName,
  bottomPlayerTransportControlClassName,
  bottomPlayerTransportIconClassName,
} from "@/components/player/transportControlStyles";
import type { Track } from "@/types/music";

const navigate = vi.fn();
const toggleFullScreen = vi.fn();
const setFullScreen = vi.fn();
const togglePlay = vi.fn();
const next = vi.fn();
const previous = vi.fn();
const seek = vi.fn();
const toggleShuffle = vi.fn();
const toggleRepeat = vi.fn();
const toggleLike = vi.fn();
const openRightPanel = vi.fn();
const embedAttachHost = vi.fn();
const embedIsAttachedToHost = vi.fn(() => false);
const embedReturnToGlobalHost = vi.fn();
const sharedVideoElement = document.createElement("video");
const attachMediaElementToHost = vi.fn((host: HTMLElement) => {
  host.appendChild(sharedVideoElement);
});
const isMediaElementAttachedToHost = vi.fn((host: HTMLElement) => sharedVideoElement.parentElement === host);
const returnMediaElementToGlobalHost = vi.fn();
let mockLyricsAvailability: "available" | "empty" = "available";
let mockShowFullScreenLyrics = true;
let mockFullScreenBackgroundBlur = 100;
let mockFullScreenBackgroundDarkness = 58;
let mockPlaybackMode: "native" | "youtube-embed" = "native";
let mockAllowHeavyBlur = false;
let mockIsPlaying = true;
let mockRepeatMode: "off" | "all" | "one" = "off";
let latestTrackOptionsMenuProps: Record<string, unknown> | null = null;
let mockCurrentTrack: Track = {
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
let mockQueue: Track[] = [
  {
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
  },
  {
    id: "track-2",
    title: "Eat Me",
    artist: "Demi Lovato, Royal & the Serpent",
    album: "Holy Fvck",
    artists: [
      { id: 3544816, name: "Demi Lovato" },
      { id: 999, name: "Royal & the Serpent" },
    ],
    artistId: 3544816,
    coverUrl: "/cover-2.jpg",
    duration: 190,
    year: 2022,
    canvasColor: "0 0% 0%",
    source: "tidal",
    isVideo: false,
  },
  {
    id: "track-3",
    title: "29",
    artist: "Demi Lovato",
    album: "Holy Fvck",
    artists: [{ id: 3544816, name: "Demi Lovato" }],
    artistId: 3544816,
    coverUrl: "/cover-3.jpg",
    duration: 175,
    year: 2022,
    canvasColor: "0 0% 0%",
    source: "tidal",
    isVideo: false,
  },
];
let latestLyricsPanelProps: Record<string, unknown> | null = null;

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMockMotionComponent = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function MockMotionComponent(
      { children, ...props },
      ref,
    ) {
      const { animate, exit, initial, layoutId, transition, ...domProps } = props as Record<string, unknown>;
      void animate;
      void exit;
      void initial;
      void layoutId;
      void transition;
      return React.createElement(tag, { ...domProps, ref }, children);
    });

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: {
      div: createMockMotionComponent("div"),
      img: createMockMotionComponent("img"),
    },
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => {
    const { variant, size, asChild, allowGlobalShortcuts, whileHover, whileTap, transition, ...buttonProps } = props;
    void variant;
    void size;
    void asChild;
    void allowGlobalShortcuts;
    void whileHover;
    void whileTap;
    void transition;
    return (
      <button type="button" {...buttonProps}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/LyricsPanel", () => ({
  LyricsPanel: (props: {
    hideEmptyState?: boolean;
    onAvailabilityChange?: (state: "loading" | "available" | "empty") => void;
    density?: string;
    variant?: string;
  }) => {
    const { hideEmptyState, onAvailabilityChange } = props;
    latestLyricsPanelProps = props;

    useEffect(() => {
      onAvailabilityChange?.(mockLyricsAvailability);
    }, [onAvailabilityChange]);

    if (mockLyricsAvailability === "empty" && hideEmptyState) {
      return null;
    }

    return <div>{mockLyricsAvailability === "empty" ? "No lyrics found." : "Lyrics"}</div>;
  },
}));

vi.mock("@/components/player/PlayerSeekRow", () => ({
  PlayerSeekRow: () => <div>Seek row</div>,
}));

vi.mock("@/components/ConnectDeviceDialog", () => ({
  ConnectDeviceDialog: () => <button type="button">Connect device</button>,
}));

vi.mock("@/components/TrackOptionsMenu", () => ({
  TrackOptionsMenu: (props: Record<string, unknown>) => {
    latestTrackOptionsMenuProps = props;
    return <button type="button">Track options</button>;
  },
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    currentTrack: mockCurrentTrack,
    playbackMode: mockPlaybackMode,
    isPlaying: mockIsPlaying,
    togglePlay,
    next,
    previous,
    seek,
    isFullScreen: true,
    toggleFullScreen,
    setFullScreen,
    shuffle: false,
    toggleShuffle,
    repeat: mockRepeatMode,
    toggleRepeat,
    playbackSpeed: 1,
    openRightPanel,
    queue: mockQueue,
  }),
  usePlayerTimeline: () => ({
    currentTime: 32,
    duration: 180,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    lyricsSyncMode: "follow",
    showFullScreenLyrics: mockShowFullScreenLyrics,
    fullScreenBackgroundBlur: mockFullScreenBackgroundBlur,
    fullScreenBackgroundDarkness: mockFullScreenBackgroundDarkness,
  }),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike,
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    allowHeavyBlur: mockAllowHeavyBlur,
    preferLightweightMotion: true,
    motionEnabled: false,
    websiteMode: "default",
  }),
}));

vi.mock("@/lib/motion", () => ({
  getMotionProfile: () => ({
    duration: { instant: 0, fast: 0, base: 0 },
    ease: { swift: "linear", smooth: "linear" },
    spring: { shell: {}, control: {} },
  }),
}));

vi.mock("@/lib/trackArtwork", () => ({
  getTrackArtworkUrl: () => "/cover.jpg",
}));

vi.mock("@/lib/lyricsPanelData", () => ({
  loadLyricsForTrack: vi.fn(async () => (
    mockLyricsAvailability === "empty"
      ? null
      : {
          lines: [
            { timeMs: 0, text: "Turn the light down low" },
            { timeMs: 20000, text: "Stay with me a little longer" },
          ],
          lyricsProvider: "Mock Lyrics",
          isSynced: true,
        }
  )),
  resolveLyricsArtistLabel: (track: Track) => track.artist,
}));

vi.mock("@/lib/audioEngine", () => ({
  getAudioEngine: () => ({
    getMediaElement: () => sharedVideoElement,
    attachMediaElementToHost,
    isMediaElementAttachedToHost,
    returnMediaElementToGlobalHost,
  }),
}));

vi.mock("@/lib/videoPlaybackPreferences", () => ({
  getVideoFramePreference: () => "poster",
}));

vi.mock("@/lib/youtubeEmbedManager", () => ({
  getYoutubeEmbedManager: () => ({
    attachHost: embedAttachHost,
    isAttachedToHost: embedIsAttachedToHost,
    returnToGlobalHost: embedReturnToGlobalHost,
  }),
}));

describe("FullScreenPlayer", () => {
  beforeAll(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  });

  beforeEach(() => {
    mockLyricsAvailability = "available";
    mockShowFullScreenLyrics = true;
    mockFullScreenBackgroundBlur = 100;
    mockFullScreenBackgroundDarkness = 58;
    mockPlaybackMode = "native";
    mockAllowHeavyBlur = false;
    mockIsPlaying = true;
    mockRepeatMode = "off";
    latestTrackOptionsMenuProps = null;
    mockCurrentTrack = {
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
    mockQueue = [
      mockCurrentTrack,
      {
        id: "track-2",
        title: "Eat Me",
        artist: "Demi Lovato, Royal & the Serpent",
        album: "Holy Fvck",
        artists: [
          { id: 3544816, name: "Demi Lovato" },
          { id: 999, name: "Royal & the Serpent" },
        ],
        artistId: 3544816,
        coverUrl: "/cover-2.jpg",
        duration: 190,
        year: 2022,
        canvasColor: "0 0% 0%",
        source: "tidal",
        isVideo: false,
      },
      {
        id: "track-3",
        title: "29",
        artist: "Demi Lovato",
        album: "Holy Fvck",
        artists: [{ id: 3544816, name: "Demi Lovato" }],
        artistId: 3544816,
        coverUrl: "/cover-3.jpg",
        duration: 175,
        year: 2022,
        canvasColor: "0 0% 0%",
        source: "tidal",
        isVideo: false,
      },
    ];
    latestLyricsPanelProps = null;
    navigate.mockReset();
    toggleFullScreen.mockReset();
    setFullScreen.mockReset();
    togglePlay.mockReset();
    next.mockReset();
    previous.mockReset();
    seek.mockReset();
    toggleShuffle.mockReset();
    toggleRepeat.mockReset();
    toggleLike.mockReset();
    openRightPanel.mockReset();
    embedAttachHost.mockReset();
    embedIsAttachedToHost.mockReset();
    embedReturnToGlobalHost.mockReset();
    attachMediaElementToHost.mockClear();
    isMediaElementAttachedToHost.mockClear();
    returnMediaElementToGlobalHost.mockClear();
    sharedVideoElement.className = "";
    sharedVideoElement.remove();
  });

  it("closes the full-screen player before navigating to the artist page", () => {
    render(<FullScreenPlayer />);

    fireEvent.click(screen.getByText("Demi Lovato"));

    expect(toggleFullScreen).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/artist/3544816?name=Demi+Lovato");
  });
  it("closes full-screen mode from the close button", () => {
    render(<FullScreenPlayer />);

    fireEvent.click(screen.getByLabelText("Close full screen"));

    expect(setFullScreen).toHaveBeenCalledWith(false);
  });
  it("renders a dedicated primary pause button and toggles playback", () => {
    render(<FullScreenPlayer />);

    const button = screen.getByRole("button", { name: "Pause playback" });
    expect(button).toHaveClass(...bottomPlayerPrimaryTransportControlClassName.split(" "));

    fireEvent.click(button);

    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it("matches the fullscreen transport strip to the bottom player control style", () => {
    mockRepeatMode = "one";

    const { rerender } = render(<FullScreenPlayer />);

    const shuffleButton = screen.getByRole("button", { name: "Enable shuffle" });
    const previousButton = screen.getByRole("button", { name: "Previous track" });
    const pauseButton = screen.getByRole("button", { name: "Pause playback" });
    const nextButton = screen.getByRole("button", { name: "Next track" });
    const repeatButton = screen.getByRole("button", { name: "Disable repeat" });

    expect(shuffleButton).toHaveClass(...bottomPlayerTransportControlClassName.split(" "));
    expect(previousButton).toHaveClass(...bottomPlayerTransportControlClassName.split(" "));
    expect(nextButton).toHaveClass(...bottomPlayerTransportControlClassName.split(" "));
    expect(repeatButton).toHaveClass(...bottomPlayerTransportControlClassName.split(" "));
    expect(shuffleButton).toHaveClass("fullscreen-player-control");
    expect(previousButton).toHaveClass("fullscreen-player-control");
    expect(nextButton).toHaveClass("fullscreen-player-control");
    expect(repeatButton).toHaveClass("fullscreen-player-control");
    expect(shuffleButton.querySelector("svg")).toHaveClass(...bottomPlayerTransportIconClassName.split(" "));
    expect(previousButton.querySelector("svg")).toHaveClass(...bottomPlayerSkipIconClassName.split(" "));
    expect(pauseButton.querySelector("svg")).toHaveClass(...bottomPlayerPauseIconClassName.split(" "));
    expect(nextButton.querySelector("svg")).toHaveClass(...bottomPlayerSkipIconClassName.split(" "));
    expect(repeatButton.querySelector("svg")).toHaveClass(...bottomPlayerTransportIconClassName.split(" "));

    mockIsPlaying = false;
    mockRepeatMode = "off";
    rerender(<FullScreenPlayer />);

    expect(screen.getByRole("button", { name: "Resume playback" }).querySelector("svg")).toHaveClass(
      ...bottomPlayerPlayIconClassName.split(" "),
    );
    expect(screen.getByRole("button", { name: "Add to liked songs" })).toHaveClass("player-chrome-utility", "fullscreen-player-utility");
  });

  it("closes full-screen mode when Escape is pressed", () => {
    render(<FullScreenPlayer />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(setFullScreen).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Close full screen")).toHaveAttribute("title", "Close full screen (Esc)");
  });

  it("hides the empty lyrics state when no lyrics are available", () => {
    mockLyricsAvailability = "empty";

    render(<FullScreenPlayer />);

    expect(screen.queryByText("No lyrics found.")).not.toBeInTheDocument();
  });

  it("uses a center-divided split layout for audio tracks when lyrics are visible", () => {
    render(<FullScreenPlayer />);

    expect(screen.getByTestId("fullscreen-layout-shell")).toHaveClass("grid", "grid-cols-2", "items-center");
    expect(screen.getByTestId("fullscreen-media-column")).toHaveClass("items-end", "justify-center", "px-0");
    expect(screen.getByTestId("fullscreen-lyrics-column")).toHaveClass("items-start", "justify-center");
  });

  it("centers the media layout when full-screen lyrics are disabled in settings", () => {
    mockShowFullScreenLyrics = false;

    render(<FullScreenPlayer />);

    expect(screen.queryByText("Lyrics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fullscreen-lyrics-column")).not.toBeInTheDocument();
    expect(screen.getByTestId("fullscreen-media-column")).toHaveClass("px-0");
  });

  it("restores the artwork blur overlay when heavy blur is allowed", () => {
    mockAllowHeavyBlur = true;

    const { container } = render(<FullScreenPlayer />);
    const shell = container.firstElementChild as HTMLDivElement;

    expect(shell.style.backdropFilter).toBe("blur(32px)");
    expect(shell.style.backgroundColor).toBe("rgba(0, 0, 0, 0.58)");
  });

  it("updates fullscreen background blur and darkness from settings", () => {
    mockAllowHeavyBlur = true;
    mockFullScreenBackgroundBlur = 40;
    mockFullScreenBackgroundDarkness = 22;

    const { container } = render(<FullScreenPlayer />);
    const shell = container.firstElementChild as HTMLDivElement;

    expect(shell.style.backdropFilter).toBe("blur(12.8px)");
    expect(shell.style.backgroundColor).toBe("rgba(0, 0, 0, 0.22)");
  });

  it("softens lyric clipping with a viewport fade mask for regular tracks", () => {
    render(<FullScreenPlayer />);

    expect((screen.getByTestId("fullscreen-lyrics-viewport") as HTMLDivElement).style.maskImage).toContain("linear-gradient");
  });

  it("uses the dedicated video lyrics panel styling for music videos", () => {
    mockCurrentTrack = {
      ...mockCurrentTrack,
      id: "video-1",
      sourceId: "video-1",
      isVideo: true,
    };

    render(<FullScreenPlayer />);

    expect(screen.getByTestId("fullscreen-lyrics-column")).toBeInTheDocument();
    expect((screen.getByTestId("fullscreen-lyrics-viewport") as HTMLDivElement).style.maskImage).toContain("linear-gradient");
    expect(latestLyricsPanelProps).toMatchObject({
      density: "compact",
    });
  });

  it("attaches the YouTube embed host for fullscreen embedded videos", () => {
    mockPlaybackMode = "youtube-embed";
    embedIsAttachedToHost.mockReturnValue(true);
    mockCurrentTrack = {
      ...mockCurrentTrack,
      id: "video-1",
      source: "youtube-music",
      sourceId: "video-1",
      isVideo: true,
    };

    const { unmount } = render(<FullScreenPlayer />);

    expect(embedAttachHost).toHaveBeenCalledTimes(1);
    expect(embedAttachHost.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);

    unmount();

    expect(embedReturnToGlobalHost).toHaveBeenCalledTimes(1);
  });

  it("shows the fullscreen YouTube embed surface for YT tracks even when they are not flagged as native video", () => {
    mockPlaybackMode = "youtube-embed";
    embedIsAttachedToHost.mockReturnValue(true);
    mockCurrentTrack = {
      ...mockCurrentTrack,
      id: "yt-audio-1",
      source: "youtube-music",
      sourceId: "yt-audio-1",
      isVideo: false,
    };

    const { getByTestId } = render(<FullScreenPlayer />);
    const fullscreenHost = getByTestId("fullscreen-media-column").querySelector(".h-full.w-full.bg-black");

    expect(embedAttachHost).toHaveBeenCalledTimes(1);
    expect(fullscreenHost).not.toHaveClass("hidden");
    expect(screen.queryByAltText(mockCurrentTrack.title)).not.toBeInTheDocument();
  });

  it("does not return the native video to the global host after another surface reattaches it", () => {
    mockCurrentTrack = {
      ...mockCurrentTrack,
      id: "video-1",
      sourceId: "video-1",
      isVideo: true,
    };

    const { unmount, getByTestId } = render(<FullScreenPlayer />);
    const fullscreenHost = getByTestId("fullscreen-media-column").querySelector(".bg-black");

    expect(fullscreenHost?.querySelector("video")).toBe(sharedVideoElement);

    const sidebarHost = document.createElement("div");
    sidebarHost.appendChild(sharedVideoElement);

    unmount();

    expect(returnMediaElementToGlobalHost).not.toHaveBeenCalled();
  });

  it("keeps the fullscreen video host non-interactive while reusing the active media element", () => {
    mockCurrentTrack = {
      ...mockCurrentTrack,
      id: "video-1",
      sourceId: "video-1",
      isVideo: true,
    };

    const { getByTestId } = render(<FullScreenPlayer />);
    const fullscreenHost = getByTestId("fullscreen-media-column").querySelector(".pointer-events-none.h-full.w-full.bg-black");

    expect(fullscreenHost?.querySelector("video")).toBe(sharedVideoElement);
    expect(sharedVideoElement).toHaveClass("pointer-events-none", "h-full", "w-full", "object-contain");
  });
});
