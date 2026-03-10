import { fireEvent, render, screen } from "@testing-library/react";

import { MobilePlayerSheet } from "@/components/mobile/MobilePlayerSheet";

const mobilePlayerSheetMocks = vi.hoisted(() => {
  const play = vi.fn();
  const removeFromQueue = vi.fn();
  const setRightPanelTab = vi.fn();

  return {
    play,
    removeFromQueue,
    setRightPanelTab,
    timeline: {
      currentTime: 32,
      duration: 250,
    },
    player: {
      currentTrack: {
        id: "track-1",
        title: "Midnight City",
        artist: "M83",
        album: "Hurry Up, We're Dreaming",
        duration: 250,
        year: 2011,
        coverUrl: "/cover-midnight-city.jpg",
        canvasColor: "210 80% 56%",
      },
      duration: 250,
      isLoading: false,
      isPlaying: true,
      next: vi.fn(),
      playbackSpeed: 1,
      play,
      previous: vi.fn(),
      queue: [
        {
          id: "track-1",
          title: "Midnight City",
          artist: "M83",
          album: "Hurry Up, We're Dreaming",
          duration: 250,
          year: 2011,
          coverUrl: "/cover-midnight-city.jpg",
          canvasColor: "210 80% 56%",
        },
        {
          id: "track-2",
          title: "Wait",
          artist: "M83",
          album: "Hurry Up, We're Dreaming",
          duration: 343,
          year: 2011,
          coverUrl: "/cover-wait.jpg",
          canvasColor: "210 76% 50%",
        },
      ],
      removeFromQueue,
      repeat: "off",
      rightPanelTab: "queue",
      seek: vi.fn(),
      setRightPanelTab,
      shuffle: false,
      togglePlay: vi.fn(),
      toggleRepeat: vi.fn(),
      toggleShuffle: vi.fn(),
    },
  };
});

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => mobilePlayerSheetMocks.player,
  usePlayerTimeline: () => mobilePlayerSheetMocks.timeline,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    lyricsSyncMode: "follow",
  }),
  useOptionalSettings: () => ({
    showScrollbar: true,
  }),
}));

vi.mock("@/components/LyricsPanel", () => ({
  LyricsPanel: () => <div>Lyrics panel</div>,
}));

vi.mock("@/components/visualizers/VisualizerSelector", () => ({
  VisualizerSelector: ({ className }: { className?: string }) => <div className={className}>Visualizer</div>,
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike: vi.fn(),
  }),
}));

describe("MobilePlayerSheet", () => {
  beforeAll(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  });

  beforeEach(() => {
    mobilePlayerSheetMocks.play.mockReset();
    mobilePlayerSheetMocks.removeFromQueue.mockReset();
    mobilePlayerSheetMocks.setRightPanelTab.mockReset();
    mobilePlayerSheetMocks.player.seek.mockReset();
    mobilePlayerSheetMocks.player.rightPanelTab = "queue";
  });

  it("switches between queue and lyrics tabs", async () => {
    const { rerender } = render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Wait")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^lyrics$/i }));
    expect(mobilePlayerSheetMocks.setRightPanelTab).toHaveBeenCalledWith("lyrics");

    mobilePlayerSheetMocks.player.rightPanelTab = "lyrics";
    rerender(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Lyrics panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^queue$/i }));
    expect(mobilePlayerSheetMocks.setRightPanelTab).toHaveBeenCalledWith("queue");
  });

  it("plays queued tracks and removes them from the queue", () => {
    render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /wait m83/i }));
    expect(mobilePlayerSheetMocks.play).toHaveBeenCalledWith(
      mobilePlayerSheetMocks.player.queue[1],
      mobilePlayerSheetMocks.player.queue,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove from queue/i }));
    expect(mobilePlayerSheetMocks.removeFromQueue).toHaveBeenCalledWith(1);
  });

  it("supports swipe switching between queue and lyrics", () => {
    render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    const pane = screen.getByTestId("mobile-player-pane");

    fireEvent.touchStart(pane, {
      changedTouches: [{ clientX: 220 }],
    });
    fireEvent.touchEnd(pane, {
      changedTouches: [{ clientX: 290 }],
    });

    expect(mobilePlayerSheetMocks.setRightPanelTab).toHaveBeenCalledWith("lyrics");
  });

  it("renders as a full-height bottom sheet", () => {
    render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("fixed");
    expect(dialog).toHaveClass("bottom-0");
    expect(dialog).toHaveClass("h-[100dvh]");
  });

  it("drags the seekbar to update playback position", () => {
    render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    const seekbar = screen.getByRole("slider", { name: /seek playback position/i });
    Object.defineProperty(seekbar, "getBoundingClientRect", {
      value: () => ({
        left: 20,
        top: 0,
        right: 220,
        bottom: 20,
        width: 200,
        height: 20,
        x: 20,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(seekbar, { button: 0, clientX: 70, pointerId: 4, pointerType: "mouse" });
    fireEvent.pointerMove(window, { clientX: 170, pointerId: 4 });
    fireEvent.pointerUp(window, { clientX: 170, pointerId: 4 });

    expect(mobilePlayerSheetMocks.player.seek).toHaveBeenNthCalledWith(1, 62.5);
    expect(mobilePlayerSheetMocks.player.seek).toHaveBeenLastCalledWith(187.5);
  });
});
