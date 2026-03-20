import { describe, expect, it, vi } from "vitest";

describe("youtubeEmbedManager", () => {
  it("restores playback after returning a playing player to the global host", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const { getYoutubeEmbedManager } = await import("@/lib/youtubeEmbedManager");
    const manager = getYoutubeEmbedManager() as unknown as {
      globalHost: HTMLDivElement | null;
      mountNode: HTMLDivElement | null;
      player: {
        getPlayerState: ReturnType<typeof vi.fn>;
        playVideo: ReturnType<typeof vi.fn>;
      } | null;
      startProgressUpdates: ReturnType<typeof vi.fn>;
      returnToGlobalHost: () => void;
    };

    const visibleHost = document.createElement("div");
    document.body.appendChild(visibleHost);

    const mountNode = manager.mountNode ?? document.createElement("div");
    const globalHost = manager.globalHost ?? document.createElement("div");
    manager.mountNode = mountNode;
    manager.globalHost = globalHost;
    visibleHost.appendChild(mountNode);

    const getPlayerState = vi
      .fn()
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2);
    const playVideo = vi.fn();

    manager.player = {
      getPlayerState,
      playVideo,
    };
    manager.startProgressUpdates = vi.fn();

    manager.returnToGlobalHost();
    await vi.advanceTimersByTimeAsync(0);

    expect(globalHost.contains(mountNode)).toBe(true);
    expect(playVideo).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("recreates the active player after moving from the hidden host into a visible host", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const { getYoutubeEmbedManager } = await import("@/lib/youtubeEmbedManager");
    const manager = getYoutubeEmbedManager() as unknown as {
      currentVideoId: string | null;
      globalHost: HTMLDivElement | null;
      load: ReturnType<typeof vi.fn>;
      mountNode: HTMLDivElement | null;
      player: {
        destroy: ReturnType<typeof vi.fn>;
        getCurrentTime: ReturnType<typeof vi.fn>;
        getPlayerState: ReturnType<typeof vi.fn>;
      } | null;
      playerPromise: Promise<unknown> | null;
      progressIntervalId: number | null;
      stopProgressUpdates: ReturnType<typeof vi.fn>;
      attachHost: (host: HTMLElement) => void;
    };

    const visibleHost = document.createElement("div");
    document.body.appendChild(visibleHost);

    const mountNode = manager.mountNode ?? document.createElement("div");
    const globalHost = manager.globalHost ?? document.createElement("div");
    manager.mountNode = mountNode;
    manager.globalHost = globalHost;
    globalHost.appendChild(mountNode);

    const destroy = vi.fn();
    manager.currentVideoId = "video-123";
    manager.player = {
      destroy,
      getCurrentTime: vi.fn(() => 42),
      getPlayerState: vi.fn(() => 1),
    };
    manager.playerPromise = Promise.resolve(manager.player);
    manager.stopProgressUpdates = vi.fn();
    manager.load = vi.fn(async () => undefined);

    manager.attachHost(visibleHost);
    await vi.advanceTimersByTimeAsync(0);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(manager.load).toHaveBeenCalledWith("video-123", {
      autoplay: true,
      startSeconds: 42,
    });

    vi.useRealTimers();
  });

  it("resets safely when the current player does not expose stopVideo yet", async () => {
    vi.resetModules();

    const { getYoutubeEmbedManager } = await import("@/lib/youtubeEmbedManager");
    const manager = getYoutubeEmbedManager() as unknown as {
      player: {
        pauseVideo?: ReturnType<typeof vi.fn>;
        stopVideo?: ReturnType<typeof vi.fn>;
      } | null;
      reset: () => void;
    };

    const pauseVideo = vi.fn();
    manager.player = {
      pauseVideo,
    };

    expect(() => manager.reset()).not.toThrow();
    expect(pauseVideo).toHaveBeenCalledTimes(1);
  });
});
