import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOptionalAuth } from "@/contexts/AuthContext";
import {
    safeStorageClear,
    safeStorageGetItem,
    safeStorageSetItem,
} from "@/lib/safeStorage";
import {
    getMediaCardGridCssVars,
    getMediaCardSizePreset,
    type MediaCardSize,
} from "@/lib/mediaCardSizing";
import { ensureGoogleFontLoaded } from "@/lib/fontLoader";
import { DEFAULT_LIBRARY_SOURCE, isLibrarySource, type LibrarySource } from "@/lib/librarySources";
import { loadProfilePreferences, persistProfilePreferences } from "@/lib/profilePreferences";

export type Theme = "default" | "midnight" | "forest" | "crimson" | "ocean" | "amber" | "noir" | "amoled";
type Font = "System Default" | "Inter" | "Roboto" | "Outfit" | "JetBrains Mono" | "Poppins" | "Nunito" | "Space Grotesk";
export type LibraryItemStyle = "cover" | "list";
export type WebsiteMode = "roundish";
export type RightPanelStyle = "classic" | "artwork";
export type BottomPlayerStyle = "current" | "black";
export type SidebarStyle = "classic" | "artwork";
export type DownloadFormat = "flac" | "mp3_320" | "mp3_128";
export type LibrarySortDefault = "recents" | "alphabetical";
export type LibraryOpenState = "expanded" | "collapsed";
export type PlayerButtonsLayout = "compact" | "spacious";
export type CoverArtCorners = "sharp" | "rounded";
export type PageDensity = "comfortable" | "compact";
export type AccentSource = "dynamic" | "theme";
export type AnimationMode = "full" | "reduced" | "off";
export type TitleLineMode = "single" | "double";
export type RightPanelAutoOpen = "always" | "while-playing" | "never";
export type ExplicitBadgeVisibility = "show" | "hide";
export type LyricsSyncMode = "follow" | "static";
const LEGACY_NOIR_THEME = ["mono", "chrome"].join("");
const RIGHT_PANEL_AUTO_OPEN_STORAGE_KEY = "right-panel-auto-open";
const RIGHT_PANEL_AUTO_OPEN_EXPLICIT_STORAGE_KEY = "right-panel-auto-open-explicit";
const DEFAULT_FULLSCREEN_BACKGROUND_BLUR = 100;
const DEFAULT_FULLSCREEN_BACKGROUND_DARKNESS = 58;

function normalizeDownloadFormat(format: string | null): DownloadFormat {
    switch (format) {
        case "flac":
        case "lossless":
            return "flac";
        case "mp3_128":
        case "low":
            return "mp3_128";
        case "mp3_320":
        case "mp3":
        case "high":
        default:
            return "mp3_320";
    }
}

interface SettingsState {
    theme: Theme;
    accentColor: string;
    font: Font;
    librarySource: LibrarySource;
    compactMode: boolean;
    showLocalFiles: boolean;
    dynamicCardsEnabled: boolean;
    discordPresenceEnabled: boolean;
    libraryItemStyle: LibraryItemStyle;
    cardSize: MediaCardSize;
    websiteMode: WebsiteMode;
    rightPanelStyle: RightPanelStyle;
    bottomPlayerStyle: BottomPlayerStyle;
    sidebarStyle: SidebarStyle;
    rightPanelDefaultTab: "lyrics" | "queue";
    librarySortDefault: LibrarySortDefault;
    libraryOpenState: LibraryOpenState;
    playerButtonsLayout: PlayerButtonsLayout;
    coverArtCorners: CoverArtCorners;
    pageDensity: PageDensity;
    accentSource: AccentSource;
    animationMode: AnimationMode;
    titleLineMode: TitleLineMode;
    rightPanelAutoOpen: RightPanelAutoOpen;
    explicitBadgeVisibility: ExplicitBadgeVisibility;
    lyricsSyncMode: LyricsSyncMode;
    showFullScreenLyrics: boolean;
    fullScreenBackgroundBlur: number;
    fullScreenBackgroundDarkness: number;
    showSidebar: boolean;
    showScrollbar: boolean;
    animationsEnabled: boolean;
    blurEffects: boolean;
    downloadFormat: DownloadFormat;
    scrobblePercent: string;
}

interface SettingsContextType extends SettingsState {
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: string) => void;
    setFont: (font: Font) => void;
    setLibrarySource: (source: LibrarySource) => void;
    setCompactMode: (enabled: boolean) => void;
    setShowLocalFiles: (enabled: boolean) => void;
    setDynamicCardsEnabled: (enabled: boolean) => void;
    setDiscordPresenceEnabled: (enabled: boolean) => void;
    setLibraryItemStyle: (style: LibraryItemStyle) => void;
    setCardSize: (size: MediaCardSize) => void;
    setWebsiteMode: (mode: WebsiteMode) => void;
    setRightPanelStyle: (style: RightPanelStyle) => void;
    setBottomPlayerStyle: (style: BottomPlayerStyle) => void;
    setSidebarStyle: (style: SidebarStyle) => void;
    setRightPanelDefaultTab: (tab: "lyrics" | "queue") => void;
    setLibrarySortDefault: (sort: LibrarySortDefault) => void;
    setLibraryOpenState: (state: LibraryOpenState) => void;
    setPlayerButtonsLayout: (layout: PlayerButtonsLayout) => void;
    setCoverArtCorners: (corners: CoverArtCorners) => void;
    setPageDensity: (density: PageDensity) => void;
    setAccentSource: (source: AccentSource) => void;
    setAnimationMode: (mode: AnimationMode) => void;
    setTitleLineMode: (mode: TitleLineMode) => void;
    setRightPanelAutoOpen: (mode: RightPanelAutoOpen) => void;
    setExplicitBadgeVisibility: (visibility: ExplicitBadgeVisibility) => void;
    setLyricsSyncMode: (mode: LyricsSyncMode) => void;
    setShowFullScreenLyrics: (enabled: boolean) => void;
    setFullScreenBackgroundBlur: (value: number) => void;
    setFullScreenBackgroundDarkness: (value: number) => void;
    setShowSidebar: (enabled: boolean) => void;
    setShowScrollbar: (enabled: boolean) => void;
    setAnimationsEnabled: (enabled: boolean) => void;
    setBlurEffects: (enabled: boolean) => void;
    setDownloadFormat: (format: DownloadFormat) => void;
    setScrobblePercent: (percent: string) => void;
    clearCacheAndReset: () => void;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

