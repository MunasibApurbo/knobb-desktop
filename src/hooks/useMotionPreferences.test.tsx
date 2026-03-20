import { renderHook } from "@testing-library/react";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";

const motionPreferenceMocks = vi.hoisted(() => ({
  animationsEnabled: true,
  blurEffects: true,
  websiteMode: "roundish" as const,
  animationMode: "full" as "full" | "off" | "reduced",
  prefersReducedMotion: false,
  lowEndDevice: false,
  hasHoverCapablePointer: true,
  strongDesktopEffects: false,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    animationsEnabled: motionPreferenceMocks.animationsEnabled,
    blurEffects: motionPreferenceMocks.blurEffects,
    websiteMode: motionPreferenceMocks.websiteMode,
    animationMode: motionPreferenceMocks.animationMode,
  }),
}));

vi.mock("@/lib/performanceProfile", () => ({
  usePrefersReducedMotion: () => motionPreferenceMocks.prefersReducedMotion,
  useLowEndDevice: () => motionPreferenceMocks.lowEndDevice,
  useHoverCapablePointer: () => motionPreferenceMocks.hasHoverCapablePointer,
  useStrongDesktopEffects: () => motionPreferenceMocks.strongDesktopEffects,
}));

describe("useMotionPreferences", () => {
  beforeEach(() => {
    motionPreferenceMocks.animationsEnabled = true;
    motionPreferenceMocks.blurEffects = true;
    motionPreferenceMocks.websiteMode = "roundish";
    motionPreferenceMocks.animationMode = "full";
    motionPreferenceMocks.prefersReducedMotion = false;
    motionPreferenceMocks.lowEndDevice = false;
    motionPreferenceMocks.hasHoverCapablePointer = true;
    motionPreferenceMocks.strongDesktopEffects = false;
  });

  it("keeps roundish motion preferences on desktop", () => {
    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.websiteMode).toBe("roundish");
    expect(result.current.isRoundish).toBe(true);
    expect(result.current.motionEnabled).toBe(true);
    expect(result.current.cardHoverProfile).toBe("balanced");
    expect(result.current.allowDepthMotion).toBe(false);
    expect(result.current.allowShellDepthMotion).toBe(false);
    expect(result.current.preferLightweightMotion).toBe(true);
    expect(result.current.allowHeavyBlur).toBe(false);
  });

  it("keeps shell ambient motion disabled on desktop", () => {
    motionPreferenceMocks.strongDesktopEffects = true;

    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.motionEnabled).toBe(true);
    expect(result.current.allowAmbientMotion).toBe(false);
    expect(result.current.allowShellAmbientMotion).toBe(false);
    expect(result.current.allowShellDepthMotion).toBe(true);
    expect(result.current.allowDepthMotion).toBe(true);
    expect(result.current.allowHeavyBlur).toBe(true);
    expect(result.current.preferLightweightMotion).toBe(false);
    expect(result.current.allowRealtimeEffects).toBe(true);
    expect(result.current.cardHoverProfile).toBe("premium");
  });

  it("keeps card hover light on low-end devices while disabling depth motion", () => {
    motionPreferenceMocks.lowEndDevice = true;
    motionPreferenceMocks.strongDesktopEffects = true;

    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.motionEnabled).toBe(true);
    expect(result.current.allowDepthMotion).toBe(false);
    expect(result.current.preferLightweightMotion).toBe(true);
    expect(result.current.allowHeavyBlur).toBe(false);
    expect(result.current.cardHoverProfile).toBe("lite");
  });

  it("disables hover-heavy card motion on touch-style pointers", () => {
    motionPreferenceMocks.hasHoverCapablePointer = false;
    motionPreferenceMocks.strongDesktopEffects = true;

    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.allowDepthMotion).toBe(false);
    expect(result.current.allowShellDepthMotion).toBe(false);
    expect(result.current.cardHoverProfile).toBe("static");
  });
});
