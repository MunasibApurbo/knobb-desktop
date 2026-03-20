import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";

export type VideoFramePreference = "1:1" | "4:3" | "16:9";
export type VideoQualityPreference = "auto" | "480p" | "720p" | "1080p";

export const VIDEO_FRAME_PREFERENCE_KEY = "video-player-ratio-v2";
export const VIDEO_QUALITY_PREFERENCE_KEY = "video-quality-preference";
export const VIDEO_PLAYBACK_PREFERENCES_CHANGED_EVENT = "knobb:video-playback-preferences-changed";

const VIDEO_FRAME_PREFERENCES: VideoFramePreference[] = ["1:1", "4:3", "16:9"];
const DEFAULT_VIDEO_QUALITY_PREFERENCE: VideoQualityPreference = "1080p";

type DashBitrateInfo = {
  bitrate?: number;
  height?: number;
  qualityIndex?: number;
};

export type DashLikePlayer = {
  getBitrateInfoListFor?: (type: "video") => DashBitrateInfo[] | null | undefined;
  setAutoSwitchQualityFor?: (type: "video", enabled: boolean) => void;
  setQualityFor?: (type: "video", qualityIndex: number, forceReplace?: boolean) => void;
  updateSettings?: (settings: unknown) => void;
};

export type HlsLikePlayer = {
  levels?: Array<{ bitrate?: number; height?: number }>;
  autoLevelCapping?: number;
  startLevel?: number;
  nextLevel?: number;
  currentLevel?: number;
};

function isVideoFramePreference(value: string | null): value is VideoFramePreference {
  return typeof value === "string" && VIDEO_FRAME_PREFERENCES.includes(value as VideoFramePreference);
}

function isVideoQualityPreference(value: string | null): value is VideoQualityPreference {
  return value === "auto" || value === "480p" || value === "720p" || value === "1080p";
}

function getPreferredVideoHeight(quality: VideoQualityPreference) {
  switch (quality) {
    case "auto":
      return null;
    case "480p":
      return 480;
    case "720p":
      return 720;
    case "1080p":
    default:
      return 1080;
  }
}

function getEstimatedVideoBitrate(preferredHeight: number | null) {
  switch (preferredHeight) {
    case 480:
      return 800;
    case 720:
      return 2500;
    case 1080:
      return 5000;
    default:
      return -1;
  }
}

function getPreferredVideoBitrate(levels: DashBitrateInfo[], preferredHeight: number | null) {
  if (preferredHeight === null) {
    return -1;
  }

  if (levels.length === 0) {
    return getEstimatedVideoBitrate(preferredHeight);
  }

  const qualityIndex = findPreferredDashQualityIndex(levels, preferredHeight);
  if (qualityIndex < 0) return -1;

  const matchingLevel = levels.find((level, index) => (
    (typeof level.qualityIndex === "number" ? level.qualityIndex : index) === qualityIndex
  ));

  if (!matchingLevel || typeof matchingLevel.bitrate !== "number" || !Number.isFinite(matchingLevel.bitrate)) {
    return -1;
  }

  return Math.max(1, Math.round(matchingLevel.bitrate / 1000));
}

function notifyVideoPlaybackPreferenceChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VIDEO_PLAYBACK_PREFERENCES_CHANGED_EVENT));
}

function findPreferredDashQualityIndex(levels: DashBitrateInfo[], preferredHeight: number) {
  if (levels.length === 0) return -1;

  const sortedLevels = levels
    .map((level, index) => ({
      bitrate: typeof level.bitrate === "number" && Number.isFinite(level.bitrate) ? level.bitrate : 0,
      height: typeof level.height === "number" && Number.isFinite(level.height) ? level.height : 0,
      qualityIndex:
        typeof level.qualityIndex === "number" && Number.isFinite(level.qualityIndex)
          ? level.qualityIndex
          : index,
    }))
    .sort((left, right) => left.height - right.height || left.bitrate - right.bitrate);

  const preferredLevel =
    sortedLevels.filter((level) => level.height <= preferredHeight).pop() ??
    sortedLevels[sortedLevels.length - 1];

  return preferredLevel?.qualityIndex ?? -1;
}

