import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchTidalReference } from "@/lib/tidalReferenceSearch";

const tidalReferenceMocks = vi.hoisted(() => ({
  searchTracks: vi.fn(),
  searchArtists: vi.fn(),
  searchAlbums: vi.fn(),
  searchPlaylists: vi.fn(),
  filterAudioTracks: vi.fn((tracks) => tracks),
  getTidalImageUrl: vi.fn((value: string, size: string) => `image:${value}:${size}`),
  tidalTrackToAppTrack: vi.fn((track) => track),
}));

vi.mock("@/lib/musicApi", () => ({
  filterAudioTracks: tidalReferenceMocks.filterAudioTracks,
  getTidalImageUrl: tidalReferenceMocks.getTidalImageUrl,
  searchAlbums: tidalReferenceMocks.searchAlbums,
  searchArtists: tidalReferenceMocks.searchArtists,
  searchPlaylists: tidalReferenceMocks.searchPlaylists,
  searchTracks: tidalReferenceMocks.searchTracks,
  tidalTrackToAppTrack: tidalReferenceMocks.tidalTrackToAppTrack,
}));

describe("searchTidalReference", () => {
  beforeEach(() => {
    tidalReferenceMocks.searchTracks.mockResolvedValue([]);
    tidalReferenceMocks.searchAlbums.mockResolvedValue([]);
    tidalReferenceMocks.searchPlaylists.mockResolvedValue([]);
    tidalReferenceMocks.searchArtists.mockResolvedValue([]);
    tidalReferenceMocks.filterAudioTracks.mockImplementation((tracks) => tracks);
    tidalReferenceMocks.getTidalImageUrl.mockImplementation((value: string, size: string) => `image:${value}:${size}`);
    tidalReferenceMocks.tidalTrackToAppTrack.mockImplementation((track) => track);
  });

  it("removes collaboration and derivative artist pseudo-profiles from profile results", async () => {
    tidalReferenceMocks.searchArtists.mockResolvedValue([
      { id: 1, name: "Ava Max", picture: "ava-max", popularity: 100, url: "/artist/1" },
      {
        id: 2,
        name: "Ava Max Amanda Koci Andreas Andersen Haukeland",
        picture: null,
        popularity: 0,
        url: "/artist/2",
      },
      { id: 3, name: "Alan Walker, Ava Max", picture: null, popularity: 0, url: "/artist/3" },
      { id: 4, name: "Tiesto & Ava Max", picture: null, popularity: 0, url: "/artist/4" },
      { id: 5, name: "Ava Max (Cover)", picture: "cover-art", popularity: 1, url: "/artist/5" },
      { id: 6, name: "Beyonce and Ava Max fan", picture: null, popularity: 0, url: "/artist/6" },
      { id: 7, name: "Max Avarillo", picture: null, popularity: 0, url: "/artist/7" },
    ]);

    const results = await searchTidalReference("ava max");

    expect(results.artists.map((artist) => artist.name)).toEqual(["Ava Max", "Max Avarillo"]);
  });
});
