import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = "default" | "midnight" | "forest" | "crimson" | "ocean" | "amber" | "monochrome" | "amoled";
type Font = "System Default" | "Inter" | "Roboto" | "Outfit" | "JetBrains Mono" | "Poppins" | "Nunito";

interface SettingsState {
    theme: Theme;
    accentColor: string;
    font: Font;
    compactMode: boolean;
    animationsEnabled: boolean;
    blurEffects: boolean;
    downloadFormat: string;
    scrobblePercent: string;
}

interface SettingsContextType extends SettingsState {
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: string) => void;
    setFont: (font: Font) => void;
    setCompactMode: (enabled: boolean) => void;
    setAnimationsEnabled: (enabled: boolean) => void;
    setBlurEffects: (enabled: boolean) => void;
    setDownloadFormat: (format: string) => void;
    setScrobblePercent: (percent: string) => void;
    clearCacheAndReset: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("app-theme") as Theme) || "default");
    const [accentColor, setAccentColorState] = useState(() => localStorage.getItem("accent-color") || "dynamic");
    const [font, setFontState] = useState<Font>(() => (localStorage.getItem("app-font") as Font) || "System Default");
    const [compactMode, setCompactModeState] = useState(() => localStorage.getItem("compact-mode") === "true");
    const [animationsEnabled, setAnimationsEnabledState] = useState(() => localStorage.getItem("animations") !== "false");
    const [blurEffects, setBlurEffectsState] = useState(() => localStorage.getItem("blur-effects") !== "false");
    const [downloadFormat, setDownloadFormatState] = useState(() => localStorage.getItem("download-format") || "flac");
    const [scrobblePercent, setScrobblePercentState] = useState(() => localStorage.getItem("scrobble-percent") || "50");

    useEffect(() => {
        const root = document.documentElement;
        // Apply Theme Base
        root.setAttribute("data-theme", theme);

        // Apply Font
        if (font === "System Default") {
            root.style.removeProperty("--font-sans");
        } else {
            root.style.setProperty("--font-sans", `"${font}", sans-serif`);
        }

        // Apply Compact Mode
        if (compactMode) root.classList.add("compact-mode");
        else root.classList.remove("compact-mode");

        // Apply Animations
        if (!animationsEnabled) root.classList.add("disable-animations");
        else root.classList.remove("disable-animations");

        // Apply Blur Effects
        if (!blurEffects) root.classList.add("disable-blurs");
        else root.classList.remove("disable-blurs");

    }, [theme, font, compactMode, animationsEnabled, blurEffects]);

    const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("app-theme", t); };
    const setAccentColor = (c: string) => { setAccentColorState(c); localStorage.setItem("accent-color", c); };
    const setFont = (f: Font) => { setFontState(f); localStorage.setItem("app-font", f); };
    const setCompactMode = (e: boolean) => { setCompactModeState(e); localStorage.setItem("compact-mode", String(e)); };
    const setAnimationsEnabled = (e: boolean) => { setAnimationsEnabledState(e); localStorage.setItem("animations", String(e)); };
    const setBlurEffects = (e: boolean) => { setBlurEffectsState(e); localStorage.setItem("blur-effects", String(e)); };
    const setDownloadFormat = (f: string) => { setDownloadFormatState(f); localStorage.setItem("download-format", f); };
    const setScrobblePercent = (p: string) => { setScrobblePercentState(p); localStorage.setItem("scrobble-percent", p); };

    const clearCacheAndReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    return (
        <SettingsContext.Provider value={{
            theme, setTheme,
            accentColor, setAccentColor,
            font, setFont,
            compactMode, setCompactMode,
            animationsEnabled, setAnimationsEnabled,
            blurEffects, setBlurEffects,
            downloadFormat, setDownloadFormat,
            scrobblePercent, setScrobblePercent,
            clearCacheAndReset
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
    return ctx;
}
