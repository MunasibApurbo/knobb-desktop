import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";

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
  style?: CSSProperties;
  variant?: "visualizer" | "capsule";
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
  style,
  variant = "visualizer",
}: PlayerSeekRowProps) {
  const { currentTime, duration: timelineDuration, pendingSeekTime } = usePlayerTimeline();
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const duration = timelineDuration || fallbackDuration;
  const smoothedCurrentTime = useSmoothedPlaybackTime({
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
  });
  const displayedCurrentTime = previewTime ?? pendingSeekTime ?? smoothedCurrentTime;

  useEffect(() => {
    setPreviewTime(null);
  }, [currentTrackId]);

  const handleSeekPreview = useCallback((time: number) => {
    setPreviewTime(time);
  }, []);

  const handleSeekCommit = useCallback((time: number) => {
    setPreviewTime(null);
    onSeek(time);
  }, [onSeek]);

  const handleSeekCancel = useCallback(() => {
    setPreviewTime(null);
  }, []);

  const progressWidth = `${(displayedCurrentTime / Math.max(duration, 1)) * 100}%`;
  const useCapsuleVariant = variant === "capsule";

  return (
    <div
      className={`flex shrink-0 items-center gap-3 px-4 pb-2 ${useCapsuleVariant ? "bottom-player-seek-row-capsule" : ""} ${className ?? ""}`}
      style={style}
    >
      {useCapsuleVariant ? null : (
        <motion.span
          className="player-seek-time player-seek-time-current w-10 text-right font-mono text-xs font-semibold tabular-nums"
          style={{ color: "hsl(var(--player-waveform))" }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionEnabled ? motionProfile.duration.fast : 0 }}
        >
          {formatDuration(Math.floor(displayedCurrentTime))}
        </motion.span>
      )}
      <motion.div
        key={`visualizer-${currentTrackId}`}
        className="player-seek-visualizer relative h-10 flex-1"
        initial={motionEnabled ? { opacity: 0.76, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: motionEnabled ? motionProfile.duration.base : 0,
          ease: motionProfile.ease.smooth,
        }}
        >
        <SeekSurface
          ariaLabel="Seek playback position"
          className={`relative h-full cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--player-waveform)/0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${useCapsuleVariant ? "rounded-full" : "rounded-[2px]"}`}
          currentTime={displayedCurrentTime}
          duration={duration}
          onSeek={handleSeekCommit}
          onSeekCancel={handleSeekCancel}
          onSeekPreview={handleSeekPreview}
        >
          {useCapsuleVariant ? (
            <div className="bottom-player-capsule-track flex h-full items-center rounded-full border border-white/8 bg-white/[0.08] px-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="relative h-[0.85rem] w-full overflow-hidden rounded-full bg-black/28">
                <div
                  className="bottom-player-capsule-fill absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-linear"
                  style={{
                    width: progressWidth,
                    background:
                      "linear-gradient(90deg, hsl(var(--player-waveform) / 0.98), hsl(var(--dynamic-accent) / 0.94))",
                    boxShadow: "0 0 14px hsl(var(--player-waveform) / 0.18)",
                  }}
                />
                <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
                <div className="absolute inset-0 opacity-55 mix-blend-screen">
                  <div
                    className="h-full"
                    style={{
                      background:
                        "repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 8px)",
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Suspense
              fallback={(
                <div className="flex h-full items-center justify-center rounded-full bg-white/10">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full bg-[hsl(var(--player-waveform))] transition-all duration-100 ease-linear"
                      style={{ width: progressWidth }}
                    />
                  </div>
                </div>
              )}
            >
              <LazyVisualizerSelector
                className="h-full"
                currentTime={displayedCurrentTime}
                duration={duration}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                trackId={currentTrackId}
              />
            </Suspense>
          )}
        </SeekSurface>
      </motion.div>
      {useCapsuleVariant ? null : (
        <span className="player-seek-time player-seek-time-duration w-10 font-mono text-xs text-white/62 tabular-nums">
          {formatDuration(Math.floor(duration))}
        </span>
      )}
    </div>
  );
}
