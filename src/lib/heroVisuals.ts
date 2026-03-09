export const HERO_SPLIT_MASK_IMAGE = "linear-gradient(to left, black 0%, black 34%, rgba(0,0,0,0.9) 48%, rgba(0,0,0,0.58) 62%, rgba(0,0,0,0.2) 80%, transparent 100%), linear-gradient(to top, transparent 0%, black 22%, black 100%)";

const DEFAULT_HERO_ACCENT = "220 70% 55%";

type HeroColorSource =
  | { kind: "token"; value: string }
  | { kind: "css-var"; value: string };

function normalizeHeroAccent(value?: string) {
  const trimmed = String(value || "").trim();
  if (/^-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/i.test(trimmed)) {
    return trimmed;
  }

  return DEFAULT_HERO_ACCENT;
}

function shiftHeroAccent(
  accent: string | undefined,
  {
    hueShift = 0,
    saturationShift = 0,
    lightnessShift = 0,
  }: {
    hueShift?: number;
    saturationShift?: number;
    lightnessShift?: number;
  } = {},
) {
  const normalized = normalizeHeroAccent(accent);
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return DEFAULT_HERO_ACCENT;

  const baseHue = Number(match[1]);
  const baseSaturation = Number(match[2]);
  const baseLightness = Number(match[3]);

  const hue = ((baseHue + hueShift) % 360 + 360) % 360;
  const saturation = Math.max(18, Math.min(96, baseSaturation + saturationShift));
  const lightness = Math.max(18, Math.min(76, baseLightness + lightnessShift));

  return `${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%`;
}

function tokenColor(value: string): HeroColorSource {
  return { kind: "token", value };
}

function cssVarColor(value: string): HeroColorSource {
  return { kind: "css-var", value };
}

function formatHeroColorSource(source: HeroColorSource) {
  return source.kind === "css-var" ? `var(${source.value})` : source.value;
}

export function getHeroSurfaceBackground(accent?: string) {
  const primary = cssVarColor("--player-waveform");
  const secondary = accent
    ? tokenColor(shiftHeroAccent(accent, { hueShift: 18, saturationShift: 6, lightnessShift: 8 }))
    : cssVarColor("--dynamic-accent");
  const tertiary = accent
    ? tokenColor(shiftHeroAccent(accent, { hueShift: -22, saturationShift: 2, lightnessShift: -4 }))
    : cssVarColor("--dynamic-accent");

  return `radial-gradient(circle at 16% 16%, hsl(${formatHeroColorSource(primary)} / 0.24), transparent 34%),
radial-gradient(circle at 82% 12%, hsl(${formatHeroColorSource(secondary)} / 0.16), transparent 28%),
radial-gradient(circle at 18% 82%, hsl(${formatHeroColorSource(tertiary)} / 0.14), transparent 30%),
linear-gradient(180deg, hsl(0 0% 8% / 0.88), hsl(0 0% 4% / 0.96))`;
}

export function getHeroSplitOverlayBackground(accent?: string) {
  const primary = cssVarColor("--player-waveform");
  const soft = accent
    ? tokenColor(shiftHeroAccent(accent, { hueShift: 12, saturationShift: 2, lightnessShift: 10 }))
    : cssVarColor("--dynamic-accent");

  return `linear-gradient(to right, hsl(${formatHeroColorSource(primary)} / 0.42) 0%, hsl(${formatHeroColorSource(soft)} / 0.24) 24%, hsl(${formatHeroColorSource(soft)} / 0.12) 48%, hsl(var(--background) / 0.18) 68%, transparent 100%),
radial-gradient(circle at 58% 50%, hsl(var(--background) / 0.16) 0%, transparent 28%),
linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.82) 18%, transparent 48%)`;
}

export const HERO_SPLIT_OVERLAY_BACKGROUND = getHeroSplitOverlayBackground();

export function getHeroAuraBackground(accent?: string) {
  const leading = cssVarColor("--player-waveform");
  const trailing = accent
    ? tokenColor(shiftHeroAccent(accent, { hueShift: 22, saturationShift: 4, lightnessShift: 8 }))
    : cssVarColor("--dynamic-accent");
  const base = accent
    ? tokenColor(shiftHeroAccent(accent, { hueShift: -16, saturationShift: 8, lightnessShift: -2 }))
    : cssVarColor("--dynamic-accent");

  return `radial-gradient(circle at 12% 18%, hsl(${formatHeroColorSource(leading)} / 0.22), transparent 24%),
radial-gradient(circle at 85% 14%, hsl(${formatHeroColorSource(trailing)} / 0.16), transparent 22%),
radial-gradient(circle at 26% 88%, hsl(${formatHeroColorSource(base)} / 0.18), transparent 24%)`;
}

export function getHeroScrollStyles(scrollY: number) {
  return {
    scrollScale: 1 + scrollY * 0.001,
    scrollBlur: Math.min(scrollY * 0.05, 12),
    scrollOpacity: Math.max(1 - scrollY * 0.002, 0.4),
  };
}
