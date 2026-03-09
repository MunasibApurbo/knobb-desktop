import type { AppLanguage } from "@/contexts/LanguageContext";
import type { AudioQuality } from "@/contexts/player/playerTypes";
import type { Track } from "@/types/music";

export const AUDIO_QUALITY_VALUES: readonly AudioQuality[] = ["LOW", "MEDIUM", "HIGH", "LOSSLESS", "MAX"];

export type AudioQualityOption = {
  value: AudioQuality;
  label: string;
  tag: string;
};

type DisplayAudioQuality = AudioQuality | Track["audioQuality"] | null | undefined;

const AUDIO_QUALITY_LABELS: Record<AppLanguage, Record<AudioQuality, string>> = {
  en: {
    LOW: "Low",
    MEDIUM: "Normal",
    HIGH: "High",
    LOSSLESS: "Lossless",
    MAX: "Best",
  },
  bn: {
    LOW: "লো",
    MEDIUM: "নরমাল",
    HIGH: "হাই",
    LOSSLESS: "লসলেস",
    MAX: "সেরা",
  },
};

const AUDIO_QUALITY_RECOVERY_ORDER: Record<AudioQuality, AudioQuality[]> = {
  LOW: ["LOW"],
  MEDIUM: ["MEDIUM", "LOW"],
  HIGH: ["HIGH", "LOW"],
  LOSSLESS: ["LOSSLESS", "HIGH", "LOW"],
  MAX: ["MAX", "LOSSLESS", "HIGH", "LOW"],
};

const AUDIO_QUALITY_TAGS: Record<AudioQuality, string> = {
  LOW: "96 kbps",
  MEDIUM: "160 kbps",
  HIGH: "320 kbps",
  LOSSLESS: "16-bit",
  MAX: "24-bit",
};

export function isAudioQuality(value: unknown): value is AudioQuality {
  return typeof value === "string" && AUDIO_QUALITY_VALUES.includes(value as AudioQuality);
}

export function formatAudioQualityLabel(quality: DisplayAudioQuality, language: AppLanguage = "en") {
  return isAudioQuality(quality) ? AUDIO_QUALITY_LABELS[language][quality] : AUDIO_QUALITY_LABELS[language].HIGH;
}

export function formatAudioQualityTag(quality: DisplayAudioQuality) {
  return isAudioQuality(quality) ? AUDIO_QUALITY_TAGS[quality] : AUDIO_QUALITY_TAGS.HIGH;
}

export function getAudioQualityOptions(language: AppLanguage = "en") {
  return AUDIO_QUALITY_VALUES.map((value) => ({
    value,
    label: AUDIO_QUALITY_LABELS[language][value],
    tag: AUDIO_QUALITY_TAGS[value],
  }));
}

export function getRecoveryQualityOrder(quality: AudioQuality) {
  return AUDIO_QUALITY_RECOVERY_ORDER[quality];
}
