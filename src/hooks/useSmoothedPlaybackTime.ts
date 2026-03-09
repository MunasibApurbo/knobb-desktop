import { useEffect, useState } from "react";

type UseSmoothedPlaybackTimeOptions = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed?: number;
};

const FRAME_EPSILON_SECONDS = 1 / 120;

function clampPlaybackTime(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || currentTime <= 0) {
    return 0;
  }

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(currentTime, duration);
  }

  return currentTime;
}

export function useSmoothedPlaybackTime({
  currentTime,
  duration,
  isPlaying,
  playbackSpeed = 1,
}: UseSmoothedPlaybackTimeOptions) {
  const [smoothedTime, setSmoothedTime] = useState(() => clampPlaybackTime(currentTime, duration));

  useEffect(() => {
    const syncedTime = clampPlaybackTime(currentTime, duration);

    if (!isPlaying || typeof window === "undefined") {
      setSmoothedTime((previousTime) => (
        Math.abs(previousTime - syncedTime) < FRAME_EPSILON_SECONDS
          ? previousTime
          : syncedTime
      ));
      return;
    }

    let frameId = 0;
    const startTime = syncedTime;
    const startTimestamp = window.performance.now();
    const safePlaybackSpeed = Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1;

    const animate = (timestamp: number) => {
      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000);
      const nextTime = clampPlaybackTime(startTime + elapsedSeconds * safePlaybackSpeed, duration);

      setSmoothedTime((previousTime) => (
        Math.abs(previousTime - nextTime) < FRAME_EPSILON_SECONDS
          ? previousTime
          : nextTime
      ));

      frameId = window.requestAnimationFrame(animate);
    };

    setSmoothedTime((previousTime) => (
      Math.abs(previousTime - syncedTime) < FRAME_EPSILON_SECONDS
        ? previousTime
        : syncedTime
    ));

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentTime, duration, isPlaying, playbackSpeed]);

  return smoothedTime;
}
