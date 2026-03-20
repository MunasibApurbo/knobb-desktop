import { createInitialPlayerState } from "@/contexts/player/playerStorage";
import { normalizeTrackIdentity } from "@/lib/trackIdentity";

const PLAYER_STATE_KEY = "player-state-v1";
const AUDIO_QUALITY_KEY = "audio-quality";

const storedTrack = {
  id: "track-1",
  title: "Alegria",
  artist: "Tiago PZK, Anitta, Emilia",
  album: "Alegria",
  duration: 165,
  year: 2025,
  coverUrl: "/cover.jpg",
  canvasColor: "21 80% 52%",
};
const normalizedStoredTrack = normalizeTrackIdentity(storedTrack);

describe("createInitialPlayerState", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
  });

  it("marks a restored session as started when a current track exists", () => {
    window.localStorage.setItem(
      PLAYER_STATE_KEY,
      JSON.stringify({
        currentTrack: storedTrack,
        currentTime: 12,
        duration: storedTrack.duration,
        queue: [storedTrack],
        repeat: "off",
        rightPanelTab: "lyrics",
        showRightPanel: true,
        shuffle: false,
        volume: 0.8,
      }),
    );

    const state = createInitialPlayerState();

    expect(state.currentTrack).toMatchObject(normalizedStoredTrack);
    expect(state.hasPlaybackStarted).toBe(true);
    expect(state.showRightPanel).toBe(true);
  });

  it("keeps playback stopped when there is no restored current track", () => {
    const state = createInitialPlayerState();

    expect(state.currentTrack).toBeNull();
    expect(state.hasPlaybackStarted).toBe(false);
  });

  it("derives auto-quality mode from the stored quality preference", () => {
    window.localStorage.setItem(AUDIO_QUALITY_KEY, "AUTO");

    const state = createInitialPlayerState();

    expect(state.quality).toBe("AUTO");
    expect(state.autoQualityEnabled).toBe(true);
  });

});
