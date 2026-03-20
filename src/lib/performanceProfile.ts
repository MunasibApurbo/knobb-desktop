import { useEffect, useState, useSyncExternalStore } from "react";

export function readReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readHoverCapablePointer() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
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

function readNetworkSignals() {
  if (typeof navigator === "undefined") {
    return {
      saveData: false,
      effectiveType: null as string | null,
    };
  }

  const connection = (navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  }).connection;

  return {
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType ?? null,
  };
}

export function readStartupPerformanceBudget() {
  const lowEndDevice = readLowEndDeviceState();
  const { saveData, effectiveType } = readNetworkSignals();
  const constrainedNetwork =
    saveData ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g";

  return {
    lowEndDevice,
    constrainedNetwork,
    shouldDeferNonCriticalBootWork: lowEndDevice || constrainedNetwork,
    canPreloadLikelyRoutes: !constrainedNetwork && !lowEndDevice,
    canWarmPlaybackStackEagerly: !constrainedNetwork && !lowEndDevice,
  };
}

function readStrongDesktopEffectsState() {
  const { deviceMemory, hardwareConcurrency, prefersReducedMotion } = readDeviceSignals();

  if (prefersReducedMotion) return false;

  const hasStrongMemory = deviceMemory === null || deviceMemory >= 8;
  const hasStrongCpu = hardwareConcurrency === null || hardwareConcurrency >= 10;

  return hasStrongMemory && hasStrongCpu;
}

export function readStrongDesktopEffectsPreference() {
  return readStrongDesktopEffectsState();
}

type SnapshotListener = () => void;

type SharedSnapshotStore<T> = {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (listener: SnapshotListener) => () => void;
};

function createMediaQueryStore(
  query: string,
  readSnapshot: () => boolean,
): SharedSnapshotStore<boolean> {
  let mediaQuery: MediaQueryList | null = null;
  let cleanup: (() => void) | null = null;
  let currentSnapshot = readSnapshot();
  const listeners = new Set<SnapshotListener>();

  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  const handleChange = () => {
    const nextSnapshot = readSnapshot();
    if (Object.is(currentSnapshot, nextSnapshot)) return;
    currentSnapshot = nextSnapshot;
    notifyListeners();
  };

  const ensureSubscription = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function" || mediaQuery) {
      return;
    }

    mediaQuery = window.matchMedia(query);
    currentSnapshot = readSnapshot();
    mediaQuery.addEventListener("change", handleChange);
    cleanup = () => {
      mediaQuery?.removeEventListener("change", handleChange);
      mediaQuery = null;
      cleanup = null;
    };
  };

  return {
    getSnapshot: () => {
      currentSnapshot = readSnapshot();
      return currentSnapshot;
    },
    getServerSnapshot: readSnapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      ensureSubscription();

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          cleanup?.();
        }
      };
    },
  };
}

function createSharedStore<T>(
  readSnapshot: () => T,
  subscribeToChanges: (listener: SnapshotListener) => () => void,
): SharedSnapshotStore<T> {
  return {
    getSnapshot: readSnapshot,
    getServerSnapshot: readSnapshot,
    subscribe: subscribeToChanges,
  };
}

const reducedMotionStore = createMediaQueryStore(
  "(prefers-reduced-motion: reduce)",
  readReducedMotionPreference,
);

const hoverCapablePointerStore = createMediaQueryStore(
  "(hover: hover) and (pointer: fine)",
  readHoverCapablePointer,
);

const lowEndDeviceStore = createSharedStore(
  readLowEndDeviceState,
  reducedMotionStore.subscribe,
);

const strongDesktopEffectsStore = createSharedStore(
  readStrongDesktopEffectsState,
  reducedMotionStore.subscribe,
);

export function useLowEndDevice() {
  return useSyncExternalStore(
    lowEndDeviceStore.subscribe,
    lowEndDeviceStore.getSnapshot,
    lowEndDeviceStore.getServerSnapshot,
  );
}

export function useStrongDesktopEffects() {
  return useSyncExternalStore(
    strongDesktopEffectsStore.subscribe,
    strongDesktopEffectsStore.getSnapshot,
    strongDesktopEffectsStore.getServerSnapshot,
  );
}

export function useHoverCapablePointer() {
  return useSyncExternalStore(
    hoverCapablePointerStore.subscribe,
    hoverCapablePointerStore.getSnapshot,
    hoverCapablePointerStore.getServerSnapshot,
  );
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.getSnapshot,
    reducedMotionStore.getServerSnapshot,
  );
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

export function useDeferredMount(timeout = 1200) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled) return;
    return scheduleBackgroundTask(() => setEnabled(true), timeout);
  }, [enabled, timeout]);

  return enabled;
}
