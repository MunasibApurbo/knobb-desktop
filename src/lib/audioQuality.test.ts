import {
  AUDIO_QUALITY_VALUES,
  formatAudioQualityLabel,
  formatAudioQualityTag,
  getAudioQualityOptions,
  getRecoveryQualityOrder,
  isAudioQuality,
} from "@/lib/audioQuality";

describe("audioQuality", () => {
  it("exposes the supported quality values in one place", () => {
    expect(AUDIO_QUALITY_VALUES).toEqual(["LOW", "MEDIUM", "HIGH", "LOSSLESS", "MAX"]);
  });

  it("validates known audio quality values", () => {
    expect(isAudioQuality("LOSSLESS")).toBe(true);
    expect(isAudioQuality("ULTRA")).toBe(false);
    expect(isAudioQuality(null)).toBe(false);
  });

  it("formats user-facing labels by language", () => {
    expect(formatAudioQualityLabel("LOSSLESS")).toBe("Lossless");
    expect(formatAudioQualityLabel("MAX")).toBe("Best");
    expect(formatAudioQualityLabel("LOW", "bn")).toBe("লো");
  });

  it("formats the technical quality tags", () => {
    expect(formatAudioQualityTag("HIGH")).toBe("320 kbps");
    expect(formatAudioQualityTag("LOSSLESS")).toBe("16-bit");
    expect(formatAudioQualityTag("MAX")).toBe("24-bit");
  });

  it("builds select options from the shared labels", () => {
    expect(getAudioQualityOptions("en")).toEqual([
      { value: "LOW", label: "Low", tag: "96 kbps" },
      { value: "MEDIUM", label: "Normal", tag: "160 kbps" },
      { value: "HIGH", label: "High", tag: "320 kbps" },
      { value: "LOSSLESS", label: "Lossless", tag: "16-bit" },
      { value: "MAX", label: "Best", tag: "24-bit" },
    ]);
  });

  it("returns the correct recovery order for playback fallback", () => {
    expect(getRecoveryQualityOrder("MAX")).toEqual(["MAX", "LOSSLESS", "HIGH", "LOW"]);
    expect(getRecoveryQualityOrder("MEDIUM")).toEqual(["MEDIUM", "LOW"]);
  });
});
