import { fireEvent, render, screen } from "@testing-library/react";

import { MobileMiniPlayer } from "@/components/mobile/MobileMiniPlayer";

const mobileMiniPlayerMocks = vi.hoisted(() => ({
  seek: vi.fn(),
  togglePlay: vi.fn(),
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
    isLoading: false,
    isPlaying: false,
    seek: vi.fn(),
    togglePlay: vi.fn(),
  },
}));

mobileMiniPlayerMocks.player.seek = mobileMiniPlayerMocks.seek;
mobileMiniPlayerMocks.player.togglePlay = mobileMiniPlayerMocks.togglePlay;

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => mobileMiniPlayerMocks.player,
  usePlayerTimeline: () => mobileMiniPlayerMocks.timeline,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    bottomPlayerStyle: "current",
    titleLineMode: "single",
  }),
}));

describe("MobileMiniPlayer", () => {
  beforeAll(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  });

  beforeEach(() => {
    mobileMiniPlayerMocks.seek.mockReset();
    mobileMiniPlayerMocks.togglePlay.mockReset();
  });

  it("opens the full player when the mini-player shell is tapped", () => {
    const onOpenPlayer = vi.fn();

    render(<MobileMiniPlayer onOpenPlayer={onOpenPlayer} onOpenTab={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /open now playing for midnight city/i }));

    expect(onOpenPlayer).toHaveBeenCalledTimes(1);
  });

  it("keeps the queue and play actions from bubbling into the open-player handler", () => {
    const onOpenPlayer = vi.fn();
    const onOpenTab = vi.fn();

    render(<MobileMiniPlayer onOpenPlayer={onOpenPlayer} onOpenTab={onOpenTab} />);

    fireEvent.click(screen.getByRole("button", { name: /open queue/i }));
    expect(onOpenTab).toHaveBeenCalledWith("queue");
    expect(onOpenPlayer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^play$/i }));
    expect(mobileMiniPlayerMocks.togglePlay).toHaveBeenCalledTimes(1);
    expect(onOpenPlayer).not.toHaveBeenCalled();
  });

  it("drags the mini-player seekbar without opening the full player", () => {
    const onOpenPlayer = vi.fn();

    render(<MobileMiniPlayer onOpenPlayer={onOpenPlayer} onOpenTab={vi.fn()} />);

    const seekbar = screen.getByRole("slider", { name: /seek playback position/i });
    Object.defineProperty(seekbar, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 16,
        width: 200,
        height: 16,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(seekbar, { clientX: 50, pointerId: 7, pointerType: "touch" });
    fireEvent.pointerMove(window, { clientX: 150, pointerId: 7 });
    fireEvent.pointerUp(window, { clientX: 150, pointerId: 7 });

    expect(mobileMiniPlayerMocks.seek).toHaveBeenNthCalledWith(1, 62.5);
    expect(mobileMiniPlayerMocks.seek).toHaveBeenLastCalledWith(187.5);
    expect(onOpenPlayer).not.toHaveBeenCalled();
  });
});
