import { useMemo } from "react";

import { useSettings } from "@/contexts/SettingsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useLowEndDevice,
  usePrefersReducedMotion,
  useStrongDesktopEffects,
} from "@/lib/performanceProfile";

export function useMotionPreferences() {
  const { animationsEnabled, blurEffects, websiteMode, animationMode } = useSettings();
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEndDevice = useLowEndDevice();
  const strongDesktopEffects = useStrongDesktopEffects();

  return useMemo(() => {
    const effectiveWebsiteMode = isMobile ? "roundish" : websiteMode;
    const baseMotionEnabled = animationsEnabled && animationMode !== "off" && !prefersReducedMotion;
    const motionEnabled = baseMotionEnabled && !lowEndDevice;
    const allowDepthMotion = motionEnabled && animationMode === "full";
    const allowAmbientMotion = allowDepthMotion && blurEffects;
    const allowShellDepthMotion = baseMotionEnabled && animationMode === "full" && (isMobile ? !lowEndDevice : strongDesktopEffects);
    const allowShellAmbientMotion = allowShellDepthMotion && blurEffects;
    const isRoundish = effectiveWebsiteMode === "roundish";

    return {
      motionEnabled,
      allowDepthMotion,
      allowAmbientMotion,
      allowShellDepthMotion,
      allowShellAmbientMotion,
      websiteMode: effectiveWebsiteMode,
      isRoundish,
      prefersReducedMotion,
      lowEndDevice,
      strongDesktopEffects,
    };
  }, [animationsEnabled, animationMode, blurEffects, isMobile, lowEndDevice, prefersReducedMotion, strongDesktopEffects, websiteMode]);
}
