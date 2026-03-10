import { renderHook } from "@testing-library/react";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";

const motionPreferenceMocks = vi.hoisted(() => ({
  animationsEnabled: true,
  blurEffects: true,
  websiteMode: "roundish" as const,
  animationMode: "full" as "full" | "off" | "reduced",
  isMobile: false,
  prefersReducedMotion: false,
  lowEndDevice: false,
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => motionPreferenceMocks.isMobile,
}));

vi.mock("@/lib/performanceProfile", () => ({
  usePrefersReducedMotion: () => motionPreferenceMocks.prefersReducedMotion,
  useLowEndDevice: () => motionPreferenceMocks.lowEndDevice,
  useStrongDesktopEffects: () => motionPreferenceMocks.strongDesktopEffects,
}));

describe("useMotionPreferences", () => {
  beforeEach(() => {
    motionPreferenceMocks.animationsEnabled = true;
    motionPreferenceMocks.blurEffects = true;
    motionPreferenceMocks.websiteMode = "roundish";
    motionPreferenceMocks.animationMode = "full";
    motionPreferenceMocks.isMobile = false;
    motionPreferenceMocks.prefersReducedMotion = false;
    motionPreferenceMocks.lowEndDevice = false;
    motionPreferenceMocks.strongDesktopEffects = false;
  });

  it("keeps roundish motion preferences on desktop", () => {
    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.websiteMode).toBe("roundish");
    expect(result.current.isRoundish).toBe(true);
    expect(result.current.motionEnabled).toBe(true);
  });

  it("forces roundish motion preferences on mobile", () => {
    motionPreferenceMocks.isMobile = true;

    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.websiteMode).toBe("roundish");
    expect(result.current.isRoundish).toBe(true);
    expect(result.current.allowAmbientMotion).toBe(true);
    expect(result.current.allowShellAmbientMotion).toBe(true);
  });

  it("uses strong desktop effects only for shell depth on desktop", () => {
    motionPreferenceMocks.strongDesktopEffects = true;

    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current.motionEnabled).toBe(true);
    expect(result.current.allowAmbientMotion).toBe(true);
    expect(result.current.allowShellAmbientMotion).toBe(true);
  });
});
