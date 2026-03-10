import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ProfileStatsSection } from "@/components/profile/ProfileStatsSection";

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("ProfileStatsSection mobile layout", () => {
  it("keeps the stats content inside a mobile panel with stacked overview cards", () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileStatsSection
          range="30d"
          stats={{
            totalCountedPlays: 42,
            totalMinutes: 210,
            peakHour: 18,
            hourCounts: Array.from({ length: 24 }, (_value, index) => (index === 18 ? 9 : 1)),
            topArtists: [
              { artist: "Bonobo", listenedSeconds: 7200 },
              { artist: "Kiasmos", listenedSeconds: 5100 },
            ],
            topTracks: [
              {
                track: {
                  id: "track-1",
                  title: "Kerala",
                  artist: "Bonobo",
                  artistId: 1,
                  album: "Migration",
                  albumId: 11,
                  coverUrl: "/kerala.jpg",
                  duration: 220,
                  year: 2017,
                  canvasColor: "180 80% 60%",
                },
                listenedSeconds: 3600,
                playCount: 1,
              },
            ],
          }}
          maxHour={9}
          artistImages={{ Bonobo: "/bonobo.jpg" }}
          onRangeChange={vi.fn()}
          onArtistSelect={vi.fn()}
          onTrackSelect={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector(".mobile-page-panel")).not.toBeNull();
    expect(screen.getByText("Listening Stats")).toBeInTheDocument();
    expect(screen.getByText("Counted Plays")).toBeInTheDocument();
    expect(screen.getByText("Top Artists")).toBeInTheDocument();
    expect(screen.getByText("Top Tracks")).toBeInTheDocument();
  });
});
