import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";

const settingsAccountSyncMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loadProfilePreferences: vi.fn(async () => ({ data: null, error: null })),
  persistProfilePreferences: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => (
    settingsAccountSyncMocks.user
      ? { user: settingsAccountSyncMocks.user }
      : null
  ),
}));

vi.mock("@/lib/profilePreferences", () => ({
  loadProfilePreferences: settingsAccountSyncMocks.loadProfilePreferences,
  persistProfilePreferences: settingsAccountSyncMocks.persistProfilePreferences,
}));

function SettingsSnapshot() {
  const {
    dynamicCardsEnabled,
    discordPresenceEnabled,
    font,
    libraryItemStyle,
    cardSize,
    websiteMode,
    rightPanelStyle,
    bottomPlayerStyle,
    showFullScreenLyrics,
    showSidebar,
    showScrollbar,
    setDiscordPresenceEnabled,
    setFont,
    setRightPanelStyle,
    setBottomPlayerStyle,
    setShowFullScreenLyrics,
    setWebsiteMode,
    setShowSidebar,
    setShowScrollbar,
  } = useSettings();

  return (
    <dl>
      <div data-testid="dynamic-cards">{String(dynamicCardsEnabled)}</div>
      <div data-testid="discord-presence">{String(discordPresenceEnabled)}</div>
      <div data-testid="font">{font}</div>
      <div data-testid="library-item-style">{libraryItemStyle}</div>
      <div data-testid="card-size">{cardSize}</div>
      <div data-testid="website-mode">{websiteMode}</div>
      <div data-testid="right-panel-style">{rightPanelStyle}</div>
      <div data-testid="bottom-player-style">{bottomPlayerStyle}</div>
      <div data-testid="show-fullscreen-lyrics">{String(showFullScreenLyrics)}</div>
      <div data-testid="show-sidebar">{String(showSidebar)}</div>
      <div data-testid="show-scrollbar">{String(showScrollbar)}</div>
      <button type="button" onClick={() => setDiscordPresenceEnabled(true)}>
        Enable Discord presence
      </button>
      <button type="button" onClick={() => setFont("Space Grotesk")}>
        Use Space Grotesk
      </button>
      <button type="button" onClick={() => setFont("Inter")}>
        Use Inter
      </button>
      <button type="button" onClick={() => setWebsiteMode("roundish")}>
        Roundish
      </button>
      <button type="button" onClick={() => setRightPanelStyle("artwork")}>
        Artwork right panel
      </button>
      <button type="button" onClick={() => setBottomPlayerStyle("black")}>
        Black bottom player
      </button>
      <button type="button" onClick={() => setShowFullScreenLyrics(false)}>
        Hide fullscreen lyrics
      </button>
      <button type="button" onClick={() => setShowSidebar(false)}>
        Hide sidebar
      </button>
      <button type="button" onClick={() => setShowScrollbar(false)}>
        Hide scrollbar
      </button>
    </dl>
  );
}

