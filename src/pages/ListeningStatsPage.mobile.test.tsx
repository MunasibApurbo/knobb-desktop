import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ListeningStatsPage from "@/pages/ListeningStatsPage";

const listeningStatsMocks = vi.hoisted(() => ({
  getHistory: vi.fn(async () => [
    {
      id: "history-1",
      playedAt: "2026-03-08T10:00:00.000Z",
      completed: true,
      trackId: "track-1",
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
  ]),
  play: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    scrobblePercent: "50",
  }),
}));

vi.mock("@/hooks/usePlayHistory", () => ({
  usePlayHistory: () => ({
    getHistory: listeningStatsMocks.getHistory,
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    play: listeningStatsMocks.play,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("ListeningStatsPage mobile layout", () => {
  it("renders the stats view in the shared mobile shell", async () => {
    const { container } = render(
      <MemoryRouter>
        <ListeningStatsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Listening Stats")).toBeInTheDocument();
    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("Activity by Hour")).toBeInTheDocument();
    expect(screen.getByText("Top Tracks")).toBeInTheDocument();
  });
});
