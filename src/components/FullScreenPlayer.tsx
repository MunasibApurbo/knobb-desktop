import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTrackArtworkUrl } from "@/lib/trackArtwork";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { useSettings } from "@/contexts/SettingsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { PlayerSeekRow } from "@/components/player/PlayerSeekRow";
import {
  bottomPlayerActiveTransportControlClassName,
  bottomPlayerPauseIconClassName,
  bottomPlayerPlayIconClassName,
  bottomPlayerPrimaryTransportControlClassName,
  bottomPlayerSkipIconClassName,
  bottomPlayerTransportControlClassName,
  bottomPlayerTransportIconClassName,
} from "@/components/player/transportControlStyles";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getMotionProfile } from "@/lib/motion";
import { ArtistsLink } from "@/components/ArtistsLink";
import {
  buildTrackSharePath,
  buildTrackShareUrl,
  copyPlainTextToClipboard,
  navigateToTrackAlbum,
} from "@/lib/mediaNavigation";
import { useNavigate } from "react-router-dom";
import { getYoutubeEmbedManager } from "@/lib/youtubeEmbedManager";
import type { Track } from "@/types/music";
import { toast } from "sonner";

const LyricsPanel = lazy(() => import("@/components/LyricsPanel").then(m => ({ default: m.LyricsPanel })));
const closeControlTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };
const fullscreenContainerTransition = { 
  duration: 0.48, 
  ease: [0.22, 1, 0.36, 1] as const,
  opacity: { duration: 0.32 }
};
const fullscreenContainerExitTransition = { 
  duration: 0.36, 
  ease: [0.32, 0, 0.67, 0] as const,
  opacity: { duration: 0.22 }
};
type LyricsAvailability = "loading" | "available" | "empty";

type FullScreenPlayerProps = {
  onExitComplete?: () => void;
};

function hasYoutubeEmbedSource(track: Pick<Track, "source" | "sourceId"> | null | undefined) {
  return track?.source === "youtube-music" && typeof track.sourceId === "string" && track.sourceId.trim().length > 0;
}

