import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchTidalReference } from "@/lib/tidalReferenceSearch";

const mockSearchTracks = vi.fn();
const mockSearchArtists = vi.fn();
const mockSearchAlbums = vi.fn();
const mockSearchPlaylists = vi.fn();
const mockFilterAudioTracks = vi.fn((tracks) => tracks);
const mockGetTidalImageUrl = vi.fn((value: string, size: string) => `image:${value}:${size}`);
const mockTidalTrackToAppTrack = vi.fn((track) => track);

vi.mock("@/lib/musicApi", () => ({
  filterAudioTracks: (...args: unknown[]) => mockFilterAudioTracks(...args),
  getTidalImageUrl: (...args: unknown[]) => mockGetTidalImageUrl(...args),
  searchAlbums: (...args: unknown[]) => mockSearchAlbums(...args),
  searchArtists: (...args: unknown[]) => mockSearchArtists(...args),
  searchPlaylists: (...args: unknown[]) => mockSearchPlaylists(...args),
  searchTracks: (...args: unknown[]) => mockSearchTracks(...args),
  tidalTrackToAppTrack: (...args: unknown[]) => mockTidalTrackToAppTrack(...args),
}));

describe("searchTidalReference", () => {
  beforeEach(() => {
    mockSearchTracks.mockResolvedValue([]);
    mockSearchAlbums.mockResolvedValue([]);
    mockSearchPlaylists.mockResolvedValue([]);
    mockSearchArtists.mockResolvedValue([]);
    mockFilterAudioTracks.mockImplementation((tracks) => tracks);
    mockGetTidalImageUrl.mockImplementation((value: string, size: string) => `image:${value}:${size}`);
    mockTidalTrackToAppTrack.mockImplementation((track) => track);
  });

  it("removes collaboration and derivative artist pseudo-profiles from profile results", async () => {
    mockSearchArtists.mockResolvedValue([
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
