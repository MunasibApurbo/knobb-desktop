import type { ButtonHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { BottomPlayer } from "@/components/BottomPlayer";

const openRightPanel = vi.fn();
const setVolume = vi.fn();
const seek = vi.fn();
const toggleLike = vi.fn();

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMockMotionComponent = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function MockMotionComponent(
      { children, ...props },
      ref,
    ) {
      const { animate, exit, initial, layout, layoutId, transition, variants, ...domProps } = props as Record<string, unknown>;
      void animate;
      void exit;
      void initial;
      void layout;
      void layoutId;
      void transition;
      void variants;
      return React.createElement(tag, { ...domProps, ref }, children);
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
    titleLineMode: "single",
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
    togglePlay: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    toggleShuffle: vi.fn(),
    toggleRepeat: vi.fn(),
    setVolume,
    seek,
    openRightPanel,
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
  });

  it("renders the inline player settings control", async () => {
    render(<BottomPlayer />);

    expect(await screen.findByTestId("player-settings")).toBeInTheDocument();
  });

  it("keeps the desktop player shell isolated from main-content compositing", () => {
    const { container } = render(<BottomPlayer />);

    const shell = container.querySelector(".bottom-player-shell");
    expect(shell).not.toBeNull();
    expect(shell).toHaveClass("relative", "z-20", "isolate", "overflow-hidden");

    const ambientLayer = shell?.firstElementChild;
    expect(ambientLayer).not.toBeNull();
    expect(ambientLayer).toHaveClass("pointer-events-none", "absolute", "inset-0", "z-0", "overflow-hidden");
  });

  it("opens queue and lyrics panels from the bottom controls", () => {
    const { container } = render(<BottomPlayer />);

    const utilityButtons = Array.from(container.querySelectorAll(".player-chrome-utility"));
    expect(utilityButtons.length).toBeGreaterThanOrEqual(2);

    utilityButtons.forEach((button) => {
      fireEvent.click(button as HTMLButtonElement);
    });

    expect(openRightPanel).toHaveBeenCalledWith("queue");
    expect(openRightPanel).toHaveBeenCalledWith("lyrics");
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

    expect(seek).toHaveBeenNthCalledWith(1, 45);
    expect(seek).toHaveBeenLastCalledWith(135);
  });
});
