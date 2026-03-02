import { Radio, Settings2, Disc3 } from "lucide-react";
import { usePlayer, AudioQuality } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

const QUALITY_LABELS: Record<AudioQuality, { label: string; desc: string }> = {
  LOW: { label: "Low", desc: "96 kbps" },
  HIGH: { label: "High", desc: "320 kbps" },
  LOSSLESS: { label: "Lossless", desc: "FLAC 16-bit" },
};

export function PlayerSettings() {
  const { quality, setQuality, radioMode, toggleRadioMode, crossfadeDuration, setCrossfadeDuration } = usePlayer();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <Settings2 className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-xl border-border/30">
        {/* Quality selector */}
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Audio Quality
        </DropdownMenuLabel>
        {(Object.keys(QUALITY_LABELS) as AudioQuality[]).map((q) => (
          <DropdownMenuItem
            key={q}
            onClick={() => setQuality(q)}
            className={`flex justify-between ${quality === q ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
          >
            <span className="flex items-center gap-2">
              <Disc3 className={`w-3 h-3 ${quality === q ? "opacity-100" : "opacity-0"}`} />
              {QUALITY_LABELS[q].label}
            </span>
            <span className="text-xs text-muted-foreground">{QUALITY_LABELS[q].desc}</span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Radio mode */}
        <DropdownMenuItem onClick={toggleRadioMode} className="flex justify-between">
          <span className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${radioMode ? "text-[hsl(var(--dynamic-accent))]" : ""}`} />
            Radio Mode
          </span>
          <span className={`text-xs ${radioMode ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground"}`}>
            {radioMode ? "ON" : "OFF"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Crossfade */}
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Crossfade
        </DropdownMenuLabel>
        <div className="px-3 py-2 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Duration</span>
            <span style={{ color: crossfadeDuration > 0 ? `hsl(var(--dynamic-accent))` : undefined }}>
              {crossfadeDuration === 0 ? "Off" : `${crossfadeDuration}s`}
            </span>
          </div>
          <Slider
            value={[crossfadeDuration]}
            onValueChange={([v]) => setCrossfadeDuration(v)}
            min={0}
            max={12}
            step={1}
            className="w-full"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
