import { useEffect, useState } from "react";

export function readReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readDeviceSignals() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      deviceMemory: null,
      hardwareConcurrency: null,
      prefersReducedMotion: false,
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
  };

  const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : null;
  const prefersReducedMotion = readReducedMotionPreference();

  return {
    deviceMemory,
    hardwareConcurrency,
    prefersReducedMotion,
  };
}

function readLowEndDeviceState() {
  const { deviceMemory, hardwareConcurrency, prefersReducedMotion } = readDeviceSignals();

  return (
    prefersReducedMotion ||
    (deviceMemory !== null && deviceMemory <= 4) ||
    (hardwareConcurrency !== null && hardwareConcurrency <= 4)
  );
}

function readStrongDesktopEffectsState() {
  const { deviceMemory, hardwareConcurrency, prefersReducedMotion } = readDeviceSignals();

  if (prefersReducedMotion) return false;

  const hasStrongMemory = deviceMemory === null || deviceMemory >= 8;
  const hasStrongCpu = hardwareConcurrency === null || hardwareConcurrency >= 10;

  return hasStrongMemory && hasStrongCpu;
}

export function useLowEndDevice() {
  const [lowEndDevice, setLowEndDevice] = useState(() => readLowEndDeviceState());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setLowEndDevice(readLowEndDeviceState());

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return lowEndDevice;
}

export function useStrongDesktopEffects() {
  const [strongDesktopEffects, setStrongDesktopEffects] = useState(() => readStrongDesktopEffectsState());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStrongDesktopEffects(readStrongDesktopEffectsState());

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return strongDesktopEffects;
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => readReducedMotionPreference());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(readReducedMotionPreference());

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export function scheduleBackgroundTask(task: () => void, timeout = 1200) {
  if (typeof window === "undefined") {
    task();
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(() => task(), { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(task, Math.min(timeout, 800));
  return () => window.clearTimeout(timeoutId);
}
