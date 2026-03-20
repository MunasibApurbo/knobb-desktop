import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Mic2,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import type { CSSProperties } from "react";

import { ArtistsLink } from "@/components/ArtistsLink";
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
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { Button } from "@/components/ui/button";
import { VolumeBar } from "@/components/VolumeBar";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { formatAudioQualityLabel, getPlayableAudioQualityForTrack } from "@/lib/audioQuality";
import { getTrackSource } from "@/lib/librarySources";
import {
  getControlHover,
  getControlTap,
  getMotionProfile,
} from "@/lib/motion";
import { getTrackArtworkUrl } from "@/lib/trackArtwork";

const MotionButton = motion(Button);
const LazyPlayerSettings = lazy(async () => {
  const module = await import("@/components/PlayerSettings");
  return { default: module.PlayerSettings };
});
const LazyConnectDeviceDialog = lazy(async () => {
  const module = await import("@/components/ConnectDeviceDialog");
  return { default: module.ConnectDeviceDialog };
});

function UtilityControlFallback() {
  return <div className="h-9 w-9 shrink-0 bg-transparent" aria-hidden="true" />;
}

export type BottomPlayerShellWidthMode = "full" | "half" | "quarter";

type BottomPlayerProps = {
  shellWidthMode?: BottomPlayerShellWidthMode;
};