type SyncedUiPreferences = Pick<
    SettingsState,
    | "theme"
    | "font"
    | "librarySource"
    | "compactMode"
    | "showLocalFiles"
    | "dynamicCardsEnabled"
    | "discordPresenceEnabled"
    | "libraryItemStyle"
    | "cardSize"
    | "websiteMode"
    | "rightPanelStyle"
    | "bottomPlayerStyle"
    | "sidebarStyle"
    | "rightPanelDefaultTab"
    | "librarySortDefault"
    | "libraryOpenState"
    | "playerButtonsLayout"
    | "coverArtCorners"
    | "pageDensity"
    | "accentSource"
    | "animationMode"
    | "titleLineMode"
    | "rightPanelAutoOpen"
    | "explicitBadgeVisibility"
    | "lyricsSyncMode"
    | "showFullScreenLyrics"
    | "fullScreenBackgroundBlur"
    | "fullScreenBackgroundDarkness"
    | "showSidebar"
    | "showScrollbar"
    | "blurEffects"
    | "downloadFormat"
    | "scrobblePercent"
>;

const VALID_THEMES: Theme[] = ["default", "midnight", "forest", "crimson", "ocean", "amber", "noir", "amoled"];
const VALID_FONTS: Font[] = ["System Default", "Inter", "Roboto", "Outfit", "JetBrains Mono", "Poppins", "Nunito", "Space Grotesk"];
const VALID_LIBRARY_SOURCES: LibrarySource[] = ["tidal", "youtube-music"];
const VALID_LIBRARY_ITEM_STYLES: LibraryItemStyle[] = ["cover", "list"];
const VALID_WEBSITE_MODES: WebsiteMode[] = ["roundish"];
const VALID_RIGHT_PANEL_STYLES: RightPanelStyle[] = ["classic", "artwork"];
const VALID_BOTTOM_PLAYER_STYLES: BottomPlayerStyle[] = ["current", "black"];
const VALID_SIDEBAR_STYLES: SidebarStyle[] = ["classic", "artwork"];
const VALID_RIGHT_PANEL_TABS: Array<"lyrics" | "queue"> = ["lyrics", "queue"];
const VALID_LIBRARY_SORT_DEFAULTS: LibrarySortDefault[] = ["recents", "alphabetical"];
const VALID_LIBRARY_OPEN_STATES: LibraryOpenState[] = ["expanded", "collapsed"];
const VALID_PLAYER_BUTTON_LAYOUTS: PlayerButtonsLayout[] = ["compact", "spacious"];
const VALID_COVER_ART_CORNERS: CoverArtCorners[] = ["sharp", "rounded"];
const VALID_PAGE_DENSITIES: PageDensity[] = ["comfortable", "compact"];
const VALID_ACCENT_SOURCES: AccentSource[] = ["dynamic", "theme"];
const VALID_ANIMATION_MODES: AnimationMode[] = ["full", "reduced", "off"];
const VALID_TITLE_LINE_MODES: TitleLineMode[] = ["single", "double"];
const VALID_RIGHT_PANEL_AUTO_OPEN: RightPanelAutoOpen[] = ["always", "while-playing", "never"];
const VALID_EXPLICIT_BADGE_VISIBILITY: ExplicitBadgeVisibility[] = ["show", "hide"];
const VALID_LYRICS_SYNC_MODES: LyricsSyncMode[] = ["follow", "static"];
const VALID_MEDIA_CARD_SIZES: MediaCardSize[] = ["smaller", "small", "default", "big", "bigger"];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnumValue<T extends string>(value: unknown, validValues: readonly T[]) {
    return typeof value === "string" && validValues.includes(value as T) ? (value as T) : undefined;
}

function readBooleanValue(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
}

function readStringValue(value: unknown) {
    return typeof value === "string" ? value : undefined;
}

