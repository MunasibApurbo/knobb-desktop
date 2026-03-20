import {
  buildMediaSessionArtwork,
  buildMediaSessionPositionState,
  shouldIgnoreProgressWhileSeekSettles,
  stabilizePlaybackProgressTime,
  updatePlaybackInterruptionHealth,
} from "@/contexts/PlayerContext";
import { getMediaSessionTrackArtworkUrl, getTrackArtworkUrl } from "@/lib/trackArtwork";

describe("buildMediaSessionArtwork", () => {
  it("expands Tidal artwork into multiple sized images", () => {
    const artwork = buildMediaSessionArtwork("https://resources.tidal.com/images/ab/cd/ef/750x750.jpg");

    expect(artwork).toEqual([
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/96x96.jpg",
        sizes: "96x96",
        type: "image/jpeg",
      },
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/128x128.jpg",
        sizes: "128x128",
        type: "image/jpeg",
      },
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/192x192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/256x256.jpg",
        sizes: "256x256",
        type: "image/jpeg",
      },
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/384x384.jpg",
        sizes: "384x384",
        type: "image/jpeg",
      },
      {
        src: "https://resources.tidal.com/images/ab/cd/ef/512x512.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ]);
  });

  it("preserves same-origin artwork as a single image", () => {
    const artwork = buildMediaSessionArtwork("/brand/logo-k-black-square-512.png");

    expect(artwork).toEqual([
      {
        src: `${window.location.origin}/brand/logo-k-black-square-512.png`,
        type: "image/png",
      },
    ]);
  });

  it("uses the square YouTube Music cover art for media session artwork", () => {
    const artwork = buildMediaSessionArtwork(getMediaSessionTrackArtworkUrl({
      coverUrl: "https://lh3.googleusercontent.com/example=w60-h60-l90-rj",
      isVideo: false,
      source: "youtube-music",
      sourceId: "abc123",
    }));

    expect(artwork).toEqual([
      {
        src: "https://lh3.googleusercontent.com/example=w60-h60-l90-rj",
        type: "image/jpeg",
      },
    ]);
  });
});

describe("buildMediaSessionPositionState", () => {
  it("clamps the position to the current track duration", () => {
    expect(buildMediaSessionPositionState(215, 180, 1.25)).toEqual({
      duration: 180,
      playbackRate: 1.25,
      position: 180,
    });
  });

  it("falls back to normal playback speed when the rate is invalid", () => {
    expect(buildMediaSessionPositionState(42, 180, 0)).toEqual({
      duration: 180,
      playbackRate: 1,
      position: 42,
    });
  });

  it("returns null when the duration is not playable yet", () => {
    expect(buildMediaSessionPositionState(5, 0, 1)).toBeNull();
    expect(buildMediaSessionPositionState(5, Number.NaN, 1)).toBeNull();
  });
});

describe("shouldIgnoreProgressWhileSeekSettles", () => {
  it("holds stale engine progress while a seek is still settling", () => {
    expect(shouldIgnoreProgressWhileSeekSettles(
      {
        expiresAt: 5_000,
        time: 180,
        trackId: "track-1",
      },
      {
        currentTime: 42,
        trackId: "track-1",
      },
      1_000,
    )).toBe(true);
  });

  it("accepts progress once playback reaches the pending seek target", () => {
    expect(shouldIgnoreProgressWhileSeekSettles(
      {
        expiresAt: 5_000,
        time: 180,
        trackId: "track-1",
      },
      {
        currentTime: 181,
        trackId: "track-1",
      },
      1_000,
    )).toBe(false);
  });

  it("stops holding progress after the pending seek timeout elapses", () => {
    expect(shouldIgnoreProgressWhileSeekSettles(
      {
        expiresAt: 1_000,
        time: 180,
        trackId: "track-1",
      },
      {
        currentTime: 42,
        trackId: "track-1",
      },
      1_500,
    )).toBe(false);
  });
});

describe("stabilizePlaybackProgressTime", () => {
  it("holds small backward progress jumps during normal playback", () => {
    expect(stabilizePlaybackProgressTime(42.4, 42.18, {
      duration: 180,
      isPlaying: true,
      pendingSeek: null,
    })).toBe(42.4);
  });

  it("accepts larger backward jumps as real timeline changes", () => {
    expect(stabilizePlaybackProgressTime(42.4, 41.6, {
      duration: 180,
      isPlaying: true,
      pendingSeek: null,
    })).toBe(41.6);
  });

  it("accepts backward progress immediately when a seek is pending", () => {
    expect(stabilizePlaybackProgressTime(42.4, 18, {
      duration: 180,
      isPlaying: true,
      pendingSeek: {
        expiresAt: 5_000,
        time: 18,
        trackId: "track-1",
      },
    })).toBe(18);
  });
});

describe("updatePlaybackInterruptionHealth", () => {
  it("warns after repeated interruptions on the same track within the health window", () => {
    let state = {
      trackId: null,
      timestamps: [],
      lastReportedAt: 0,
    };

    ({ nextState: state } = updatePlaybackInterruptionHealth(state, { trackId: "track-1", occurredAt: 1_000 }));
    ({ nextState: state } = updatePlaybackInterruptionHealth(state, { trackId: "track-1", occurredAt: 5_000 }));
    const result = updatePlaybackInterruptionHealth(state, { trackId: "track-1", occurredAt: 9_000 });

    expect(result.shouldWarn).toBe(true);
    expect(result.interruptionCount).toBe(3);
    expect(result.nextState.lastReportedAt).toBe(9_000);
  });

  it("resets the interruption streak when the track changes", () => {
    const result = updatePlaybackInterruptionHealth(
      {
        trackId: "track-1",
        timestamps: [1_000, 5_000],
        lastReportedAt: 0,
      },
      {
        trackId: "track-2",
        occurredAt: 6_000,
      },
    );

    expect(result.shouldWarn).toBe(false);
    expect(result.interruptionCount).toBe(1);
    expect(result.nextState.trackId).toBe("track-2");
  });

  it("respects the reporting cooldown for ongoing buffering issues", () => {
    const result = updatePlaybackInterruptionHealth(
      {
        trackId: "track-1",
        timestamps: [5_000, 10_000],
        lastReportedAt: 12_000,
      },
      {
        trackId: "track-1",
        occurredAt: 20_000,
      },
    );

    expect(result.shouldWarn).toBe(false);
    expect(result.interruptionCount).toBe(3);
    expect(result.nextState.lastReportedAt).toBe(12_000);
  });
});
