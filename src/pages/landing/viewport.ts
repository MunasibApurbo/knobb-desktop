import type { CSSProperties } from "react";

export const LANDING_REFERENCE_WIDTH = 1920;
export const LANDING_REFERENCE_HEIGHT = 1080;
export const LANDING_FIXED_STAGE_BREAKPOINT = 960;
export const LANDING_TABLET_BREAKPOINT = 1280;
export const LANDING_SHORT_HEIGHT_BREAKPOINT = 820;

export type LandingViewportStyle = CSSProperties & Record<`--${string}`, string>;
export type LandingViewportKind = "compact" | "tablet" | "desktop";
export type LandingHeightKind = "short" | "regular";

export type LandingViewportProfile = {
  viewportKind: LandingViewportKind;
  heightKind: LandingHeightKind;
  isCompact: boolean;
  isTabletOrSmaller: boolean;
  isShort: boolean;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getLandingViewportStyle(width: number, height: number): LandingViewportStyle {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 480);
  const compactViewport = safeWidth < LANDING_FIXED_STAGE_BREAKPOINT;
  const fitScale = Math.min(
    safeWidth / LANDING_REFERENCE_WIDTH,
    safeHeight / LANDING_REFERENCE_HEIGHT,
  );
  const scale = clampNumber(
    fitScale,
    compactViewport ? 0.56 : 0.42,
    compactViewport ? 1.05 : 1.4,
  );
  const sectionGutter = Math.round(
    compactViewport
      ? clampNumber(safeWidth * 0.052, 18, 36)
      : clampNumber(72 * scale, 20, 80),
  );
  const contentMaxWidth = Math.round(
    compactViewport
      ? clampNumber(safeWidth - (sectionGutter * 2), 320, 1080)
      : clampNumber(1720 * scale, 960, 1720),
  );
  const sectionMinHeight = Math.round(
    compactViewport
      ? clampNumber(safeHeight * 0.74, 560, 760)
      : clampNumber(safeHeight * 0.92, 760, 1080),
  );

  return {
    "--landing-scale": scale.toFixed(4),
    "--landing-section-gutter": `${sectionGutter}px`,
    "--landing-content-max-width": `${contentMaxWidth}px`,
    "--landing-stage-width": `${Math.round(safeWidth)}px`,
    "--landing-stage-height": `${Math.round(safeHeight)}px`,
    "--landing-section-min-height": `${sectionMinHeight}px`,
    "--landing-monitor-height": `${Math.round(safeHeight)}px`,
    "--landing-monitor-width": `${Math.round(safeWidth)}px`,
    "--landing-safe-width": `${Math.round(LANDING_REFERENCE_WIDTH * scale)}px`,
    "--landing-safe-height": `${Math.round(LANDING_REFERENCE_HEIGHT * scale)}px`,
  };
}

export function getLandingViewportProfile(width: number, height: number): LandingViewportProfile {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 480);

  const viewportKind = safeWidth < LANDING_FIXED_STAGE_BREAKPOINT
    ? "compact"
    : safeWidth < LANDING_TABLET_BREAKPOINT
      ? "tablet"
      : "desktop";
  const heightKind = safeHeight < LANDING_SHORT_HEIGHT_BREAKPOINT ? "short" : "regular";

  return {
    viewportKind,
    heightKind,
    isCompact: viewportKind === "compact",
    isTabletOrSmaller: viewportKind !== "desktop",
    isShort: heightKind === "short",
  };
}
