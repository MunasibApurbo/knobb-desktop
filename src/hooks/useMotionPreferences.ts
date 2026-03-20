import { useMemo } from "react";

import { useSettings } from "@/contexts/SettingsContext";
import {
  useHoverCapablePointer,
  useLowEndDevice,
  usePrefersReducedMotion,
  useStrongDesktopEffects,
} from "@/lib/performanceProfile";

export function useMotionPreferences() {
  const { animationsEnabled, blurEffects, websiteMode, animationMode } = useSettings();
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEndDevice = useLowEndDevice();
  const hasHoverCapablePointer = useHoverCapablePointer();
  const strongDesktopEffects = useStrongDesktopEffects();

  return useMemo(() => {
    const baseMotionEnabled = animationsEnabled && animationMode !== "off" && !prefersReducedMotion;
    const reducedAnimationMode = animationMode === "reduced";
    const motionEnabled = baseMotionEnabled;
    const preferLightweightMotion = reducedAnimationMode || lowEndDevice || !strongDesktopEffects;
    const canUsePremiumDesktopEffects =
      blurEffects &&
      animationMode === "full" &&
      strongDesktopEffects &&
      hasHoverCapablePointer &&
      !lowEndDevice;
    const allowDepthMotion =
      baseMotionEnabled &&
      animationMode === "full" &&
      strongDesktopEffects &&
      hasHoverCapablePointer &&
      !lowEndDevice;
    const allowAmbientMotion = false;
    const allowShellDepthMotion =
      baseMotionEnabled &&
      animationMode === "full" &&
      strongDesktopEffects &&
      hasHoverCapablePointer &&
      !lowEndDevice;
    const allowShellAmbientMotion = false;
    const allowHeavyBlur = canUsePremiumDesktopEffects;
    const allowRealtimeEffects =
      motionEnabled &&
      animationMode === "full" &&
      strongDesktopEffects &&
      hasHoverCapablePointer &&
      !lowEndDevice;
    const isRoundish = websiteMode === "roundish";
    const cardHoverProfile =
      !motionEnabled
        ? "static"
        : !hasHoverCapablePointer
          ? "static"
          : lowEndDevice
            ? "lite"
            : strongDesktopEffects && animationMode === "full"
              ? "premium"
              : "balanced";

    return {
      motionEnabled,
      allowDepthMotion,
      allowAmbientMotion,
      allowShellDepthMotion,
      allowShellAmbientMotion,
      allowHeavyBlur,
      allowRealtimeEffects,
      websiteMode,
      isRoundish,
      prefersReducedMotion,
      lowEndDevice,
      hasHoverCapablePointer,
      strongDesktopEffects,
      preferLightweightMotion,
      reducedAnimationMode,
      cardHoverProfile,
    };
  }, [animationsEnabled, animationMode, blurEffects, hasHoverCapablePointer, lowEndDevice, prefersReducedMotion, strongDesktopEffects, websiteMode]);
}
