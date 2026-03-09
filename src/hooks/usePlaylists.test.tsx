import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { PlaylistsProvider, usePlaylists } from "@/hooks/usePlaylists";

const authMocks = vi.hoisted(() => ({
  user: { id: "user-1" },
}));

const playlistQueryMocks = vi.hoisted(() => ({
  fetchUserPlaylists: vi.fn(),
  invalidateUserPlaylistsCache: vi.fn(),
  subscribeToPlaylistChanges: vi.fn(() => ({ id: "channel-1" })),
  removePlaylistSubscription: vi.fn(async () => {}),
  fetchPlaylistTracks: vi.fn(async () => []),
}));

const playlistMutationMocks = vi.hoisted(() => ({
  createPlaylistRecord: vi.fn(),
  deletePlaylistRecord: vi.fn(),
  deletePlaylistTrackRecord: vi.fn(),
  fetchPlaylistTrackIds: vi.fn(),
  fetchPlaylistTrackRows: vi.fn(),
  insertPlaylistTrackRecord: vi.fn(),
  setPlaylistCoverUrl: vi.fn(),
  updatePlaylistRecord: vi.fn(),
  updatePlaylistTrackPosition: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authMocks.user,
  }),
}));

vi.mock("@/hooks/playlists/playlistQueries", () => ({
  fetchUserPlaylists: (...args: unknown[]) => playlistQueryMocks.fetchUserPlaylists(...args),
  invalidateUserPlaylistsCache: (...args: unknown[]) =>
    playlistQueryMocks.invalidateUserPlaylistsCache(...args),
  subscribeToPlaylistChanges: (...args: unknown[]) =>
    playlistQueryMocks.subscribeToPlaylistChanges(...args),
  removePlaylistSubscription: (...args: unknown[]) =>
    playlistQueryMocks.removePlaylistSubscription(...args),
  fetchPlaylistTracks: (...args: unknown[]) => playlistQueryMocks.fetchPlaylistTracks(...args),
}));

vi.mock("@/hooks/playlists/playlistCollaborators", () => ({
  fetchPlaylistCollaborators: vi.fn(async () => []),
  invitePlaylistCollaborator: vi.fn(async () => ({ ok: true })),
  removePlaylistCollaborator: vi.fn(async () => true),
  updatePlaylistCollaboratorRole: vi.fn(async () => true),
}));

vi.mock("@/hooks/playlists/playlistMutations", () => ({
  createPlaylistRecord: (...args: unknown[]) => playlistMutationMocks.createPlaylistRecord(...args),
  deletePlaylistRecord: (...args: unknown[]) => playlistMutationMocks.deletePlaylistRecord(...args),
  deletePlaylistTrackRecord: (...args: unknown[]) => playlistMutationMocks.deletePlaylistTrackRecord(...args),
  fetchPlaylistTrackIds: (...args: unknown[]) => playlistMutationMocks.fetchPlaylistTrackIds(...args),
  fetchPlaylistTrackRows: (...args: unknown[]) => playlistMutationMocks.fetchPlaylistTrackRows(...args),
  insertPlaylistTrackRecord: (...args: unknown[]) => playlistMutationMocks.insertPlaylistTrackRecord(...args),
  setPlaylistCoverUrl: (...args: unknown[]) => playlistMutationMocks.setPlaylistCoverUrl(...args),
  updatePlaylistRecord: (...args: unknown[]) => playlistMutationMocks.updatePlaylistRecord(...args),
  updatePlaylistTrackPosition: (...args: unknown[]) => playlistMutationMocks.updatePlaylistTrackPosition(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  },
}));

