import { Track } from "@/types/music";

export type AudioQuality = "AUTO" | "LOW" | "MEDIUM" | "HIGH" | "LOSSLESS" | "MAX";
export type PlaybackMode = "native" | "youtube-embed";
export type RightPanelTab = "lyrics" | "queue";

export interface PlayerState {
  currentTrack: Track | null;
  resolvedAudioQuality: AudioQuality | null;
  resolvedAvailableAudioQualityLabels: string[];
  resolvedAudioQualityLabel: string | null;
  resolvedVideoQuality: string | null;
  playbackMode: PlaybackMode;
  hasPlaybackStarted: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Track[];
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  volume: number;
  showRightPanel: boolean;
  rightPanelTab: RightPanelTab;
  isLoading: boolean;
  autoQualityEnabled: boolean;
  quality: AudioQuality;
  normalization: boolean;
  equalizerEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  preampDb: number;
  monoAudioEnabled: boolean;
  crossfadeDuration: number;
  playbackSpeed: number;
  preservePitch: boolean;
  sleepTimerEndsAt: number | null;
  isFullScreen: boolean;
}

export type AlbumPlaybackTarget = {
  id: number | string;
  title: string;
  artist?: { name: string };
  artists?: { name: string }[];
};
