import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LikedSongsProvider, useLikedSongs } from "@/contexts/LikedSongsContext";
import type { Track } from "@/types/music";

const authMocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}));

const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}));

const artistGridPlaybackMocks = vi.hoisted(() => ({
  hydrateArtistGridTrackPlayback: vi.fn(async (track: Track) => track),
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
        if (table === "liked_songs") {
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

vi.mock("@/lib/artistGridPlayback", () => ({
  hydrateArtistGridTrackPlayback: (...args: Parameters<typeof artistGridPlaybackMocks.hydrateArtistGridTrackPlayback>) =>
    artistGridPlaybackMocks.hydrateArtistGridTrackPlayback(...args),
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

function LikedSongsHarness() {
  const { likedSongs } = useLikedSongs();
  return (
    <>
      <div>{likedSongs.map((track) => track.title).join(",")}</div>
      <div data-testid="first-stream-url">{likedSongs[0]?.streamUrl || ""}</div>
    </>
  );
}

describe("LikedSongsContext", () => {
  beforeEach(() => {
    authMocks.user = { id: "user-1" };
    storageMocks.getItem.mockReset();
    storageMocks.setItem.mockReset();
    artistGridPlaybackMocks.hydrateArtistGridTrackPlayback.mockReset();
    artistGridPlaybackMocks.hydrateArtistGridTrackPlayback.mockImplementation(async (track: Track) => track);
    supabaseMocks.order.mockClear();
    supabaseMocks.select.mockClear();
    supabaseMocks.subscribe.mockClear();
    supabaseMocks.on.mockClear();
    supabaseMocks.channel.mockClear();
    supabaseMocks.removeChannel.mockClear();
    supabaseMocks.client.from.mockClear();
  });

  it("hydrates liked songs from cache immediately while remote sync starts", async () => {
    const cachedTrack = makeTrack({ id: "cached-1", title: "Cached Song" });
    storageMocks.getItem.mockReturnValue(JSON.stringify([cachedTrack]));

    render(
      <LikedSongsProvider>
        <LikedSongsHarness />
      </LikedSongsProvider>,
    );

    expect(screen.getByText("Cached Song")).toBeInTheDocument();

    await waitFor(() => {
      expect(supabaseMocks.order).toHaveBeenCalled();
    });
  });

  it("uses the remote liked-song data directly without eager playback hydration", async () => {
    const remoteTrack = makeTrack({
      id: "artistgrid-track-1",
      title: "Leaked Song",
      sourceId: `${"a".repeat(44)}:https://pillows.su/f/abc123`,
    });
    supabaseMocks.order.mockResolvedValueOnce({
      data: [{ track_data: remoteTrack, liked_at: "2026-03-17T00:00:00.000Z" }],
      error: null,
    });

    render(
      <LikedSongsProvider>
        <LikedSongsHarness />
      </LikedSongsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Leaked Song")).toBeInTheDocument();
    });
    expect(screen.getByTestId("first-stream-url")).toHaveTextContent("");
    expect(artistGridPlaybackMocks.hydrateArtistGridTrackPlayback).not.toHaveBeenCalled();
  });
});