vi.mock("@/lib/appDiagnostics", () => ({
  pushAppDiagnostic: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  reportClientError: vi.fn(async () => {}),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return <PlaylistsProvider>{children}</PlaylistsProvider>;
}

describe("usePlaylists", () => {
  beforeEach(() => {
    authMocks.user = { id: "user-1" };
    playlistQueryMocks.fetchUserPlaylists.mockReset();
    playlistQueryMocks.invalidateUserPlaylistsCache.mockReset();
    playlistQueryMocks.subscribeToPlaylistChanges.mockClear();
    playlistQueryMocks.removePlaylistSubscription.mockClear();
    playlistQueryMocks.fetchPlaylistTracks.mockClear();
    playlistMutationMocks.createPlaylistRecord.mockReset();
    playlistMutationMocks.deletePlaylistRecord.mockReset();
    playlistMutationMocks.deletePlaylistTrackRecord.mockReset();
    playlistMutationMocks.fetchPlaylistTrackIds.mockReset();
    playlistMutationMocks.fetchPlaylistTrackRows.mockReset();
    playlistMutationMocks.insertPlaylistTrackRecord.mockReset();
    playlistMutationMocks.setPlaylistCoverUrl.mockReset();
    playlistMutationMocks.updatePlaylistRecord.mockReset();
    playlistMutationMocks.updatePlaylistTrackPosition.mockReset();
  });

  it("keeps playlist detail routes in a resolving state until the first fetch completes", async () => {
    const request = deferred<
      Array<{
        id: string;
        name: string;
        description: string;
        cover_url: string | null;
        created_at: string;
        user_id: string;
        visibility: string;
        share_token: string;
        access_role: string;
        track_count: number;
      }>
    >();
    playlistQueryMocks.fetchUserPlaylists.mockReturnValueOnce(request.promise);

    const { result } = renderHook(() => usePlaylists(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.initialized).toBe(false);
    expect(result.current.playlists).toEqual([]);

    request.resolve([
      {
        id: "playlist-1",
        name: "Fresh Playlist",
        description: "",
        cover_url: null,
        created_at: "2026-03-08T00:00:00.000Z",
        user_id: "user-1",
        visibility: "private",
        share_token: "share-token-1",
        access_role: "owner",
        track_count: 0,
      },
    ]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.initialized).toBe(true);
      expect(result.current.playlists).toHaveLength(1);
      expect(result.current.playlists[0]?.id).toBe("playlist-1");
    });
  });

  it("shares optimistic playlist state across consumers under the provider", async () => {
    playlistQueryMocks.fetchUserPlaylists.mockResolvedValue([]);
    playlistMutationMocks.createPlaylistRecord.mockResolvedValue({
      data: {
        id: "playlist-2",
        name: "Shared State Playlist",
        description: "",
        cover_url: null,
        created_at: "2026-03-08T00:00:00.000Z",
        user_id: "user-1",
        visibility: "private",
        share_token: "share-token-2",
      },
      error: null,
    });

    let creatorValue: ReturnType<typeof usePlaylists> | null = null;
    let readerValue: ReturnType<typeof usePlaylists> | null = null;

    function CreatorConsumer() {
      creatorValue = usePlaylists();
      return null;
    }

    function ReaderConsumer() {
      readerValue = usePlaylists();
      return null;
    }

    render(
      <PlaylistsProvider>
        <CreatorConsumer />
        <ReaderConsumer />
      </PlaylistsProvider>
    );

    await waitFor(() => {
      expect(creatorValue?.initialized).toBe(true);
      expect(readerValue?.initialized).toBe(true);
    });

    let playlistId: string | null = null;

    await act(async () => {
      playlistId = await creatorValue!.createPlaylist("Shared State Playlist");
    });

    expect(playlistId).toBe("playlist-2");

    await waitFor(() => {
      expect(readerValue?.playlists).toHaveLength(1);
      expect(readerValue?.playlists[0]?.id).toBe("playlist-2");
      expect(readerValue?.playlists[0]?.name).toBe("Shared State Playlist");
    });
  });

  it("keeps playlist creation working when the backend returns the legacy playlist shape", async () => {
    playlistQueryMocks.fetchUserPlaylists.mockResolvedValue([]);
    playlistMutationMocks.createPlaylistRecord.mockResolvedValue({
      data: {
        id: "playlist-legacy",
        name: "Legacy Playlist",
        description: "",
        cover_url: null,
        created_at: "2026-03-08T00:00:00.000Z",
        user_id: "user-1",
      },
      error: null,
    });

    const { result } = renderHook(() => usePlaylists(), { wrapper });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    let playlistId: string | null = null;

    await act(async () => {
      playlistId = await result.current.createPlaylist("Legacy Playlist");
    });

    expect(playlistId).toBe("playlist-legacy");

    await waitFor(() => {
      expect(result.current.playlists[0]?.id).toBe("playlist-legacy");
      expect(result.current.playlists[0]?.visibility).toBe("private");
      expect(result.current.playlists[0]?.share_token).toBeTruthy();
    });
  });

  it("keeps legacy zero-count summaries unresolved after tracks were added", async () => {
    playlistQueryMocks.fetchUserPlaylists.mockResolvedValueOnce([]);
    playlistMutationMocks.createPlaylistRecord.mockResolvedValue({
      data: {
        id: "playlist-refresh",
        name: "Refresh Playlist",
        description: "",
        cover_url: null,
        created_at: "2026-03-08T00:00:00.000Z",
        user_id: "user-1",
      },
      error: null,
    });
    playlistMutationMocks.insertPlaylistTrackRecord.mockResolvedValue({
      error: null,
    });
    playlistMutationMocks.setPlaylistCoverUrl.mockResolvedValue({
      error: null,
    });

    const { result } = renderHook(() => usePlaylists(), { wrapper });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    let playlistId: string | null = null;

    await act(async () => {
      playlistId = await result.current.createPlaylist("Refresh Playlist");
    });

    await act(async () => {
      await result.current.addTrack(playlistId!, {
        id: "tidal-999",
        tidalId: 999,
        title: "Imported Song",
        artist: "Imported Artist",
        album: "Imported Album",
        duration: 180,
        year: 2024,
        coverUrl: "/cover.jpg",
        canvasColor: "0 0% 0%",
      });
    });

    playlistQueryMocks.fetchUserPlaylists.mockResolvedValueOnce([
      {
        id: "playlist-refresh",
        name: "Refresh Playlist",
        description: "",
        cover_url: null,
        created_at: "2026-03-08T00:00:00.000Z",
        owner_user_id: "user-1",
        access_role: "owner",
        visibility: "private",
        share_token: "share-refresh",
        track_count: 0,
        tracks_loaded: false,
        tracks: [],
      },
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.playlists[0]?.id).toBe("playlist-refresh");
      expect(result.current.playlists[0]?.tracks_loaded).toBe(false);
    });
  });
});
