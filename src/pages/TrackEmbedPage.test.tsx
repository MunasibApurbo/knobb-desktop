import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Track } from "@/types/music";
import TrackEmbedPage from "@/pages/TrackEmbedPage";

const trackEmbedMocks = vi.hoisted(() => ({
  getTrackInfo: vi.fn(),
  tidalTrackToAppTrack: vi.fn(),
  player: {
    currentTrack: null as Track | null,
    isPlaying: false,
    play: vi.fn(),
    togglePlay: vi.fn(),
  },
}));

vi.mock("@/lib/musicApi", () => ({
  getTrackInfo: (...args: unknown[]) => trackEmbedMocks.getTrackInfo(...args),
  tidalTrackToAppTrack: (...args: unknown[]) => trackEmbedMocks.tidalTrackToAppTrack(...args),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => trackEmbedMocks.player,
}));

vi.mock("@/hooks/usePageMetadata", () => ({
  usePageMetadata: () => undefined,
}));

const appTrack: Track = {
  id: "tidal-123",
  tidalId: 123,
  albumId: 456,
  artistId: 789,
  title: "Levitating",
  artist: "Dua Lipa",
  album: "Future Nostalgia",
  duration: 203,
  year: 2020,
  coverUrl: "/levitating.jpg",
  canvasColor: "210 48% 40%",
  audioQuality: "HIGH",
};

describe("TrackEmbedPage", () => {
  beforeEach(() => {
    trackEmbedMocks.getTrackInfo.mockReset();
    trackEmbedMocks.tidalTrackToAppTrack.mockReset();
    trackEmbedMocks.player.play.mockReset();
    trackEmbedMocks.player.togglePlay.mockReset();
    trackEmbedMocks.player.currentTrack = null;
    trackEmbedMocks.player.isPlaying = false;
  });

  function renderPage(initialEntry = "/embed/track/tidal-123") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/embed/track/:trackId" element={<TrackEmbedPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("loads and renders a valid track embed", async () => {
    trackEmbedMocks.getTrackInfo.mockResolvedValue({ id: 123 });
    trackEmbedMocks.tidalTrackToAppTrack.mockReturnValue(appTrack);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Levitating" })).toBeInTheDocument();
    });

    expect(screen.getByText("Dua Lipa")).toBeInTheDocument();
    expect(screen.getByText("Future Nostalgia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in knobb/i })).toBeInTheDocument();
  });

  it("shows an unavailable state for invalid embed ids", async () => {
    renderPage("/embed/track/local-file-9");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Track unavailable" })).toBeInTheDocument();
    });

    expect(trackEmbedMocks.getTrackInfo).not.toHaveBeenCalled();
  });

  it("replays the current embed track from the start instead of toggling playback", async () => {
    trackEmbedMocks.getTrackInfo.mockResolvedValue({ id: 123 });
    trackEmbedMocks.tidalTrackToAppTrack.mockReturnValue(appTrack);
    trackEmbedMocks.player.currentTrack = appTrack;
    trackEmbedMocks.player.isPlaying = true;

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Levitating" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /play from start/i }));

    expect(trackEmbedMocks.player.play).toHaveBeenCalledWith(appTrack, [appTrack]);
    expect(trackEmbedMocks.player.togglePlay).not.toHaveBeenCalled();
  });

  it("renders the compact embed layout for iframe-friendly previews", async () => {
    trackEmbedMocks.getTrackInfo.mockResolvedValue({ id: 123 });
    trackEmbedMocks.tidalTrackToAppTrack.mockReturnValue(appTrack);

    renderPage("/embed/track/tidal-123?theme=graphite&size=compact");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Levitating" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /^open/i })).toBeInTheDocument();
  });
});
