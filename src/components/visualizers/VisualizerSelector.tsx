import { memo } from "react";

import { WaveformVisualizer } from "./WaveformVisualizer";

type VisualizerSelectorProps = {
  className?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  trackId: string;
};

function VisualizerSelectorComponent({
  className = "",
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  trackId,
}: VisualizerSelectorProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="h-full w-full">
        <WaveformVisualizer
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          trackId={trackId}
        />
      </div>
    </div>
  );
}

export const VisualizerSelector = memo(VisualizerSelectorComponent);
