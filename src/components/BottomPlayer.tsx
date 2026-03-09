import {
  Heart,
  ListMusic,
  Loader2,
  Mic2,
  Pause,
  Play,
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

import { ArtistsLink } from "@/components/ArtistsLink";
import { Button } from "@/components/ui/button";
import { VolumeBar } from "@/components/VolumeBar";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSmoothedPlaybackTime } from "@/hooks/useSmoothedPlaybackTime";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { formatAudioQualityLabel } from "@/lib/audioQuality";
import {
  getControlHover,
  getControlTap,
  getMotionProfile,
} from "@/lib/motion";
import { formatDuration } from "@/lib/utils";

type BottomPlayerProps = {
  onOpenFullScreen?: () => void;
};

const MotionButton = motion(Button);
const LazyPlayerSettings = lazy(async () => {
  const module = await import("@/components/PlayerSettings");
  return { default: module.PlayerSettings };
});
const LazyConnectDeviceDialog = lazy(async () => {
  const module = await import("@/components/ConnectDeviceDialog");
  return { default: module.ConnectDeviceDialog };
});
const LazyVisualizerSelector = lazy(async () => {
  const module = await import("@/components/visualizers/VisualizerSelector");
  return { default: module.VisualizerSelector };
});

function UtilityControlFallback() {
  return <div className="h-9 w-9 shrink-0 bg-transparent" aria-hidden="true" />;
}

type BottomPlayerProgressRowProps = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  currentTrackId: string;
  motionEnabled: boolean;
  motionProfile: ReturnType<typeof getMotionProfile>;
  onSeek: (time: number) => void;
};

function BottomPlayerProgressRow({
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  currentTrackId,
  motionEnabled,
  motionProfile,
  onSeek,
}: BottomPlayerProgressRowProps) {
  const smoothedCurrentTime = useSmoothedPlaybackTime({
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
  });

  return (
    <div className="flex-1 flex items-center gap-3 px-4 pb-2">
      <motion.span
        className="w-10 text-right font-mono text-xs font-semibold tabular-nums"
        style={{ color: `hsl(var(--dynamic-accent))` }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: motionEnabled ? motionProfile.duration.fast : 0 }}
      >
        {formatDuration(Math.floor(smoothedCurrentTime))}
      </motion.span>
      <motion.div
        key={`visualizer-${currentTrackId}`}
        className="relative h-10 flex-1 cursor-pointer overflow-hidden rounded-[2px]"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const pct = (event.clientX - rect.left) / rect.width;
          onSeek(pct * duration);
        }}
        initial={motionEnabled ? { opacity: 0.76, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: motionEnabled ? motionProfile.duration.base : 0,
          ease: motionProfile.ease.smooth,
        }}
      >
        <Suspense fallback={null}>
          <LazyVisualizerSelector className="h-full" currentTime={smoothedCurrentTime} />
        </Suspense>
      </motion.div>
      <span className="w-10 font-mono text-xs tabular-nums text-white/62">
        {formatDuration(Math.floor(duration))}
      </span>
    </div>
  );
}

