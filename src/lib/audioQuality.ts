import type { AppLanguage } from "@/contexts/LanguageContext";
import type { AudioQuality } from "@/contexts/player/playerTypes";
import type { TrackSource } from "@/lib/librarySources";
import type { Track } from "@/types/music";

type FixedAudioQuality = Exclude<AudioQuality, "AUTO">;
const FIXED_AUDIO_QUALITY_VALUES: readonly FixedAudioQuality[] = ["LOW", "MEDIUM", "HIGH", "LOSSLESS", "MAX"];

export const AUDIO_QUALITY_VALUES: readonly AudioQuality[] = ["AUTO", "LOW", "MEDIUM", "HIGH", "LOSSLESS", "MAX"];

export type AudioQualityOption = {
  value: AudioQuality;
  label: string;
  tag: string;
};

type DisplayAudioQuality = AudioQuality | Track["audioQuality"] | null | undefined;

const AUDIO_QUALITY_LABELS: Record<AppLanguage, Record<AudioQuality, string>> = {
  en: {
    AUTO: "Auto",
    LOW: "Low",
    MEDIUM: "Normal",
    HIGH: "High",
    LOSSLESS: "Lossless",
    MAX: "Best",
  },
  bn: {
    AUTO: "অটো",
    LOW: "লো",
    MEDIUM: "নরমাল",
    HIGH: "হাই",
    LOSSLESS: "লসলেস",
    MAX: "সেরা",
  },
};

const AUDIO_QUALITY_RECOVERY_ORDER: Record<AudioQuality, FixedAudioQuality[]> = {
  AUTO: ["MAX", "LOSSLESS", "HIGH", "MEDIUM", "LOW"],
  LOW: ["LOW"],
  MEDIUM: ["MEDIUM", "LOW"],
  HIGH: ["HIGH", "MEDIUM", "LOW"],
  LOSSLESS: ["LOSSLESS", "HIGH", "MEDIUM", "LOW"],
  MAX: ["MAX", "LOSSLESS", "HIGH", "MEDIUM", "LOW"],
};

const AUDIO_QUALITY_TAGS: Record<AudioQuality, string> = {
  AUTO: "Adaptive",
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

export function getAudioQualityTierFromResolvedLabel(
  label: string | null | undefined,
): FixedAudioQuality | null {
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }

  const normalized = label.trim().toLowerCase();
  if (normalized.includes("24-bit") || normalized.includes("24 bit")) {
    return "MAX";
  }

  if (normalized.includes("16-bit") || normalized.includes("16 bit")) {
    return "LOSSLESS";
  }

  if (normalized.includes("lossless") || normalized.includes("flac") || normalized.includes("alac")) {
    return "LOSSLESS";
  }

  const bitrateMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kbps/i);
  const bitrateKbps = bitrateMatch ? Number.parseFloat(bitrateMatch[1]) : NaN;
  if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) {
    return null;
  }

  if (bitrateKbps <= 96) return "LOW";
  if (bitrateKbps <= 160) return "MEDIUM";
  return "HIGH";
}

export function getAudioQualityOptions(language: AppLanguage = "en") {
  return AUDIO_QUALITY_VALUES.map((value) => ({
    value,
    label: AUDIO_QUALITY_LABELS[language][value],
    tag: AUDIO_QUALITY_TAGS[value],
  }));
}

export function getSupportedAudioQualities(source: TrackSource | null | undefined): readonly FixedAudioQuality[] {
  if (source === "youtube-music") {
    return ["LOW", "MEDIUM", "HIGH"];
  }

  if (source === "tidal") {
    return ["LOW", "HIGH", "LOSSLESS", "MAX"];
  }

  return ["LOW", "MEDIUM", "HIGH"];
}

function getAutomaticAudioQualityForSource(source: TrackSource | null | undefined): FixedAudioQuality {
  const supported = getSupportedAudioQualities(source);
  return supported[supported.length - 1] || "HIGH";
}

export function getEffectiveAudioQualityForSource(
  quality: AudioQuality,
  source: TrackSource | null | undefined,
): FixedAudioQuality {
  if (quality === "AUTO") {
    return getAutomaticAudioQualityForSource(source);
  }

  const supported = getSupportedAudioQualities(source);
  if (supported.includes(quality)) {
    return quality;
  }

  if (source === "youtube-music") {
    return "HIGH";
  }

  if (source === "tidal" && quality === "MEDIUM") {
    return "HIGH";
  }

  return supported[supported.length - 1] || "HIGH";
}

