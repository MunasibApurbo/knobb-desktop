import type { ButtonHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { BottomPlayer } from "@/components/BottomPlayer";
import {
  bottomPlayerPauseIconClassName,
  bottomPlayerSkipIconClassName,
  bottomPlayerTransportIconClassName,
} from "@/components/player/transportControlStyles";

const openRightPanel = vi.fn();
const setVolume = vi.fn();
const seek = vi.fn();
const toggleLike = vi.fn();
const togglePlay = vi.fn();
const next = vi.fn();
const previous = vi.fn();
const toggleShuffle = vi.fn();
const toggleRepeat = vi.fn();
const toggleFullScreen = vi.fn();
let mockTitleLineMode: "single" | "double" = "single";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMockMotionComponent = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function MockMotionComponent(
      { children, ...props },
      ref,
    ) {
      const {
        animate,
        exit,
        initial,
        layout,
        layoutId,
        transition,
        variants,
        whileHover,
        whileTap,
        ...domProps
      } = props as Record<string, unknown>;
      const layoutProps = layout === undefined ? {} : { "data-motion-layout": String(layout) };
      void animate;
      void exit;
      void initial;
      void layoutId;
      void transition;
      void variants;
      void whileHover;
      void whileTap;
      return React.createElement(tag, { ...domProps, ...layoutProps, ref }, children);
    });

  const motion = Object.assign(
    (Component: React.ComponentType<Record<string, unknown>>) =>
      React.forwardRef<HTMLElement, Record<string, unknown>>(function MockMotionWrapper(props, ref) {
        return <Component {...props} ref={ref} />;
      }),
    {
      div: createMockMotionComponent("div"),
      img: createMockMotionComponent("img"),
      p: createMockMotionComponent("p"),
      button: createMockMotionComponent("button"),
      span: createMockMotionComponent("span"),
    },
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => {
    const { allowGlobalShortcuts, whileHover, whileTap, transition, ...buttonProps } = props;
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

vi.mock("@/components/ArtistsLink", () => ({
  ArtistsLink: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({
    children,
    contentClassName,
  }: {
    children: ReactNode;
    contentClassName?: string;
  }) => (
    <div data-testid="bottom-player-track-context-menu" data-content-class={contentClassName}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ConnectDeviceDialog", () => ({
  ConnectDeviceDialog: () => <button type="button">Connect device</button>,
}));

vi.mock("@/components/PlayerSettings", () => ({
  PlayerSettings: () => <button type="button" data-testid="player-settings">Player settings</button>,
}));

vi.mock("@/components/visualizers/VisualizerSelector", () => ({
  VisualizerSelector: ({ className }: { className?: string }) => <div className={className}>Visualizer</div>,
}));

vi.mock("@/components/VolumeBar", () => ({
  VolumeBar: ({ volume, onChange }: { volume: number; onChange: (value: number) => void }) => (
    <input
      aria-label="Volume"
      type="range"
      value={volume}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  ),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    bottomPlayerStyle: "glass",
    playerButtonsLayout: "centered",
    titleLineMode: mockTitleLineMode,
    explicitBadgeVisibility: "show",
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
    allowShellAmbientMotion: false,
    websiteMode: "default",
  }),
}));

vi.mock("@/lib/motion", () => ({
  getControlHover: () => undefined,
  getControlTap: () => undefined,
  getContentSwapVariants: () => ({}),
  getMotionProfile: () => ({
    duration: { instant: 0, fast: 0, base: 0 },
    ease: { swift: "linear", smooth: "linear" },
    spring: { shell: {}, control: {} },
  }),
  getPageTitleLayoutId: () => "title-layout",
  getSharedArtworkLayoutId: () => "artwork-layout",
}));

vi.mock("@/lib/utils", () => ({
  formatDuration: (value: number) => `${value}s`,
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    currentTrack: {
      id: "track-1",
      title: "Basta Ya",
      artist: "The Marias",
      artists: [{ id: 1, name: "The Marias" }],
      artistId: 1,
      albumId: 10,
      coverUrl: "/cover.jpg",
      duration: 180,
      canvasColor: "18 80% 55%",
      explicit: false,
      audioQuality: "LOSSLESS",
    },
    isPlaying: true,
    playbackSpeed: 1,
    shuffle: false,
    repeat: "off",
    volume: 0.7,
    isLoading: false,
    togglePlay,
    next,
    previous,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    seek,
    openRightPanel,
    toggleFullScreen,
  }),
  usePlayerTimeline: () => ({
    currentTime: 24,
    duration: 180,
  }),
}));