function readNumberValue(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampPercentage(value: number) {
    return Math.min(Math.max(Math.round(value), 0), 100);
}

function normalizeStoredPercentage(value: string | null, fallback: number) {
    if (value === null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? clampPercentage(parsed) : fallback;
}

function hasExplicitRightPanelAutoOpenPreference() {
    return safeStorageGetItem(RIGHT_PANEL_AUTO_OPEN_EXPLICIT_STORAGE_KEY) === "true";
}

function resolveRightPanelAutoOpenPreference(
    value: unknown,
    hasExplicitPreference = hasExplicitRightPanelAutoOpenPreference(),
): RightPanelAutoOpen {
    if (value === "while-playing" || value === "never") {
        return value;
    }

    if (value === "always") {
        return hasExplicitPreference ? "always" : "never";
    }

    return "never";
}

function persistRightPanelAutoOpenPreference(mode: RightPanelAutoOpen, explicit: boolean) {
    safeStorageSetItem(RIGHT_PANEL_AUTO_OPEN_STORAGE_KEY, mode);
    safeStorageSetItem(RIGHT_PANEL_AUTO_OPEN_EXPLICIT_STORAGE_KEY, String(explicit));
}

function parseSyncedUiPreferences(value: unknown): Partial<SyncedUiPreferences> {
    if (!isRecord(value)) return {};

    const theme = readEnumValue(value.theme, VALID_THEMES);
    const font = readEnumValue(value.font, VALID_FONTS);
    const librarySource = readEnumValue(value.librarySource, VALID_LIBRARY_SOURCES);
    const compactMode = readBooleanValue(value.compactMode);
    const showLocalFiles = readBooleanValue(value.showLocalFiles);
    const dynamicCardsEnabled = readBooleanValue(value.dynamicCardsEnabled);
    const discordPresenceEnabled = readBooleanValue(value.discordPresenceEnabled);
    const libraryItemStyle = readEnumValue(value.libraryItemStyle, VALID_LIBRARY_ITEM_STYLES);
    const cardSize = readEnumValue(value.cardSize, VALID_MEDIA_CARD_SIZES);
    const websiteMode = readEnumValue(value.websiteMode, VALID_WEBSITE_MODES);
    const rightPanelStyle = readEnumValue(value.rightPanelStyle, VALID_RIGHT_PANEL_STYLES);
    const bottomPlayerStyle = readEnumValue(value.bottomPlayerStyle, VALID_BOTTOM_PLAYER_STYLES);
    const sidebarStyle = readEnumValue(value.sidebarStyle, VALID_SIDEBAR_STYLES);
    const rightPanelDefaultTab = readEnumValue(value.rightPanelDefaultTab, VALID_RIGHT_PANEL_TABS);
    const librarySortDefault = readEnumValue(value.librarySortDefault, VALID_LIBRARY_SORT_DEFAULTS);
    const libraryOpenState = readEnumValue(value.libraryOpenState, VALID_LIBRARY_OPEN_STATES);
    const playerButtonsLayout = readEnumValue(value.playerButtonsLayout, VALID_PLAYER_BUTTON_LAYOUTS);
    const coverArtCorners = readEnumValue(value.coverArtCorners, VALID_COVER_ART_CORNERS);
    const pageDensity = readEnumValue(value.pageDensity, VALID_PAGE_DENSITIES);
    const accentSource = readEnumValue(value.accentSource, VALID_ACCENT_SOURCES);
    const animationMode = readEnumValue(value.animationMode, VALID_ANIMATION_MODES);
    const titleLineMode = readEnumValue(value.titleLineMode, VALID_TITLE_LINE_MODES);
    const rightPanelAutoOpen = readEnumValue(value.rightPanelAutoOpen, VALID_RIGHT_PANEL_AUTO_OPEN);
    const explicitBadgeVisibility = readEnumValue(value.explicitBadgeVisibility, VALID_EXPLICIT_BADGE_VISIBILITY);
    const lyricsSyncMode = readEnumValue(value.lyricsSyncMode, VALID_LYRICS_SYNC_MODES);
    const showFullScreenLyrics = readBooleanValue(value.showFullScreenLyrics);
    const fullScreenBackgroundBlur = readNumberValue(value.fullScreenBackgroundBlur);
    const fullScreenBackgroundDarkness = readNumberValue(value.fullScreenBackgroundDarkness);
    const showSidebar = readBooleanValue(value.showSidebar);
    const showScrollbar = readBooleanValue(value.showScrollbar);
    const blurEffects = readBooleanValue(value.blurEffects);
    const downloadFormat = typeof value.downloadFormat === "string"
        ? normalizeDownloadFormat(value.downloadFormat)
        : undefined;
    const scrobblePercent = readStringValue(value.scrobblePercent);

    return {
        ...(theme ? { theme } : {}),
        ...(font ? { font } : {}),
        ...(librarySource ? { librarySource } : {}),
        ...(compactMode !== undefined ? { compactMode } : {}),
        ...(showLocalFiles !== undefined ? { showLocalFiles } : {}),
        ...(dynamicCardsEnabled !== undefined ? { dynamicCardsEnabled } : {}),
        ...(discordPresenceEnabled !== undefined ? { discordPresenceEnabled } : {}),
        ...(libraryItemStyle ? { libraryItemStyle } : {}),
        ...(cardSize ? { cardSize } : {}),
        ...(websiteMode ? { websiteMode } : {}),
        ...(rightPanelStyle ? { rightPanelStyle } : {}),
        ...(bottomPlayerStyle ? { bottomPlayerStyle } : {}),
        ...(sidebarStyle ? { sidebarStyle } : {}),
        ...(rightPanelDefaultTab ? { rightPanelDefaultTab } : {}),
        ...(librarySortDefault ? { librarySortDefault } : {}),
        ...(libraryOpenState ? { libraryOpenState } : {}),
        ...(playerButtonsLayout ? { playerButtonsLayout } : {}),
        ...(coverArtCorners ? { coverArtCorners } : {}),
        ...(pageDensity ? { pageDensity } : {}),
        ...(accentSource ? { accentSource } : {}),
        ...(animationMode ? { animationMode } : {}),
        ...(titleLineMode ? { titleLineMode } : {}),
        ...(rightPanelAutoOpen ? { rightPanelAutoOpen } : {}),
        ...(explicitBadgeVisibility ? { explicitBadgeVisibility } : {}),
        ...(lyricsSyncMode ? { lyricsSyncMode } : {}),
        ...(showFullScreenLyrics !== undefined ? { showFullScreenLyrics } : {}),
        ...(fullScreenBackgroundBlur !== undefined ? { fullScreenBackgroundBlur: clampPercentage(fullScreenBackgroundBlur) } : {}),
        ...(fullScreenBackgroundDarkness !== undefined ? { fullScreenBackgroundDarkness: clampPercentage(fullScreenBackgroundDarkness) } : {}),
        ...(showSidebar !== undefined ? { showSidebar } : {}),
        ...(showScrollbar !== undefined ? { showScrollbar } : {}),
        ...(blurEffects !== undefined ? { blurEffects } : {}),
        ...(downloadFormat ? { downloadFormat } : {}),
        ...(scrobblePercent !== undefined ? { scrobblePercent } : {}),
    };
}

function hasSyncedUiPreferences(value: Partial<SyncedUiPreferences>) {
    return Object.keys(value).length > 0;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const auth = useOptionalAuth();
    const user = auth?.user ?? null;
    const [theme, setThemeState] = useState<Theme>(() => {
        const storedTheme = safeStorageGetItem("app-theme");
        if (storedTheme === LEGACY_NOIR_THEME) return "noir";
        if (storedTheme === "default" || storedTheme === null) return "amoled";
        return storedTheme as Theme;
    });
    const [accentColor, setAccentColorState] = useState(() => safeStorageGetItem("accent-color") || "dynamic");
    const [font, setFontState] = useState<Font>(() => (safeStorageGetItem("app-font") as Font) || "System Default");
    const [librarySource, setLibrarySourceState] = useState<LibrarySource>(() => {
        const storedLibrarySource = safeStorageGetItem("library-source");
        return isLibrarySource(storedLibrarySource) ? storedLibrarySource : DEFAULT_LIBRARY_SOURCE;
    });
    const [compactMode, setCompactModeState] = useState(() => safeStorageGetItem("compact-mode") === "true");
    const [showLocalFiles, setShowLocalFilesState] = useState(() => safeStorageGetItem("show-local-files") !== "false");
    const [dynamicCardsEnabled, setDynamicCardsEnabledState] = useState(() => safeStorageGetItem("dynamic-cards") === "true");
    const [discordPresenceEnabled, setDiscordPresenceEnabledState] = useState(() => safeStorageGetItem("discord-presence-enabled") === "true");
    const [libraryItemStyle, setLibraryItemStyleState] = useState<LibraryItemStyle>(() => {
        const storedLibraryItemStyle = safeStorageGetItem("library-item-style");
        return storedLibraryItemStyle === "cover" ? "cover" : "list";
    });
    const [cardSize, setCardSizeState] = useState<MediaCardSize>(() => {
        const storedCardSize = safeStorageGetItem("card-size") as MediaCardSize | null;
        return storedCardSize || "small";
    });
    const [websiteMode, setWebsiteModeState] = useState<WebsiteMode>("roundish");
    const [rightPanelStyle, setRightPanelStyleState] = useState<RightPanelStyle>(() => {
        const storedRightPanelStyle = safeStorageGetItem("right-panel-style");
        return storedRightPanelStyle === "classic" ? "classic" : "artwork";
    });
    const [bottomPlayerStyle, setBottomPlayerStyleState] = useState<BottomPlayerStyle>(() => {
        const storedBottomPlayerStyle = safeStorageGetItem("bottom-player-style");
        return storedBottomPlayerStyle === "black" ? "black" : "current";
    });
    const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => {
        const storedSidebarStyle = safeStorageGetItem("sidebar-style");
        return storedSidebarStyle === "artwork" ? "artwork" : "classic";
    });
    const [rightPanelDefaultTab, setRightPanelDefaultTabState] = useState<"lyrics" | "queue">(() => {
        const storedRightPanelDefaultTab = safeStorageGetItem("right-panel-default-tab");
        return storedRightPanelDefaultTab === "queue" ? "queue" : "lyrics";
    });
    const [librarySortDefault, setLibrarySortDefaultState] = useState<LibrarySortDefault>(() => {
        const storedLibrarySortDefault = safeStorageGetItem("library-sort-default");
        return storedLibrarySortDefault === "alphabetical" ? "alphabetical" : "recents";
    });
    const [libraryOpenState, setLibraryOpenStateState] = useState<LibraryOpenState>(() => {
        const storedLibraryOpenState = safeStorageGetItem("library-open-state");
        return storedLibraryOpenState === "collapsed" ? "collapsed" : "expanded";
    });
    const [playerButtonsLayout, setPlayerButtonsLayoutState] = useState<PlayerButtonsLayout>(() => {
        const storedPlayerButtonsLayout = safeStorageGetItem("player-buttons-layout");
        return storedPlayerButtonsLayout === "spacious" ? "spacious" : "compact";
    });
    const [coverArtCorners, setCoverArtCornersState] = useState<CoverArtCorners>(() => {
        const storedCoverArtCorners = safeStorageGetItem("cover-art-corners");
        return storedCoverArtCorners === "rounded" ? "rounded" : "sharp";
    });
    const [pageDensity, setPageDensityState] = useState<PageDensity>(() => {
        const storedPageDensity = safeStorageGetItem("page-density");
        return storedPageDensity === "compact" ? "compact" : "comfortable";
    });
    const [accentSource, setAccentSourceState] = useState<AccentSource>(() => {
        const storedAccentSource = safeStorageGetItem("accent-source");
        return storedAccentSource === "theme" ? "theme" : "dynamic";
    });
    const [animationMode, setAnimationModeState] = useState<AnimationMode>(() => {
        const storedAnimationMode = safeStorageGetItem("animation-mode");
        return storedAnimationMode === "reduced" || storedAnimationMode === "off" ? storedAnimationMode : "full";
    });
    const [titleLineMode, setTitleLineModeState] = useState<TitleLineMode>(() => {
        const storedTitleLineMode = safeStorageGetItem("title-line-mode");
        return storedTitleLineMode === "double" ? "double" : "single";
    });
    const [rightPanelAutoOpen, setRightPanelAutoOpenState] = useState<RightPanelAutoOpen>(() => {
        const storedRightPanelAutoOpen = safeStorageGetItem(RIGHT_PANEL_AUTO_OPEN_STORAGE_KEY);
        const resolvedRightPanelAutoOpen = resolveRightPanelAutoOpenPreference(storedRightPanelAutoOpen);

        if (storedRightPanelAutoOpen !== null && storedRightPanelAutoOpen !== resolvedRightPanelAutoOpen) {
            persistRightPanelAutoOpenPreference(resolvedRightPanelAutoOpen, hasExplicitRightPanelAutoOpenPreference());
        }

        return resolvedRightPanelAutoOpen;
    });
    const [explicitBadgeVisibility, setExplicitBadgeVisibilityState] = useState<ExplicitBadgeVisibility>(() => {
        const storedExplicitBadgeVisibility = safeStorageGetItem("explicit-badge-visibility");
        return storedExplicitBadgeVisibility === "hide" ? "hide" : "show";
    });
    const [lyricsSyncMode, setLyricsSyncModeState] = useState<LyricsSyncMode>(() => {
        const storedLyricsSyncMode = safeStorageGetItem("lyrics-sync-mode");
        return storedLyricsSyncMode === "static" ? "static" : "follow";
    });
    const [showFullScreenLyrics, setShowFullScreenLyricsState] = useState(() => safeStorageGetItem("show-fullscreen-lyrics") !== "false");
    const [fullScreenBackgroundBlur, setFullScreenBackgroundBlurState] = useState(() => normalizeStoredPercentage(
        safeStorageGetItem("fullscreen-background-blur"),
        DEFAULT_FULLSCREEN_BACKGROUND_BLUR,
    ));
    const [fullScreenBackgroundDarkness, setFullScreenBackgroundDarknessState] = useState(() => normalizeStoredPercentage(
        safeStorageGetItem("fullscreen-background-darkness"),
        DEFAULT_FULLSCREEN_BACKGROUND_DARKNESS,
    ));
    const [showSidebar, setShowSidebarState] = useState(() => safeStorageGetItem("show-sidebar") !== "false");
    const [showScrollbar, setShowScrollbarState] = useState(() => safeStorageGetItem("show-scrollbar") !== "false");
    const [animationsEnabled, setAnimationsEnabledState] = useState(() => safeStorageGetItem("animations") !== "false");
    const [blurEffects, setBlurEffectsState] = useState(() => safeStorageGetItem("blur-effects") !== "false");
    const [downloadFormat, setDownloadFormatState] = useState<DownloadFormat>(() => normalizeDownloadFormat(safeStorageGetItem("download-format")));
    const [scrobblePercent, setScrobblePercentState] = useState(() => safeStorageGetItem("scrobble-percent") || "50");
    const accountSyncReadyRef = useRef(false);
    const lastSyncedUiPreferencesRef = useRef<string | null>(null);
    const pendingUiSyncTimeoutRef = useRef<number | null>(null);
    const effectiveWebsiteMode: WebsiteMode = websiteMode;
    const effectiveCardSize: MediaCardSize = cardSize;
    const syncedUiPreferences = useMemo<SyncedUiPreferences>(() => ({
        theme,
        font,
        librarySource,
        compactMode,
        showLocalFiles,
        dynamicCardsEnabled,
        discordPresenceEnabled,
        libraryItemStyle,
        cardSize,
        websiteMode,
        rightPanelStyle,
        bottomPlayerStyle,
        sidebarStyle,
        rightPanelDefaultTab,
        librarySortDefault,
        libraryOpenState,
        playerButtonsLayout,
        coverArtCorners,
        pageDensity,
        accentSource,
        animationMode,
        titleLineMode,
        rightPanelAutoOpen,
        explicitBadgeVisibility,
        lyricsSyncMode,
        showFullScreenLyrics,
        fullScreenBackgroundBlur,
        fullScreenBackgroundDarkness,
        showSidebar,
        showScrollbar,
        blurEffects,
        downloadFormat,
        scrobblePercent,
    }), [
        animationMode,
        blurEffects,
        bottomPlayerStyle,
        cardSize,
        compactMode,
        coverArtCorners,
        discordPresenceEnabled,
        downloadFormat,
        dynamicCardsEnabled,
        explicitBadgeVisibility,
        font,
        fullScreenBackgroundBlur,
        fullScreenBackgroundDarkness,
        showFullScreenLyrics,
        librarySource,
        libraryItemStyle,
        libraryOpenState,
        librarySortDefault,
        lyricsSyncMode,
        pageDensity,
        playerButtonsLayout,
        rightPanelAutoOpen,
        rightPanelDefaultTab,
        rightPanelStyle,
        scrobblePercent,
        showLocalFiles,
        showScrollbar,
        showSidebar,
        sidebarStyle,
        theme,
        titleLineMode,
        websiteMode,
        accentSource,
    ]);
    const syncedUiPreferencesRef = useRef(syncedUiPreferences);
    syncedUiPreferencesRef.current = syncedUiPreferences;
    const applySyncedUiPreferences = useCallback((preferences: Partial<SyncedUiPreferences>) => {
        if (preferences.theme !== undefined) {
            setThemeState(preferences.theme);
            safeStorageSetItem("app-theme", preferences.theme);
        }
        if (preferences.font !== undefined) {
            setFontState(preferences.font);
            safeStorageSetItem("app-font", preferences.font);
        }
        if (preferences.librarySource !== undefined) {
            setLibrarySourceState(preferences.librarySource);
            safeStorageSetItem("library-source", preferences.librarySource);
        }
        if (preferences.compactMode !== undefined) {
            setCompactModeState(preferences.compactMode);
            safeStorageSetItem("compact-mode", String(preferences.compactMode));
        }
        if (preferences.showLocalFiles !== undefined) {
            setShowLocalFilesState(preferences.showLocalFiles);
            safeStorageSetItem("show-local-files", String(preferences.showLocalFiles));
        }
        if (preferences.dynamicCardsEnabled !== undefined) {
            setDynamicCardsEnabledState(preferences.dynamicCardsEnabled);
            safeStorageSetItem("dynamic-cards", String(preferences.dynamicCardsEnabled));
        }
        if (preferences.discordPresenceEnabled !== undefined) {
            setDiscordPresenceEnabledState(preferences.discordPresenceEnabled);
            safeStorageSetItem("discord-presence-enabled", String(preferences.discordPresenceEnabled));
        }
        if (preferences.libraryItemStyle !== undefined) {
            setLibraryItemStyleState(preferences.libraryItemStyle);
            safeStorageSetItem("library-item-style", preferences.libraryItemStyle);
        }
        if (preferences.cardSize !== undefined) {
            setCardSizeState(preferences.cardSize);
            safeStorageSetItem("card-size", preferences.cardSize);
        }
        if (preferences.websiteMode !== undefined) {
            setWebsiteModeState(preferences.websiteMode);
            safeStorageSetItem("website-mode", preferences.websiteMode);
        }
        if (preferences.rightPanelStyle !== undefined) {
            setRightPanelStyleState(preferences.rightPanelStyle);
            safeStorageSetItem("right-panel-style", preferences.rightPanelStyle);
        }
        if (preferences.bottomPlayerStyle !== undefined) {
            setBottomPlayerStyleState(preferences.bottomPlayerStyle);
            safeStorageSetItem("bottom-player-style", preferences.bottomPlayerStyle);
        }
        if (preferences.sidebarStyle !== undefined) {
            setSidebarStyleState(preferences.sidebarStyle);
            safeStorageSetItem("sidebar-style", preferences.sidebarStyle);
        }
        if (preferences.rightPanelDefaultTab !== undefined) {
            setRightPanelDefaultTabState(preferences.rightPanelDefaultTab);
            safeStorageSetItem("right-panel-default-tab", preferences.rightPanelDefaultTab);
        }
        if (preferences.librarySortDefault !== undefined) {
            setLibrarySortDefaultState(preferences.librarySortDefault);
            safeStorageSetItem("library-sort-default", preferences.librarySortDefault);
        }
        if (preferences.libraryOpenState !== undefined) {
            setLibraryOpenStateState(preferences.libraryOpenState);
            safeStorageSetItem("library-open-state", preferences.libraryOpenState);
        }
        if (preferences.playerButtonsLayout !== undefined) {
            setPlayerButtonsLayoutState(preferences.playerButtonsLayout);
            safeStorageSetItem("player-buttons-layout", preferences.playerButtonsLayout);
        }
        if (preferences.coverArtCorners !== undefined) {
            setCoverArtCornersState(preferences.coverArtCorners);
            safeStorageSetItem("cover-art-corners", preferences.coverArtCorners);
        }
        if (preferences.pageDensity !== undefined) {
            setPageDensityState(preferences.pageDensity);
            safeStorageSetItem("page-density", preferences.pageDensity);
        }
        if (preferences.accentSource !== undefined) {
            setAccentSourceState(preferences.accentSource);
            setAccentColorState(preferences.accentSource);
            safeStorageSetItem("accent-source", preferences.accentSource);
            safeStorageSetItem("accent-color", preferences.accentSource);
        }
        if (preferences.animationMode !== undefined) {
            const nextAnimationsEnabled = preferences.animationMode !== "off";
            setAnimationModeState(preferences.animationMode);
            setAnimationsEnabledState(nextAnimationsEnabled);
            safeStorageSetItem("animation-mode", preferences.animationMode);
            safeStorageSetItem("animations", String(nextAnimationsEnabled));
        }
        if (preferences.titleLineMode !== undefined) {
            setTitleLineModeState(preferences.titleLineMode);
            safeStorageSetItem("title-line-mode", preferences.titleLineMode);
        }
        if (preferences.rightPanelAutoOpen !== undefined) {
            const resolvedRightPanelAutoOpen = resolveRightPanelAutoOpenPreference(preferences.rightPanelAutoOpen);
            setRightPanelAutoOpenState(resolvedRightPanelAutoOpen);
            persistRightPanelAutoOpenPreference(resolvedRightPanelAutoOpen, hasExplicitRightPanelAutoOpenPreference());
        }
        if (preferences.explicitBadgeVisibility !== undefined) {
            setExplicitBadgeVisibilityState(preferences.explicitBadgeVisibility);
            safeStorageSetItem("explicit-badge-visibility", preferences.explicitBadgeVisibility);
        }
        if (preferences.lyricsSyncMode !== undefined) {
            setLyricsSyncModeState(preferences.lyricsSyncMode);
            safeStorageSetItem("lyrics-sync-mode", preferences.lyricsSyncMode);
        }
        if (preferences.showFullScreenLyrics !== undefined) {
            setShowFullScreenLyricsState(preferences.showFullScreenLyrics);
            safeStorageSetItem("show-fullscreen-lyrics", String(preferences.showFullScreenLyrics));
        }
        if (preferences.fullScreenBackgroundBlur !== undefined) {
            const normalized = clampPercentage(preferences.fullScreenBackgroundBlur);
            setFullScreenBackgroundBlurState(normalized);
            safeStorageSetItem("fullscreen-background-blur", String(normalized));
        }
        if (preferences.fullScreenBackgroundDarkness !== undefined) {
            const normalized = clampPercentage(preferences.fullScreenBackgroundDarkness);
            setFullScreenBackgroundDarknessState(normalized);
            safeStorageSetItem("fullscreen-background-darkness", String(normalized));
        }
        if (preferences.showSidebar !== undefined) {
            setShowSidebarState(preferences.showSidebar);
            safeStorageSetItem("show-sidebar", String(preferences.showSidebar));
        }
        if (preferences.showScrollbar !== undefined) {
            setShowScrollbarState(preferences.showScrollbar);
            safeStorageSetItem("show-scrollbar", String(preferences.showScrollbar));
        }
        if (preferences.blurEffects !== undefined) {
            setBlurEffectsState(preferences.blurEffects);
            safeStorageSetItem("blur-effects", String(preferences.blurEffects));
        }
        if (preferences.downloadFormat !== undefined) {
            setDownloadFormatState(preferences.downloadFormat);
            safeStorageSetItem("download-format", preferences.downloadFormat);
        }
        if (preferences.scrobblePercent !== undefined) {
            setScrobblePercentState(preferences.scrobblePercent);
            safeStorageSetItem("scrobble-percent", preferences.scrobblePercent);
        }
    }, []);

    useLayoutEffect(() => {
        const root = document.documentElement;
        // Apply Theme Base
        root.setAttribute("data-theme", theme);
        root.setAttribute("data-website-mode", effectiveWebsiteMode);
        root.setAttribute("data-sidebar-style", sidebarStyle);
        root.setAttribute("data-player-buttons-layout", playerButtonsLayout);
        root.setAttribute("data-cover-art-corners", coverArtCorners);
        root.setAttribute("data-page-density", pageDensity);
        root.setAttribute("data-accent-source", accentSource);
        root.setAttribute("data-animation-mode", animationMode);
        root.setAttribute("data-title-line-mode", titleLineMode);
        root.setAttribute("data-explicit-badge-visibility", explicitBadgeVisibility);
        root.setAttribute("data-lyrics-sync-mode", lyricsSyncMode);

        // Apply Font
        if (font === "System Default") {
            root.style.removeProperty("--font-sans");
        } else {
            root.style.setProperty("--font-sans", `"${font}", sans-serif`);
        }

        // Apply Compact Mode
        if (compactMode || pageDensity === "compact") root.classList.add("compact-mode");
        else root.classList.remove("compact-mode");

        // Apply Dynamic Cards
        if (!dynamicCardsEnabled) root.classList.add("disable-dynamic-cards");
        else root.classList.remove("disable-dynamic-cards");

        root.classList.add("card-style-editorial");

        const mediaCardPreset = getMediaCardSizePreset(effectiveCardSize);
        const mediaCardGridVars = getMediaCardGridCssVars(effectiveCardSize);
        root.style.setProperty("--media-card-min-width", mediaCardPreset.minWidth);
        root.style.setProperty("--media-card-grid-gap", mediaCardGridVars.gap);
        root.style.setProperty("--media-card-grid-min-width", mediaCardGridVars.minWidth);
        root.style.setProperty("--media-card-grid-ideal-width", mediaCardGridVars.idealWidth);
        root.style.setProperty("--media-card-grid-max-width", mediaCardGridVars.maxWidth);
        root.style.setProperty("--media-card-body-pad-inline", mediaCardPreset.bodyPadInline);
        root.style.setProperty("--media-card-body-pad-top", mediaCardPreset.bodyPadTop);
        root.style.setProperty("--media-card-body-pad-bottom", mediaCardPreset.bodyPadBottom);
        root.style.setProperty("--media-card-body-gap", mediaCardPreset.bodyGap);
        root.style.setProperty("--media-card-body-min-height", mediaCardPreset.bodyMinHeight);
        root.style.setProperty("--media-card-title-size", mediaCardPreset.titleSize);
        root.style.setProperty("--media-card-meta-size", mediaCardPreset.metaSize);
        root.style.setProperty("--media-card-action-size", mediaCardPreset.actionSize);
        root.style.setProperty("--media-card-action-inset", mediaCardPreset.actionInset);
        root.style.setProperty("--media-card-icon-size", mediaCardPreset.iconSize);
        root.style.setProperty("--media-card-hover-lift", mediaCardPreset.hoverLift);
        root.style.setProperty("--media-card-artwork-hover-scale", mediaCardPreset.artworkHoverScale);
        root.style.setProperty("--media-card-hover-focus-scale", mediaCardPreset.hoverFocusScale);
        root.style.setProperty("--media-card-neighbor-scale", mediaCardPreset.neighborScale);

        if (coverArtCorners === "rounded") {
            root.style.setProperty("--cover-radius", "18px");
        } else {
            root.style.setProperty("--cover-radius", effectiveWebsiteMode === "roundish" ? "24px" : "0px");
        }

        if (accentSource === "theme") {
            root.style.setProperty("--dynamic-accent", "0 0% 100%");
            root.style.setProperty("--player-waveform", "0 0% 80%");
            root.style.setProperty("--dynamic-accent-glow", "0 0% 100% / 0.2");
        }

        // Apply Animations
        if (!animationsEnabled || animationMode === "off") root.classList.add("disable-animations");
        else root.classList.remove("disable-animations");

        if (animationMode === "reduced") root.classList.add("reduce-animations");
        else root.classList.remove("reduce-animations");

        // Apply Blur Effects
        if (!blurEffects) root.classList.add("disable-blurs");
        else root.classList.remove("disable-blurs");

        // Apply visible scrollbar chrome
        if (showScrollbar) root.classList.add("show-scrollbars");
        else root.classList.remove("show-scrollbars");

    }, [theme, font, compactMode, dynamicCardsEnabled, cardSize, websiteMode, effectiveWebsiteMode, effectiveCardSize, animationsEnabled, blurEffects, showScrollbar, sidebarStyle, playerButtonsLayout, coverArtCorners, pageDensity, accentSource, animationMode, titleLineMode, explicitBadgeVisibility, lyricsSyncMode]);

    useEffect(() => {
        if (font !== "System Default") {
            ensureGoogleFontLoaded(font);
        }
    }, [font]);

    useEffect(() => {
        const storedWebsiteMode = safeStorageGetItem("website-mode");
        if (storedWebsiteMode && storedWebsiteMode !== "roundish") {
            safeStorageSetItem("website-mode", "roundish");
        }
    }, []);

    useEffect(() => {
        if (!user) {
            accountSyncReadyRef.current = false;
            lastSyncedUiPreferencesRef.current = null;
            if (pendingUiSyncTimeoutRef.current !== null) {
                window.clearTimeout(pendingUiSyncTimeoutRef.current);
                pendingUiSyncTimeoutRef.current = null;
            }
            return;
        }

        accountSyncReadyRef.current = false;
        let cancelled = false;

        void (async () => {
            const localSnapshot = syncedUiPreferencesRef.current;
            const localSnapshotKey = JSON.stringify(localSnapshot);

            try {
                const { data, error } = await loadProfilePreferences(user.id);
                if (cancelled) return;
                if (error) {
                    accountSyncReadyRef.current = true;
                    return;
                }

                const remotePreferences = parseSyncedUiPreferences(data?.ui_preferences);
                if (hasSyncedUiPreferences(remotePreferences)) {
                    const mergedSnapshot = { ...localSnapshot, ...remotePreferences };
                    lastSyncedUiPreferencesRef.current = JSON.stringify(mergedSnapshot);
                    applySyncedUiPreferences(remotePreferences);
                } else {
                    lastSyncedUiPreferencesRef.current = localSnapshotKey;
                    await persistProfilePreferences(user.id, { ui_preferences: localSnapshot });
                }
            } finally {
                if (!cancelled) {
                    accountSyncReadyRef.current = true;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [applySyncedUiPreferences, user]);

    useEffect(() => {
        if (!user || !accountSyncReadyRef.current) return;

        const nextSnapshotKey = JSON.stringify(syncedUiPreferences);
        if (lastSyncedUiPreferencesRef.current === nextSnapshotKey) return;

        if (pendingUiSyncTimeoutRef.current !== null) {
            window.clearTimeout(pendingUiSyncTimeoutRef.current);
        }

        pendingUiSyncTimeoutRef.current = window.setTimeout(() => {
            pendingUiSyncTimeoutRef.current = null;
            lastSyncedUiPreferencesRef.current = nextSnapshotKey;
            void persistProfilePreferences(user.id, { ui_preferences: syncedUiPreferences });
        }, 250);

        return () => {
            if (pendingUiSyncTimeoutRef.current !== null) {
                window.clearTimeout(pendingUiSyncTimeoutRef.current);
                pendingUiSyncTimeoutRef.current = null;
            }
        };
    }, [syncedUiPreferences, user]);

    const setTheme = useCallback((t: Theme) => { setThemeState(t); safeStorageSetItem("app-theme", t); }, []);
    const setAccentColor = useCallback((c: string) => { setAccentColorState(c); safeStorageSetItem("accent-color", c); }, []);
    const setFont = useCallback((f: Font) => { setFontState(f); safeStorageSetItem("app-font", f); }, []);
    const setLibrarySource = useCallback((s: LibrarySource) => {
        setLibrarySourceState(s);
        safeStorageSetItem("library-source", s);
    }, []);
    const setCompactMode = useCallback((e: boolean) => { setCompactModeState(e); safeStorageSetItem("compact-mode", String(e)); }, []);
    const setShowLocalFiles = useCallback((e: boolean) => { setShowLocalFilesState(e); safeStorageSetItem("show-local-files", String(e)); }, []);
    const setDynamicCardsEnabled = useCallback((e: boolean) => { setDynamicCardsEnabledState(e); safeStorageSetItem("dynamic-cards", String(e)); }, []);
    const setDiscordPresenceEnabled = useCallback((e: boolean) => { setDiscordPresenceEnabledState(e); safeStorageSetItem("discord-presence-enabled", String(e)); }, []);
    const setLibraryItemStyle = useCallback((s: LibraryItemStyle) => { setLibraryItemStyleState(s); safeStorageSetItem("library-item-style", s); }, []);
    const setCardSize = useCallback((s: MediaCardSize) => { setCardSizeState(s); safeStorageSetItem("card-size", s); }, []);
    const setWebsiteMode = useCallback((m: WebsiteMode) => { setWebsiteModeState(m); safeStorageSetItem("website-mode", m); }, []);
    const setRightPanelStyle = useCallback((s: RightPanelStyle) => { setRightPanelStyleState(s); safeStorageSetItem("right-panel-style", s); }, []);
    const setBottomPlayerStyle = useCallback((s: BottomPlayerStyle) => { setBottomPlayerStyleState(s); safeStorageSetItem("bottom-player-style", s); }, []);
    const setSidebarStyle = useCallback((s: SidebarStyle) => { setSidebarStyleState(s); safeStorageSetItem("sidebar-style", s); }, []);
    const setRightPanelDefaultTab = useCallback((s: "lyrics" | "queue") => { setRightPanelDefaultTabState(s); safeStorageSetItem("right-panel-default-tab", s); }, []);
    const setLibrarySortDefault = useCallback((s: LibrarySortDefault) => { setLibrarySortDefaultState(s); safeStorageSetItem("library-sort-default", s); }, []);
    const setLibraryOpenState = useCallback((s: LibraryOpenState) => { setLibraryOpenStateState(s); safeStorageSetItem("library-open-state", s); }, []);
    const setPlayerButtonsLayout = useCallback((s: PlayerButtonsLayout) => { setPlayerButtonsLayoutState(s); safeStorageSetItem("player-buttons-layout", s); }, []);
    const setCoverArtCorners = useCallback((s: CoverArtCorners) => { setCoverArtCornersState(s); safeStorageSetItem("cover-art-corners", s); }, []);
    const setPageDensity = useCallback((s: PageDensity) => { setPageDensityState(s); safeStorageSetItem("page-density", s); }, []);
    const setAccentSource = useCallback((s: AccentSource) => { setAccentSourceState(s); safeStorageSetItem("accent-source", s); safeStorageSetItem("accent-color", s); }, []);
    const setAnimationMode = useCallback((s: AnimationMode) => { setAnimationModeState(s); setAnimationsEnabledState(s !== "off"); safeStorageSetItem("animation-mode", s); safeStorageSetItem("animations", String(s !== "off")); }, []);
    const setTitleLineMode = useCallback((s: TitleLineMode) => { setTitleLineModeState(s); safeStorageSetItem("title-line-mode", s); }, []);
    const setRightPanelAutoOpen = useCallback((s: RightPanelAutoOpen) => {
        setRightPanelAutoOpenState(s);
        persistRightPanelAutoOpenPreference(s, true);
    }, []);
    const setExplicitBadgeVisibility = useCallback((s: ExplicitBadgeVisibility) => { setExplicitBadgeVisibilityState(s); safeStorageSetItem("explicit-badge-visibility", s); }, []);
    const setLyricsSyncMode = useCallback((s: LyricsSyncMode) => { setLyricsSyncModeState(s); safeStorageSetItem("lyrics-sync-mode", s); }, []);
    const setShowFullScreenLyrics = useCallback((e: boolean) => {
        setShowFullScreenLyricsState(e);
        safeStorageSetItem("show-fullscreen-lyrics", String(e));
    }, []);
    const setFullScreenBackgroundBlur = useCallback((value: number) => {
        const normalized = clampPercentage(value);
        setFullScreenBackgroundBlurState(normalized);
        safeStorageSetItem("fullscreen-background-blur", String(normalized));
    }, []);
    const setFullScreenBackgroundDarkness = useCallback((value: number) => {
        const normalized = clampPercentage(value);
        setFullScreenBackgroundDarknessState(normalized);
        safeStorageSetItem("fullscreen-background-darkness", String(normalized));
    }, []);
    const setShowSidebar = useCallback((e: boolean) => {
        setShowSidebarState(e);
        safeStorageSetItem("show-sidebar", String(e));
    }, []);
    const setShowScrollbar = useCallback((e: boolean) => { setShowScrollbarState(e); safeStorageSetItem("show-scrollbar", String(e)); }, []);
    const setAnimationsEnabled = useCallback((e: boolean) => { setAnimationsEnabledState(e); setAnimationModeState(e ? "full" : "off"); safeStorageSetItem("animations", String(e)); safeStorageSetItem("animation-mode", e ? "full" : "off"); }, []);
    const setBlurEffects = useCallback((e: boolean) => { setBlurEffectsState(e); safeStorageSetItem("blur-effects", String(e)); }, []);
    const setDownloadFormat = useCallback((f: DownloadFormat) => {
        const normalized = normalizeDownloadFormat(f);
        setDownloadFormatState(normalized);
        safeStorageSetItem("download-format", normalized);
    }, []);
    const setScrobblePercent = useCallback((p: string) => { setScrobblePercentState(p); safeStorageSetItem("scrobble-percent", p); }, []);

    const clearCacheAndReset = useCallback(() => {
        safeStorageClear();
        try {
            sessionStorage.clear();
        } catch {
            // Ignore storage clear failures.
        }
        window.location.reload();
    }, []);

    const value = useMemo(() => ({
        theme, setTheme,
        accentColor, setAccentColor,
        font, setFont,
        librarySource, setLibrarySource,
        compactMode, setCompactMode,
        showLocalFiles, setShowLocalFiles,
        dynamicCardsEnabled, setDynamicCardsEnabled,
        discordPresenceEnabled, setDiscordPresenceEnabled,
        libraryItemStyle, setLibraryItemStyle,
        cardSize, setCardSize,
        websiteMode, setWebsiteMode,
        rightPanelStyle, setRightPanelStyle,
        bottomPlayerStyle, setBottomPlayerStyle,
        sidebarStyle, setSidebarStyle,
        rightPanelDefaultTab, setRightPanelDefaultTab,
        librarySortDefault, setLibrarySortDefault,
        libraryOpenState, setLibraryOpenState,
        playerButtonsLayout, setPlayerButtonsLayout,
        coverArtCorners, setCoverArtCorners,
        pageDensity, setPageDensity,
        accentSource, setAccentSource,
        animationMode, setAnimationMode,
        titleLineMode, setTitleLineMode,
        rightPanelAutoOpen, setRightPanelAutoOpen,
        explicitBadgeVisibility, setExplicitBadgeVisibility,
        lyricsSyncMode, setLyricsSyncMode,
        showFullScreenLyrics, setShowFullScreenLyrics,
        fullScreenBackgroundBlur, setFullScreenBackgroundBlur,
        fullScreenBackgroundDarkness, setFullScreenBackgroundDarkness,
        showSidebar, setShowSidebar,
        showScrollbar, setShowScrollbar,
        animationsEnabled, setAnimationsEnabled,
        blurEffects, setBlurEffects,
        downloadFormat, setDownloadFormat,
        scrobblePercent, setScrobblePercent,
        clearCacheAndReset
    }), [
        accentColor, accentSource, animationMode, animationsEnabled, blurEffects,
        bottomPlayerStyle, cardSize, clearCacheAndReset, compactMode, coverArtCorners,
        discordPresenceEnabled, downloadFormat, dynamicCardsEnabled, explicitBadgeVisibility,
        font, fullScreenBackgroundBlur, fullScreenBackgroundDarkness, libraryItemStyle, libraryOpenState, librarySortDefault, lyricsSyncMode,
        librarySource,
        pageDensity, playerButtonsLayout, rightPanelAutoOpen, rightPanelDefaultTab,
        rightPanelStyle, scrobblePercent, setAccentColor, setAccentSource,
        setAnimationMode, setAnimationsEnabled, setBlurEffects, setBottomPlayerStyle,
        setCardSize, setCompactMode, setCoverArtCorners, setDiscordPresenceEnabled,
        setDownloadFormat, setDynamicCardsEnabled, setExplicitBadgeVisibility, setFont,
        setFullScreenBackgroundBlur, setFullScreenBackgroundDarkness, setLibrarySource,
        setLibraryItemStyle, setLibraryOpenState, setLibrarySortDefault, setLyricsSyncMode,
        setPageDensity, setPlayerButtonsLayout, setRightPanelAutoOpen, setRightPanelDefaultTab,
        setRightPanelStyle, setScrobblePercent, setShowLocalFiles, setShowScrollbar,
        setShowFullScreenLyrics, setShowSidebar, setSidebarStyle, setTheme, setTitleLineMode, setWebsiteMode,
        showFullScreenLyrics, showLocalFiles, showScrollbar, showSidebar, sidebarStyle, theme, titleLineMode,
        websiteMode
    ]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
    return ctx;
}

export function useOptionalSettings() {
    return useContext(SettingsContext);
}