export function FullScreenPlayer({ onExitComplete }: FullScreenPlayerProps) {
  const navigate = useNavigate();
  const {
    currentTrack,
    playbackMode,
    isPlaying,
    togglePlay,
    next,
    previous,
    seek,
    isFullScreen,
    toggleFullScreen,
    setFullScreen,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
    playbackSpeed,
  } = usePlayer();
  const { currentTime, duration } = usePlayerTimeline();
  const {
    lyricsSyncMode,
    showFullScreenLyrics,
    fullScreenBackgroundBlur,
    fullScreenBackgroundDarkness,
  } = useSettings();
  const { isLiked, toggleLike } = useLikedSongs();
  const { allowHeavyBlur, motionEnabled, preferLightweightMotion, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const immersiveMotionEnabled = motionEnabled && !preferLightweightMotion;
  const videoHostRef = useRef<HTMLDivElement>(null);
  const [hasMountedYoutubeEmbedFrame, setHasMountedYoutubeEmbedFrame] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showArtworkControls, setShowArtworkControls] = useState(false);
  const [lyricsAvailability, setLyricsAvailability] = useState<LyricsAvailability>("loading");
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeFullScreen = () => setFullScreen(false);

  useEffect(() => {
    const host = videoHostRef.current;
    const shouldAttachYoutubeEmbed = playbackMode === "youtube-embed" && hasYoutubeEmbedSource(currentTrack);
    if (!host || (!shouldAttachYoutubeEmbed && currentTrack?.isVideo !== true)) return;

    if (shouldAttachYoutubeEmbed) {
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
    if (!(mediaElement instanceof HTMLVideoElement)) return;
    
    mediaElement.className = "pointer-events-none h-full w-full object-contain";
    audioEngine.attachMediaElementToHost(host);

    return () => {
      if (audioEngine.isMediaElementAttachedToHost(host)) {
        audioEngine.returnMediaElementToGlobalHost();
      }
    };
  }, [currentTrack, currentTrack?.id, currentTrack?.isVideo, currentTrack?.source, currentTrack?.sourceId, playbackMode]);

  useEffect(() => {
    const host = videoHostRef.current;
    const shouldShowYoutubeEmbedSurface = playbackMode === "youtube-embed" && hasYoutubeEmbedSource(currentTrack);
    if (!host || !shouldShowYoutubeEmbedSurface) {
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
  }, [currentTrack, currentTrack?.id, currentTrack?.source, currentTrack?.sourceId, playbackMode]);

  useEffect(() => {
    if (!isFullScreen) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      return;
    }

    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (!isFullScreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFullScreen(false);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isFullScreen, setFullScreen]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    setLyricsAvailability("loading");
  }, [currentTrack?.id, showFullScreenLyrics]);

  if (!currentTrack) return null;

  const artworkUrl = getTrackArtworkUrl(currentTrack);
  const normalizedBackgroundBlur = Math.min(Math.max(fullScreenBackgroundBlur, 0), 100);
  const normalizedBackgroundDarkness = Math.min(Math.max(fullScreenBackgroundDarkness, 0), 100);
  const fullscreenBackdropBlurPx = allowHeavyBlur
    ? (32 * normalizedBackgroundBlur) / 100
    : (18 * normalizedBackgroundBlur) / 100;
  const fullscreenBackdropOverlayOpacity = Math.min(Math.max(normalizedBackgroundDarkness / 100, 0), 1);
  const fullscreenShellStyle = {
    backgroundColor: `rgba(0, 0, 0, ${fullscreenBackdropOverlayOpacity})`,
    backdropFilter: `blur(${fullscreenBackdropBlurPx}px)`,
    WebkitBackdropFilter: `blur(${fullscreenBackdropBlurPx}px)`,
  };
  const trackSharePath = buildTrackSharePath(currentTrack);
  const canOpenTrackView = Boolean(currentTrack.album || currentTrack.albumId || trackSharePath);
  const showLyricsColumn = showFullScreenLyrics && lyricsAvailability !== "empty";
  const isNativeVideoTrack = currentTrack.isVideo === true;
  const showsYoutubeEmbedSurface = playbackMode === "youtube-embed" && hasYoutubeEmbedSource(currentTrack);
  const showsVideoSurface = isNativeVideoTrack || showsYoutubeEmbedSurface;
  const useAudioLyricsSplitLayout = showLyricsColumn && !showsVideoSurface;
  const mediaColumnClassName = useAudioLyricsSplitLayout
    ? "w-full min-w-0 items-end justify-center px-0 pr-[clamp(1.5rem,4vw,4.5rem)]"
    : showLyricsColumn
    ? showsVideoSurface
      ? "w-[66vw] px-[4vw]"
      : "w-[52vw] pl-[5vw] pr-[3vw]"
    : showsVideoSurface
      ? "w-full max-w-[min(84vw,1280px)] px-0"
      : "w-full max-w-[min(52vw,62vh)] px-0";
  const mediaStackClassName = showsVideoSurface
    ? "w-full max-w-[1280px] gap-10"
    : useAudioLyricsSplitLayout
      ? "w-full max-w-[min(32rem,calc(50vw-7rem))] gap-6"
      : showLyricsColumn
        ? "w-full max-w-[min(45vw,55vh)] gap-10"
        : "w-full max-w-[min(52vw,62vh)] gap-10";
  const lyricsColumnClassName = showsVideoSurface
    ? "w-[min(27vw,31rem)] h-[min(78vh,56rem)] pr-[3.75vw] items-stretch justify-center"
    : useAudioLyricsSplitLayout
      ? "w-full min-w-0 h-[min(72vh,44rem)] items-start justify-center pl-[clamp(1.5rem,4vw,4.5rem)]"
      : "w-[min(28vw,35rem)] h-[min(64vh,40rem)] pr-[4.5vw] items-start justify-center";
  const lyricsContentClassName = showsVideoSurface
    ? "h-full w-full"
    : useAudioLyricsSplitLayout
      ? "h-full w-full max-w-[min(30rem,calc(50vw-7rem))]"
      : "h-full w-full max-h-[min(64vh,40rem)]";
  const lyricsViewportClassName = "h-full overflow-hidden";
  const lyricsViewportMask =
    "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.12) 8%, rgba(0, 0, 0, 0.55) 16%, black 24%, black 76%, rgba(0, 0, 0, 0.55) 84%, rgba(0, 0, 0, 0.12) 92%, transparent 100%)";
  const lyricsViewportStyle = {
    WebkitMaskImage: lyricsViewportMask,
    maskImage: lyricsViewportMask,
  };
  const utilityControlClassName =
    "player-chrome-utility fullscreen-player-utility relative h-9 w-9 overflow-hidden rounded-md text-white/68 transition-colors hover:bg-white/10 hover:text-white";
  const likeIconClassName = "h-5 w-5";
  const trackShareUrl = buildTrackShareUrl(currentTrack);
  const handleTrackTitleClick = async () => {
    const openedAlbum = currentTrack.album || currentTrack.albumId
      ? await navigateToTrackAlbum(currentTrack, navigate)
      : false;

    if (!openedAlbum && trackSharePath) {
      navigate(trackSharePath);
    }
  };

  const handleShareTrack = async () => {
    if (!trackShareUrl) return;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `${currentTrack.title} · ${currentTrack.artist}`,
          url: trackShareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyPlainTextToClipboard(trackShareUrl);
    toast.success("Song link copied");
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isFullScreen && (
        <motion.div
          initial={{ opacity: 0, y: immersiveMotionEnabled ? 74 : 0, scale: immersiveMotionEnabled ? 0.985 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: immersiveMotionEnabled ? 42 : 0, scale: immersiveMotionEnabled ? 0.992 : 1 }}
          transition={immersiveMotionEnabled ? fullscreenContainerTransition : { duration: 0.22 }}
          className={`fixed inset-0 z-[100] flex flex-col overflow-hidden text-white transition-opacity will-change-[transform,opacity] ${!showControls ? "cursor-none" : "cursor-default"}`}
          style={fullscreenShellStyle}
          data-testid="fullscreen-player-shell"
        >
          <>
              <motion.div
                initial={immersiveMotionEnabled ? { opacity: 0, y: -24, scale: 0.92 } : false}
                animate={{
                  opacity: showControls ? 1 : 0,
                  y: immersiveMotionEnabled ? (showControls ? 0 : -14) : 0,
                  scale: immersiveMotionEnabled ? (showControls ? 1 : 0.96) : 1,
                }}
                exit={immersiveMotionEnabled ? { opacity: 0, y: -24, scale: 0.92 } : undefined}
                transition={immersiveMotionEnabled ? closeControlTransition : { duration: 0.16 }}
                className="absolute top-0 right-0 p-8 lg:p-12 z-50 pointer-events-none"
              >
                <motion.div
                  initial={false}
                  animate={{
                    rotate: immersiveMotionEnabled ? (showControls ? 0 : -10) : 0,
                    scale: immersiveMotionEnabled ? (showControls ? 1 : 0.96) : 1,
                  }}
                  exit={immersiveMotionEnabled ? { rotate: -10, scale: 0.96 } : undefined}
                  transition={immersiveMotionEnabled ? closeControlTransition : { duration: 0.16 }}
                  className="pointer-events-auto"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close full screen"
                    title="Close full screen (Esc)"
                    className="h-12 w-12 rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={closeFullScreen}
                  >
                    <X className="h-7 w-7" strokeWidth={1} />
                  </Button>
                </motion.div>
              </motion.div>

              {/* Center-Anchored Layout */}
              <div
                className={`relative flex-1 overflow-hidden min-h-0 ${
                  useAudioLyricsSplitLayout
                    ? "grid place-items-center px-[clamp(1.5rem,3vw,3rem)]"
                    : "flex items-center justify-center"
                }`}
              >
                {!useAudioLyricsSplitLayout ? (
                  <div className="absolute inset-y-0 left-1/2 w-0 border-r border-transparent pointer-events-none" />
                ) : null}
                {useAudioLyricsSplitLayout ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-[clamp(2rem,7vh,5rem)] left-1/2 hidden w-px -translate-x-1/2 bg-white/8 lg:block"
                  />
                ) : null}
                <div
                  data-testid="fullscreen-layout-shell"
                  className={useAudioLyricsSplitLayout
                    ? "grid h-full w-full max-w-[min(96vw,140rem)] grid-cols-2 items-center gap-0"
                    : "contents"}
                >
                  <motion.div
                    data-testid="fullscreen-media-column"
                    initial={immersiveMotionEnabled ? { opacity: 0, y: 18 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={immersiveMotionEnabled ? { delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] } : undefined}
                    className={`flex flex-col transition-[transform,opacity,flex-basis,width] duration-300 ease-out min-h-0 z-10 ${mediaColumnClassName}`}
                  >
                    <div className={`flex flex-col transition-[transform,opacity,width,max-width] duration-300 ease-out ${mediaStackClassName}`}>
                      {/* 1. Red Area: Artwork / Video */}
                      <motion.div
                        onMouseEnter={() => setShowArtworkControls(true)}
                        onMouseLeave={() => setShowArtworkControls(false)}
                        layoutId={showsYoutubeEmbedSurface || !immersiveMotionEnabled ? undefined : "player-artwork"}
                        transition={showsYoutubeEmbedSurface ? undefined : {
                          type: "spring",
                          damping: 32,
                          stiffness: 280,
                          mass: 0.6,
                          restDelta: 0.001,
                        }}
                        className={`group relative w-full overflow-hidden rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] ${
                          showsYoutubeEmbedSurface ? "bg-black" : "bg-black/40 will-change-transform backface-hidden"
                        } ${
                          showsVideoSurface ? "aspect-video" : "aspect-square"
                        }`}
                        style={showsYoutubeEmbedSurface ? { transform: "none" } : undefined}
                      >
                        {showsYoutubeEmbedSurface && artworkUrl ? (
                          <img
                            src={artworkUrl}
                            alt=""
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                              hasMountedYoutubeEmbedFrame ? "opacity-0" : "opacity-100"
                            }`}
                          />
                        ) : null}
                        <div 
                          ref={videoHostRef} 
                          className={`${showsYoutubeEmbedSurface ? "" : "pointer-events-none "}h-full w-full bg-black ${showsVideoSurface ? "" : "hidden"}`} 
                          aria-hidden={!showsVideoSurface}
                        />
                        {!showsVideoSurface && (
                          <img src={artworkUrl} alt={currentTrack.title} className="h-full w-full object-cover" />
                        )}

                        <motion.div
                          initial={false}
                          animate={{ opacity: showArtworkControls ? 1 : 0 }}
                          transition={{ duration: immersiveMotionEnabled ? 0.24 : 0.12, ease: "easeOut" }}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.72)_18%,rgba(0,0,0,0.46)_34%,rgba(0,0,0,0.24)_50%,rgba(0,0,0,0.1)_62%,rgba(0,0,0,0.03)_72%,rgba(0,0,0,0)_82%)]"
                          style={{ boxShadow: allowHeavyBlur ? "inset 0 -48px 120px rgba(0, 0, 0, 0.5)" : "inset 0 -24px 64px rgba(0, 0, 0, 0.42)" }}
                        />

                        <motion.div 
                          initial={immersiveMotionEnabled ? { opacity: 0, y: 24 } : false}
                          animate={{ 
                            opacity: showArtworkControls ? 1 : (immersiveMotionEnabled ? 0 : 0), 
                            y: showArtworkControls ? 0 : (immersiveMotionEnabled ? 12 : 20) 
                          }}
                          transition={{ 
                            duration: immersiveMotionEnabled ? 0.32 : 0.12, 
                            ease: "easeOut",
                            delay: immersiveMotionEnabled && showArtworkControls ? 0 : 0.15 
                          }}
                          className="absolute bottom-0 inset-x-0 p-10 flex items-center justify-center gap-8 bg-gradient-to-t from-black/22 via-black/8 to-transparent pointer-events-none"
                        >
                          <button
                            type="button"
                            onClick={toggleShuffle}
                            aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
                            className={`${bottomPlayerTransportControlClassName} fullscreen-player-control pointer-events-auto inline-flex items-center justify-center ${shuffle ? bottomPlayerActiveTransportControlClassName : ""}`}
                          >
                            <Shuffle className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
                          </button>
                          <button
                            type="button"
                            onClick={previous}
                            aria-label="Previous track"
                            className={`${bottomPlayerTransportControlClassName} fullscreen-player-control pointer-events-auto inline-flex items-center justify-center`}
                          >
                            <SkipBack className={bottomPlayerSkipIconClassName} absoluteStrokeWidth />
                          </button>
                          <button
                            type="button"
                            onClick={togglePlay}
                            aria-label={isPlaying ? "Pause playback" : "Resume playback"}
                            className={`${bottomPlayerPrimaryTransportControlClassName} pointer-events-auto inline-flex items-center justify-center`}
                          >
                            {isPlaying ? (
                              <Pause className={bottomPlayerPauseIconClassName} absoluteStrokeWidth />
                            ) : (
                              <Play className={bottomPlayerPlayIconClassName} absoluteStrokeWidth />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={next}
                            aria-label="Next track"
                            className={`${bottomPlayerTransportControlClassName} fullscreen-player-control pointer-events-auto inline-flex items-center justify-center`}
                          >
                            <SkipForward className={bottomPlayerSkipIconClassName} absoluteStrokeWidth />
                          </button>
                          <button
                            type="button"
                            onClick={toggleRepeat}
                            aria-label={
                              repeat === "off"
                                ? "Enable repeat all"
                                : repeat === "all"
                                  ? "Enable repeat one"
                                  : "Disable repeat"
                            }
                            className={`${bottomPlayerTransportControlClassName} fullscreen-player-control pointer-events-auto inline-flex items-center justify-center ${repeat !== "off" ? bottomPlayerActiveTransportControlClassName : ""}`}
                          >
                            {repeat === "one" ? (
                              <Repeat1 className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
                            ) : (
                              <Repeat className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
                            )}
                          </button>
                        </motion.div>

                        {/* Overlay Seekbar (Blue Area) */}
                        <motion.div
                          initial={false}
                          animate={{ opacity: showArtworkControls ? 1 : 0, y: showArtworkControls ? 0 : 10 }}
                          transition={{ duration: immersiveMotionEnabled ? 0.22 : 0.12 }}
                          className="absolute bottom-28 inset-x-0 px-10 pointer-events-none"
                        >
                          <PlayerSeekRow
                            className="!px-0 !pb-0 pointer-events-auto"
                            currentTrackId={currentTrack.id}
                            fallbackDuration={duration}
                            isPlaying={isPlaying}
                            motionEnabled={motionEnabled}
                            motionProfile={motionProfile}
                            onSeek={seek}
                            playbackSpeed={playbackSpeed}
                          />
                        </motion.div>
                      </motion.div>

                      {/* 2. Green Area: Metadata */}
                      <motion.div 
                        initial={immersiveMotionEnabled ? { opacity: 0, y: 12 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={immersiveMotionEnabled ? { delay: 0.22, duration: 0.44, ease: [0.22, 1, 0.36, 1] } : undefined}
                        className={`w-full text-left ${useAudioLyricsSplitLayout ? "space-y-2 pl-0" : "space-y-1 pl-1"}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="min-w-0 flex-1">
                            {canOpenTrackView ? (
                              <button
                                type="button"
                                onClick={() => void handleTrackTitleClick()}
                                className="min-w-0 text-left text-[1.65rem] font-black leading-[0.96] tracking-tight text-white/92 drop-shadow-2xl transition-colors hover:text-white hover:underline hover:decoration-white/55 hover:underline-offset-4 lg:text-[2.35rem]"
                              >
                                <span className="line-clamp-2">{currentTrack.title}</span>
                              </button>
                            ) : (
                              <h1 className="min-w-0 text-[1.65rem] font-black tracking-tight lg:text-[2.35rem] line-clamp-2 drop-shadow-2xl leading-[0.96] text-white/92">
                                {currentTrack.title}
                              </h1>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleLike(currentTrack)}
                            aria-label={isLiked(currentTrack.id) ? "Remove from liked songs" : "Add to liked songs"}
                            className={`${utilityControlClassName} mt-1 shrink-0`}
                          >
                            <Heart
                              className={`${likeIconClassName} transition-colors ${isLiked(currentTrack.id) ? "fill-current text-white" : "text-white/68 hover:text-white"}`}
                              absoluteStrokeWidth
                            />
                          </Button>
                        </div>
                        <div className="line-clamp-1 text-sm font-bold tracking-tight text-white/50 lg:text-[0.98rem]">
                          <ArtistsLink
                            artists={currentTrack.artists?.map((artist) => ({
                              id: artist.id,
                              name: artist.name,
                              source: currentTrack.source ?? "tidal",
                            }))}
                            name={currentTrack.artist}
                            artistId={currentTrack.artistId}
                            source={currentTrack.source ?? "tidal"}
                            truncate={false}
                            onClick={() => {
                              if (isFullScreen) {
                                toggleFullScreen();
                              }
                            }}
                            className="text-white/50 transition-colors [&>span>span:hover]:text-white/78"
                          />
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Right Column: Lyrics (Pink Area) */}
                  {showFullScreenLyrics && showLyricsColumn ? (
                    <motion.div
                      data-testid="fullscreen-lyrics-column"
                      initial={immersiveMotionEnabled ? { opacity: 0, x: 24 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={immersiveMotionEnabled ? { delay: 0.16, duration: 0.52, ease: [0.22, 1, 0.36, 1] } : undefined}
                      className={`flex flex-col transition-[transform,opacity,flex-basis,width] duration-300 ease-out z-10 ${lyricsColumnClassName}`}
                    >
                      <motion.div
                        initial={immersiveMotionEnabled ? { opacity: 0, x: 40 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={immersiveMotionEnabled ? { opacity: 0, x: 40 } : undefined}
                        transition={{ delay: immersiveMotionEnabled ? 0.06 : 0, duration: immersiveMotionEnabled ? 0.36 : 0.16 }}
                        className={`flex h-full flex-col transition-[transform,opacity,width,max-width] duration-300 ease-out ${lyricsContentClassName}`}
                      >
                        <div data-testid="fullscreen-lyrics-viewport" className={lyricsViewportClassName} style={lyricsViewportStyle}>
                          <div className="h-full overflow-hidden">
                            <Suspense fallback={<div className="text-2xl font-bold opacity-20">Loading lyrics...</div>}>
                              <LyricsPanel
                                track={currentTrack}
                                currentTime={lyricsSyncMode === "follow" ? currentTime : 0}
                                onSeek={seek}
                                density={showsVideoSurface ? "compact" : "immersive"}
                                hideEmptyState
                                onAvailabilityChange={setLyricsAvailability}
                              />
                            </Suspense>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </div>
              </div>
          </>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
