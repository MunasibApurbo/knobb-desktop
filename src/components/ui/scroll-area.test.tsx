import type { ContextType } from "react";
import { render, screen } from "@testing-library/react";

import { SettingsContext } from "@/contexts/SettingsContext";

import { ScrollArea } from "./scroll-area";

const settingsValue: NonNullable<ContextType<typeof SettingsContext>> = {
  theme: "amoled",
  setTheme: () => {},
  accentColor: "dynamic",
  setAccentColor: () => {},
  font: "System Default",
  setFont: () => {},
  compactMode: false,
  setCompactMode: () => {},
  showLocalFiles: true,
  setShowLocalFiles: () => {},
  dynamicCardsEnabled: true,
  setDynamicCardsEnabled: () => {},
  libraryItemStyle: "list",
  setLibraryItemStyle: () => {},
  cardSize: "default",
  setCardSize: () => {},
  websiteMode: "edgy",
  setWebsiteMode: () => {},
  rightPanelStyle: "classic",
  setRightPanelStyle: () => {},
  bottomPlayerStyle: "current",
  setBottomPlayerStyle: () => {},
  sidebarStyle: "classic",
  setSidebarStyle: () => {},
  rightPanelDefaultTab: "lyrics",
  setRightPanelDefaultTab: () => {},
  librarySortDefault: "recents",
  setLibrarySortDefault: () => {},
  libraryOpenState: "expanded",
  setLibraryOpenState: () => {},
  playerButtonsLayout: "compact",
  setPlayerButtonsLayout: () => {},
  coverArtCorners: "sharp",
  setCoverArtCorners: () => {},
  pageDensity: "comfortable",
  setPageDensity: () => {},
  accentSource: "dynamic",
  setAccentSource: () => {},
  animationMode: "full",
  setAnimationMode: () => {},
  titleLineMode: "single",
  setTitleLineMode: () => {},
  rightPanelAutoOpen: "always",
  setRightPanelAutoOpen: () => {},
  explicitBadgeVisibility: "show",
  setExplicitBadgeVisibility: () => {},
  lyricsSyncMode: "follow",
  setLyricsSyncMode: () => {},
  showSidebar: true,
  setShowSidebar: () => {},
  showScrollbar: false,
  setShowScrollbar: () => {},
  animationsEnabled: true,
  setAnimationsEnabled: () => {},
  blurEffects: true,
  setBlurEffects: () => {},
  downloadFormat: "flac",
  setDownloadFormat: () => {},
  scrobblePercent: "50",
  setScrobblePercent: () => {},
  clearCacheAndReset: () => {},
};

describe("ScrollArea", () => {
  it("keeps a native scroll container when scrollbar chrome is hidden", () => {
    render(
      <SettingsContext.Provider value={settingsValue}>
        <ScrollArea data-testid="scroll-area" viewportProps={{ "data-main-scroll-viewport": "true" }}>
          <div style={{ height: 2000 }}>Content</div>
        </ScrollArea>
      </SettingsContext.Provider>,
    );

    const scrollArea = screen.getByTestId("scroll-area");

    expect(scrollArea).toHaveClass("scroll-area-native", "overflow-auto", "scrollbar-hide");
    expect(scrollArea).toHaveAttribute("data-main-scroll-viewport", "true");
  });

  it("lets callers force visible scrollbar chrome", () => {
    render(
      <SettingsContext.Provider value={settingsValue}>
        <ScrollArea data-testid="scroll-area" forceVisibleScrollbar>
          <div style={{ height: 2000 }}>Content</div>
        </ScrollArea>
      </SettingsContext.Provider>,
    );

    expect(screen.getByTestId("scroll-area")).not.toHaveClass("scrollbar-hide");
  });
});