export function getEffectivePlaybackQuality(
  quality: AudioQuality,
  source: TrackSource | null | undefined,
  isVideo = false,
): AudioQuality {
  if (isVideo) {
    return getAutomaticAudioQualityForSource(source);
  }

  return getEffectiveAudioQualityForSource(quality, source);
}

export function getPlayableAudioQualityForTrack(
  quality: AudioQuality,
  source: TrackSource | null | undefined,
  capability: AudioQuality | null | undefined,
  isVideo = false,
): AudioQuality {
  const effectiveQuality = getEffectivePlaybackQuality(quality, source, isVideo);
  if (isVideo || !capability) {
    return effectiveQuality;
  }

  const supported = getSupportedAudioQualities(source);
  const effectiveIndex = supported.indexOf(effectiveQuality);
  const capabilityIndex = supported.indexOf(getEffectiveAudioQualityForSource(capability, source));
  if (effectiveIndex < 0 || capabilityIndex < 0) {
    return effectiveQuality;
  }

  return supported[Math.min(effectiveIndex, capabilityIndex)] || effectiveQuality;
}

export function getAudioQualityOptionsForSource(source: TrackSource | null | undefined, language: AppLanguage = "en") {
  return [
    {
      value: "AUTO" as const,
      label: AUDIO_QUALITY_LABELS[language].AUTO,
      tag: AUDIO_QUALITY_TAGS.AUTO,
    },
    ...getSupportedAudioQualities(source).map((value) => ({
      value,
      label: AUDIO_QUALITY_LABELS[language][value],
      tag: AUDIO_QUALITY_TAGS[value],
    })),
  ];
}

export function getHighestResolvedAudioQuality(
  labels: string[] | null | undefined,
  fallbackLabel?: string | null,
  source?: TrackSource | null,
): FixedAudioQuality | null {
  const supported = getSupportedAudioQualities(source);
  const candidates = [
    ...(Array.isArray(labels) ? labels : []),
    ...(typeof fallbackLabel === "string" && fallbackLabel.trim() ? [fallbackLabel] : []),
  ];

  let highest: FixedAudioQuality | null = null;
  let highestIndex = -1;

  for (const candidate of candidates) {
    const tier = getAudioQualityTierFromResolvedLabel(candidate, source);
    if (!tier) continue;

    const tierIndex = supported.includes(tier)
      ? supported.indexOf(tier)
      : FIXED_AUDIO_QUALITY_VALUES.indexOf(tier);
    if (tierIndex > highestIndex) {
      highest = tier;
      highestIndex = tierIndex;
    }
  }

  return highest;
}

export function getAudioQualityOptionsForTrack(
  source: TrackSource | null | undefined,
  capability: AudioQuality | null | undefined,
  language: AppLanguage = "en",
) {
  const supported = getSupportedAudioQualities(source);
  const maxSupportedQuality = capability
    ? getEffectiveAudioQualityForSource(capability, source)
    : supported[supported.length - 1];
  const maxIndex = supported.indexOf(maxSupportedQuality);
  const limited = maxIndex >= 0 ? supported.slice(0, maxIndex + 1) : supported;

  return [
    {
      value: "AUTO" as const,
      label: AUDIO_QUALITY_LABELS[language].AUTO,
      tag: AUDIO_QUALITY_TAGS.AUTO,
    },
    ...limited.map((value) => ({
      value,
      label: AUDIO_QUALITY_LABELS[language][value],
      tag: AUDIO_QUALITY_TAGS[value],
    })),
  ];
}

export function getRecoveryQualityOrder(quality: AudioQuality) {
  return AUDIO_QUALITY_RECOVERY_ORDER[quality];
}

export function getRecoveryQualityOrderForSource(
  quality: AudioQuality,
  source: TrackSource | null | undefined,
) {
  const supported = getSupportedAudioQualities(source);
  const effectiveQuality = getEffectiveAudioQualityForSource(quality, source);

  return AUDIO_QUALITY_RECOVERY_ORDER[effectiveQuality].filter((candidate, index, collection) => (
    supported.includes(candidate) && collection.indexOf(candidate) === index
  ));
}
