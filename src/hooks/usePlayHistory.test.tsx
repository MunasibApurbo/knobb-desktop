import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlayHistory } from "@/hooks/usePlayHistory";
import type { Track } from "@/types/music";

const authMocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}));

const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const queryState = {
    since: undefined as string | undefined,
    limit: undefined as number | undefined,
  };

  const limit = vi.fn(async () => ({ data: [], error: null }));
  const gte = vi.fn((column: string, value: string) => {
    if (column === "played_at") {
      queryState.since = value;
    }
    return { limit };
  });
  const order = vi.fn(() => ({ gte, limit }));
  const select = vi.fn(() => ({ order }));
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const del = vi.fn(() => ({ eq }));

  return {
    queryState,
    select,
    order,
    gte,
    limit,
    eq,
    delete: del,
    client: {
      from: vi.fn((table: string) => {
        if (table === "play_history") {
          return {
            select,
            delete: del,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
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

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: overrides.id ?? "track-1",
    title: overrides.title ?? "Track",
    artist: overrides.artist ?? "Artist",
    album: overrides.album ?? "Album",
    duration: overrides.duration ?? 180,
    year: overrides.year ?? 2024,
    coverUrl: overrides.coverUrl ?? "/cover.jpg",
    canvasColor: overrides.canvasColor ?? "0 0% 0%",
    ...overrides,
  };
}

function makeCachedEntry(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTrack({
      id: "track-1",
      title: "Cached Track",
    }),
    playedAt: "2026-03-17T10:00:00.000Z",
    listenedSeconds: 140,
    durationSeconds: 180,
    eventType: "complete",
    trackKey: "tidal:track-1",
    ...overrides,
  };
}

describe("usePlayHistory", () => {
  beforeEach(() => {
    vi.useRealTimers();
    authMocks.user = { id: "user-1" };
    storageMocks.getItem.mockReset();
    storageMocks.setItem.mockReset();
    supabaseMocks.queryState.since = undefined;
    supabaseMocks.queryState.limit = undefined;
    supabaseMocks.select.mockClear();
    supabaseMocks.order.mockClear();
    supabaseMocks.gte.mockClear();
    supabaseMocks.limit.mockReset();
    supabaseMocks.limit.mockResolvedValue({ data: [], error: null });
    supabaseMocks.eq.mockClear();
    supabaseMocks.delete.mockClear();
    supabaseMocks.client.from.mockClear();
    supabaseMocks.client.rpc.mockClear();
  });

  it("reads cached history immediately and applies the requested query options", () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify([
      makeCachedEntry(),
      makeCachedEntry({
        id: "track-2",
        title: "Older Track",
        trackKey: "tidal:track-2",
        playedAt: "2026-02-01T10:00:00.000Z",
      }),
    ]));

    const { result } = renderHook(() => usePlayHistory());

    const cached = result.current.readCachedHistory({
      limit: 1,
      since: "2026-03-01T00:00:00.000Z",
    });

    expect(cached).toHaveLength(1);
    expect(cached[0]?.title).toBe("Cached Track");
  });

  it("falls back to cached history when the remote request fails", async () => {
    storageMocks.getItem.mockReturnValue(JSON.stringify([makeCachedEntry()]));
    supabaseMocks.limit.mockResolvedValueOnce({
      data: null,
      error: new Error("network down"),
    });

    const { result } = renderHook(() => usePlayHistory());

    await act(async () => {
      const history = await result.current.getHistory({
        limit: 50,
        since: "2026-03-01T00:00:00.000Z",
      });

      expect(history).toHaveLength(1);
      expect(history[0]?.title).toBe("Cached Track");
    });
  });

  it("falls back to cached history when the remote request hangs", async () => {
    vi.useFakeTimers();
    storageMocks.getItem.mockReturnValue(JSON.stringify([makeCachedEntry()]));
    supabaseMocks.limit.mockImplementationOnce(() => new Promise(() => undefined));

    const { result } = renderHook(() => usePlayHistory());

    const historyPromise = result.current.getHistory({
      limit: 50,
      since: "2026-03-01T00:00:00.000Z",
    });

    await vi.advanceTimersByTimeAsync(8000);

    await act(async () => {
      const history = await historyPromise;
      expect(history).toHaveLength(1);
      expect(history[0]?.title).toBe("Cached Track");
    });
  });
});
