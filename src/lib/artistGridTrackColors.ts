const DEFAULT_ARTIST_GRID_TRACK_COLOR = "220 70% 55%";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rgbToHslToken(r: number, g: number, b: number) {
  const normalizedR = clamp(r, 0, 255) / 255;
  const normalizedG = clamp(g, 0, 255) / 255;
  const normalizedB = clamp(b, 0, 255) / 255;

  const max = Math.max(normalizedR, normalizedG, normalizedB);
  const min = Math.min(normalizedR, normalizedG, normalizedB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case normalizedR:
        h = ((normalizedG - normalizedB) / d + (normalizedG < normalizedB ? 6 : 0)) / 6;
        break;
      case normalizedG:
        h = ((normalizedB - normalizedR) / d + 2) / 6;
        break;
      default:
        h = ((normalizedR - normalizedG) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToHslToken(hex: string) {
  const normalized = hex.trim();
  const shorthandMatch = normalized.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  const fullHex = shorthandMatch
    ? `${shorthandMatch[1]}${shorthandMatch[1]}${shorthandMatch[2]}${shorthandMatch[2]}${shorthandMatch[3]}${shorthandMatch[3]}`
    : normalized.replace(/^#/, "");

  const match = fullHex.match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;

  return rgbToHslToken(
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  );
}

export function normalizeArtistGridTrackColor(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  if (/^-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/i.test(trimmed)) {
    return trimmed;
  }

  if (/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(trimmed)) {
    return hexToHslToken(trimmed);
  }

  const hslMatch = trimmed.match(
    /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(\d+(?:\.\d+)?)%\s*(?:,|\s)\s*(\d+(?:\.\d+)?)%(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,
  );
  if (hslMatch) {
    return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*(?:,|\s)\s*(\d+(?:\.\d+)?)\s*(?:,|\s)\s*(\d+(?:\.\d+)?)(?:\s*\/\s*[\d.]+%?|\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    return rgbToHslToken(
      Number(rgbMatch[1]),
      Number(rgbMatch[2]),
      Number(rgbMatch[3]),
    );
  }

  return null;
}

export function resolveArtistGridTrackCanvasColor({
  artworkColor,
  eraBackgroundColor,
}: {
  artworkColor?: string | null;
  eraBackgroundColor?: string | null;
}) {
  return normalizeArtistGridTrackColor(artworkColor)
    || normalizeArtistGridTrackColor(eraBackgroundColor)
    || DEFAULT_ARTIST_GRID_TRACK_COLOR;
}

export { DEFAULT_ARTIST_GRID_TRACK_COLOR };
