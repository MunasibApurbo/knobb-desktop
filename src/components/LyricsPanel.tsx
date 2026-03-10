import type { Track } from "@/types/music";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

const LazyAmLyrics = lazy(async () => {
  await import("@uimaxbai/am-lyrics/am-lyrics.js");
  const module = await import("@uimaxbai/am-lyrics/react");
  return { default: module.AmLyrics };
});

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
type SyncedLyricsPayload = {
  subtitles: string;
  lyricsProvider: string;
};

interface LyricsPanelProps {
  currentTime: number;
  onSeek: (time: number) => void;
  track: Track;
}

function getLyricsTrackKey(track: Track) {
  return track.id;
}

async function fetchLyrics(track: Track, artistLabel: string, albumLabel: string) {
  const title = track.title?.trim();
  const artist = artistLabel.trim();
  const album = albumLabel.trim();
  const duration = track.duration ? Math.round(track.duration) : null;

  if (!title || !artist) {
    return null;
  }

  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });

  if (album) params.append("album_name", album);
  if (duration) params.append("duration", String(duration));

  const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { syncedLyrics?: unknown };
  if (typeof data.syncedLyrics !== "string" || !data.syncedLyrics.trim()) {
    return null;
  }

  return {
    subtitles: data.syncedLyrics,
    lyricsProvider: "LRCLIB",
  } satisfies SyncedLyricsPayload;
}

function parseSyncedLyrics(subtitles: string) {
  return subtitles
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(\d+):(\d+)\.(\d+)\]\s*(.+)/);
      if (!match) return null;

      const [, minutes, seconds, centiseconds, text] = match;
      const timeMs =
        Number.parseInt(minutes, 10) * 60_000 +
        Number.parseInt(seconds, 10) * 1000 +
        Number.parseInt(centiseconds.padEnd(3, "0").slice(0, 3), 10);
      const trimmedText = text.trim();
      if (!trimmedText) return null;

      return {
        timeMs,
        text: trimmedText,
      };
    })
    .filter((line): line is { timeMs: number; text: string } => Boolean(line));
}

function toRenderableLyrics(lyricsData: SyncedLyricsPayload | null): RenderableLyricsLine[] {
  if (!lyricsData?.subtitles) return [];

  const parsed = parseSyncedLyrics(lyricsData.subtitles);
  return parsed.map((line, index) => {
    const nextTime = index < parsed.length - 1 ? parsed[index + 1].timeMs : line.timeMs + 5000;

    return {
      text: [
        {
          text: line.text,
          part: false,
          timestamp: line.timeMs,
          endtime: nextTime,
          lineSynced: true,
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

function injectLyricsShadowStyles(host: LyricsHostElement) {
  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) return;

  let styleElement = shadowRoot.getElementById(SHADOW_STYLE_ID) as HTMLStyleElement | null;
  if (styleElement) return;

  styleElement = document.createElement("style");
  styleElement.id = SHADOW_STYLE_ID;
  styleElement.textContent = `
    :host {
      display: block;
      height: 100%;
      width: 100%;
      color-scheme: dark;
      font-family: ${LYRICS_FONT_FAMILY};
      font-weight: 600;
      --am-lyrics-highlight-color: rgba(255, 255, 255, 0.98);
      --hover-background-color: hsl(var(--player-waveform) / 0.18);
      --lyplus-font-size-base: 24px;
      --lyplus-font-size-base-grow: 18px;
      --lyrics-scroll-padding-top: 18%;
    }

    .lyrics-container {
      background: transparent !important;
      padding: 28px 12px 38px !important;
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
      letter-spacing: -0.03em;
      transition: background-color 200ms ease, color 200ms ease, opacity 200ms ease, transform 200ms ease;
    }

    .lyrics-footer,
    .version-info {
      display: none !important;
    }

    .no-lyrics {
      font-family: ${LYRICS_FONT_FAMILY} !important;
      font-size: clamp(1.5rem, 2.2vw, 2.25rem) !important;
      letter-spacing: -0.03em !important;
      color: rgba(255, 255, 255, 0.46) !important;
    }
  `;
  shadowRoot.appendChild(styleElement);
}

function stripLyricsShadowChrome(host: LyricsHostElement) {
  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) return;

  shadowRoot
    .querySelectorAll(".lyrics-header, .lyrics-footer, .source-info, .version-info")
    .forEach((element) => element.remove());
}

function applyLyricsShadowCleanup(host: LyricsHostElement) {
  injectLyricsShadowStyles(host);
  stripLyricsShadowChrome(host);
}

export function LyricsPanel({
  currentTime,
  onSeek,
  track,
}: LyricsPanelProps) {
  const lyricsRef = useRef<LyricsHostElement | null>(null);
  const trackStorageKey = getLyricsTrackKey(track);
  const [lyricsData, setLyricsData] = useState<SyncedLyricsPayload | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(true);
  const artistLabel = useMemo(() => {
    if (track.artists && track.artists.length > 0) {
      return track.artists.map((artist) => artist.name).join(", ");
    }

    return track.artist;
  }, [track.artist, track.artists]);
  const albumLabel = track.album;
  const isrc = "isrc" in track && typeof track.isrc === "string" ? track.isrc : "";
  const syncedTimeMs = Math.max(0, Math.round(currentTime * 1000));

  useEffect(() => {
    let cancelled = false;

    setIsLoadingLyrics(true);
    setLyricsData(null);

    void fetchLyrics(track, artistLabel, albumLabel)
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
        applyLyricsShadowCleanup(host);
        observer = new MutationObserver(() => {
          const activeHost = lyricsRef.current;
          if (!activeHost) return;

          applyLyricsShadowCleanup(activeHost);
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
  }, [trackStorageKey]);

  useEffect(() => {
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
    applyLyricsShadowCleanup(host);

    if (!isLoadingLyrics && renderedLyrics.length > 0) {
      void host.onLyricsLoaded?.();
    }
  }, [isLoadingLyrics, lyricsData]);

  const handleLineClick = (event: Event) => {
    const { detail } = event as LyricsLineClickEvent;
    if (detail?.timestamp === undefined) return;

    onSeek(Math.max(0, detail.timestamp / 1000));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
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
            interpolate
            onLineClick={handleLineClick}
            query={`${track.title} ${artistLabel}`.trim()}
            songAlbum={albumLabel}
            songArtist={artistLabel}
            songDurationMs={Math.round(track.duration * 1000)}
            songTitle={track.title}
            isrc={isrc}
          />
        </Suspense>
      </div>
    </div>
  );
}
