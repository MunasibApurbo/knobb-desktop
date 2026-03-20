import type { Track } from "@/types/music";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  loadAmLyricsComponent,
  loadLyricsForTrack,
  resolveLyricsArtistLabel,
  type SyncedLyricsPayload,
} from "@/lib/lyricsPanelData";

const LazyAmLyrics = lazy(loadAmLyricsComponent);

const LYRICS_FONT_FAMILY =
  "var(--font-sans, 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)";
const SHADOW_STYLE_ID = "knobb-am-lyrics-overrides";

type LyricsLineClickEvent = CustomEvent<{ timestamp: number }>;
type LyricsHostElement = HTMLElement & {
  shadowRoot: ShadowRoot | null;
  lyrics?: RenderableLyricsLine[];
  lyricsSource?: string | null;
  availableSources?: { lines: RenderableLyricsLine[]; source: string }[];
  currentSourceIndex?: number;
  isLoading?: boolean;
  hasFetchedAllProviders?: boolean;
  requestUpdate?: () => void;
  onLyricsLoaded?: () => Promise<void>;
};
type RenderableLyricsLine = {
  text: Array<{
    text: string;
    part: boolean;
    timestamp: number;
    endtime: number;
    lineSynced: boolean;
  }>;
  background: boolean;
  backgroundText: [];
  oppositeTurn: boolean;
  timestamp: number;
  endtime: number;
  isWordSynced: boolean;
};
interface LyricsPanelProps {
  currentTime: number;
  onSeek: (time: number) => void;
  track: Track;
  compact?: boolean;
  density?: "compact" | "default" | "immersive";
  variant?: "default" | "video-panel";
  hideEmptyState?: boolean;
  onAvailabilityChange?: (state: "loading" | "available" | "empty") => void;
}

function getLyricsTrackKey(track: Track) {
  return track.id;
}

function toRenderableLyrics(lyricsData: SyncedLyricsPayload | null): RenderableLyricsLine[] {
  if (!lyricsData?.lines.length) return [];

  return lyricsData.lines.map((line, index) => {
    const nextTime = index < lyricsData.lines.length - 1
      ? lyricsData.lines[index + 1].timeMs
      : line.timeMs + (lyricsData.isSynced ? 5000 : 4000);

    return {
      text: [
        {
          text: line.text,
          part: false,
          timestamp: line.timeMs,
          endtime: nextTime,
          lineSynced: lyricsData.isSynced,
        },
      ],
      background: false,
      backgroundText: [],
      oppositeTurn: false,
      timestamp: line.timeMs,
      endtime: nextTime,
      isWordSynced: false,
    };
  });
}

function getStaticLyricsViewportClassName(
  density: "compact" | "default" | "immersive",
  variant: "default" | "video-panel",
) {
  if (variant === "video-panel") {
    return "h-full overflow-y-auto px-2 pb-24 pt-[28%]";
  }

  if (density === "compact") {
    return "h-full overflow-y-auto px-3 pb-14 pt-[12%]";
  }

  if (density === "immersive") {
    return "h-full overflow-y-auto px-3 pb-16 pt-[18%]";
  }

  return "h-full overflow-y-auto px-10 pb-24 pt-[25%]";
}

function getStaticLyricsLineClassName(
  density: "compact" | "default" | "immersive",
  variant: "default" | "video-panel",
) {
  if (variant === "video-panel") {
    return "mb-4 text-[clamp(2.15rem,1.05vw+1.45rem,3.15rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-white/92";
  }

  if (density === "compact") {
    return "mb-2 text-2xl font-semibold leading-[1.12] tracking-[-0.04em] text-white/88";
  }

  if (density === "immersive") {
    return "mb-3 text-[clamp(3.1rem,2.6vw+1.8rem,4.85rem)] font-semibold leading-[1.08] tracking-[-0.05em] text-white/92";
  }

  return "mb-5 text-4xl font-semibold leading-[1.3] tracking-[-0.04em] text-white/88";
}

