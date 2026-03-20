export type MediaCardSize = "smaller" | "small" | "default" | "big" | "bigger";

const DESKTOP_MEDIA_CARD_COLUMNS = 7;
const DESKTOP_MEDIA_CARD_MIN_COLUMNS = 5;
const DESKTOP_MEDIA_CARD_BREAKPOINT = 960;

type MediaCardSizePreset = {
  minWidth: string;
  bodyPadInline: string;
  bodyPadTop: string;
  bodyPadBottom: string;
  bodyGap: string;
  bodyMinHeight: string;
  titleSize: string;
  metaSize: string;
  actionSize: string;
  actionInset: string;
  iconSize: string;
  hoverLift: string;
  artworkHoverScale: string;
  hoverFocusScale: string;
  neighborScale: string;
  collapsedCount: number;
};

export const MEDIA_CARD_SIZE_PRESETS: Record<MediaCardSize, MediaCardSizePreset> = {
  smaller: {
    minWidth: "148px",
    bodyPadInline: "9px",
    bodyPadTop: "7px",
    bodyPadBottom: "9px",
    bodyGap: "2px",
    bodyMinHeight: "62px",
    titleSize: "0.9rem",
    metaSize: "0.72rem",
    actionSize: "36px",
    actionInset: "11px",
    iconSize: "17px",
    hoverLift: "5px",
    artworkHoverScale: "1.028",
    hoverFocusScale: "1.026",
    neighborScale: "0.98",
    collapsedCount: 9,
  },
  small: {
    minWidth: "162px",
    bodyPadInline: "10px",
    bodyPadTop: "8px",
    bodyPadBottom: "10px",
    bodyGap: "2px",
    bodyMinHeight: "66px",
    titleSize: "0.945rem",
    metaSize: "0.745rem",
    actionSize: "38px",
    actionInset: "12px",
    iconSize: "18px",
    hoverLift: "5px",
    artworkHoverScale: "1.032",
    hoverFocusScale: "1.03",
    neighborScale: "0.974",
    collapsedCount: 8,
  },
  default: {
    minWidth: "172px",
    bodyPadInline: "10px",
    bodyPadTop: "8px",
    bodyPadBottom: "10px",
    bodyGap: "2px",
    bodyMinHeight: "68px",
    titleSize: "0.965rem",
    metaSize: "0.76rem",
    actionSize: "39px",
    actionInset: "12px",
    iconSize: "18px",
    hoverLift: "6px",
    artworkHoverScale: "1.034",
    hoverFocusScale: "1.032",
    neighborScale: "0.972",
    collapsedCount: 8,
  },
  big: {
    minWidth: "192px",
    bodyPadInline: "11px",
    bodyPadTop: "9px",
    bodyPadBottom: "11px",
    bodyGap: "3px",
    bodyMinHeight: "72px",
    titleSize: "1rem",
    metaSize: "0.79rem",
    actionSize: "41px",
    actionInset: "13px",
    iconSize: "19px",
    hoverLift: "7px",
    artworkHoverScale: "1.04",
    hoverFocusScale: "1.038",
    neighborScale: "0.968",
    collapsedCount: 7,
  },
  bigger: {
    minWidth: "208px",
    bodyPadInline: "12px",
    bodyPadTop: "10px",
    bodyPadBottom: "12px",
    bodyGap: "3px",
    bodyMinHeight: "76px",
    titleSize: "1.03rem",
    metaSize: "0.81rem",
    actionSize: "43px",
    actionInset: "15px",
    iconSize: "20px",
    hoverLift: "8px",
    artworkHoverScale: "1.044",
    hoverFocusScale: "1.044",
    neighborScale: "0.962",
    collapsedCount: 7,
  },
};

export function getMediaCardSizePreset(size: MediaCardSize) {
  return MEDIA_CARD_SIZE_PRESETS[size] ?? MEDIA_CARD_SIZE_PRESETS.bigger;
}

export function getMediaCardCollapsedCount(size: MediaCardSize) {
  return getMediaCardSizePreset(size).collapsedCount;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getMediaCardGridMetrics(
  size: MediaCardSize,
  containerWidth = 1440,
) {
  const preset = getMediaCardSizePreset(size);
  const baseWidth = Number.parseFloat(preset.minWidth);
  const safeWidth = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 1440;
  const viewportScale = clampNumber(safeWidth / 1440, 0.82, 1.08);

  const gap = clampNumber(safeWidth * 0.012, 16, 24);
  const minWidth = clampNumber(baseWidth * (0.9 + (viewportScale - 1) * 0.35), baseWidth * 0.82, baseWidth * 1.01);
  const maxWidth = clampNumber(baseWidth * 1.08, minWidth + 10, baseWidth * 1.14);
  const idealWidth = clampNumber(safeWidth * 0.175, minWidth, maxWidth);
  return { gap, minWidth, idealWidth, maxWidth };
}

export function getMediaCardGridCssVars(size: MediaCardSize) {
  const metrics = getMediaCardGridMetrics(size, 1440);

  return {
    gap: "clamp(16px, 1.2vw + 8px, 24px)",
    minWidth: `${Math.round(metrics.minWidth)}px`,
    idealWidth: "17.5vw",
    maxWidth: `${Math.round(metrics.maxWidth)}px`,
  };
}

export function getMediaCardColumnsForWidth(
  width: number,
  size: MediaCardSize,
  compactBreakpoint = 640,
  compactColumns = 2,
) {
  if (!Number.isFinite(width) || width <= 0) return getMediaCardCollapsedCount(size);
  if (width < compactBreakpoint) return compactColumns;

  const { gap, idealWidth } = getMediaCardGridMetrics(size, width);
  const responsiveColumns = Math.max(1, Math.floor((width + gap) / (idealWidth + gap)));

  if (width >= DESKTOP_MEDIA_CARD_BREAKPOINT) {
    return clampNumber(responsiveColumns, DESKTOP_MEDIA_CARD_MIN_COLUMNS, DESKTOP_MEDIA_CARD_COLUMNS);
  }

  return responsiveColumns;
}
