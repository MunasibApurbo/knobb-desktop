import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SearchProvider, useSearch } from "@/contexts/SearchContext";
import type { Track } from "@/types/music";

const searchContextMocks = vi.hoisted(() => {
  const tidalTrack: Track = {
    id: "tidal-track-1",
    title: "Tidal Sidebar Song",
    artist: "Tidal Artist",
    album: "Tidal Album",
    duration: 201,
    year: 2024,
    coverUrl: "/tidal-song.jpg",
    canvasColor: "210 70% 50%",
    source: "tidal",
  };

  return {
    tidalSearch: vi.fn(async () => ({
      tracks: [tidalTrack],
      videos: [],
      artists: [],
      albums: [],
      playlists: [],
    })),
    youtubeSearch: vi.fn(async () => ({
      tracks: [{
        ...tidalTrack,
        id: "yt-track-1",
        title: "YT Sidebar Song",
        source: "youtube-music" as const,
      }],
      videos: [],
      artists: [],
      albums: [],
      playlists: [],
    })),
  };
});

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    librarySource: "youtube-music" as const,
  }),
}));

vi.mock("@/lib/tidalReferenceSearch", () => ({
  searchTidalReference: (...args: unknown[]) => searchContextMocks.tidalSearch(...args),
}));

vi.mock("@/lib/youtubeMusicApi", () => ({
  searchYoutubeMusicReference: (...args: unknown[]) => searchContextMocks.youtubeSearch(...args),
}));

vi.mock("@/lib/appDiagnostics", () => ({
  pushAppDiagnostic: vi.fn(),
}));

vi.mock("@/lib/safeStorage", () => ({
  safeStorageGetItem: vi.fn(() => null),
  safeStorageSetItem: vi.fn(),
}));

function SearchHarness() {
  const { handleSearch, tidalTracks } = useSearch();

  return (
    <div>
      <button type="button" onClick={() => void handleSearch("Submarine")}>
        Run search
      </button>
      <div>{tidalTracks.map((track) => track.title).join(", ")}</div>
    </div>
  );
}

describe("SearchContext", () => {
  beforeEach(() => {
    searchContextMocks.tidalSearch.mockClear();
    searchContextMocks.youtubeSearch.mockClear();
  });

  it("keeps sidebar search on TIDAL even when the selected library source is YouTube Music", async () => {
    render(
      <SearchProvider>
        <SearchHarness />
      </SearchProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run search" }));

    await waitFor(() => {
      expect(searchContextMocks.tidalSearch).toHaveBeenCalledWith("Submarine");
    });

    expect(searchContextMocks.youtubeSearch).not.toHaveBeenCalled();
    expect(screen.getByText("Tidal Sidebar Song")).toBeInTheDocument();
  });
});
