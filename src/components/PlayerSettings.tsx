import { Radio, Settings2, Disc3, Timer, TimerOff, ChevronDown, ChevronUp, PictureInPicture2 } from "lucide-react";
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
  MEDIUM: { label: "Medium", desc: "160 kbps" },
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

// Collapsible section with hover-reveal indicator
function CollapsibleSection({ 
  label, expanded, onToggle, badge, children 
}: { 
  label: string; expanded: boolean; onToggle: () => void; badge?: React.ReactNode; children: React.ReactNode 
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="group flex items-center justify-between w-full px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {badge}
        </span>
        <span className={`transition-all duration-200 ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${expanded ? "" : "translate-x-1 group-hover:translate-x-0"}`}>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{
          maxHeight: expanded ? "300px" : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        {children}
      </div>
    </>
  );
}

export function PlayerSettings({ miniPlayerEnabled, onToggleMiniPlayer }: { miniPlayerEnabled?: boolean; onToggleMiniPlayer?: () => void }) {
  const { quality, setQuality, radioMode, toggleRadioMode, crossfadeDuration, setCrossfadeDuration, togglePlay, isPlaying } = usePlayer();
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [sleepExpanded, setSleepExpanded] = useState(false);
  const [qualityExpanded, setQualityExpanded] = useState(false);
  const [crossfadeExpanded, setCrossfadeExpanded] = useState(false);
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
        {/* Collapsible Audio Quality */}
        <CollapsibleSection
          label="Audio Quality"
          expanded={qualityExpanded}
          onToggle={() => setQualityExpanded(!qualityExpanded)}
          badge={
            <span className="text-[10px] normal-case" style={{ color: `hsl(var(--dynamic-accent))` }}>
              {QUALITY_LABELS[quality].label}
            </span>
          }
        >
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
        </CollapsibleSection>

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

        {/* Mini Player toggle */}
        {onToggleMiniPlayer && (
          <>
            <DropdownMenuItem onClick={onToggleMiniPlayer} className="flex justify-between">
              <span className="flex items-center gap-2">
                <PictureInPicture2 className={`w-3.5 h-3.5 ${miniPlayerEnabled ? "text-[hsl(var(--dynamic-accent))]" : ""}`} />
                Mini Player
              </span>
              <span className={`text-xs ${miniPlayerEnabled ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground"}`}>
                {miniPlayerEnabled ? "ON" : "OFF"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Collapsible Crossfade */}
        <CollapsibleSection
          label="Crossfade"
          expanded={crossfadeExpanded}
          onToggle={() => setCrossfadeExpanded(!crossfadeExpanded)}
          badge={
            <span className="text-[10px] normal-case" style={{ color: crossfadeDuration > 0 ? `hsl(var(--dynamic-accent))` : undefined }}>
              {crossfadeDuration === 0 ? "Off" : `${crossfadeDuration}s`}
            </span>
          }
        >
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
              className="w-full [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-range]]:bg-[hsl(var(--dynamic-accent))] [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:border-[hsl(var(--dynamic-accent))]"
            />
          </div>
        </CollapsibleSection>

        <DropdownMenuSeparator />

        {/* Collapsible Sleep Timer */}
        <CollapsibleSection
          label="Sleep Timer"
          expanded={sleepExpanded}
          onToggle={() => setSleepExpanded(!sleepExpanded)}
          badge={
            sleepMinutes !== null ? (
              <span className="text-[10px] normal-case" style={{ color: `hsl(var(--dynamic-accent))` }}>
                {formatRemaining(remaining)}
              </span>
            ) : undefined
          }
        >
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
        </CollapsibleSection>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
