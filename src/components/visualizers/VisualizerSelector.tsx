import { WaveformVisualizer } from "./WaveformVisualizer";

type VisualizerSelectorProps = {
  className?: string;
  currentTime?: number;
};

export function VisualizerSelector({ className = "", currentTime }: VisualizerSelectorProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="h-full w-full">
        <WaveformVisualizer currentTime={currentTime} />
      </div>
    </div>
  );
}
