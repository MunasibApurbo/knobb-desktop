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

      {/* Visualizer picker */}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
        {VISUALIZERS.map(({ type: t, icon: Icon }) => (
          <Button
            key={t}
            variant="ghost"
            size="icon"
            className={`w-6 h-6 ${type === t ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => setType(t)}
          >
            <Icon className="w-3 h-3" />
          </Button>
        ))}
      </div>
    </div>
  );
}
