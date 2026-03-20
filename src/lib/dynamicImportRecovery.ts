const RECOVERY_STORAGE_KEY = "knobb:dynamic-import-recovery";
const SHELL_CACHE_PREFIX = "knobb-shell-";

type RecoveryServiceWorkerRegistration = {
  unregister?: () => Promise<boolean> | boolean;
};

type RecoveryLocation = Pick<Location, "pathname" | "search" | "hash" | "reload">;

type RecoveryNavigator = {
  serviceWorker?: {
    getRegistrations?: () => Promise<readonly RecoveryServiceWorkerRegistration[]>;
  };
};

type RecoveryCacheStorage = {
  keys?: () => Promise<string[]>;
  delete?: (key: string) => Promise<boolean> | boolean;
};

type RecoveryWindow = {
  location: RecoveryLocation;
  setTimeout: (callback: () => void, delay?: number) => number;
  caches?: RecoveryCacheStorage;
  navigator?: RecoveryNavigator;
  sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error ?? "");
}

function getErrorStack(error: unknown) {
  if (error instanceof Error) return error.stack ?? "";
  if (error && typeof error === "object" && "stack" in error && typeof error.stack === "string") {
    return error.stack;
  }
  return "";
}

function getRouteKey(targetWindow: RecoveryWindow) {
  const { pathname, search, hash } = targetWindow.location;
  return `${pathname}${search}${hash}`;
}

function safeGetMarker(targetWindow: RecoveryWindow) {
  try {
    return targetWindow.sessionStorage?.getItem(RECOVERY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeSetMarker(targetWindow: RecoveryWindow, routeKey: string) {
  try {
    targetWindow.sessionStorage?.setItem(RECOVERY_STORAGE_KEY, routeKey);
  } catch {
    // Ignore storage failures.
  }
}

export function clearDynamicImportRecovery(targetWindow: RecoveryWindow | undefined = typeof window !== "undefined" ? window : undefined) {
  if (!targetWindow) return;

  try {
    targetWindow.sessionStorage?.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function isDynamicImportFailure(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("error loading dynamically imported module") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed")
  );
}

function isBundledAssetMismatchFailure(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const stack = getErrorStack(error).toLowerCase();
  const combined = `${message}\n${stack}`;
  const hasHookMismatch =
    combined.includes("invalid hook call") ||
    /cannot read properties of null \(reading 'use[a-z]+'\)/.test(combined);
  const hasBundledStack =
    combined.includes("/node_modules/.vite/deps/") ||
    /\/assets\/[^)\s]+\.js/.test(combined);

  return hasHookMismatch && hasBundledStack;
}

export async function resetKnobbShellRuntime(
  targetWindow: RecoveryWindow | undefined = typeof window !== "undefined" ? window : undefined,
) {
  if (!targetWindow) return;

  try {
    const registrations = await targetWindow.navigator?.serviceWorker?.getRegistrations?.();
    if (registrations?.length) {
      await Promise.allSettled(registrations.map((registration) => registration.unregister?.()));
    }
  } catch {
    // Ignore service worker cleanup failures.
  }

  try {
    const cacheKeys = await targetWindow.caches?.keys?.();
    if (cacheKeys?.length) {
      await Promise.allSettled(
        cacheKeys
          .filter((key) => key.startsWith(SHELL_CACHE_PREFIX))
          .map((key) => targetWindow.caches?.delete?.(key)),
      );
    }
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function attemptDynamicImportRecovery(
  error: unknown,
  targetWindow: RecoveryWindow | undefined = typeof window !== "undefined" ? window : undefined,
) {
  if (!targetWindow || (!isDynamicImportFailure(error) && !isBundledAssetMismatchFailure(error))) {
    return false;
  }

  const routeKey = getRouteKey(targetWindow);
  if (safeGetMarker(targetWindow) === routeKey) {
    return false;
  }

  safeSetMarker(targetWindow, routeKey);
  targetWindow.setTimeout(() => {
    void resetKnobbShellRuntime(targetWindow).finally(() => {
      targetWindow.location.reload();
    });
  }, 0);
  return true;
}
