import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const playerContextMocks = vi.hoisted(() => ({
  warmTrackPlayback: vi.fn(),
}));

vi.mock("@/contexts/PlayerContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/PlayerContext")>();

  return {
    ...actual,
    useOptionalPlayerWarmTrackPlayback: () => playerContextMocks.warmTrackPlayback,
  };
});

import { TrackListRow } from "@/components/detail/TrackListRow";
import type { Track } from "@/types/music";

const track: Track = {
  id: "track-1",
  title: "La Perla",
  artist: "ROSALIA",
  album: "MOTOMAMI",
  duration: 188,
  year: 2022,
  coverUrl: "/cover.jpg",
  canvasColor: "24 90% 60%",
};

describe("TrackListRow", () => {
  it("forwards refs and DOM event props to the root row", () => {
    const onContextMenu = vi.fn();
    const onPointerDown = vi.fn();
    const ref = createRef<HTMLDivElement>();

    render(
      <TrackListRow
        ref={ref}
        data-testid="track-row"
        index={0}
        isCurrent={false}
        isPlaying={false}
        middleContent={null}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPlay={vi.fn()}
        subtitle="ROSALIA"
        track={track}
      />,
    );

    const row = screen.getByTestId("track-row");
    fireEvent.contextMenu(row);
    fireEvent.pointerDown(row);

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(playerContextMocks.warmTrackPlayback).toHaveBeenCalledWith(track);
    expect(ref.current).toBe(row);
    expect(row).toHaveAttribute("data-allow-global-shortcuts", "true");
  });

  it("renders the default album column alongside desktop metadata", () => {
    render(
      <MemoryRouter>
        <TrackListRow
          index={0}
          isCurrent={false}
          isPlaying={false}
          desktopMeta="today"
          onPlay={vi.fn()}
          subtitle="ROSALIA"
          track={track}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("MOTOMAMI")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("shows unavailable rows as disabled and does not invoke play", () => {
    const onPlay = vi.fn();

    render(
      <MemoryRouter>
        <TrackListRow
          index={0}
          isCurrent={false}
          isPlaying={false}
          disabled
          onPlay={onPlay}
          track={track}
        />
      </MemoryRouter>,
    );

    const row = screen.getByRole("button", { name: /La Perla/i });
    fireEvent.click(row);

    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("allocates enough action width for double-slot controls", () => {
    render(
      <MemoryRouter>
        <TrackListRow
          index={0}
          isCurrent={false}
          isPlaying={false}
          actionSlotLayout="double"
          actionSlot={(
            <>
              <button type="button" aria-label="Queue track">+</button>
              <button type="button" aria-label="Open source">↗</button>
            </>
          )}
          onPlay={vi.fn()}
          track={track}
        />
      </MemoryRouter>,
    );

    const queueButton = screen.getByRole("button", { name: "Queue track" });
    expect(queueButton.parentElement).toHaveClass("min-w-[5.25rem]");
  });

  it("makes the row draggable when drag callbacks are provided", () => {
    const onDragHandleStart = vi.fn();

    render(
      <MemoryRouter>
        <TrackListRow
          data-testid="track-row"
          index={0}
          isCurrent={false}
          isPlaying={false}
          onDragHandleStart={onDragHandleStart}
          onPlay={vi.fn()}
          track={track}
        />
      </MemoryRouter>,
    );

    const row = screen.getByTestId("track-row");
    fireEvent.dragStart(row);

    expect(row).toHaveAttribute("draggable", "true");
    expect(onDragHandleStart).toHaveBeenCalledTimes(1);
  });

  it("uses the dynamic accent fill for the current track row", () => {
    render(
      <MemoryRouter>
        <TrackListRow
          data-testid="track-row"
          index={0}
          isCurrent
          isPlaying
          onPlay={vi.fn()}
          track={track}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("track-row")).toHaveStyle({
      backgroundColor: "hsl(var(--dynamic-accent) / 0.94)",
    });
  });
});
