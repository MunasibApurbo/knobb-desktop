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
    player: {
      currentTime: 32,
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

describe("MobilePlayerSheet", () => {
  beforeEach(() => {
    mobilePlayerSheetMocks.play.mockReset();
    mobilePlayerSheetMocks.removeFromQueue.mockReset();
    mobilePlayerSheetMocks.setRightPanelTab.mockReset();
    mobilePlayerSheetMocks.player.rightPanelTab = "queue";
  });

  it("switches between queue and lyrics tabs", async () => {
    const { rerender } = render(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Wait")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /lyrics/i }));
    expect(mobilePlayerSheetMocks.setRightPanelTab).toHaveBeenCalledWith("lyrics");

    mobilePlayerSheetMocks.player.rightPanelTab = "lyrics";
    rerender(<MobilePlayerSheet open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Lyrics panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /queue/i }));
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
});
