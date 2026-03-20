type UseSmoothedPlaybackTimeOptions = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed?: number;
};

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
}: UseSmoothedPlaybackTimeOptions) {
  return clampPlaybackTime(currentTime, duration);
}
