import { lazy, Suspense } from "react";
import { motion } from "framer-motion";

import { SeekSurface } from "@/components/player/SeekSurface";
import { usePlayerTimeline } from "@/contexts/PlayerContext";
import { useSmoothedPlaybackTime } from "@/hooks/useSmoothedPlaybackTime";
import { getMotionProfile } from "@/lib/motion";
import { formatDuration } from "@/lib/utils";

const LazyVisualizerSelector = lazy(async () => {
  const module = await import("@/components/visualizers/VisualizerSelector");
  return { default: module.VisualizerSelector };
});

type PlayerSeekRowProps = {
  className?: string;
  currentTrackId: string;
  fallbackDuration: number;
  isPlaying: boolean;
  motionEnabled: boolean;
  motionProfile: ReturnType<typeof getMotionProfile>;
  onSeek: (time: number) => void;
  playbackSpeed: number;
  variant?: "desktop" | "mobile";
};

export function PlayerSeekRow({
  className,
  currentTrackId,
  fallbackDuration,
  isPlaying,
  motionEnabled,
  motionProfile,
  onSeek,
  playbackSpeed,
  variant = "desktop",
}: PlayerSeekRowProps) {
  const { currentTime, duration: timelineDuration } = usePlayerTimeline();
  const duration = timelineDuration || fallbackDuration;
  const smoothedCurrentTime = useSmoothedPlaybackTime({
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
  });
  const isMobile = variant === "mobile";

  return (
    <div className={`${isMobile ? "flex w-full max-w-sm items-center gap-3" : "flex flex-1 items-center gap-3 px-4 pb-2"} ${className ?? ""}`}>
      <motion.span
        className={`${isMobile ? "w-10 text-[11px] text-white/80" : "w-10 text-xs font-semibold"} text-right font-mono tabular-nums`}
        style={isMobile ? undefined : { color: "hsl(var(--dynamic-accent))" }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: motionEnabled ? motionProfile.duration.fast : 0 }}
      >
        {formatDuration(Math.floor(smoothedCurrentTime))}
      </motion.span>
      <motion.div
        key={`visualizer-${currentTrackId}-${variant}`}
        className={`relative flex-1 ${isMobile ? "h-10" : "h-10"}`}
        initial={motionEnabled ? { opacity: 0.76, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: motionEnabled ? motionProfile.duration.base : 0,
          ease: motionProfile.ease.smooth,
        }}
      >
        <SeekSurface
          ariaLabel="Seek playback position"
          className={`relative h-full cursor-pointer overflow-hidden rounded-[2px] focus-visible:outline-none focus-visible:ring-2 ${isMobile
            ? "focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            : "focus-visible:ring-[hsl(var(--dynamic-accent)/0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
            }`}
          currentTime={smoothedCurrentTime}
          duration={duration}
          onSeek={onSeek}
        >
          <Suspense
            fallback={(
              <div className="flex h-full items-center justify-center rounded-full bg-white/10">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-[hsl(var(--dynamic-accent))] transition-all duration-100 ease-linear"
                    style={{ width: `${(smoothedCurrentTime / Math.max(duration, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          >
            <LazyVisualizerSelector
              className="h-full"
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              trackId={currentTrackId}
            />
          </Suspense>
        </SeekSurface>
      </motion.div>
      <span className={`${isMobile ? "w-10 text-[11px] text-white/50" : "w-10 text-xs text-white/62"} font-mono tabular-nums`}>
        {formatDuration(Math.floor(duration))}
      </span>
    </div>
  );
}
