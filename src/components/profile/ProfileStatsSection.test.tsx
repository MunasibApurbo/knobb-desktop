import { fireEvent, render, screen } from "@testing-library/react";

import { ProfileStatsSection } from "@/components/profile/ProfileStatsSection";
import type { ListeningStats } from "@/lib/listeningIntelligence";

vi.mock("@/components/ArtistLink", () => ({
  ArtistLink: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const emptyStats: ListeningStats = {
  totalMinutes: 0,
  totalCountedPlays: 0,
  topArtists: [],
  topTracks: [],
  peakHour: 0,
  hourCounts: new Array(24).fill(0),
};

describe("ProfileStatsSection", () => {
  it("shows a friendly empty state before any listening data exists", () => {
    render(
      <ProfileStatsSection
        range="30d"
        stats={emptyStats}
        maxHour={1}
        artistImages={{}}
        onRangeChange={vi.fn()}
        onArtistSelect={vi.fn()}
        onTrackSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("No listening stats yet")).toBeInTheDocument();
    expect(screen.getByText(/Start playing a few songs/i)).toBeInTheDocument();
    expect(screen.queryByText("Activity by Hour")).not.toBeInTheDocument();
  });

  it("keeps the range controls interactive in the empty state", () => {
    const onRangeChange = vi.fn();

    render(
      <ProfileStatsSection
        range="30d"
        stats={emptyStats}
        maxHour={1}
        artistImages={{}}
        onRangeChange={onRangeChange}
        onArtistSelect={vi.fn()}
        onTrackSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "7D" }));

    expect(onRangeChange).toHaveBeenCalledWith("7d");
  });
});