describe("BottomPlayer", () => {
  beforeAll(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  });

  beforeEach(() => {
    openRightPanel.mockReset();
    setVolume.mockReset();
    seek.mockReset();
    toggleLike.mockReset();
    togglePlay.mockReset();
    next.mockReset();
    previous.mockReset();
    toggleShuffle.mockReset();
    toggleRepeat.mockReset();
    toggleFullScreen.mockReset();
    mockTitleLineMode = "single";
  });

  it("renders the inline player settings control", async () => {
    render(<BottomPlayer />);

    expect(await screen.findByTestId("player-settings")).toBeInTheDocument();
  });

  it("keeps the fullscreen artwork trigger keyboard accessible", () => {
    render(<BottomPlayer />);

    expect(screen.getByRole("button", { name: /open fullscreen player/i })).toBeInTheDocument();
  });

  it("wraps the now-playing cluster in a styled track context menu trigger", () => {
    render(<BottomPlayer />);

    expect(screen.getByTestId("bottom-player-track-context-menu")).toHaveAttribute(
      "data-content-class",
      expect.stringContaining("bottom-player-context-menu"),
    );
    expect(screen.getByTestId("bottom-player-context-trigger")).toBeInTheDocument();
  });

  it("keeps the desktop player shell isolated from main-content compositing", () => {
    const { container } = render(<BottomPlayer />);

    const shell = container.querySelector(".bottom-player-shell");
    expect(shell).not.toBeNull();
    expect(shell).toHaveClass("relative", "z-20", "isolate", "overflow-hidden");
    expect(shell).not.toHaveClass("h-[var(--desktop-player-height)]");
    expect(shell).not.toHaveAttribute("data-motion-layout");

    const ambientLayer = shell?.firstElementChild;
    expect(ambientLayer).not.toBeNull();
    expect(ambientLayer).toHaveClass("pointer-events-none", "absolute", "inset-0", "z-0", "overflow-hidden");
  });

  it("sizes the player body from its content instead of stretching the seek row", () => {
    const { container } = render(<BottomPlayer />);

    const body = container.querySelector(".bottom-player-shell > .relative.z-10");
    expect(body).toHaveClass("flex", "flex-col");
    expect(body).not.toHaveClass("h-full");

    const seekRow = container.querySelector('[aria-label="Seek playback position"]')?.parentElement?.parentElement;
    expect(seekRow).toHaveClass("shrink-0");
    expect(seekRow).not.toHaveClass("flex-1");
  });

  it("opens queue and lyrics panels from the bottom controls", () => {
    render(<BottomPlayer />);

    fireEvent.click(screen.getByRole("button", { name: /open queue/i }));
    fireEvent.click(screen.getByRole("button", { name: /open lyrics/i }));

    expect(openRightPanel).toHaveBeenCalledWith("queue");
    expect(openRightPanel).toHaveBeenCalledWith("lyrics");
  });

  it("renders the desktop utility controls with accessible triggers", async () => {
    render(<BottomPlayer />);

    expect(screen.getByRole("button", { name: /player settings/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect device/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /connect device/i })).toBeInTheDocument();
  });

  it("wires the bottom transport and utility controls to player actions", () => {
    render(<BottomPlayer />);

    fireEvent.click(screen.getByRole("button", { name: /enable shuffle/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous track/i }));
    fireEvent.click(screen.getByRole("button", { name: /pause playback/i }));
    fireEvent.click(screen.getByRole("button", { name: /next track/i }));
    fireEvent.click(screen.getByRole("button", { name: /enable repeat all/i }));
    fireEvent.click(screen.getByRole("button", { name: /like track/i }));
    fireEvent.click(screen.getByRole("button", { name: /mute/i }));

    expect(toggleShuffle).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(toggleRepeat).toHaveBeenCalledTimes(1);
    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(setVolume).toHaveBeenCalledWith(0);
  });

  it("uses the same transport icon family as fullscreen mode", () => {
    render(<BottomPlayer />);

    expect(screen.getByRole("button", { name: /enable shuffle/i }).querySelector("svg")).toHaveClass(
      "lucide-shuffle",
      ...bottomPlayerTransportIconClassName.split(" "),
    );
    expect(screen.getByRole("button", { name: /previous track/i }).querySelector("svg")).toHaveClass(
      "lucide-skip-back",
      ...bottomPlayerSkipIconClassName.split(" "),
    );
    expect(screen.getByRole("button", { name: /pause playback/i }).querySelector("svg")).toHaveClass(
      "lucide-pause",
      ...bottomPlayerPauseIconClassName.split(" "),
    );
    expect(screen.getByRole("button", { name: /next track/i }).querySelector("svg")).toHaveClass(
      "lucide-skip-forward",
      ...bottomPlayerSkipIconClassName.split(" "),
    );
    expect(screen.getByRole("button", { name: /enable repeat all/i }).querySelector("svg")).toHaveClass(
      "lucide-repeat",
      ...bottomPlayerTransportIconClassName.split(" "),
    );
  });

  it("updates the playback volume from the desktop slider", () => {
    render(<BottomPlayer />);

    fireEvent.change(screen.getByRole("slider", { name: /^volume$/i }), {
      target: { value: "0.35" },
    });

    expect(setVolume).toHaveBeenCalledWith(0.35);
  });

  it("opens full screen when the artwork is clicked", () => {
    const { container } = render(<BottomPlayer />);

    const artworkButton = container.querySelector(".bottom-player-artwork-container");
    expect(artworkButton).not.toBeNull();

    fireEvent.click(artworkButton as HTMLElement);

    expect(toggleFullScreen).toHaveBeenCalledTimes(1);
  });

  it("scales the like control up when track titles can wrap to two lines", () => {
    mockTitleLineMode = "double";

    render(<BottomPlayer />);

    const likeButton = screen.getByRole("button", { name: /like track/i });
    expect(likeButton).toHaveClass("h-10", "w-10");
    expect(likeButton.querySelector("svg")).toHaveClass("h-[22px]", "w-[22px]");
  });

  it("drags the seekbar to update playback position", () => {
    render(<BottomPlayer />);

    const seekbar = screen.getByRole("slider", { name: /seek playback position/i });
    Object.defineProperty(seekbar, "getBoundingClientRect", {
      value: () => ({
        left: 100,
        top: 0,
        right: 300,
        bottom: 20,
        width: 200,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(seekbar, { button: 0, clientX: 150, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(window, { clientX: 250, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 250, pointerId: 1 });

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(135);
  });

  it("trims low-priority chrome in snapped windows", () => {
    const { container } = render(<BottomPlayer shellWidthMode="half" />);

    expect(screen.queryByText("Lossless")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /player settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect device/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable shuffle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable repeat all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^volume$/i })).toBeInTheDocument();

    const grid = container.querySelector(".bottom-player-grid");
    expect(grid).toBeInTheDocument();
    expect(container.querySelector(".bottom-player-primary-cluster")).toBeNull();
  });

  it("keeps core playback controls available in the tightest snapped layout", () => {
    render(<BottomPlayer shellWidthMode="quarter" />);

    expect(screen.queryByText("Lossless")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /player settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect device/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable shuffle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable repeat all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous track/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause playback/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next track/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /^volume$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mute/i })).toBeInTheDocument();
  });
});