export function BottomPlayer(_props: BottomPlayerProps = {}) {
  const { shellWidthMode = "full" } = _props;
  const {
    currentTrack,
    quality,
    resolvedAudioQuality,
    isPlaying,
    playbackSpeed,
    shuffle,
    repeat,
    volume,
    togglePlay,
    next,
    previous,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    seek,
    openRightPanel,
    toggleFullScreen,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const { currentTime, duration: timelineDuration, pendingSeekTime } = usePlayerTimeline();
  const { bottomPlayerStyle, playerButtonsLayout, titleLineMode, explicitBadgeVisibility } = useSettings();
  const { motionEnabled, allowHeavyBlur, allowShellAmbientMotion, preferLightweightMotion, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const playerMotionEnabled = motionEnabled && !preferLightweightMotion;
  const isBlackBottomPlayer = bottomPlayerStyle === "black";
  const compactShell = shellWidthMode === "half" || shellWidthMode === "quarter";
  const utilityControlClassName =
    "player-chrome-utility relative h-9 w-9 overflow-hidden rounded-md text-white/68 transition-colors hover:bg-white/10 hover:text-white";
  const likeControlClassName = titleLineMode === "double"
    ? "player-chrome-utility relative h-10 w-10 overflow-hidden rounded-lg text-white/68 transition-colors hover:bg-white/10 hover:text-white"
    : utilityControlClassName;
  const likeIconClassName = titleLineMode === "double" ? "h-[22px] w-[22px]" : "h-5 w-5";

  if (!currentTrack) return null;

  const artworkUrl = getTrackArtworkUrl(currentTrack);
  const trackDuration = currentTrack.duration;
  const resolvedDuration = timelineDuration || trackDuration;
  const resolvedCurrentTime = pendingSeekTime ?? currentTime;
  const playerProgressPercent = `${Math.min(Math.max((resolvedCurrentTime / Math.max(resolvedDuration, 1)) * 100, 0), 100)}%`;
  const displayedAudioQuality = resolvedAudioQuality || getPlayableAudioQualityForTrack(
    quality,
    getTrackSource(currentTrack),
    currentTrack.audioQuality || null,
    currentTrack.isVideo === true,
  );
  const playerControlHover = getControlHover(motionEnabled, websiteMode);
  const playerControlTap = getControlTap(motionEnabled, websiteMode);
  const playerControlTransition = motionEnabled
    ? { duration: motionProfile.duration.instant, ease: motionProfile.ease.swift }
    : { duration: 0 };
  const playerGridClassName = "bottom-player-grid grid items-center gap-4 px-4 pt-2 min-[1380px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]";
  const nowPlayingClassName = "bottom-player-now-playing flex min-w-0 max-w-full items-center gap-2.5 justify-self-start min-[1380px]:max-w-[430px]";
  const transportClassName = "bottom-player-transport flex items-center justify-center gap-[18px] justify-self-center";
  const utilityClassName = "bottom-player-utility flex min-w-0 items-center justify-between gap-4 min-[1380px]:w-[248px] min-[1380px]:justify-self-end min-[1380px]:justify-end min-[1500px]:w-[280px]";

  const transportControls = (
    <div className={transportClassName}>
      {!compactShell ? (
        <motion.button
          type="button"
          data-allow-global-shortcuts="true"
          aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
          className={`${bottomPlayerTransportControlClassName} inline-flex items-center justify-center ${shuffle ? bottomPlayerActiveTransportControlClassName : ""}`}
          onClick={toggleShuffle}
          whileHover={playerControlHover}
          whileTap={playerControlTap}
          transition={playerControlTransition}
        >
          <Shuffle className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
        </motion.button>
      ) : null}
      <motion.button
        type="button"
        data-allow-global-shortcuts="true"
        aria-label="Previous track"
        className={`${bottomPlayerTransportControlClassName} inline-flex items-center justify-center`}
        onClick={previous}
        whileHover={playerControlHover}
        whileTap={playerControlTap}
        transition={playerControlTransition}
      >
        <SkipBack className={bottomPlayerSkipIconClassName} absoluteStrokeWidth />
      </motion.button>
      <motion.button
        type="button"
        data-allow-global-shortcuts="true"
        aria-label={isPlaying ? "Pause playback" : "Resume playback"}
        className={`${bottomPlayerPrimaryTransportControlClassName} inline-flex items-center justify-center`}
        style={{
          backgroundColor: "hsl(0 0% 100%)",
          color: "hsl(0 0% 8%)",
        }}
        onClick={togglePlay}
        whileHover={playerControlHover}
        whileTap={playerControlTap}
        transition={playerControlTransition}
      >
        {isPlaying ? (
          <Pause className={bottomPlayerPauseIconClassName} absoluteStrokeWidth />
        ) : (
          <Play className={bottomPlayerPlayIconClassName} absoluteStrokeWidth />
        )}
      </motion.button>
      <motion.button
        type="button"
        data-allow-global-shortcuts="true"
        aria-label="Next track"
        className={`${bottomPlayerTransportControlClassName} inline-flex items-center justify-center`}
        onClick={next}
        whileHover={playerControlHover}
        whileTap={playerControlTap}
        transition={playerControlTransition}
      >
        <SkipForward className={bottomPlayerSkipIconClassName} absoluteStrokeWidth />
      </motion.button>
      {!compactShell ? (
        <motion.button
          type="button"
          data-allow-global-shortcuts="true"
          aria-label={
            repeat === "off"
              ? "Enable repeat all"
              : repeat === "all"
                ? "Enable repeat one"
                : "Disable repeat"
          }
          className={`${bottomPlayerTransportControlClassName} inline-flex items-center justify-center ${repeat !== "off" ? bottomPlayerActiveTransportControlClassName : ""}`}
          onClick={toggleRepeat}
          whileHover={playerControlHover}
          whileTap={playerControlTap}
          transition={playerControlTransition}
        >
          {repeat === "one" ? (
            <Repeat1 className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
          ) : (
            <Repeat className={bottomPlayerTransportIconClassName} absoluteStrokeWidth />
          )}
        </motion.button>
      ) : null}
    </div>
  );

  const utilityControls = (
    <div className={utilityClassName}>
      <div className="bottom-player-utility-actions flex items-center gap-2.5">
        {!compactShell ? (
          <Suspense fallback={<UtilityControlFallback />}>
            <LazyPlayerSettings />
          </Suspense>
        ) : null}
        <MotionButton
          allowGlobalShortcuts
          variant="ghost"
          size="icon"
          aria-label="Open queue"
          title="Open queue"
          className={utilityControlClassName}
          onClick={() => openRightPanel("queue")}
          whileHover={getControlHover(motionEnabled, websiteMode)}
          whileTap={getControlTap(motionEnabled, websiteMode)}
          transition={motionProfile.spring.control}
        >
          <ListMusic className="h-5 w-5" absoluteStrokeWidth />
        </MotionButton>
        <MotionButton
          allowGlobalShortcuts
          variant="ghost"
          size="icon"
          aria-label="Open lyrics"
          title="Open lyrics"
          className={utilityControlClassName}
          onClick={() => openRightPanel("lyrics")}
          whileHover={getControlHover(motionEnabled, websiteMode)}
          whileTap={getControlTap(motionEnabled, websiteMode)}
          transition={motionProfile.spring.control}
        >
          <Mic2 className="h-5 w-5" absoluteStrokeWidth />
        </MotionButton>
        {!compactShell ? (
          <Suspense fallback={<UtilityControlFallback />}>
            <LazyConnectDeviceDialog />
          </Suspense>
        ) : null}
      </div>
      <div className="bottom-player-volume flex items-center gap-1.5 -ml-0.5">
        <MotionButton
          allowGlobalShortcuts
          variant="ghost"
          size="icon"
          aria-label={volume === 0 ? "Unmute" : "Mute"}
          title={volume === 0 ? "Unmute" : "Mute"}
          className={utilityControlClassName}
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
          whileHover={getControlHover(motionEnabled, websiteMode)}
          whileTap={getControlTap(motionEnabled, websiteMode)}
          transition={motionProfile.spring.control}
        >
          {volume === 0 ? (
            <VolumeX className="h-5 w-5" absoluteStrokeWidth />
          ) : volume < 0.5 ? (
            <Volume1 className="h-5 w-5" absoluteStrokeWidth />
          ) : (
            <Volume2 className="h-5 w-5" absoluteStrokeWidth />
          )}
        </MotionButton>
        <VolumeBar ariaLabel="Playback volume" volume={volume} onChange={setVolume} className="w-32" />
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={motionProfile.spring.shell}
        className={`bottom-player-shell bottom-player-shell-${bottomPlayerStyle} bottom-player-shell-buttons-${playerButtonsLayout} relative z-20 isolate h-auto min-h-0 shrink-0 overflow-hidden chrome-bar border-t border-white/10 shadow-[0_-18px_54px_rgba(0,0,0,0.52)] flex flex-col`}
        style={{ "--player-progress": playerProgressPercent } as CSSProperties}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`player-ambient-${currentTrack.id}`}
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            initial={motionEnabled ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={motionEnabled ? { opacity: 0 } : undefined}
            transition={{
              duration: motionEnabled ? motionProfile.duration.base : 0,
              ease: motionProfile.ease.smooth,
            }}
          >
            {allowHeavyBlur ? (
              <div className="shell-artwork-wash" aria-hidden="true">
                <img
                  src={artworkUrl}
                  alt=""
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : null}
            <div
              className="absolute inset-0"
              style={{
                background: isBlackBottomPlayer
                  ? "linear-gradient(180deg, hsl(0 0% 3%), hsl(0 0% 0%))"
                  : `radial-gradient(circle at 14% 18%, hsl(var(--dynamic-accent) / 0.28), transparent 34%),
radial-gradient(circle at 82% 120%, hsl(var(--dynamic-accent) / 0.18), transparent 42%),
linear-gradient(90deg, hsl(0 0% 100% / 0.04), transparent 18%, transparent 82%, hsl(0 0% 100% / 0.03)),
linear-gradient(180deg, hsl(0 0% 100% / 0.08), hsl(0 0% 3% / 0.22) 18%, hsl(0 0% 0% / 0.82) 100%)`,
                opacity: isBlackBottomPlayer ? 1 : allowShellAmbientMotion ? 0.92 : 0.84,
              }}
            />
          </motion.div>
        </AnimatePresence>

        <div
          aria-hidden="true"
          className="bottom-player-progress-bar pointer-events-none absolute inset-y-0 left-0 z-[1]"
          style={{
            width: "var(--player-progress)",
            background:
              "linear-gradient(90deg, hsl(var(--player-waveform) / 0.18), hsl(var(--dynamic-accent) / 0.16))",
          }}
        />

        <div
          className="bottom-player-body relative z-10 flex flex-col"
          data-testid="bottom-player-body"
        >
          <div className={playerGridClassName}>
            <div className={nowPlayingClassName}>
              <TrackContextMenu
                track={currentTrack}
                contentClassName={`bottom-player-context-menu rounded-[28px] border-white/12 bg-[hsl(0_0%_12%/0.9)] shadow-[0_24px_72px_rgba(0,0,0,0.42)] ${allowHeavyBlur ? "backdrop-blur-[24px]" : ""}`}
                itemClassName="rounded-[18px]"
                separatorClassName="bg-white/12"
              >
                <div
                  className="group/bottom-player-context flex min-w-0 max-w-full items-center gap-2.5 rounded-[24px]"
                  data-testid="bottom-player-context-trigger"
                >
                  <AnimatePresence mode="wait">
                    <motion.button
                      layoutId="player-artwork"
                      type="button"
                      aria-label="Open fullscreen player"
                      className={`bottom-player-artwork bottom-player-artwork-container border border-white/10 overflow-hidden shadow-[0_16px_30px_rgba(0,0,0,0.38)] cursor-pointer hover:brightness-110 transition shrink-0 ${
                        currentTrack.isVideo
                          ? "bottom-player-artwork-video h-12 w-20 rounded-full"
                          : "bottom-player-artwork-square h-14 w-14 rounded-full"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFullScreen();
                      }}
                    >
                      <img
                        src={artworkUrl}
                        alt={currentTrack.title}
                        className="h-full w-full object-cover"
                      />
                    </motion.button>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`meta-${currentTrack.id}`}
                      className="bottom-player-meta min-w-0 max-w-full min-[1380px]:max-w-[330px] min-[1500px]:max-w-[350px]"
                      initial={playerMotionEnabled ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={playerMotionEnabled ? { opacity: 0, y: -6 } : undefined}
                      transition={{
                        duration: playerMotionEnabled ? motionProfile.duration.fast : 0,
                        ease: motionProfile.ease.smooth,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`${titleLineMode === "double" ? "line-clamp-2" : "truncate"} text-sm font-semibold text-foreground leading-[1.1]`}>
                          {currentTrack.title}
                        </p>
                        {currentTrack.explicit && explicitBadgeVisibility === "show" ? (
                          <span className="flex-shrink-0 px-1 py-0.5 text-[10px] font-bold bg-muted-foreground/20 text-muted-foreground rounded-[2px] leading-none uppercase">
                            E
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <div className="min-w-0 flex-1">
                          <ArtistsLink
                            artists={currentTrack.artists}
                            name={currentTrack.artist}
                            artistId={currentTrack.artistId}
                            className="block min-w-0 truncate text-sm leading-[1.15]"
                          />
                        </div>
                        {displayedAudioQuality && !compactShell ? (
                          <motion.span
                            className="player-quality-badge shrink-0 self-center"
                            initial={playerMotionEnabled ? { opacity: 0, scale: 0.92 } : false}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={motionProfile.spring.control}
                            style={{
                              color: displayedAudioQuality === "MAX" ? "hsl(var(--dynamic-accent))" : "hsl(var(--player-waveform))",
                              borderColor:
                                displayedAudioQuality === "MAX"
                                  ? "hsl(var(--dynamic-accent) / 0.2)"
                                  : "hsl(var(--player-waveform) / 0.2)",
                              backgroundColor:
                                displayedAudioQuality === "MAX"
                                  ? "hsl(var(--dynamic-accent) / 0.1)"
                                  : "hsl(var(--player-waveform) / 0.1)",
                            }}
                          >
                            {formatAudioQualityLabel(displayedAudioQuality)}
                          </motion.span>
                        ) : null}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </TrackContextMenu>

              <MotionButton
                variant="ghost"
                size="icon"
                aria-label="Like track"
                className={`${likeControlClassName} shrink-0 self-center`}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleLike(currentTrack);
                }}
                whileHover={getControlHover(motionEnabled, websiteMode)}
                whileTap={getControlTap(motionEnabled, websiteMode)}
                transition={motionProfile.spring.control}
              >
                <Heart className={`${likeIconClassName} transition-colors ${isLiked(currentTrack.id) ? "fill-current text-white" : "text-white/68 hover:text-white"}`} absoluteStrokeWidth />
              </MotionButton>
            </div>

            {transportControls}
            {utilityControls}
          </div>

          <PlayerSeekRow
            className="bottom-player-seek-row"
            fallbackDuration={trackDuration}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            currentTrackId={currentTrack.id}
            motionEnabled={motionEnabled}
            motionProfile={motionProfile}
            onSeek={seek}
            variant="visualizer"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
