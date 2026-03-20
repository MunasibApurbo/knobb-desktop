import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";

const settingsRightPanelMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loadProfilePreferences: vi.fn(async () => ({ data: null, error: null })),
  persistProfilePreferences: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => (
    settingsRightPanelMocks.user
      ? { user: settingsRightPanelMocks.user }
      : null
  ),
}));

vi.mock("@/lib/profilePreferences", () => ({
  loadProfilePreferences: settingsRightPanelMocks.loadProfilePreferences,
  persistProfilePreferences: settingsRightPanelMocks.persistProfilePreferences,
}));

function RightPanelAutoOpenSnapshot() {
  const { rightPanelAutoOpen, setRightPanelAutoOpen } = useSettings();

  return (
    <div>
      <div data-testid="right-panel-auto-open">{rightPanelAutoOpen}</div>
      <button type="button" onClick={() => setRightPanelAutoOpen("always")}>
        Set always
      </button>
    </div>
  );
}

describe("SettingsContext right panel auto-open", () => {
  let storage: Map<string, string>;
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeAll(() => {
    previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  beforeEach(() => {
    settingsRightPanelMocks.user = null;
    settingsRightPanelMocks.loadProfilePreferences.mockReset();
    settingsRightPanelMocks.loadProfilePreferences.mockResolvedValue({ data: null, error: null });
    settingsRightPanelMocks.persistProfilePreferences.mockReset();
    settingsRightPanelMocks.persistProfilePreferences.mockResolvedValue({ error: null });

    storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("defaults to never until the panel is opened manually", async () => {
    await act(async () => {
      root.render(
        <SettingsProvider>
          <RightPanelAutoOpenSnapshot />
        </SettingsProvider>,
      );
    });

    expect(container.textContent).toContain("never");
    expect(window.localStorage.getItem("right-panel-auto-open")).toBe(null);
  });

  it("migrates legacy implicit always mode to never", async () => {
    window.localStorage.setItem("right-panel-auto-open", "always");

    await act(async () => {
      root.render(
        <SettingsProvider>
          <RightPanelAutoOpenSnapshot />
        </SettingsProvider>,
      );
    });

    expect(container.textContent).toContain("never");
    expect(window.localStorage.getItem("right-panel-auto-open")).toBe("never");
    expect(window.localStorage.getItem("right-panel-auto-open-explicit")).toBe("false");
  });

  it("preserves always mode after the user explicitly chooses it", async () => {
    await act(async () => {
      root.render(
        <SettingsProvider>
          <RightPanelAutoOpenSnapshot />
        </SettingsProvider>,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("always");
    expect(window.localStorage.getItem("right-panel-auto-open")).toBe("always");
    expect(window.localStorage.getItem("right-panel-auto-open-explicit")).toBe("true");
  });
});
