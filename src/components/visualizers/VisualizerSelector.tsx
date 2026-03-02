import { useState } from "react";
import { LCDVisualizer } from "./LCDVisualizer";
import { ParticlesVisualizer } from "./ParticlesVisualizer";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { SpectrumVisualizer } from "./SpectrumVisualizer";
import { CircularVisualizer } from "./CircularVisualizer";
import { Button } from "@/components/ui/button";
import { Activity, Grid3X3, Sparkles, BarChart3, Circle } from "lucide-react";

type VisualizerType = "waveform" | "lcd" | "particles" | "spectrum" | "circular";

const VISUALIZERS: { type: VisualizerType; icon: typeof Activity; label: string }[] = [
  { type: "waveform", icon: Activity, label: "Waveform" },
  { type: "spectrum", icon: BarChart3, label: "Spectrum" },
  { type: "lcd", icon: Grid3X3, label: "LCD" },
  { type: "particles", icon: Sparkles, label: "Particles" },
  { type: "circular", icon: Circle, label: "Circular" },
];

export function VisualizerSelector({ className = "" }: { className?: string }) {
  const [type, setType] = useState<VisualizerType>("waveform");

  return (
    <div className={`relative ${className}`}>
      <div className="w-full h-full">
        {type === "waveform" && <WaveformVisualizer />}
        {type === "lcd" && <LCDVisualizer />}
        {type === "particles" && <ParticlesVisualizer />}
        {type === "spectrum" && <SpectrumVisualizer />}
        {type === "circular" && <CircularVisualizer />}
      </div>

    </div>
  );
}
