import { insertPlaylistTrackRecord } from "@/hooks/playlists/playlistMutations";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

describe("playlistMutations", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("retries playlist track inserts without track_key on legacy schemas", async () => {
    const firstInsert = vi.fn(async () => ({
      data: null,
      error: {
        code: "PGRST204",
        message: "Could not find the 'track_key' column of 'playlist_tracks' in the schema cache",
      },
    }));
    const secondInsert = vi.fn(async () => ({
      data: null,
      error: null,
    }));

    fromMock
      .mockReturnValueOnce({ insert: firstInsert })
      .mockReturnValueOnce({ insert: secondInsert });

    await insertPlaylistTrackRecord(
      "playlist-1",
      {
        album: "Album",
        artist: "Artist",
        canvasColor: "0 0% 0%",
        coverUrl: "",
        duration: 123,
        id: "track-1",
        title: "Track",
        year: 2024,
      },
      "id:track-1",
      0,
    );

    expect(firstInsert).toHaveBeenCalledWith({
      playlist_id: "playlist-1",
      position: 0,
      track_data: {
        album: "Album",
        artist: "Artist",
        canvasColor: "0 0% 0%",
        coverUrl: "",
        duration: 123,
        id: "track-1",
        title: "Track",
        year: 2024,
      },
      track_key: "id:track-1",
    });
    expect(secondInsert).toHaveBeenCalledWith({
      playlist_id: "playlist-1",
      position: 0,
      track_data: {
        album: "Album",
        artist: "Artist",
        canvasColor: "0 0% 0%",
        coverUrl: "",
        duration: 123,
        id: "track-1",
        title: "Track",
        year: 2024,
      },
    });
  });
});
