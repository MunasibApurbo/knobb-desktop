import {
  attemptDynamicImportRecovery,
  clearDynamicImportRecovery,
  isDynamicImportFailure,
  resetKnobbShellRuntime,
} from "@/lib/dynamicImportRecovery";

function createMockWindow(route = "/liked") {
  const store = new Map<string, string>();
  const reload = vi.fn();
  const unregister = vi.fn(async () => true);
  const cacheDelete = vi.fn(async () => true);

  const sessionStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };

  return {
    location: {
      pathname: route,
      search: "",
      hash: "",
      reload,
    },
    setTimeout: vi.fn((callback: () => void) => {
      callback();
      return 0;
    }),
    caches: {
      keys: vi.fn(async () => ["knobb-shell-v2", "other-cache"]),
      delete: cacheDelete,
    },
    navigator: {
      serviceWorker: {
        getRegistrations: vi.fn(async () => [{ unregister }]),
      },
    },
    sessionStorage,
    cacheDelete,
    reload,
    unregister,
  };
}

describe("dynamic import recovery", () => {
  async function flushRecoveryWork() {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  }

  it("detects chunk loading failures", () => {
    expect(isDynamicImportFailure(new Error("error loading dynamically imported module: /assets/LikedSongsPage.js"))).toBe(true);
    expect(isDynamicImportFailure(new Error("Importing a module script failed."))).toBe(true);
    expect(isDynamicImportFailure(new Error("Something else"))).toBe(false);
  });

  it("reloads once for a route when a lazy chunk fails", async () => {
    const mockWindow = createMockWindow();

    expect(attemptDynamicImportRecovery(new Error("Failed to fetch dynamically imported module"), mockWindow)).toBe(true);
    await flushRecoveryWork();

    expect(mockWindow.unregister).toHaveBeenCalledTimes(1);
    expect(mockWindow.cacheDelete).toHaveBeenCalledWith("knobb-shell-v2");
    expect(mockWindow.reload).toHaveBeenCalledTimes(1);

    expect(attemptDynamicImportRecovery(new Error("Failed to fetch dynamically imported module"), mockWindow)).toBe(false);
    expect(mockWindow.reload).toHaveBeenCalledTimes(1);
  });

  it("clears the stored recovery marker", async () => {
    const mockWindow = createMockWindow();

    expect(attemptDynamicImportRecovery(new Error("Failed to fetch dynamically imported module"), mockWindow)).toBe(true);
    await flushRecoveryWork();
    clearDynamicImportRecovery(mockWindow);
    expect(attemptDynamicImportRecovery(new Error("Failed to fetch dynamically imported module"), mockWindow)).toBe(true);
    await flushRecoveryWork();
    expect(mockWindow.reload).toHaveBeenCalledTimes(2);
  });

  it("recovers once from bundled React hook mismatches", async () => {
    const mockWindow = createMockWindow("/profile");
    const error = {
      message: "Cannot read properties of null (reading 'useState')",
      stack: "at useState (http://127.0.0.1:4173/node_modules/.vite/deps/chunk-QCHXOAYK.js?v=703d8aa1:1066:29)",
    };

    expect(attemptDynamicImportRecovery(error, mockWindow)).toBe(true);
    await flushRecoveryWork();

    expect(mockWindow.unregister).toHaveBeenCalledTimes(1);
    expect(mockWindow.cacheDelete).toHaveBeenCalledWith("knobb-shell-v2");
    expect(mockWindow.reload).toHaveBeenCalledTimes(1);
  });

  it("can clear shell caches and service workers directly", async () => {
    const mockWindow = createMockWindow("/browse");

    await resetKnobbShellRuntime(mockWindow);

    expect(mockWindow.unregister).toHaveBeenCalledTimes(1);
    expect(mockWindow.cacheDelete).toHaveBeenCalledWith("knobb-shell-v2");
  });
});
