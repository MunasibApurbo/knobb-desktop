import { extractDominantColor } from "@/lib/colorExtractor";
import { loadMusicApiModule } from "@/lib/runtimeModules";
import { Track } from "@/types/music";
import { getResolvableTidalId } from "@/lib/trackIdentity";
import { getArtworkColorSampleUrl, getTrackArtworkUrl } from "@/lib/trackArtwork";

const DEFAULT_DYNAMIC_ACCENT = "220 70% 55%";
const DEFAULT_PENDING_DYNAMIC_ACCENT = "0 0% 14%";
const DEFAULT_PLAYER_WAVEFORM = "0 0% 74%";

// Persistent cache for performance
const colorCache = new Map<string, string>();
const SESSION_CACHE_KEY = "knobb-color-cache-v2";

// Try to load cache from session storage
try {
  const saved = window.sessionStorage.getItem(SESSION_CACHE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([k, v]) => colorCache.set(k, v as string));
  }
} catch {
  // Ignore
}

function saveToCache(key: string, value: string) {
  colorCache.set(key, value);
  try {
    const obj = Object.fromEntries(colorCache.entries());
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore
  }
}

function isHslToken(value: string) {
  return /^-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/i.test(value.trim());
}

function isHexColor(value: string) {
  return /^#(?:[0-9a-f]{6})$/i.test(value.trim());
}

function hexToHsl(hex: string): string {
  const trimmed = hex.trim();
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(trimmed);
  if (!result) return DEFAULT_DYNAMIC_ACCENT;

  const r = Number.parseInt(result[1], 16) / 255;
  const g = Number.parseInt(result[2], 16) / 255;
  const b = Number.parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function normalizeAccentColor(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  if (isHslToken(trimmed)) return trimmed;
  if (isHexColor(trimmed)) return hexToHsl(trimmed);

  const hslFunction = trimmed.match(
    /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(\d+(?:\.\d+)?)%\s*(?:,|\s)\s*(\d+(?:\.\d+)?)%\s*(?:\/\s*[\d.]+%?)?\)$/i,
  );
  if (hslFunction) {
    return `${hslFunction[1]} ${hslFunction[2]}% ${hslFunction[3]}%`;
  }

  return null;
}

function isPlaceholderAccent(value: string | null | undefined) {
  return normalizeAccentColor(value) === DEFAULT_DYNAMIC_ACCENT;
}

function clampChannel(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

export function dimWaveformColor(hsl: string): string {
  const match = hsl.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return hsl;

  const hue = normalizeHue(Number(match[1]));
  const sat = Number(match[2]);
  const light = Number(match[3]);
  const isCoolBlue = hue >= 190 && hue <= 255;
  const isPurple = hue > 255 && hue <= 320;
  const isWarmGold = hue >= 35 && hue <= 85;

  if (sat < 16) {
    return `${Math.round(hue)} ${Math.round(clampChannel(sat * 0.9, 8, 18))}% ${Math.round(clampChannel(light + 12, 60, 76))}%`;
  }

  const nextSat = clampChannel(
    sat * (isCoolBlue ? 0.58 : isPurple ? 0.68 : 0.78),
    isCoolBlue ? 24 : 28,
    isCoolBlue ? 58 : 72,
  );
  const nextLight = clampChannel(
    light + (light < 50 ? 8 : light > 66 ? -6 : 1) + (isWarmGold ? 3 : 0),
    isWarmGold ? 48 : 44,
    isWarmGold ? 66 : 62,
  );

  return `${Math.round(hue)} ${Math.round(nextSat)}% ${Math.round(nextLight)}%`;
}

function applyAccentVariables(
  hsl: string,
  overrides?: {
    accentOverride?: string | null;
    waveformOverride?: string | null;
  },
) {
  const normalized = normalizeAccentColor(overrides?.accentOverride) || normalizeAccentColor(hsl) || DEFAULT_DYNAMIC_ACCENT;
  const root = document.documentElement;
  root.style.setProperty("--dynamic-accent", normalized);
  root.style.setProperty(
    "--player-waveform",
    overrides?.waveformOverride
      ? overrides.waveformOverride
      : isPlaceholderAccent(normalized)
        ? DEFAULT_PLAYER_WAVEFORM
        : dimWaveformColor(normalized),
  );
  root.style.setProperty("--dynamic-accent-glow", `${normalized} / 0.3`);
}

function getAccentSourcePreference() {
  if (typeof window === "undefined") return "dynamic";

  try {
    return window.localStorage.getItem("accent-source") === "theme" ? "theme" : "dynamic";
  } catch {
    return "dynamic";
  }
}

export function applyTrackAccent(track: Track | null) {
  if (!track) return () => undefined;
  if (getAccentSourcePreference() === "theme") return () => undefined;

  const artworkUrl = getTrackArtworkUrl(track);
  const artworkColorSampleUrl = getArtworkColorSampleUrl(artworkUrl);
  const cachedColor = colorCache.get(artworkUrl);
  const baseAccent = normalizeAccentColor(cachedColor || track.canvasColor) || DEFAULT_DYNAMIC_ACCENT;
  const pendingPlaceholderAccent = !cachedColor && isPlaceholderAccent(baseAccent);
  const pendingVideoThumbnailAccent = track.isVideo === true && !cachedColor;
  const keepPlayerChromeNeutral = pendingVideoThumbnailAccent || pendingPlaceholderAccent;
  let accentPriority = (cachedColor || !isPlaceholderAccent(baseAccent)) ? 1 : 0;

  const applyAccentCandidate = (nextAccent: string | null | undefined, priority: number) => {
    const normalized = normalizeAccentColor(nextAccent);
    if (!normalized || priority < accentPriority) return;

    // If it's a high priority match (extracted or metadata), cache it
    if (priority >= 1 && artworkUrl) {
      saveToCache(artworkUrl, normalized);
    }

    accentPriority = priority;
    applyAccentVariables(normalized);
  };

  applyAccentVariables(baseAccent, {
    accentOverride: keepPlayerChromeNeutral ? DEFAULT_PENDING_DYNAMIC_ACCENT : null,
    waveformOverride: keepPlayerChromeNeutral ? DEFAULT_PLAYER_WAVEFORM : null,
  });

  let cancelled = false;
  const resolvableTrackId = getResolvableTidalId(track);

  if (track.isVideo !== true && resolvableTrackId && accentPriority < 2) {
    void loadMusicApiModule()
      .then((module) => module.getTrackInfo(resolvableTrackId))
      .then((trackInfo) => {
        if (cancelled) return;
        const metadataAccent = normalizeAccentColor(trackInfo?.album?.vibrantColor || null);
        applyAccentCandidate(metadataAccent, 2);
      })
      .catch(() => undefined);
  }

  // Re-sample video thumbnails so stale cached accents do not stick across browser sessions.
  if (!cachedColor || track.isVideo === true) {
    void extractDominantColor(artworkColorSampleUrl).then((hsl) => {
      if (cancelled) return;
      applyAccentCandidate(hsl, track.isVideo ? 3 : 0);
    });
  }

  return () => {
    cancelled = true;
  };
}