function injectLyricsShadowStyles(
  host: LyricsHostElement,
  density: "compact" | "default" | "immersive",
  hideEmptyState: boolean,
  variant: "default" | "video-panel",
) {
  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) return;
  const compact = density === "compact";
  const immersive = density === "immersive";
  const videoPanel = variant === "video-panel";

  let styleElement = shadowRoot.getElementById(SHADOW_STYLE_ID) as HTMLStyleElement | null;
  if (styleElement) {
    if (styleElement.dataset.density !== density || styleElement.dataset.variant !== variant) {
      styleElement.remove();
    } else {
      return;
    }
  }

  styleElement = document.createElement("style");
  styleElement.id = SHADOW_STYLE_ID;
  styleElement.dataset.density = density;
  styleElement.dataset.variant = variant;
  styleElement.textContent = `
    :host {
      display: block;
      height: 100%;
      width: 100%;
      color-scheme: dark;
      font-family: ${LYRICS_FONT_FAMILY};
      font-weight: 600;
      --am-lyrics-highlight-color: rgba(255, 255, 255, 0.98);
      --hover-background-color: ${videoPanel ? "transparent" : "hsl(var(--player-waveform) / 0.18)"};
      --lyplus-text-primary: rgba(255, 255, 255, 0.98);
      --lyplus-text-secondary: ${
        videoPanel
          ? "rgba(255, 255, 255, 0.18)"
          : immersive
            ? "rgba(255, 255, 255, 0.92)"
            : "rgba(255, 255, 255, 0.72)"
      };
      --lyplus-blur-amount: ${videoPanel ? "8px" : "7px"};
      --lyplus-blur-amount-near: ${videoPanel ? "3px" : "4px"};
      --lyplus-primary-opacity: 1;
      --lyplus-font-size-base: ${
        videoPanel
          ? "clamp(2.15rem, 1.05vw + 1.45rem, 3.15rem)"
          : compact
            ? "24px"
            : immersive
              ? "clamp(3.1rem, 2.6vw + 1.8rem, 4.85rem)"
              : "36px"
      };
      --lyplus-font-size-base-grow: ${videoPanel ? "8px" : compact ? "3px" : immersive ? "14px" : "10px"};
      --lyrics-scroll-padding-top: ${videoPanel ? "28%" : compact ? "12%" : immersive ? "18%" : "25%"};
    }

    .lyrics-container {
      background: transparent !important;
      padding: ${
        videoPanel
          ? "18px 8px 140px"
          : compact
            ? "0 12px 56px"
            : immersive
              ? "0 10px 72px"
              : "0 40px 100px"
      } !important;
    }

    .lyrics-container:has(.no-lyrics) {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    }

    .lyrics-header {
      display: none !important;
    }

    .header-controls,
    .download-controls,
    .footer-content,
    .source-info,
    .version-info {
      display: none !important;
    }

    .lyrics-line,
    .lyrics-syllable,
    .background-text,
    .lyrics-translation-container,
    .lyrics-romanization-container {
      letter-spacing: ${videoPanel ? "-0.05em" : immersive ? "-0.05em" : "-0.04em"};
      line-height: ${videoPanel ? "1.04" : compact ? "1.12" : immersive ? "1.08" : "1.3"} !important;
      margin-bottom: ${videoPanel ? "16px" : compact ? "8px" : immersive ? "10px" : "20px"} !important;
      transition: background-color 200ms ease, color 200ms ease, opacity 200ms ease, transform 200ms ease;
    }

    .lyrics-line {
      opacity: ${videoPanel ? "0.26" : immersive ? "1" : "0.8"} !important;
      color: ${
        videoPanel
          ? "rgba(255, 255, 255, 0.24)"
          : immersive
            ? "rgba(255, 255, 255, 0.92)"
            : "rgba(255, 255, 255, 0.72)"
      } !important;
      mix-blend-mode: ${videoPanel || immersive ? "normal" : "lighten"};
      padding: ${videoPanel ? "0.05em 0" : "inherit"};
      border-radius: ${videoPanel ? "0" : "inherit"};
    }

    .lyrics-line.active,
    .lyrics-line.pre-active {
      opacity: 1 !important;
      color: rgba(255, 255, 255, 0.98) !important;
      filter: none !important;
    }

    .lyrics-line.post-active-line,
    .lyrics-line.next-active-line,
    .lyrics-line.lyrics-activest {
      opacity: ${videoPanel ? "0.46" : immersive ? "1" : "0.8"} !important;
    }
    ${videoPanel ? `
    .lyrics-line .lyrics-line-container {
      transform: scale3d(0.96, 0.96, 1);
      transform-origin: left center;
    }

    .lyrics-line .main-vocal-container {
      text-shadow: 0 10px 24px rgba(0, 0, 0, 0.34);
    }

    .lyrics-line.active .lyrics-line-container,
    .lyrics-line.pre-active .lyrics-line-container {
      transform: scale3d(1, 1, 1);
    }

    .lyrics-line.active .main-vocal-container,
    .lyrics-line.pre-active .main-vocal-container {
      text-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
    }
    ` : ""}

    .lyrics-footer,
    .version-info {
      display: none !important;
    }

    .no-lyrics {
      display: ${hideEmptyState ? "none" : "block"} !important;
      width: min(100%, 12ch) !important;
      margin: 0 auto !important;
      font-family: ${LYRICS_FONT_FAMILY} !important;
      font-size: ${
        compact ? "1.5rem" : immersive ? "clamp(2.75rem, 2.4vw + 1.85rem, 4.4rem)" : "clamp(2rem, 3.5vw, 3.5rem)"
      } !important;
      letter-spacing: -0.03em !important;
      text-align: center !important;
      color: rgba(255, 255, 255, 0.46) !important;
    }
  `;
  shadowRoot.appendChild(styleElement);
}

function applyLyricsShadowStyles(
  host: LyricsHostElement,
  density: "compact" | "default" | "immersive",
  hideEmptyState: boolean,
  variant: "default" | "video-panel",
) {
  injectLyricsShadowStyles(host, density, hideEmptyState, variant);
}

