import type { VideoQualityPreference } from "@/lib/videoPlaybackPreferences";

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: [6, 5, 3.5, 2, 1, 0, 0, 0, 0, 0],
  bassReducer: [-6, -5, -3, -2, -1, 0, 0, 0, 0, 0],
  trebleBoost: [0, 0, 0, 0, 0, 0.5, 1.5, 3, 4.5, 6],
  vocalBoost: [-2, -1, 0, 1, 2.5, 3.5, 2.5, 1, 0, -1.5],
  loudness: [5, 4, 2.5, 1, 0, -0.5, 0, 1.5, 3.5, 4.5],
  rock: [4, 3, 2, 0.5, -1, -0.5, 1, 2.5, 3, 2],
  electronic: [4.5, 3.5, 2.5, 0.5, -0.5, 0.5, 1.5, 2.5, 3.5, 3],
} as const;

export type PlaybackSource = {
  availableAudioQualityLabels?: string[];
  audioUrl?: string;
  audioQualityLabel?: string;
  fallbackUrl?: string;
  fallbackVideoHeight?: number;
  videoHeight?: number;
  videoQualityPreference?: VideoQualityPreference;
  url: string;
  type: "direct" | "dash" | "hls";
};
