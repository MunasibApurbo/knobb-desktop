import { Settings2, AudioLines, Moon, Waves } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VolumeBar } from "@/components/VolumeBar";
const PLAYBACK_SPEED_OPTIONS = [
  { key: "0.8", label: "0.8x" },
  { key: "1", label: "1x" },
  { key: "1.25", label: "1.25x" },
  { key: "1.5", label: "1.5x" },
  { key: "2", label: "2x" },
] as const;
const PLAYBACK_SPEED_VALUES = PLAYBACK_SPEED_OPTIONS.map((option) => Number(option.key));

function formatPlaybackSpeed(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}x` : `${rounded}x`;
}

const settingsRowTitleClassName = "text-base font-medium text-white";
const settingsRowValueClassName = "text-base font-medium";
const topLevelSectionClassName =
  "menu-sweep-hover hover:[--volume-active-color:hsl(0_0%_0%)] hover:[--volume-inactive-color:hsl(0_0%_0%/0.45)] flex flex-col border-b border-border/10 px-4 py-4 group/section transition-colors";

function getPlaybackSpeedSliderValue(speed: number) {
  const closestIndex = PLAYBACK_SPEED_VALUES.reduce((bestIndex, value, index) => {
    const bestDistance = Math.abs(PLAYBACK_SPEED_VALUES[bestIndex] - speed);
    const nextDistance = Math.abs(value - speed);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);

  return PLAYBACK_SPEED_VALUES.length === 1
    ? 0
    : closestIndex / (PLAYBACK_SPEED_VALUES.length - 1);
}

function getPlaybackSpeedFromSliderValue(value: number) {
  if (PLAYBACK_SPEED_VALUES.length === 1) return PLAYBACK_SPEED_VALUES[0];

  const closestIndex = PLAYBACK_SPEED_VALUES.reduce((bestIndex, _speed, index) => {
    const currentPosition = index / (PLAYBACK_SPEED_VALUES.length - 1);
    const bestPosition = bestIndex / (PLAYBACK_SPEED_VALUES.length - 1);
    return Math.abs(currentPosition - value) < Math.abs(bestPosition - value) ? index : bestIndex;
  }, 0);

  return PLAYBACK_SPEED_VALUES[closestIndex];
}

function SectionTitle({
  icon: Icon,
  title,
  value,
  action,
}: {
  icon: typeof AudioLines;
  title: string;
  value?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Icon className="w-[18px] h-[18px] text-foreground/55 group-hover/section:!text-black transition-colors" />
        <span className={`${settingsRowTitleClassName} group-hover/section:!text-black transition-colors`}>{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {value ? (
          <span className={`${settingsRowValueClassName} group-hover/section:!text-black`} style={{ color: `hsl(var(--player-waveform))` }}>
            {value}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function PlayerSettings() {
  const {
    crossfadeDuration,
    setCrossfadeDuration,
    playbackSpeed,
    setPlaybackSpeed,
    sleepTimerEndsAt,
    setSleepTimer,
  } = usePlayer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sleepTimerEndsAt) return;

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sleepTimerEndsAt]);

  const sleepTimerMinutes = useMemo(() => {
    if (!sleepTimerEndsAt) return 0;
    return Math.max(0, Math.ceil((sleepTimerEndsAt - now) / 60000));
  }, [now, sleepTimerEndsAt]);

  const sleepTimerSliderValue = useMemo(() => {
    const minutes = [0, 5, 10, 15, 20, 30, 45, 60];
    const activeMinutes = sleepTimerMinutes;
    const closest = minutes.reduce((prev, curr) =>
      Math.abs(curr - activeMinutes) < Math.abs(prev - activeMinutes) ? curr : prev
    );
    return closest / 60;
  }, [sleepTimerMinutes]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="player-chrome-utility menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md text-white/68 transition-colors hover:text-white">
          <Settings2 className="h-5 w-5" absoluteStrokeWidth />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-[78vh] overflow-y-auto p-0 text-white"
      >
        <div className={`${topLevelSectionClassName} space-y-4`}>
          <SectionTitle icon={Waves} title="Playback" value={formatPlaybackSpeed(playbackSpeed)} />
          <VolumeBar
            volume={getPlaybackSpeedSliderValue(playbackSpeed)}
            onChange={(value) => setPlaybackSpeed(getPlaybackSpeedFromSliderValue(value))}
            className="w-full h-3 mt-0.5 opacity-90"
            variant="straight"
          />
        </div>

        <div className={`${topLevelSectionClassName} pb-3.5`}>
          <SectionTitle icon={AudioLines} title="Crossfade" value={`${crossfadeDuration}s`} />
          <VolumeBar
            volume={crossfadeDuration / 12}
            onChange={(v) => {
              const val = Math.round(v * 12);
              setCrossfadeDuration(val);
            }}
            className="w-full h-3 mt-2.5 opacity-90"
            variant="straight"
          />
        </div>

        <div className="menu-sweep-hover hover:[--volume-active-color:hsl(0_0%_0%)] hover:[--volume-inactive-color:hsl(0_0%_0%/0.45)] flex flex-col px-4 py-4 pb-3.5 group/section transition-colors">
          <SectionTitle
            icon={Moon}
            title="Sleep Timer"
            value={sleepTimerMinutes > 0 ? `${sleepTimerMinutes}m` : "Off"}
          />
          <VolumeBar
            volume={sleepTimerSliderValue}
            onChange={(v) => {
              const minutes = [0, 5, 10, 15, 20, 30, 45, 60];
              const closest = minutes.reduce((prev, curr) => Math.abs(curr - v * 60) < Math.abs(prev - v * 60) ? curr : prev);
              setSleepTimer(closest);
            }}
            className="w-full h-3 mt-2.5 opacity-90"
            variant="straight"
          />
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
