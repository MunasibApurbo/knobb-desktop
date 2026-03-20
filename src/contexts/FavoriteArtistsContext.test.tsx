import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FavoriteArtistsProvider, useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";

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
  const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
  const on = vi.fn(() => ({ subscribe }));
  const channel = vi.fn(() => ({ on }));
  const removeChannel = vi.fn(async () => {});

  return {
    order,
    select,
    subscribe,
    on,
    channel,
    removeChannel,
    client: {
      from: vi.fn((table: string) => {
        if (table === "favorite_artists") {
          return {
            select,
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

function FavoriteArtistsHarness() {
  const { favoriteArtists } = useFavoriteArtists();
  return <div>{favoriteArtists.map((artist) => artist.artist_name).join(",")}</div>;
}

describe("FavoriteArtistsContext", () => {
  beforeEach(() => {
    authMocks.user = { id: "user-1" };
    storageMocks.getItem.mockReset();
    storageMocks.setItem.mockReset();
    supabaseMocks.order.mockClear();
    supabaseMocks.select.mockClear();
    supabaseMocks.subscribe.mockClear();
    supabaseMocks.on.mockClear();
    supabaseMocks.channel.mockClear();
    supabaseMocks.removeChannel.mockClear();
    supabaseMocks.client.from.mockClear();
  });

  it("hydrates cached favorite artists immediately while remote sync starts", async () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify([
      {
        id: "artist-1",
        artist_id: 123,
        artist_name: "Lady Gaga",
        artist_image_url: "/gaga.jpg",
        created_at: "2026-03-08T00:00:00.000Z",
      },
    ]));

    render(
      <FavoriteArtistsProvider>
        <FavoriteArtistsHarness />
      </FavoriteArtistsProvider>,
    );

    expect(screen.getByText("Lady Gaga")).toBeInTheDocument();

    await waitFor(() => {
      expect(supabaseMocks.order).toHaveBeenCalled();
    });
  });
});