describe("SettingsProvider", () => {
  beforeEach(() => {
    settingsAccountSyncMocks.user = null;
    settingsAccountSyncMocks.loadProfilePreferences.mockReset();
    settingsAccountSyncMocks.loadProfilePreferences.mockResolvedValue({ data: null, error: null });
    settingsAccountSyncMocks.persistProfilePreferences.mockReset();
    settingsAccountSyncMocks.persistProfilePreferences.mockResolvedValue({ error: null });

    const storage = new Map<string, string>();
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

    const root = document.documentElement;
    root.className = "";
    root.removeAttribute("data-theme");
    root.removeAttribute("style");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  it("uses the intended first-visit display defaults", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    expect(screen.getByTestId("dynamic-cards")).toHaveTextContent("false");
    expect(screen.getByTestId("discord-presence")).toHaveTextContent("false");
    expect(screen.getByTestId("font")).toHaveTextContent("System Default");
    expect(screen.getByTestId("library-item-style")).toHaveTextContent("list");
    expect(screen.getByTestId("card-size")).toHaveTextContent("small");
    expect(screen.getByTestId("website-mode")).toHaveTextContent("roundish");
    expect(screen.getByTestId("right-panel-style")).toHaveTextContent("artwork");
    expect(screen.getByTestId("bottom-player-style")).toHaveTextContent("current");
    expect(screen.getByTestId("show-fullscreen-lyrics")).toHaveTextContent("true");
    expect(screen.getByTestId("show-sidebar")).toHaveTextContent("true");
    expect(screen.getByTestId("show-scrollbar")).toHaveTextContent("true");

    const root = document.documentElement;
    expect(root).toHaveClass("disable-dynamic-cards");
    expect(root).toHaveClass("show-scrollbars");
    expect(root.getAttribute("data-theme")).toBe("amoled");
    expect(root.getAttribute("data-website-mode")).toBe("roundish");
    expect(root.style.getPropertyValue("--font-sans")).toBe("");
    expect(root.style.getPropertyValue("--media-card-min-width")).not.toBe("");
  });

  it("hydrates saved account display preferences after sign-in", async () => {
    settingsAccountSyncMocks.user = { id: "user-1" };
    settingsAccountSyncMocks.loadProfilePreferences.mockResolvedValue({
      data: {
        ui_preferences: {
          websiteMode: "edgy",
          rightPanelStyle: "classic",
          cardSize: "big",
        },
      },
      error: null,
    });

    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("website-mode")).toHaveTextContent("roundish");
    });

    expect(screen.getByTestId("right-panel-style")).toHaveTextContent("classic");
    expect(screen.getByTestId("card-size")).toHaveTextContent("big");
    expect(document.documentElement.getAttribute("data-website-mode")).toBe("roundish");
  });

  it("normalizes saved edgy website mode to roundish", async () => {
    window.localStorage.setItem("website-mode", "edgy");

    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("website-mode")).toHaveTextContent("roundish");
    });
    expect(window.localStorage.getItem("website-mode")).toBe("roundish");
    expect(document.documentElement.getAttribute("data-website-mode")).toBe("roundish");
  });

  it("persists right panel style changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Artwork right panel" }));

    expect(screen.getByTestId("right-panel-style")).toHaveTextContent("artwork");
    expect(window.localStorage.getItem("right-panel-style")).toBe("artwork");
  });

  it("persists bottom player style changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Black bottom player" }));

    expect(screen.getByTestId("bottom-player-style")).toHaveTextContent("black");
    expect(window.localStorage.getItem("bottom-player-style")).toBe("black");
  });

  it("persists full-screen lyrics visibility changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide fullscreen lyrics" }));

    expect(screen.getByTestId("show-fullscreen-lyrics")).toHaveTextContent("false");
    expect(window.localStorage.getItem("show-fullscreen-lyrics")).toBe("false");
  });

  it("persists and applies font changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Use Space Grotesk" }));

    expect(screen.getByTestId("font")).toHaveTextContent("Space Grotesk");
    expect(window.localStorage.getItem("app-font")).toBe("Space Grotesk");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe('"Space Grotesk", sans-serif');
  });

  it("persists and applies newly exposed font choices", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Use Inter" }));

    expect(screen.getByTestId("font")).toHaveTextContent("Inter");
    expect(window.localStorage.getItem("app-font")).toBe("Inter");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe('"Inter", sans-serif');
  });

  it("persists Discord presence preference", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable Discord presence" }));

    expect(screen.getByTestId("discord-presence")).toHaveTextContent("true");
    expect(window.localStorage.getItem("discord-presence-enabled")).toBe("true");
  });

  it("keeps the selected website mode on narrow viewports", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    expect(screen.getByTestId("website-mode")).toHaveTextContent("roundish");
    expect(document.documentElement.getAttribute("data-website-mode")).toBe("roundish");
  });

  it("persists sidebar visibility changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(screen.getByTestId("show-sidebar")).toHaveTextContent("false");
    expect(window.localStorage.getItem("show-sidebar")).toBe("false");
  });

  it("persists scrollbar visibility changes", () => {
    render(
      <SettingsProvider>
        <SettingsSnapshot />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide scrollbar" }));

    expect(screen.getByTestId("show-scrollbar")).toHaveTextContent("false");
    expect(window.localStorage.getItem("show-scrollbar")).toBe("false");
    expect(document.documentElement).not.toHaveClass("show-scrollbars");
  });
});
