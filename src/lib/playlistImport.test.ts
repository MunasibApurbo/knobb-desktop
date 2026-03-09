import { importPlaylist } from "@/lib/playlistImport";
import type { Track } from "@/types/music";

const musicApiMocks = vi.hoisted(() => ({
  searchTracks: vi.fn(),
  tidalTrackToAppTrack: vi.fn(),
}));

vi.mock("@/lib/musicApi", () => ({
  searchTracks: (...args: unknown[]) => musicApiMocks.searchTracks(...args),
  tidalTrackToAppTrack: (...args: unknown[]) => musicApiMocks.tidalTrackToAppTrack(...args),
}));

function buildTrack(id: string, title: string, artist: string): Track {
  return {
    id,
    tidalId: Number(id.replace(/\D+/g, "")) || undefined,
    title,
    artist,
    album: "Album",
    duration: 180,
    year: 2024,
    coverUrl: "/cover.jpg",
    canvasColor: "0 0% 0%",
  };
}

function buildImportFile(contents: string) {
  return {
    name: "spotify.csv",
    text: vi.fn(async () => contents),
  } as unknown as File;
}

describe("playlistImport", () => {
  beforeEach(() => {
    musicApiMocks.searchTracks.mockReset();
    musicApiMocks.tidalTrackToAppTrack.mockReset();
    musicApiMocks.tidalTrackToAppTrack.mockImplementation((track) =>
      buildTrack(String(track.id ?? "1"), track.title ?? "Unknown", track.artist?.name ?? "Unknown"),
    );
  });

  it("parses quoted Spotify CSV cells that contain embedded newlines", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 101,
        title: "Song\nOne",
        artist: { name: "Artist One" },
        album: { title: "Album One" },
      },
    ]);

    const file = buildImportFile(
      'Track Name,Artist Name(s),Album Name\n' +
        '"Song\nOne","Artist One","Album One"\n',
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.title).toBe("Song\nOne");
    expect(result.missingTracks).toEqual([]);
  });

  it("reuses identical Spotify lookups while preserving duplicate playlist entries", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 202,
        title: "Repeat Song",
        artist: { name: "Repeat Artist" },
        album: { title: "Repeat Album" },
      },
    ]);

    const file = buildImportFile(
      "Track Name,Artist Name(s),Album Name\n" +
        "Repeat Song,Repeat Artist,Repeat Album\n" +
        "Repeat Song,Repeat Artist,Repeat Album\n" +
        "Repeat Song,Repeat Artist,Repeat Album\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(musicApiMocks.searchTracks).toHaveBeenCalledTimes(1);
    expect(result.tracks).toHaveLength(3);
    expect(result.tracks.map((track) => track.title)).toEqual([
      "Repeat Song",
      "Repeat Song",
      "Repeat Song",
    ]);
  });

  it("ignores unrelated search results instead of forcing the first track", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 301,
        title: "Completely Different Song",
        artist: { name: "Wrong Artist" },
        album: { title: "Wrong Album" },
      },
    ]);

    const file = buildImportFile(
      "Track Name,Artist Name(s),Album Name\n" +
        "Wanted Song,Wanted Artist,Wanted Album\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(result.tracks).toEqual([]);
    expect(result.missingTracks).toEqual([
      {
        album: "Wanted Album",
        artist: "Wanted Artist",
        title: "Wanted Song",
      },
    ]);
  });

  it("prefers the title-matching result even when the first search hit is wrong", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 401,
        title: "Wrong Song",
        artist: { name: "Wrong Artist" },
        album: { title: "Wrong Album" },
      },
      {
        id: 402,
        title: "Golden",
        artists: [{ id: 2, name: "Harry Styles" }],
        artist: { name: "Harry Styles" },
        album: { title: "Fine Line" },
      },
    ]);

    const file = buildImportFile(
      "Track Name,Artist Name(s),Album Name\n" +
        "Golden,Harry Styles,Fine Line\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.id).toBe("402");
    expect(result.missingTracks).toEqual([]);
  });

  it("supports semicolon-delimited Spotify CSV files", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 501,
        title: "Semicolon Song",
        artist: { name: "Semicolon Artist" },
        album: { title: "Semicolon Album" },
      },
    ]);

    const file = buildImportFile(
      "Track Name;Artist Name(s);Album Name\n" +
        "Semicolon Song;Semicolon Artist;Semicolon Album\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.title).toBe("Semicolon Song");
  });

  it("skips non-track rows when the Spotify CSV has a type column", async () => {
    musicApiMocks.searchTracks.mockResolvedValue([
      {
        id: 601,
        title: "Actual Song",
        artist: { name: "Actual Artist" },
        album: { title: "Actual Album" },
      },
    ]);

    const file = buildImportFile(
      "Type,Track Name,Artist Name(s),Album Name\n" +
        "episode,Podcast Episode,Podcast Host,Podcast Album\n" +
        "track,Actual Song,Actual Artist,Actual Album\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(musicApiMocks.searchTracks).toHaveBeenCalledTimes(1);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.title).toBe("Actual Song");
  });

  it("retries Spotify lookups with simpler fallback queries", async () => {
    musicApiMocks.searchTracks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 701,
          title: "Fallback Song",
          artist: { name: "Fallback Artist" },
          album: { title: "Fallback Album" },
        },
      ]);

    const file = buildImportFile(
      "Track Name,Artist Name(s),Album Name\n" +
        "Fallback Song,Fallback Artist,Fallback Album\n",
    );

    const result = await importPlaylist({
      file,
      format: "csv",
      provider: "spotify",
    });

    expect(musicApiMocks.searchTracks).toHaveBeenCalledTimes(2);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.title).toBe("Fallback Song");
  });
});
