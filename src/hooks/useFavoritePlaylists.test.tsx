import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FavoritePlaylistsProvider, useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";

const authMocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}));

const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const order = vi.fn(async () => ({ data: [], error: null }));
  const select = vi.fn(() => ({ order }));
  const deleteEqPlaylist = vi.fn(async () => ({ error: null }));
  const deleteEqSource = vi.fn(() => ({ eq: deleteEqPlaylist }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqSource }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));
  const upsert = vi.fn(async () => ({ error: null }));
  const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
  const on = vi.fn(() => ({ subscribe }));
  const channel = vi.fn(() => ({ on }));
  const removeChannel = vi.fn(async () => {});

  return {
    order,
    select,
    deleteEqPlaylist,
    deleteEqSource,
    deleteEqUser,
    deleteFn,
    upsert,
    subscribe,
    on,
    channel,
    removeChannel,
    client: {
      from: vi.fn((table: string) => {
        if (table === "favorite_playlists") {
          return {
            select,
            upsert,
            delete: deleteFn,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      channel,
      removeChannel,
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authMocks.user,
  }),
}));

vi.mock("@/lib/runtimeModules", () => ({
  getSupabaseClient: vi.fn(async () => supabaseMocks.client),
}));

vi.mock("@/lib/safeStorage", () => ({
  safeStorageGetItem: (...args: unknown[]) => storageMocks.getItem(...args),
  safeStorageSetItem: (...args: unknown[]) => storageMocks.setItem(...args),
}));

function ProviderWrapper({ children }: { children: ReactNode }) {
  return <FavoritePlaylistsProvider>{children}</FavoritePlaylistsProvider>;
}

describe("useFavoritePlaylists", () => {
  beforeEach(() => {
    authMocks.user = { id: "user-1" };
    storageMocks.getItem.mockReset();
    storageMocks.setItem.mockReset();
    supabaseMocks.order.mockClear();
    supabaseMocks.select.mockClear();
    supabaseMocks.deleteEqPlaylist.mockClear();
    supabaseMocks.deleteEqSource.mockClear();
    supabaseMocks.deleteEqUser.mockClear();
    supabaseMocks.deleteFn.mockClear();
    supabaseMocks.upsert.mockClear();
    supabaseMocks.subscribe.mockClear();
    supabaseMocks.on.mockClear();
    supabaseMocks.channel.mockClear();
    supabaseMocks.removeChannel.mockClear();
    supabaseMocks.client.from.mockClear();
  });

  it("hydrates cached favorite playlists immediately while remote sync starts", async () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify([
      {
        id: "favorite-1",
        source: "tidal",
        playlist_id: "playlist-42",
        playlist_title: "Late Night Mix",
        playlist_cover_url: "/mix.jpg",
        created_at: "2026-03-08T00:00:00.000Z",
      },
    ]));

    const { result } = renderHook(() => useFavoritePlaylists(), { wrapper: ProviderWrapper });

    expect(result.current.favoritePlaylists).toHaveLength(1);
    expect(result.current.favoritePlaylists[0]?.playlist_title).toBe("Late Night Mix");

    await waitFor(() => {
      expect(supabaseMocks.order).toHaveBeenCalled();
    });
  });

  it("shares optimistic favorite playlist updates across consumers immediately", async () => {
    let creatorValue: ReturnType<typeof useFavoritePlaylists> | null = null;
    let readerValue: ReturnType<typeof useFavoritePlaylists> | null = null;

    function CreatorConsumer() {
      creatorValue = useFavoritePlaylists();
      return null;
    }

    function ReaderConsumer() {
      readerValue = useFavoritePlaylists();
      return null;
    }

    render(
      <ProviderWrapper>
        <CreatorConsumer />
        <ReaderConsumer />
      </ProviderWrapper>
    );

    await waitFor(() => {
      expect(readerValue?.favoritePlaylists).toEqual([]);
    });

    await act(async () => {
      await creatorValue!.addFavoritePlaylist({
        playlistId: "playlist-42",
        playlistTitle: "Late Night Mix",
        playlistCoverUrl: "/mix.jpg",
      });
    });

    await waitFor(() => {
      expect(readerValue?.favoritePlaylists).toHaveLength(1);
      expect(readerValue?.favoritePlaylists[0]?.playlist_id).toBe("playlist-42");
      expect(readerValue?.isFavoritePlaylist("playlist-42")).toBe(true);
    });
  });
});