export function BottomPlayer({ onOpenFullScreen }: BottomPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    shuffle,
    repeat,
    volume,
    isLoading,
    togglePlay,
    next,
    previous,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    seek,
    openRightPanel,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const { bottomPlayerStyle, playerButtonsLayout, titleLineMode, explicitBadgeVisibility } = useSettings();
  const { motionEnabled, allowShellAmbientMotion, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const isBlackBottomPlayer = bottomPlayerStyle === "black";
  const transportControlClassName =
    "bottom-player-control h-10 w-10 rounded-none bg-white/[0.035] text-white/84 transition-[background-color,color,transform] duration-100 hover:bg-white/[0.09] hover:text-white";
  const utilityControlClassName =
    "player-chrome-utility h-9 w-9 bg-white/[0.035] text-white/68 hover:bg-white/[0.085] hover:text-white";

  if (!currentTrack) return null;

  const trackDuration = duration || currentTrack.duration;
  const playerControlHover = getControlHover(motionEnabled, websiteMode);
  const playerControlTap = getControlTap(motionEnabled, websiteMode);
  const playerControlTransition = motionEnabled
    ? { duration: motionProfile.duration.instant, ease: motionProfile.ease.swift }
    : { duration: 0 };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        layout
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={motionProfile.spring.shell}
        className={`bottom-player-shell bottom-player-shell-${bottomPlayerStyle} bottom-player-shell-buttons-${playerButtonsLayout} relative h-[124px] shrink-0 overflow-hidden chrome-bar border-t border-white/10 shadow-[0_-18px_54px_rgba(0,0,0,0.52)] flex flex-col`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`player-ambient-${currentTrack.id}`}
            className="absolute inset-0"
            initial={motionEnabled ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={motionEnabled ? { opacity: 0 } : undefined}
            transition={{
              duration: motionEnabled ? motionProfile.duration.base : 0,
              ease: motionProfile.ease.smooth,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: isBlackBottomPlayer
                  ? "linear-gradient(180deg, hsl(0 0% 3%), hsl(0 0% 0%))"
                  : `radial-gradient(circle at 14% 18%, hsl(${currentTrack.canvasColor} / 0.28), transparent 34%),
radial-gradient(circle at 82% 120%, hsl(${currentTrack.canvasColor} / 0.18), transparent 42%),
linear-gradient(90deg, hsl(0 0% 100% / 0.04), transparent 18%, transparent 82%, hsl(0 0% 100% / 0.03)),
linear-gradient(180deg, hsl(0 0% 100% / 0.08), hsl(0 0% 3% / 0.22) 18%, hsl(0 0% 0% / 0.82) 100%)`,
                opacity: isBlackBottomPlayer ? 1 : allowShellAmbientMotion ? 0.92 : 0.84,
              }}
            />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 flex h-full flex-col">
          <div className="grid items-center gap-4 px-4 pt-2 min-[1380px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="flex min-w-0 max-w-full items-center gap-2.5 justify-self-start min-[1380px]:max-w-[430px]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentTrack.id}
                  initial={motionEnabled ? { scale: 0.84, opacity: 0, rotate: -3 } : false}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={motionEnabled ? { scale: 0.88, opacity: 0, rotate: 2 } : undefined}
                  transition={motionProfile.spring.card}
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="bottom-player-artwork w-14 h-14 border border-white/10 object-cover shadow-[0_16px_30px_rgba(0,0,0,0.38)] cursor-pointer hover:brightness-110 transition"
                  onClick={onOpenFullScreen}
                />
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`meta-${currentTrack.id}`}
                  className="min-w-0 max-w-full min-[1380px]:max-w-[330px] min-[1500px]:max-w-[350px]"
                  initial={motionEnabled ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionEnabled ? { opacity: 0, y: -6 } : undefined}
                  transition={{
                    duration: motionEnabled ? motionProfile.duration.base : 0,
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
                    {currentTrack.audioQuality &&
                    (currentTrack.audioQuality === "LOSSLESS" || currentTrack.audioQuality === "MAX") ? (
                      <motion.span
                        className="player-quality-badge shrink-0 self-center"
                        initial={motionEnabled ? { opacity: 0, scale: 0.85 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={motionProfile.spring.control}
                        style={{
                          color: currentTrack.audioQuality === "MAX" ? "hsl(var(--dynamic-accent))" : "hsl(var(--player-waveform))",
                          borderColor:
                            currentTrack.audioQuality === "MAX"
                              ? "hsl(var(--dynamic-accent) / 0.2)"
                              : "hsl(var(--player-waveform) / 0.2)",
                          backgroundColor:
                            currentTrack.audioQuality === "MAX"
                              ? "hsl(var(--dynamic-accent) / 0.1)"
                              : "hsl(var(--player-waveform) / 0.1)",
                        }}
                      >
                        {formatAudioQualityLabel(currentTrack.audioQuality)}
                      </motion.span>
                    ) : null}
                  </div>
                </motion.div>
              </AnimatePresence>

              <MotionButton
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 self-center bg-white/[0.035] text-white/68 hover:bg-white/[0.085] hover:text-white"
                onClick={() => toggleLike(currentTrack)}
                whileHover={getControlHover(motionEnabled, websiteMode)}
                whileTap={getControlTap(motionEnabled, websiteMode)}
                transition={motionProfile.spring.control}
              >
                <Heart className={`h-5 w-5 transition-colors ${isLiked(currentTrack.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-white/68 hover:text-white"}`} />
              </MotionButton>
            </div>

            <div className="flex items-center justify-center gap-[18px] justify-self-center">
              <MotionButton
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={`${transportControlClassName} ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                onClick={toggleShuffle}
                whileHover={playerControlHover}
                whileTap={playerControlTap}
                transition={playerControlTransition}
              >
                <Shuffle className="h-5 w-5" />
              </MotionButton>
              <MotionButton
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={transportControlClassName}
                onClick={previous}
                whileHover={playerControlHover}
                whileTap={playerControlTap}
                transition={playerControlTransition}
              >
                <SkipBack className="h-[22px] w-[22px] fill-current" />
              </MotionButton>
              <MotionButton
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className="bottom-player-control bottom-player-primary-control h-14 w-14 rounded-none border border-white/16 shadow-[0_12px_24px_rgba(0,0,0,0.32)] transition-[transform,background-color,color] duration-100"
                style={{
                  backgroundColor: "hsl(0 0% 100%)",
                  color: "hsl(0 0% 8%)",
                }}
                onClick={togglePlay}
                disabled={isLoading && !isPlaying}
                whileHover={playerControlHover}
                whileTap={playerControlTap}
                transition={playerControlTransition}
              >
                {isLoading && !isPlaying ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="ml-0.5 h-6 w-6" />
                )}
              </MotionButton>
              <MotionButton
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={transportControlClassName}
                onClick={next}
                whileHover={playerControlHover}
                whileTap={playerControlTap}
                transition={playerControlTransition}
              >
                <SkipForward className="h-[22px] w-[22px] fill-current" />
              </MotionButton>
              <MotionButton
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={`${transportControlClassName} ${repeat !== "off" ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                onClick={toggleRepeat}
                whileHover={playerControlHover}
                whileTap={playerControlTap}
                transition={playerControlTransition}
              >
                {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </MotionButton>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-4 min-[1380px]:w-[248px] min-[1380px]:justify-self-end min-[1380px]:justify-end min-[1500px]:w-[280px]">
              <div className="flex items-center gap-2.5">
                <Suspense fallback={<UtilityControlFallback />}>
                  <LazyPlayerSettings />
                </Suspense>
                <MotionButton
                  allowGlobalShortcuts
                  variant="ghost"
                  size="icon"
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
                  className={utilityControlClassName}
                  onClick={() => openRightPanel("lyrics")}
                  whileHover={getControlHover(motionEnabled, websiteMode)}
                  whileTap={getControlTap(motionEnabled, websiteMode)}
                  transition={motionProfile.spring.control}
                >
                  <Mic2 className="h-5 w-5" absoluteStrokeWidth />
                </MotionButton>
                <Suspense fallback={<UtilityControlFallback />}>
                  <LazyConnectDeviceDialog />
                </Suspense>
              </div>
              <div className="flex items-center gap-1.5 -ml-0.5">
                <MotionButton
                  allowGlobalShortcuts
                  variant="ghost"
                  size="icon"
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
                <VolumeBar volume={volume} onChange={setVolume} className="w-32" />
              </div>
            </div>
          </div>

          <BottomPlayerProgressRow
            currentTime={currentTime}
            duration={trackDuration}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            currentTrackId={currentTrack.id}
            motionEnabled={motionEnabled}
            motionProfile={motionProfile}
            onSeek={seek}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
