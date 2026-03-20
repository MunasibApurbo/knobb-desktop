import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { formatDuration } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Music, ListMusic, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { TrackOptionsMenu } from "@/components/TrackOptionsMenu";
import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  getVideoFrameAspectRatio,
  getVideoFramePreference,
  VIDEO_PLAYBACK_PREFERENCES_CHANGED_EVENT,
  type VideoFramePreference,
} from "@/lib/videoPlaybackPreferences";
import { getAudioEngine } from "@/lib/audioEngine";
import { getYoutubeEmbedManager } from "@/lib/youtubeEmbedManager";
import { getTrackArtworkUrl } from "@/lib/trackArtwork";
import type { Track } from "@/types/music";

const LyricsPanel = lazy(async () => {
  const module = await import("@/components/LyricsPanel");
  return { default: module.LyricsPanel };
});

function isArtistId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function hasYoutubeEmbedSource(track: Pick<Track, "source" | "sourceId"> | null | undefined) {
  return track?.source === "youtube-music" && typeof track.sourceId === "string" && track.sourceId.trim().length > 0;
}

function RightPanelArtwork({
  isPlaying,
  playbackMode,
  track,
}: {
  isPlaying: boolean;
  playbackMode: "native" | "youtube-embed";
  track: Track;
}) {
  const { isFullScreen } = usePlayer();
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const [videoFramePreference, setVideoFramePreferenceState] = useState<VideoFramePreference>(() => getVideoFramePreference());
  const [videoElementAspectRatio, setVideoElementAspectRatio] = useState<number | null>(null);
  const [hasRenderedVideoFrame, setHasRenderedVideoFrame] = useState(false);
  const [hasMountedYoutubeEmbedFrame, setHasMountedYoutubeEmbedFrame] = useState(false);
  const aspectRatio = useMemo(() => videoElementAspectRatio || getVideoFrameAspectRatio(videoFramePreference), [videoElementAspectRatio, videoFramePreference]);
  const artworkUrl = getTrackArtworkUrl(track);
  const showsYoutubeEmbedSurface = playbackMode === "youtube-embed" && hasYoutubeEmbedSource(track);
  const showsVideoSurface = track.isVideo === true || showsYoutubeEmbedSurface;

  useEffect(() => {
    const syncPreferences = () => {
      setVideoFramePreferenceState(getVideoFramePreference());
    };

    syncPreferences();
    window.addEventListener(VIDEO_PLAYBACK_PREFERENCES_CHANGED_EVENT, syncPreferences);
    window.addEventListener("storage", syncPreferences);

    return () => {
      window.removeEventListener(VIDEO_PLAYBACK_PREFERENCES_CHANGED_EVENT, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  useEffect(() => {
    const host = videoHostRef.current;
    if (!host || !showsVideoSurface || isFullScreen) return;

    if (showsYoutubeEmbedSurface) {
      const embedManager = getYoutubeEmbedManager();
      embedManager.attachHost(host);

      return () => {
        if (embedManager.isAttachedToHost(host)) {
          embedManager.returnToGlobalHost();
        }
      };
    }

    const audioEngine = getAudioEngine();
    const mediaElement = audioEngine.getMediaElement();
    if (!(mediaElement instanceof HTMLVideoElement)) {
      return;
    }

    const syncAspectRatio = () => {
      const ratio = mediaElement.videoWidth > 0 && mediaElement.videoHeight > 0
        ? mediaElement.videoWidth / mediaElement.videoHeight
        : null;
      setVideoElementAspectRatio(ratio);
    };

    const maybeMarkVideoFrameReady = () => {
      if (mediaElement.videoWidth <= 0 || mediaElement.videoHeight <= 0 || mediaElement.readyState < 2) {
        return;
      }

      setHasRenderedVideoFrame(true);
    };

    let videoFrameCallbackId: number | null = null;
    const requestPaintedFrame = () => {
      if (typeof mediaElement.requestVideoFrameCallback !== "function") {
        maybeMarkVideoFrameReady();
        return;
      }

      if (videoFrameCallbackId !== null) {
        return;
      }

      videoFrameCallbackId = mediaElement.requestVideoFrameCallback(() => {
        videoFrameCallbackId = null;
        maybeMarkVideoFrameReady();
      });
    };

    mediaElement.className = "pointer-events-none h-full w-full bg-black object-contain";
    mediaElement.playsInline = true;
    mediaElement.controls = false;
    mediaElement.preload = "auto";
    mediaElement.poster = artworkUrl || "";
    mediaElement.removeAttribute("muted");
    mediaElement.muted = false;

    audioEngine.attachMediaElementToHost(host);

    mediaElement.addEventListener("loadedmetadata", syncAspectRatio);
    mediaElement.addEventListener("loadeddata", requestPaintedFrame);
    mediaElement.addEventListener("canplay", syncAspectRatio);
    mediaElement.addEventListener("canplay", requestPaintedFrame);
    mediaElement.addEventListener("playing", syncAspectRatio);
    mediaElement.addEventListener("playing", requestPaintedFrame);
    mediaElement.addEventListener("timeupdate", requestPaintedFrame);
    mediaElement.addEventListener("seeked", requestPaintedFrame);

    syncAspectRatio();
    requestPaintedFrame();

    return () => {
      mediaElement.removeEventListener("loadedmetadata", syncAspectRatio);
      mediaElement.removeEventListener("loadeddata", requestPaintedFrame);
      mediaElement.removeEventListener("canplay", syncAspectRatio);
      mediaElement.removeEventListener("canplay", requestPaintedFrame);
      mediaElement.removeEventListener("playing", syncAspectRatio);
      mediaElement.removeEventListener("playing", requestPaintedFrame);
      mediaElement.removeEventListener("timeupdate", requestPaintedFrame);
      mediaElement.removeEventListener("seeked", requestPaintedFrame);
      if (videoFrameCallbackId !== null && typeof mediaElement.cancelVideoFrameCallback === "function") {
        mediaElement.cancelVideoFrameCallback(videoFrameCallbackId);
      }
      if (audioEngine.isMediaElementAttachedToHost(host)) {
        audioEngine.returnMediaElementToGlobalHost();
      }
    };
  }, [artworkUrl, isFullScreen, showsVideoSurface, showsYoutubeEmbedSurface, track.id]);

  useEffect(() => {
    if (!showsVideoSurface || showsYoutubeEmbedSurface) {
      setVideoElementAspectRatio(null);
    }
  }, [showsVideoSurface, showsYoutubeEmbedSurface]);

  useEffect(() => {
    setHasRenderedVideoFrame(false);
  }, [playbackMode, track.id, track.isVideo, track.source, track.sourceId]);

  useEffect(() => {
    const host = videoHostRef.current;
    if (!host || !showsYoutubeEmbedSurface) {
      setHasMountedYoutubeEmbedFrame(false);
      return;
    }

    const syncMountedFrameState = () => {
      setHasMountedYoutubeEmbedFrame(Boolean(host.querySelector("iframe")));
    };

    syncMountedFrameState();

    const observer = new MutationObserver(syncMountedFrameState);
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [showsYoutubeEmbedSurface, track.id, track.source, track.sourceId]);

  return (
    <div
      className={`right-panel-artwork relative overflow-hidden shadow-2xl group ${showsVideoSurface ? "w-full bg-black/55" : "aspect-square"}`}
      style={showsVideoSurface ? { aspectRatio } : undefined}
    >
      {showsVideoSurface ? (
        <div className="relative h-full w-full bg-black">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt=""
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                showsYoutubeEmbedSurface
                  ? hasMountedYoutubeEmbedFrame ? "opacity-0" : "opacity-100"
                  : !hasRenderedVideoFrame ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null}
          <div ref={videoHostRef} className="pointer-events-none relative h-full w-full bg-black" />
        </div>
      ) : (
        <img
          src={artworkUrl}
          alt={track.title}
          className={`h-full w-full object-cover transition-transform ${isPlaying ? "scale-105" : "scale-100"}`}
          style={{ transitionDuration: "3000ms" }}
        />
      )}

      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.06) 2px, hsl(0 0% 0% / 0.06) 4px)",
        }}
      />
    </div>
  );
}