export function LyricsPanel({
  currentTime,
  onSeek,
  track,
  compact = false,
  density,
  variant = "default",
  hideEmptyState = false,
  onAvailabilityChange,
}: LyricsPanelProps) {
  const lyricsRef = useRef<LyricsHostElement | null>(null);
  const trackStorageKey = getLyricsTrackKey(track);
  const [lyricsData, setLyricsData] = useState<SyncedLyricsPayload | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(true);
  const resolvedDensity = density ?? (compact ? "compact" : "default");
  const artistLabel = resolveLyricsArtistLabel(track);
  const albumLabel = track.album;
  const syncedTimeMs = Math.max(0, Math.round(currentTime * 1000));
  const useStaticLyrics = Boolean(lyricsData?.lines.length && !lyricsData.isSynced);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingLyrics(true);
    setLyricsData(null);

    void loadLyricsForTrack(track, artistLabel, albumLabel)
      .then((result) => {
        if (cancelled) return;
        setLyricsData(result);
      })
      .catch(() => {
        if (cancelled) return;
        setLyricsData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingLyrics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [albumLabel, artistLabel, track]);

  useEffect(() => {
    let frameId = 0;
    let attempts = 0;
    let observer: MutationObserver | null = null;
    const maxAttempts = 60;

    const applyShadowStyles = () => {
      const host = lyricsRef.current;
      if (!host) {
        if (attempts < maxAttempts) {
          attempts += 1;
          frameId = window.requestAnimationFrame(applyShadowStyles);
        }
        return;
      }

      if (host.shadowRoot) {
        applyLyricsShadowStyles(host, resolvedDensity, hideEmptyState, variant);
        observer = new MutationObserver(() => {
          const activeHost = lyricsRef.current;
          if (!activeHost) return;

          applyLyricsShadowStyles(activeHost, resolvedDensity, hideEmptyState, variant);
        });
        observer.observe(host.shadowRoot, { childList: true, subtree: true });
        return;
      }

      if (attempts < maxAttempts) {
        attempts += 1;
        frameId = window.requestAnimationFrame(applyShadowStyles);
      }
    };

    frameId = window.requestAnimationFrame(applyShadowStyles);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [hideEmptyState, trackStorageKey, resolvedDensity, variant]);

  useEffect(() => {
    if (useStaticLyrics) return;

    const host = lyricsRef.current;
    if (!host) return;

    const renderedLyrics = toRenderableLyrics(lyricsData);
    host.isLoading = isLoadingLyrics;
    host.currentSourceIndex = 0;
    host.hasFetchedAllProviders = true;

    if (renderedLyrics.length > 0) {
      host.lyrics = renderedLyrics;
      host.lyricsSource = lyricsData?.lyricsProvider || "LRCLIB";
      host.availableSources = [
        {
          lines: renderedLyrics,
          source: lyricsData?.lyricsProvider || "LRCLIB",
        },
      ];
    } else {
      host.lyrics = [];
      host.lyricsSource = null;
      host.availableSources = [];
    }

    host.requestUpdate?.();
    applyLyricsShadowStyles(host, resolvedDensity, hideEmptyState, variant);

    if (!isLoadingLyrics && renderedLyrics.length > 0) {
      void host.onLyricsLoaded?.();
    }
  }, [hideEmptyState, isLoadingLyrics, lyricsData, resolvedDensity, useStaticLyrics, variant]);

  useEffect(() => {
    if (!onAvailabilityChange) return;

    if (isLoadingLyrics) {
      onAvailabilityChange("loading");
      return;
    }

    onAvailabilityChange(lyricsData?.lines.length ? "available" : "empty");
  }, [isLoadingLyrics, lyricsData, onAvailabilityChange]);

  const handleLineClick = (event: Event) => {
    const { detail } = event as LyricsLineClickEvent;
    if (detail?.timestamp === undefined) return;

    onSeek(Math.max(0, detail.timestamp / 1000));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        {useStaticLyrics ? (
          <div
            className={getStaticLyricsViewportClassName(resolvedDensity, variant)}
            data-testid="static-lyrics-panel"
          >
            <div className="mx-auto max-w-[36rem]">
              <div className="mb-6 text-xs font-medium uppercase tracking-[0.28em] text-white/45">
                Unsynced lyrics
              </div>
              {lyricsData?.lines.map((line, index) => (
                <p
                  key={`${line.timeMs}:${line.text}:${index}`}
                  className={getStaticLyricsLineClassName(resolvedDensity, variant)}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading lyrics...
              </div>
            }
          >
            <LazyAmLyrics
              ref={(instance) => {
                lyricsRef.current = instance as unknown as LyricsHostElement | null;
              }}
              key={trackStorageKey}
              className="knobb-am-lyrics block h-full w-full"
              autoScroll
              currentTime={syncedTimeMs}
              duration={Math.round(track.duration * 1000)}
              fontFamily={LYRICS_FONT_FAMILY}
              highlightColor="#f6f6f6"
              hoverBackgroundColor="hsl(var(--player-waveform) / 0.18)"
              interpolate={false}
              onLineClick={handleLineClick}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
