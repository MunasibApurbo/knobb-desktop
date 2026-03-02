import { Radio, Settings2, Disc3, Timer, TimerOff, Gauge } from "lucide-react";
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
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const QUALITY_LABELS: Record<AudioQuality, { label: string; desc: string }> = {
  LOW: { label: "Low", desc: "96 kbps" },
  HIGH: { label: "High", desc: "320 kbps" },
  LOSSLESS: { label: "Lossless", desc: "FLAC 16-bit" },
};

const SLEEP_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 hour", value: 60 },
];

export function PlayerSettings() {
  const { quality, setQuality, radioMode, toggleRadioMode, crossfadeDuration, setCrossfadeDuration, togglePlay, isPlaying, playbackSpeed, setPlaybackSpeed } = usePlayer();
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number | null>(null);

  const clearSleepTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    endTimeRef.current = null;
    setSleepMinutes(null);
    setRemaining(0);
  }, []);

  const startSleepTimer = useCallback((minutes: number) => {
    clearSleepTimer();
    const endTime = Date.now() + minutes * 60 * 1000;
    endTimeRef.current = endTime;
    setSleepMinutes(minutes);
    setRemaining(minutes * 60);
    toast.success(`Sleep timer set for ${minutes} minutes`);

    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((endTimeRef.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearSleepTimer();
        // Pause playback
        if (isPlaying) togglePlay();
        toast.info("Sleep timer ended — playback paused");
      }
    }, 1000);
  }, [clearSleepTimer, isPlaying, togglePlay]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatRemaining = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground relative">
          <Settings2 className="w-4 h-4" />
          {sleepMinutes !== null && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: `hsl(var(--dynamic-accent))` }} />
          )}
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

        <DropdownMenuSeparator />

        {/* Playback Speed */}
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Playback Speed
        </DropdownMenuLabel>
        <div className="px-3 py-2 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Gauge className="w-3 h-3" /> Speed</span>
            <span style={{ color: playbackSpeed !== 1 ? `hsl(var(--dynamic-accent))` : undefined }}>
              {playbackSpeed}x
            </span>
          </div>
          <Slider
            value={[playbackSpeed * 100]}
            onValueChange={([v]) => setPlaybackSpeed(v / 100)}
            min={50}
            max={200}
            step={25}
            className="w-full"
          />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Sleep Timer
        </DropdownMenuLabel>
        {sleepMinutes !== null ? (
          <div className="px-3 py-2 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" style={{ color: `hsl(var(--dynamic-accent))` }} />
                <span style={{ color: `hsl(var(--dynamic-accent))` }}>{formatRemaining(remaining)}</span>
              </span>
              <button
                onClick={clearSleepTimer}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
              >
                <TimerOff className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          SLEEP_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => startSleepTimer(opt.value)}>
              <Timer className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              {opt.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
