import { Settings2, AudioLines, Blend, Gauge, Moon } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VolumeBar } from "@/components/VolumeBar";
import { Switch } from "@/components/ui/switch";
import {
  formatAudioQualityLabel,
  getAudioQualityOptionsForTrack,
  getHighestResolvedAudioQuality,
  getAudioQualityTierFromResolvedLabel,
  getEffectivePlaybackQuality,
  getPlayableAudioQualityForTrack,
} from "@/lib/audioQuality";
import { getTrackSource } from "@/lib/librarySources";

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

function getSleepTimerMinutesFromSliderValue(value: number) {
  const minutes = [0, 5, 10, 15, 20, 30, 45, 60];
  return minutes.reduce((prev, curr) => Math.abs(curr - value * 60) < Math.abs(prev - value * 60) ? curr : prev);
}

const settingsRowTitleClassName = "text-base font-medium text-white";
const settingsRowValueClassName = "text-base font-medium";
const topLevelSectionClassName =
  "menu-sweep-hover hover:[--volume-active-color:hsl(0_0%_0%)] hover:[--volume-inactive-color:hsl(0_0%_0%/0.45)] flex flex-col border-b border-border/10 px-4 py-4 group/section transition-colors";
const optionButtonClassName =
  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";

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

function SectionToggleRow({
  checked,
  label,
  offLabel = "Off",
  onCheckedChange,
  onLabel = "On",
}: {
  checked: boolean;
  label: string;
  offLabel?: string;
  onCheckedChange: (next: boolean) => void;
  onLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[calc(var(--control-radius)+2px)] border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/52">{checked ? onLabel : offLabel}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[hsl(var(--player-waveform))] data-[state=unchecked]:bg-white/20"
      />
    </div>
  );
}

export function PlayerSettings() {
  const {
    currentTrack,
    crossfadeDuration,
    normalization,
    playbackSpeed,
    preservePitch,
    quality,
    resolvedAudioQuality,
    resolvedAudioQualityLabel,
    resolvedAvailableAudioQualityLabels,
    setCrossfadeDuration,
    setPlaybackSpeed,
    setPreservePitch,
    setQuality,
    setSleepTimer,
    sleepTimerEndsAt,
    toggleNormalization,
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
  const currentTrackSource = currentTrack ? getTrackSource(currentTrack) : null;
  const currentTrackCapability = useMemo(() => {
    const derivedCapability = getHighestResolvedAudioQuality(
      resolvedAvailableAudioQualityLabels,
      resolvedAudioQualityLabel,
      currentTrackSource,
    );

    return derivedCapability || currentTrack?.audioQuality || null;
  }, [
    currentTrack?.audioQuality,
    currentTrackSource,
    resolvedAudioQualityLabel,
    resolvedAvailableAudioQualityLabels,
  ]);
  const effectiveRequestedQuality = useMemo(
    () => getEffectivePlaybackQuality(quality, currentTrackSource, currentTrack?.isVideo === true),
    [currentTrack?.isVideo, currentTrackSource, quality],
  );
  const displayedAudioQuality = resolvedAudioQuality
    || getPlayableAudioQualityForTrack(
      quality,
      currentTrackSource,
      currentTrackCapability,
      currentTrack?.isVideo === true,
    )
    || effectiveRequestedQuality;
  const displayedResolvedAudioTier = getAudioQualityTierFromResolvedLabel(
    resolvedAudioQualityLabel,
    currentTrackSource,
  ) || displayedAudioQuality;
  const displayedAudioQualityLabel = formatAudioQualityLabel(displayedResolvedAudioTier);
  const audioQualityOptions = useMemo(
    () => getAudioQualityOptionsForTrack(currentTrackSource, currentTrackCapability),
    [currentTrackCapability, currentTrackSource],
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Player settings"
          title="Player settings"
          className="player-chrome-utility relative h-9 w-9 overflow-hidden rounded-md text-white/68 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Settings2 className="h-5 w-5" absoluteStrokeWidth />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-native-scroll="true"
        className="player-settings-surface w-[18.5rem] max-w-[calc(100vw-1rem)] max-h-[min(82vh,36rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:auto] border-white/12 p-0 text-white"
      >
        {currentTrack && currentTrack.isVideo !== true ? (
          <div className={`${topLevelSectionClassName} space-y-3`}>
            <SectionTitle
              icon={AudioLines}
              title="Audio Quality"
              value={displayedAudioQualityLabel}
            />
            <div className="flex flex-wrap gap-2">
              {audioQualityOptions.map((option) => {
                const active = option.value === quality;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${optionButtonClassName} ${
                      active
                        ? "border-white/70 bg-white/14 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.08] hover:text-white"
                    }`}
                    onClick={() => setQuality(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <SectionToggleRow
                checked={normalization}
                label="Loudness leveling"
                onCheckedChange={() => toggleNormalization()}
                onLabel="Balanced playback"
                offLabel="Full dynamics"
              />
            </div>
          </div>
        ) : null}

        <div className={`${topLevelSectionClassName} space-y-4`}>
          <SectionTitle icon={Gauge} title="Playback" value={formatPlaybackSpeed(playbackSpeed)} />
          <VolumeBar
            ariaLabel="Playback speed"
            ariaValueText={(value) => formatPlaybackSpeed(getPlaybackSpeedFromSliderValue(value))}
            volume={getPlaybackSpeedSliderValue(playbackSpeed)}
            onChange={(value) => setPlaybackSpeed(getPlaybackSpeedFromSliderValue(value))}
            className="w-full h-3 mt-0.5 opacity-90"
            variant="straight"
          />
          <div className="space-y-2">
            <SectionToggleRow
              checked={preservePitch}
              label="Preserve pitch"
              onCheckedChange={setPreservePitch}
              onLabel="Pitch locked"
              offLabel="Pitch shifts with speed"
            />
          </div>
        </div>

        <div className={`${topLevelSectionClassName} pb-3.5`}>
          <SectionTitle icon={Blend} title="Crossfade" value={`${crossfadeDuration}s`} />
          <VolumeBar
            ariaLabel="Crossfade duration"
            ariaValueText={(value) => {
              const seconds = Math.round(value * 20);
              return seconds === 0 ? "Crossfade off" : `${seconds} seconds`;
            }}
            volume={crossfadeDuration / 20}
            onChange={(v) => {
              const val = Math.round(v * 20);
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
            ariaLabel="Sleep timer"
            ariaValueText={(value) => {
              const minutes = getSleepTimerMinutesFromSliderValue(value);
              return minutes === 0 ? "Sleep timer off" : `${minutes} minutes`;
            }}
            volume={sleepTimerSliderValue}
            onChange={(v) => {
              const closest = getSleepTimerMinutesFromSliderValue(v);
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