export function RightPanel() {
  const { currentTrack, playbackMode, toggleRightPanel, rightPanelTab, isPlaying, queue, play, reorderQueue, removeFromQueue, seek, toggleFullScreen } = usePlayer();
  const { currentTime } = usePlayerTimeline();
  const { rightPanelStyle, lyricsSyncMode } = useSettings();
  const { allowHeavyBlur, allowShellAmbientMotion } = useMotionPreferences();
  const tab = rightPanelTab;

  useEffect(() => {
    if (!currentTrack || tab !== "lyrics") return;

    let cancelled = false;

    void Promise.all([
      import("@/components/LyricsPanel"),
      import("@/lib/lyricsPanelData"),
    ])
      .then(([, module]) => {
        if (cancelled) return;
        module.preloadLyricsForTrack(currentTrack);
      })
      .catch(() => {
        // Ignore preload failures and let the visible panel retry on demand.
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack, tab]);

  if (!currentTrack) return null;

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;
  const artworkUrl = getTrackArtworkUrl(currentTrack);
  const showArtworkShell = rightPanelStyle === "artwork";

  return (
    <div className={`right-panel-shell h-full flex flex-col overflow-hidden chrome-bar relative isolate ${rightPanelStyle === "artwork" ? "right-panel-shell-artwork" : "right-panel-shell-classic"}`}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {showArtworkShell && allowHeavyBlur && artworkUrl ? (
          <div className="absolute inset-0">
            <div className="shell-artwork-wash right-panel-shell-artwork-wash">
              <img
                src={artworkUrl}
                alt=""
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: showArtworkShell
              ? `radial-gradient(circle at 16% 16%, hsl(var(--dynamic-accent) / 0.26), transparent 34%),
radial-gradient(circle at 86% 92%, hsl(var(--dynamic-accent) / 0.14), transparent 42%),
linear-gradient(180deg, hsl(0 0% 100% / 0.04), transparent 24%, hsl(0 0% 0% / 0.42) 56%, hsl(0 0% 0% / 0.9) 100%)`
              : "linear-gradient(180deg, hsl(0 0% 0%), hsl(0 0% 0%))",
            opacity: showArtworkShell ? (allowShellAmbientMotion ? 0.92 : 0.88) : 1,
          }}
        />
      </div>

      <div
        className="right-panel-content-zone relative z-10"
      >
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 xl:px-6 xl:pt-5">
          <div className="flex items-center gap-2">
            <Music className="right-panel-compact-icon h-5 w-5 text-muted-foreground" absoluteStrokeWidth />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close now playing panel"
            className="menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md text-white/68 transition-colors hover:text-white"
            onClick={toggleRightPanel}
          >
            <X className="h-5 w-5" absoluteStrokeWidth />
          </Button>
        </div>

        {/* Artwork & Track Info */}
        <div className="relative z-10 px-4 pb-4 xl:px-6">
          <TrackContextMenu track={currentTrack} tracks={queue}>
            <motion.button
              type="button"
              key={currentTrack.id}
              layoutId="right-panel-artwork"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="group cursor-pointer"
              aria-label={`Open full screen player for ${currentTrack.title}`}
              onClick={toggleFullScreen}
            >
              <RightPanelArtwork isPlaying={isPlaying} playbackMode={playbackMode} track={currentTrack} />
            </motion.button>
          </TrackContextMenu>
        </div>

        <div className="relative z-10 flex items-end gap-3 px-4 pb-3 xl:px-6">
          <div className="flex-1 min-w-0">
            <motion.h3 key={`t-${currentTrack.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-base font-bold text-foreground truncate">
              {currentTrack.title}
            </motion.h3>
            <motion.p
              key={`a-${currentTrack.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="text-sm text-muted-foreground"
            >
              {currentTrack.artists && currentTrack.artists.length > 0 ? (
                currentTrack.artists.map((a, i) => (
                  <span key={a.id}>
                    <ArtistLink
                      name={a.name}
                      artistId={isArtistId(a.id) ? a.id : undefined}
                      className="inline text-sm text-muted-foreground"
                    />
                    {i < currentTrack.artists!.length - 1 && <span className="text-muted-foreground">, </span>}
                  </span>
                ))
              ) : (
                <ArtistLink
                  name={currentTrack.artist}
                  artistId={currentTrack.artistId}
                  className="inline text-sm text-muted-foreground"
                />
              )}
            </motion.p>
          </div>
          <TrackOptionsMenu
            track={currentTrack}
            tracks={queue}
            buttonClassName="right-panel-menu-button menu-sweep-hover relative flex shrink-0 items-center justify-center h-9 w-9 overflow-hidden rounded-md p-0 text-white/68 shadow-none backdrop-blur-0 transition-colors hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      {/* Tab Content */}
      {tab === "lyrics" ? (
        <div className="relative z-10 flex-1 overflow-hidden px-3 pb-5 xl:px-4 xl:pb-6">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading lyrics...
              </div>
            }
          >
            <LyricsPanel
              currentTime={lyricsSyncMode === "follow" ? currentTime : 0}
              onSeek={seek}
              track={currentTrack}
              compact
            />
          </Suspense>
        </div>
      ) : (
        <ScrollArea className="relative z-10 flex-1 px-4 pb-5 xl:px-5 xl:pb-6">
          {/* Now Playing */}
          <div className="px-2 pt-3 pb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
          </div>
          <div className="right-panel-row flex items-center gap-3 px-2 py-2.5 bg-accent/20">
            <img 
              src={currentTrack.coverUrl} 
              alt="" 
              className="w-11 h-11 object-cover" 
              loading="eager"
              decoding="async"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: `hsl(var(--dynamic-accent))` }}>{currentTrack.title}</p>
              <p className="text-sm text-muted-foreground truncate"><ArtistLink name={currentTrack.artist} artistId={currentTrack.artistId} className="text-sm" /></p>
            </div>
            <span className="text-sm text-muted-foreground font-mono">{formatDuration(currentTrack.duration)}</span>
          </div>

          {/* Up Next */}
          {upNext.length > 0 && (
            <>
              <div className="px-2 pt-4 pb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Next Up</span>
              </div>
              {upNext.map((track, i) => {
                const queueIdx = currentIdx + 1 + i;
                return (
                  <TrackContextMenu key={`${track.id}-${i}`} track={track} tracks={queue}>
                    <div
                      className="right-panel-row menu-sweep-hover flex items-center gap-2 w-full px-2 py-2.5 hover:bg-accent/15 transition-colors text-left group"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("queue-idx", String(queueIdx))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData("queue-idx"));
                        if (!isNaN(from) && from !== queueIdx) reorderQueue(from, queueIdx);
                      }}
                    >
                      <GripVertical className="w-[18px] h-[18px] text-muted-foreground opacity-0 group-hover:opacity-60 cursor-grab shrink-0" />
                      <img 
                        src={track.coverUrl} 
                        alt="" 
                        className="w-11 h-11 object-cover shrink-0 cursor-pointer" 
                        onClick={() => play(track, queue)} 
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => play(track, queue)}>
                        <p className="text-sm truncate text-foreground">{track.title}</p>
                        <p className="text-sm text-muted-foreground truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-sm" /></p>
                      </div>
                      <AddToPlaylistMenu track={track}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Add ${track.title} to a playlist`}
                          className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground"
                        >
                          <ListMusic className="h-5 w-5" />
                        </Button>
                      </AddToPlaylistMenu>
                      <Button
                        variant="ghost" size="icon"
                        aria-label={`Remove ${track.title} from queue`}
                        className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromQueue(queueIdx)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                    </div>
                  </TrackContextMenu>
                );
              })}
            </>
          )}
          {upNext.length === 0 && (
            <div className="text-center py-8">
              <ListMusic className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Queue is empty</p>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
