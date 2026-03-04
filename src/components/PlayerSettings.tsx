import { Settings2, Disc3, ChevronRight, ChevronDown, ChevronUp, Radio, Monitor, AudioLines, Moon } from "lucide-react";
import { usePlayer, AudioQuality } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { VolumeBar } from "@/components/VolumeBar";

const QUALITY_LABELS: Record<AudioQuality, { label: string; desc: string }> = {
  LOW: { label: "Low", desc: "96 kbps" },
  MEDIUM: { label: "Medium", desc: "160 kbps" },
  HIGH: { label: "High", desc: "320 kbps" },
  LOSSLESS: { label: "HIFI", desc: "FLAC 16-bit" },
};

export function PlayerSettings({ miniPlayerEnabled, onToggleMiniPlayer }: { miniPlayerEnabled?: boolean; onToggleMiniPlayer?: () => void }) {
  const { quality, setQuality } = usePlayer();
  const [qualityExpanded, setQualityExpanded] = useState(false);
  const [crossfade, setCrossfade] = useState(() => Number(localStorage.getItem("crossfade") || "3"));
  const [sleepTimer, setSleepTimer] = useState<number>(0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground relative">
          <Settings2 className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px] bg-[#1a1a1a] border border-border/10 p-0 text-[#e5e5e5] shadow-[0_0_80px_15px_rgba(0,0,0,0.9)] ">

        {/* AUDIO QUALITY */}
        <div className="flex flex-col border-b border-border/10">
          <button
            onClick={() => setQualityExpanded(!qualityExpanded)}
            className="menu-sweep-hover w-full flex items-center justify-between px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Disc3 className="w-[18px] h-[18px] text-muted-foreground/70 group-hover:!text-black transition-colors" />
              <div className="flex flex-col text-left leading-[1.15]">
                <span className="text-sm font-bold text-foreground/70 group-hover:!text-black transition-colors">Audio Quality</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold group-hover:!text-black" style={{ color: `hsl(var(--player-waveform))` }}>
                {QUALITY_LABELS[quality].label}
              </span>
              {qualityExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:!text-black" /> : <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:!text-black" />}
            </div>
          </button>

          {qualityExpanded && (
            <div className="flex flex-col pb-2 pt-1">
              {(Object.keys(QUALITY_LABELS) as AudioQuality[]).map((q) => {
                const isActive = quality === q;
                return (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className="menu-sweep-hover group w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-3 pl-[30px]">
                      <span
                        className={`text-sm transition-colors group-hover:!text-black ${
                          isActive ? "font-bold text-[hsl(var(--player-waveform))]" : "text-foreground font-medium"
                        }`}
                      >
                        {QUALITY_LABELS[q].label}
                      </span>
                    </div>
                    <span className="text-xs text-foreground/70 group-hover:!text-black">{QUALITY_LABELS[q].desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Radio Mode & Mini Player */}
        <div className="flex flex-col border-b border-border/10">
          <button className="menu-sweep-hover w-full flex items-center justify-between px-4 py-3.5 transition-colors group">
            <div className="flex items-center gap-3">
              <Radio className="w-[18px] h-[18px] text-foreground/50 group-hover:!text-black transition-colors" />
              <span className="text-sm font-bold text-foreground/70 group-hover:!text-black transition-colors">Radio Mode</span>
            </div>
            <span className="text-xs text-muted-foreground font-bold tracking-wide group-hover:!text-black">OFF</span>
          </button>

          <button
            onClick={onToggleMiniPlayer}
            className="menu-sweep-hover w-full flex items-center justify-between px-4 py-3.5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Monitor className="w-[18px] h-[18px] text-foreground/50 group-hover:!text-black transition-colors" />
              <span className="text-sm font-bold text-foreground/70 group-hover:!text-black transition-colors">Mini Player</span>
            </div>
            <span className="text-xs text-muted-foreground font-bold tracking-wide group-hover:!text-black">{miniPlayerEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* CROSSFADE */}
        <div className="menu-sweep-hover hover:[--volume-active-color:hsl(0_0%_0%)] hover:[--volume-inactive-color:hsl(0_0%_0%/0.45)] flex flex-col border-b border-border/10 py-3.5 px-4 group/section transition-colors">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <AudioLines className="w-[18px] h-[18px] text-foreground/50 group-hover/section:!text-black transition-colors" />
              <span className="text-sm font-bold text-foreground/70 group-hover/section:!text-black transition-colors">Crossfade</span>
            </div>
            <span className="text-xs font-bold group-hover/section:!text-black" style={{ color: `hsl(var(--player-waveform))` }}>{crossfade}s</span>
          </div>
          <VolumeBar
            volume={crossfade / 12}
            onChange={(v) => {
              const val = Math.round(v * 12);
              setCrossfade(val);
              localStorage.setItem("crossfade", String(val));
            }}
            className="w-full h-3 mt-0.5 opacity-90"
            variant="straight"
          />
        </div>

        {/* SLEEP TIMER */}
        <div className="menu-sweep-hover hover:[--volume-active-color:hsl(0_0%_0%)] hover:[--volume-inactive-color:hsl(0_0%_0%/0.45)] flex flex-col pb-3 py-3.5 px-4 group/section transition-colors">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <Moon className="w-[18px] h-[18px] text-foreground/50 group-hover/section:!text-black transition-colors" />
              <span className="text-sm font-bold text-foreground/70 group-hover/section:!text-black transition-colors">Sleep timer</span>
            </div>
            {sleepTimer > 0 && (
              <span className="text-xs font-bold group-hover/section:!text-black" style={{ color: `hsl(var(--player-waveform))` }}>{sleepTimer}m</span>
            )}
          </div>
          <VolumeBar
            volume={sleepTimer / 60}
            onChange={(v) => {
              const minutes = [0, 5, 10, 15, 20, 30, 45, 60];
              const closest = minutes.reduce((prev, curr) => Math.abs(curr - v * 60) < Math.abs(prev - v * 60) ? curr : prev);
              setSleepTimer(closest);
            }}
            className="w-full h-3 mt-0.5 opacity-90"
            variant="straight"
          />
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
