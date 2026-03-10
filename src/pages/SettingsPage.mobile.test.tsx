import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SettingsPage from "@/pages/SettingsPage";

const settingsPageMocks = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  setQuality: vi.fn(),
  setAutoQualityEnabled: vi.fn(),
  toggleNormalization: vi.fn(),
  toggleEqualizer: vi.fn(),
  setEqBandGain: vi.fn(),
  applyEqPreset: vi.fn(),
  resetEqualizer: vi.fn(),
  setPreampDb: vi.fn(),
  setPreservePitch: vi.fn(),
  setDynamicCardsEnabled: vi.fn(),
  setFont: vi.fn(),
  setShowLocalFiles: vi.fn(),
  setLibraryItemStyle: vi.fn(),
  setCardSize: vi.fn(),
  setDiscordPresenceEnabled: vi.fn(),
  setWebsiteMode: vi.fn(),
  setPageDensity: vi.fn(),
  setRightPanelAutoOpen: vi.fn(),
  setRightPanelStyle: vi.fn(),
  setBottomPlayerStyle: vi.fn(),
  setShowScrollbar: vi.fn(),
  setDownloadFormat: vi.fn(),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/DiscordConnectDialog", () => ({
  DiscordConnectDialog: () => null,
}));

vi.mock("@/components/SettingsEqualizer", () => ({
  SettingsEqualizer: () => <div>Equalizer</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: false,
    requestPasswordReset: vi.fn(),
    signOut: vi.fn(),
    signOutOtherSessions: vi.fn(),
    user: null,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: settingsPageMocks.setLanguage,
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "settings.localFilesCount") {
        return `local-files-${params?.count ?? 0}`;
      }
      if (key === "settings.localFilesStorage") {
        return `local-storage-${params?.size ?? "0"}`;
      }
      if (key === "settings.cacheSize") {
        return `cache-size-${params?.size ?? "0"}`;
      }
      if (key === "settings.downloadsEntries") {
        return `downloads-${params?.count ?? 0}`;
      }
      return key;
    },
  }),
}));

vi.mock("@/contexts/LocalFilesContext", () => ({
  useLocalFiles: () => ({
    localFiles: [],
    totalBytes: 0,
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    quality: "HIGH",
    setQuality: settingsPageMocks.setQuality,
    autoQualityEnabled: true,
    setAutoQualityEnabled: settingsPageMocks.setAutoQualityEnabled,
    normalization: true,
    toggleNormalization: settingsPageMocks.toggleNormalization,
    equalizerEnabled: false,
    toggleEqualizer: settingsPageMocks.toggleEqualizer,
    eqGains: Array.from({ length: 10 }, () => 0),
    eqPreset: "flat",
    setEqBandGain: settingsPageMocks.setEqBandGain,
    applyEqPreset: settingsPageMocks.applyEqPreset,
    resetEqualizer: settingsPageMocks.resetEqualizer,
    preampDb: 0,
    setPreampDb: settingsPageMocks.setPreampDb,
    preservePitch: true,
    setPreservePitch: settingsPageMocks.setPreservePitch,
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    dynamicCardsEnabled: true,
    setDynamicCardsEnabled: settingsPageMocks.setDynamicCardsEnabled,
    font: "System Default",
    setFont: settingsPageMocks.setFont,
    showLocalFiles: true,
    setShowLocalFiles: settingsPageMocks.setShowLocalFiles,
    libraryItemStyle: "cover",
    setLibraryItemStyle: settingsPageMocks.setLibraryItemStyle,
    cardSize: "default",
    setCardSize: settingsPageMocks.setCardSize,
    discordPresenceEnabled: false,
    setDiscordPresenceEnabled: settingsPageMocks.setDiscordPresenceEnabled,
    websiteMode: "roundish",
    setWebsiteMode: settingsPageMocks.setWebsiteMode,
    pageDensity: "comfortable",
    setPageDensity: settingsPageMocks.setPageDensity,
    rightPanelAutoOpen: "always",
    setRightPanelAutoOpen: settingsPageMocks.setRightPanelAutoOpen,
    rightPanelStyle: "classic",
    setRightPanelStyle: settingsPageMocks.setRightPanelStyle,
    bottomPlayerStyle: "current",
    setBottomPlayerStyle: settingsPageMocks.setBottomPlayerStyle,
    showScrollbar: false,
    setShowScrollbar: settingsPageMocks.setShowScrollbar,
    downloadFormat: "flac",
    setDownloadFormat: settingsPageMocks.setDownloadFormat,
  }),
}));

vi.mock("@/lib/discordPresence", () => ({
  subscribeToDiscordPresenceBridge: () => () => {},
}));

vi.mock("@/lib/localDiscordPresenceBridge", () => ({
  getLocalDiscordPresenceBridgeStatus: () => ({
    ok: false,
    configured: false,
    discordConnected: false,
  }),
}));

describe("SettingsPage mobile layout", () => {
  it("renders the settings shell and keeps guest actions full-width on mobile", () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const signInButton = screen.getByRole("button", { name: "settings.signIn" });

    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("settings.title")).toBeInTheDocument();
    expect(signInButton).toHaveClass("w-full");
    expect(screen.getByLabelText("settings.searchAria")).toBeInTheDocument();
  });

  it("shows offline app status without desktop installer links", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("settings.offlineApp")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings\.desktopCheckMacRelease/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /settings\.desktopDownloadWindows/i })).toBeNull();
  });
});
