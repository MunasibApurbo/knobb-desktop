import { extractDominantColor } from "@/lib/colorExtractor";
import { loadMusicApiModule } from "@/lib/runtimeModules";
import { Track } from "@/types/music";
import { getResolvableTidalId } from "@/lib/trackIdentity";

const DEFAULT_DYNAMIC_ACCENT = "220 70% 55%";

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

export function dimWaveformColor(hsl: string, lightnessDrop = 10): string {
  const match = hsl.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return hsl;

  const hue = Number(match[1]);
  const sat = Number(match[2]);
  const light = Number(match[3]);
  const nextLight = Math.max(0, Math.min(100, light - lightnessDrop));

  return `${hue} ${sat}% ${nextLight}%`;
}

function applyAccentVariables(hsl: string) {
  const normalized = normalizeAccentColor(hsl) || DEFAULT_DYNAMIC_ACCENT;
  const root = document.documentElement;
  root.style.setProperty("--dynamic-accent", normalized);
  root.style.setProperty("--player-waveform", dimWaveformColor(normalized));
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

  const baseAccent = normalizeAccentColor(track.canvasColor) || DEFAULT_DYNAMIC_ACCENT;
  let accentPriority = isPlaceholderAccent(baseAccent) ? 0 : 1;
  const applyAccentCandidate = (nextAccent: string | null | undefined, priority: number) => {
    const normalized = normalizeAccentColor(nextAccent);
    if (!normalized || priority < accentPriority) return;
    accentPriority = priority;
    applyAccentVariables(normalized);
  };

  applyAccentVariables(baseAccent);

  let cancelled = false;
  const resolvableTrackId = getResolvableTidalId(track);

  if (resolvableTrackId && accentPriority < 2) {
    void loadMusicApiModule()
      .then((module) => module.getTrackInfo(resolvableTrackId))
      .then((trackInfo) => {
        if (cancelled) return;
        const metadataAccent = normalizeAccentColor(trackInfo?.album?.vibrantColor || null);
        applyAccentCandidate(metadataAccent, 2);
      })
      .catch(() => undefined);
  }

  // Canvas color extraction varies across browser engines, especially in Firefox.
  // Keep it as a fallback so the player stays visually consistent with the curated
  // track/album accent instead of letting sampled cover art override it.
  void extractDominantColor(track.coverUrl).then((hsl) => {
    if (cancelled) return;
    applyAccentCandidate(hsl, 0);
  });

  return () => {
    cancelled = true;
  };
}
