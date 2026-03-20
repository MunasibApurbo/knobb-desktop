import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SavedAlbumsProvider, useSavedAlbums } from "@/hooks/useSavedAlbums";

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
  const deleteEqAlbum = vi.fn(async () => ({ error: null }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqAlbum }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));
  const upsert = vi.fn(async () => ({ error: null }));
  const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
  const on = vi.fn(() => ({ subscribe }));
  const channel = vi.fn(() => ({ on }));
  const removeChannel = vi.fn(async () => {});

  return {
    order,
    select,
    deleteEqAlbum,
    deleteEqUser,
    deleteFn,
    upsert,
    subscribe,
    on,
    channel,
    removeChannel,
    client: {
      from: vi.fn((table: string) => {
        if (table === "saved_albums") {
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
  return <SavedAlbumsProvider>{children}</SavedAlbumsProvider>;
}

describe("useSavedAlbums", () => {
  beforeEach(() => {
    authMocks.user = { id: "user-1" };
    storageMocks.getItem.mockReset();
    storageMocks.setItem.mockReset();
    supabaseMocks.order.mockClear();
    supabaseMocks.select.mockClear();
    supabaseMocks.deleteEqAlbum.mockClear();
    supabaseMocks.deleteEqUser.mockClear();
    supabaseMocks.deleteFn.mockClear();
    supabaseMocks.upsert.mockClear();
    supabaseMocks.subscribe.mockClear();
    supabaseMocks.on.mockClear();
    supabaseMocks.channel.mockClear();
    supabaseMocks.removeChannel.mockClear();
    supabaseMocks.client.from.mockClear();
  });

  it("hydrates cached saved albums immediately while remote sync starts", async () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify([
      {
        id: "album-1",
        album_id: 42,
        album_title: "Revival",
        album_artist: "Selena Gomez",
        album_cover_url: "/revival.jpg",
        album_year: 2015,
        created_at: "2026-03-08T00:00:00.000Z",
      },
    ]));

    const { result } = renderHook(() => useSavedAlbums(), { wrapper: ProviderWrapper });

    expect(result.current.savedAlbums).toHaveLength(1);
    expect(result.current.savedAlbums[0]?.album_title).toBe("Revival");

    await waitFor(() => {
      expect(supabaseMocks.order).toHaveBeenCalled();
    });
  });

  it("shares optimistic saved album updates across consumers immediately", async () => {
    let creatorValue: ReturnType<typeof useSavedAlbums> | null = null;
    let readerValue: ReturnType<typeof useSavedAlbums> | null = null;

    function CreatorConsumer() {
      creatorValue = useSavedAlbums();
      return null;
    }

    function ReaderConsumer() {
      readerValue = useSavedAlbums();
      return null;
    }

    render(
      <ProviderWrapper>
        <CreatorConsumer />
        <ReaderConsumer />
      </ProviderWrapper>
    );

    await waitFor(() => {
      expect(readerValue?.savedAlbums).toEqual([]);
    });

    await act(async () => {
      await creatorValue!.addSavedAlbum({
        albumId: 42,
        albumTitle: "Revival",
        albumArtist: "Selena Gomez",
        albumCoverUrl: "/revival.jpg",
        albumYear: 2015,
      });
    });

    await waitFor(() => {
      expect(readerValue?.savedAlbums).toHaveLength(1);
      expect(readerValue?.savedAlbums[0]?.album_id).toBe(42);
      expect(readerValue?.isSaved(42)).toBe(true);
    });
  });
});