function findPreferredHlsLevel(levels: Array<{ bitrate?: number; height?: number }>, preferredHeight: number) {
  if (levels.length === 0) return -1;

  const sortedLevels = levels
    .map((level, index) => ({
      index,
      bitrate: typeof level.bitrate === "number" && Number.isFinite(level.bitrate) ? level.bitrate : 0,
      height: typeof level.height === "number" && Number.isFinite(level.height) ? level.height : 0,
    }))
    .sort((left, right) => left.height - right.height || left.bitrate - right.bitrate);

  const preferredLevel =
    sortedLevels.filter((level) => level.height <= preferredHeight).pop() ??
    sortedLevels[sortedLevels.length - 1];

  return preferredLevel?.index ?? -1;
}

export function getVideoFramePreference(): VideoFramePreference {
  const storedValue = safeStorageGetItem(VIDEO_FRAME_PREFERENCE_KEY);
  return isVideoFramePreference(storedValue) ? storedValue : "16:9";
}

export function setVideoFramePreference(preference: VideoFramePreference) {
  safeStorageSetItem(VIDEO_FRAME_PREFERENCE_KEY, preference);
  notifyVideoPlaybackPreferenceChange();
}

export function formatVideoFramePreference(preference: VideoFramePreference) {
  return preference;
}

export function getVideoFrameAspectRatio(preference: VideoFramePreference, fallbackRatio?: number | null) {
  if (fallbackRatio && Number.isFinite(fallbackRatio) && fallbackRatio > 0) {
    return fallbackRatio;
  }

  switch (preference) {
    case "4:3":
      return 4 / 3;
    case "1:1":
      return 1 / 1;
    case "16:9":
    default:
      return 16 / 9;
  }
}

export function getVideoQualityPreference(): VideoQualityPreference {
  const storedValue = safeStorageGetItem(VIDEO_QUALITY_PREFERENCE_KEY);
  if (storedValue === "480p" || storedValue === "720p" || storedValue === "1080p") {
    return storedValue;
  }

  if (isVideoQualityPreference(storedValue)) {
    return DEFAULT_VIDEO_QUALITY_PREFERENCE;
  }

  return DEFAULT_VIDEO_QUALITY_PREFERENCE;
}

export function setVideoQualityPreference(preference: VideoQualityPreference) {
  void preference;
  safeStorageSetItem(VIDEO_QUALITY_PREFERENCE_KEY, DEFAULT_VIDEO_QUALITY_PREFERENCE);
  notifyVideoPlaybackPreferenceChange();
}

export function formatVideoQualityPreference(preference: VideoQualityPreference) {
  return preference === "auto" ? "Auto" : preference;
}

export function formatResolvedVideoQuality(height: number | null | undefined) {
  if (!Number.isFinite(height) || Number(height) <= 0) {
    return null;
  }

  return `${Math.round(Number(height))}p`;
}

export function applyDashVideoQualityPreference(player: DashLikePlayer | null | undefined, preference: VideoQualityPreference) {
  if (!player) {
    return;
  }

  if (preference === "auto") {
    player.setAutoSwitchQualityFor?.("video", true);
    player.updateSettings?.({
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
    return;
  }

  if (!player.getBitrateInfoListFor) {
    return;
  }

  const bitrateLevels = player.getBitrateInfoListFor("video") || [];
  const preferredHeight = getPreferredVideoHeight(preference);
  const qualityIndex = preferredHeight === null ? -1 : findPreferredDashQualityIndex(bitrateLevels, preferredHeight);
  const maxBitrate = getPreferredVideoBitrate(bitrateLevels, preferredHeight);
  player.setAutoSwitchQualityFor?.("video", false);
  player.updateSettings?.({
    streaming: {
      abr: {
        autoSwitchBitrate: {
          video: false,
        },
        initialBitrate: {
          video: maxBitrate > 0 ? maxBitrate : 900,
        },
        maxBitrate: {
          video: maxBitrate,
        },
      },
    },
  });
  if (qualityIndex >= 0) {
    player.setQualityFor?.("video", qualityIndex, true);
  }
}

export function applyHlsVideoQualityPreference(player: HlsLikePlayer | null | undefined, preference: VideoQualityPreference) {
  if (!player) return;

  if (preference === "auto") {
    player.autoLevelCapping = -1;
    player.startLevel = 0;
    player.nextLevel = -1;
    return;
  }

  const preferredHeight = getPreferredVideoHeight(preference);
  const qualityIndex = preferredHeight === null ? -1 : findPreferredHlsLevel(player.levels || [], preferredHeight);
  if (qualityIndex < 0) return;

  player.autoLevelCapping = qualityIndex;
  player.startLevel = qualityIndex;
  player.nextLevel = qualityIndex;
  player.currentLevel = qualityIndex;
}
