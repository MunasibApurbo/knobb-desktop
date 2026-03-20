import {
  AUDIO_QUALITY_VALUES,
  formatAudioQualityLabel,
  formatAudioQualityTag,
  getAudioQualityOptions,
  getAudioQualityOptionsForTrack,
  getAudioQualityOptionsForSource,
  getHighestResolvedAudioQuality,
  getAudioQualityTierFromResolvedLabel,
  getEffectivePlaybackQuality,
  getEffectiveAudioQualityForSource,
  getPlayableAudioQualityForTrack,
  getRecoveryQualityOrder,
  getRecoveryQualityOrderForSource,
  isAudioQuality,
} from "@/lib/audioQuality";

describe("audioQuality", () => {
  it("exposes the supported quality values in one place", () => {
    expect(AUDIO_QUALITY_VALUES).toEqual(["AUTO", "LOW", "MEDIUM", "HIGH", "LOSSLESS", "MAX"]);
  });

  it("validates known audio quality values", () => {
    expect(isAudioQuality("AUTO")).toBe(true);
    expect(isAudioQuality("LOSSLESS")).toBe(true);
    expect(isAudioQuality("ULTRA")).toBe(false);
    expect(isAudioQuality(null)).toBe(false);
  });

  it("formats user-facing labels by language", () => {
    expect(formatAudioQualityLabel("AUTO")).toBe("Auto");
    expect(formatAudioQualityLabel("LOSSLESS")).toBe("Lossless");
    expect(formatAudioQualityLabel("MAX")).toBe("Best");
    expect(formatAudioQualityLabel("LOW", "bn")).toBe("লো");
  });

  it("formats the technical quality tags", () => {
    expect(formatAudioQualityTag("AUTO")).toBe("Adaptive");
    expect(formatAudioQualityTag("HIGH")).toBe("320 kbps");
    expect(formatAudioQualityTag("LOSSLESS")).toBe("16-bit");
    expect(formatAudioQualityTag("MAX")).toBe("24-bit");
  });

  it("maps resolved stream labels into the app quality tiers", () => {
    expect(getAudioQualityTierFromResolvedLabel("AAC 69 kbps", "youtube-music")).toBe("LOW");
    expect(getAudioQualityTierFromResolvedLabel("AAC 128 kbps", "youtube-music")).toBe("MEDIUM");
    expect(getAudioQualityTierFromResolvedLabel("Opus 160 kbps", "youtube-music")).toBe("MEDIUM");
    expect(getAudioQualityTierFromResolvedLabel("Opus 251 kbps", "youtube-music")).toBe("HIGH");
    expect(getAudioQualityTierFromResolvedLabel("AAC 128 kbps", "tidal")).toBe("MEDIUM");
    expect(getAudioQualityTierFromResolvedLabel("AAC 512 kbps", "tidal")).toBe("HIGH");
    expect(getAudioQualityTierFromResolvedLabel("16-bit FLAC", "tidal")).toBe("LOSSLESS");
    expect(getAudioQualityTierFromResolvedLabel("24-bit FLAC", "tidal")).toBe("MAX");
    expect(getAudioQualityTierFromResolvedLabel("FLAC 900 kbps", "tidal")).toBe("LOSSLESS");
  });

  it("derives the highest real quality a track can provide from resolved stream labels", () => {
    expect(getHighestResolvedAudioQuality(["AAC 69 kbps", "AAC 128 kbps"], null, "youtube-music")).toBe("MEDIUM");
    expect(getHighestResolvedAudioQuality(["Opus 251 kbps", "AAC 128 kbps"], null, "youtube-music")).toBe("HIGH");
    expect(getHighestResolvedAudioQuality([], "AAC 69 kbps", "youtube-music")).toBe("LOW");
    expect(getHighestResolvedAudioQuality([], null, "youtube-music")).toBeNull();
  });

  it("builds select options from the shared labels", () => {
    expect(getAudioQualityOptions("en")).toEqual([
      { value: "AUTO", label: "Auto", tag: "Adaptive" },
      { value: "LOW", label: "Low", tag: "96 kbps" },
      { value: "MEDIUM", label: "Normal", tag: "160 kbps" },
      { value: "HIGH", label: "High", tag: "320 kbps" },
      { value: "LOSSLESS", label: "Lossless", tag: "16-bit" },
      { value: "MAX", label: "Best", tag: "24-bit" },
    ]);
  });

  it("returns the correct recovery order for playback fallback", () => {
    expect(getRecoveryQualityOrder("AUTO")).toEqual(["MAX", "LOSSLESS", "HIGH", "MEDIUM", "LOW"]);
    expect(getRecoveryQualityOrder("MAX")).toEqual(["MAX", "LOSSLESS", "HIGH", "MEDIUM", "LOW"]);
    expect(getRecoveryQualityOrder("MEDIUM")).toEqual(["MEDIUM", "LOW"]);
  });

  it("filters recovery order to source-supported qualities", () => {
    expect(getRecoveryQualityOrderForSource("AUTO", "youtube-music")).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect(getRecoveryQualityOrderForSource("HIGH", "youtube-music")).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect(getRecoveryQualityOrderForSource("MAX", "tidal")).toEqual(["MAX", "LOSSLESS", "HIGH", "LOW"]);
  });

  it("limits youtube music to actual supported audio tiers", () => {
    expect(getAudioQualityOptionsForSource("youtube-music")).toEqual([
      { value: "AUTO", label: "Auto", tag: "Adaptive" },
      { value: "LOW", label: "Low", tag: "96 kbps" },
      { value: "MEDIUM", label: "Normal", tag: "160 kbps" },
      { value: "HIGH", label: "High", tag: "320 kbps" },
    ]);
  });

  it("maps unsupported requested qualities to the effective provider quality", () => {
    expect(getEffectiveAudioQualityForSource("AUTO", "youtube-music")).toBe("HIGH");
    expect(getEffectiveAudioQualityForSource("AUTO", "tidal")).toBe("MAX");
    expect(getEffectiveAudioQualityForSource("LOSSLESS", "youtube-music")).toBe("HIGH");
    expect(getEffectiveAudioQualityForSource("MAX", "youtube-music")).toBe("HIGH");
    expect(getEffectiveAudioQualityForSource("MEDIUM", "tidal")).toBe("HIGH");
  });

  it("treats video playback as the best quality each provider can offer by default", () => {
    expect(getEffectivePlaybackQuality("LOSSLESS", "tidal", true)).toBe("MAX");
    expect(getEffectivePlaybackQuality("MAX", "youtube-music", true)).toBe("HIGH");
    expect(getEffectivePlaybackQuality("LOSSLESS", "tidal", false)).toBe("LOSSLESS");
  });

  it("limits track options to the actual track capability", () => {
    expect(getAudioQualityOptionsForTrack("tidal", "LOSSLESS")).toEqual([
      { value: "AUTO", label: "Auto", tag: "Adaptive" },
      { value: "LOW", label: "Low", tag: "96 kbps" },
      { value: "HIGH", label: "High", tag: "320 kbps" },
      { value: "LOSSLESS", label: "Lossless", tag: "16-bit" },
    ]);
  });

  it("caps the displayed playback quality to the current track capability", () => {
    expect(getPlayableAudioQualityForTrack("AUTO", "tidal", "LOSSLESS")).toBe("LOSSLESS");
    expect(getPlayableAudioQualityForTrack("LOSSLESS", "tidal", "HIGH")).toBe("HIGH");
    expect(getPlayableAudioQualityForTrack("MAX", "tidal", "LOSSLESS")).toBe("LOSSLESS");
    expect(getPlayableAudioQualityForTrack("LOW", "tidal", "LOSSLESS")).toBe("LOW");
  });
});
