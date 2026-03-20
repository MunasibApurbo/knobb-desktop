import { describe, expect, it, vi } from "vitest";

import {
  applyDashVideoQualityPreference,
  applyHlsVideoQualityPreference,
  formatVideoQualityPreference,
} from "@/lib/videoPlaybackPreferences";

describe("videoPlaybackPreferences", () => {
  it("formats auto as a user-facing adaptive quality label", () => {
    expect(formatVideoQualityPreference("auto")).toBe("Auto");
  });

  it("keeps DASH adaptive when video quality is auto", () => {
    const player = {
      setAutoSwitchQualityFor: vi.fn(),
      updateSettings: vi.fn(),
    };

    applyDashVideoQualityPreference(player, "auto");

    expect(player.setAutoSwitchQualityFor).toHaveBeenCalledWith("video", true);
    expect(player.updateSettings).toHaveBeenCalledWith({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: true,
          },
          initialBitrate: {
            video: 900,
          },
          maxBitrate: {
            video: -1,
          },
        },
      },
    });
  });

  it("hard-locks DASH to the fixed rendition when video quality is not auto", () => {
    const player = {
      getBitrateInfoListFor: vi.fn(() => [
        { bitrate: 800_000, height: 480, qualityIndex: 0 },
        { bitrate: 2_500_000, height: 720, qualityIndex: 1 },
        { bitrate: 5_000_000, height: 1080, qualityIndex: 2 },
      ]),
      setAutoSwitchQualityFor: vi.fn(),
      updateSettings: vi.fn(),
      setQualityFor: vi.fn(),
    };

    applyDashVideoQualityPreference(player, "720p");

    expect(player.setAutoSwitchQualityFor).toHaveBeenCalledWith("video", false);
    expect(player.updateSettings).toHaveBeenCalledWith({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: false,
          },
          initialBitrate: {
            video: 2500,
          },
          maxBitrate: {
            video: 2500,
          },
        },
      },
    });
    expect(player.setQualityFor).toHaveBeenCalledWith("video", 1, true);
  });

  it("uses an estimated DASH startup bitrate when the manifest ladder is not ready yet", () => {
    const player = {
      getBitrateInfoListFor: vi.fn(() => []),
      setAutoSwitchQualityFor: vi.fn(),
      updateSettings: vi.fn(),
    };

    applyDashVideoQualityPreference(player, "1080p");

    expect(player.setAutoSwitchQualityFor).toHaveBeenCalledWith("video", false);
    expect(player.updateSettings).toHaveBeenCalledWith({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: false,
          },
          initialBitrate: {
            video: 5000,
          },
          maxBitrate: {
            video: 5000,
          },
        },
      },
    });
  });

  it("keeps HLS adaptive when video quality is auto", () => {
    const player = {
      autoLevelCapping: 2,
      startLevel: 2,
      nextLevel: 2,
    };

    applyHlsVideoQualityPreference(player, "auto");

    expect(player.autoLevelCapping).toBe(-1);
    expect(player.startLevel).toBe(0);
    expect(player.nextLevel).toBe(-1);
  });

  it("hard-locks HLS to the fixed rendition when video quality is not auto", () => {
    const player = {
      levels: [
        { bitrate: 800_000, height: 480 },
        { bitrate: 2_500_000, height: 720 },
        { bitrate: 5_000_000, height: 1080 },
      ],
      autoLevelCapping: -1,
      startLevel: -1,
      nextLevel: -1,
      currentLevel: 2,
    };

    applyHlsVideoQualityPreference(player, "720p");

    expect(player.autoLevelCapping).toBe(1);
    expect(player.startLevel).toBe(1);
    expect(player.nextLevel).toBe(1);
    expect(player.currentLevel).toBe(1);
  });
});
