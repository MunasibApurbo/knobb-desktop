import { useState } from "react";
import { LCDVisualizer } from "./LCDVisualizer";
import { ParticlesVisualizer } from "./ParticlesVisualizer";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { Button } from "@/components/ui/button";
import { Activity, Grid3X3, Sparkles } from "lucide-react";

type VisualizerType = "waveform" | "lcd" | "particles";

export function VisualizerSelector({ className = "" }: { className?: string }) {
  const [type, setType] = useState<VisualizerType>("waveform");

  return (
    <div className={`relative ${className}`}>
      <div className="w-full h-full">
        {type === "waveform" && <WaveformVisualizer />}
        {type === "lcd" && <LCDVisualizer />}
        {type === "particles" && <ParticlesVisualizer />}
      </div>

      {/* Visualizer picker */}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className={`w-6 h-6 ${type === "waveform" ? "text-foreground" : "text-muted-foreground"}`}
          onClick={() => setType("waveform")}
        >
          <Activity className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`w-6 h-6 ${type === "lcd" ? "text-foreground" : "text-muted-foreground"}`}
          onClick={() => setType("lcd")}
        >
          <Grid3X3 className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`w-6 h-6 ${type === "particles" ? "text-foreground" : "text-muted-foreground"}`}
          onClick={() => setType("particles")}
        >
          <Sparkles className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
