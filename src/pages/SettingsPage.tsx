import { usePlayer, AudioQuality } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { VolumeBar } from "@/components/VolumeBar";
import {
  Settings, Disc3, Radio, Waves, Moon, Timer, TimerOff,
  User, LogOut, Shield, Palette, Volume2, MonitorSpeaker
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const QUALITY_LABELS: Record<AudioQuality, { label: string; desc: string }> = {
  LOW: { label: "Low", desc: "96 kbps – saves data" },
  MEDIUM: { label: "Medium", desc: "160 kbps – balanced" },
  HIGH: { label: "High", desc: "320 kbps – high quality" },
  LOSSLESS: { label: "Lossless", desc: "FLAC 16-bit – studio quality" },
};

const SLEEP_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 hour", value: 60 },
];

function SettingsSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-heavy rounded-xl p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
        <Icon className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
        {title}
      </h2>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, description, action }: { label: string; description?: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { quality, setQuality, radioMode, toggleRadioMode, crossfadeDuration, setCrossfadeDuration, volume, setVolume, togglePlay, isPlaying, playbackSpeed, setPlaybackSpeed } = usePlayer();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Sleep timer state
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

  const crossfadeNorm = crossfadeDuration / 12;
  const handleCrossfadeChange = useCallback((v: number) => {
    setCrossfadeDuration(Math.round(v * 12));
  }, [setCrossfadeDuration]);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6" />
        Settings
      </h1>

      {/* Account */}
      <SettingsSection icon={User} title="Account">
        {user ? (
          <>
            <SettingsRow
              label="Email"
              description={user.email || "No email set"}
              action={<span className="text-xs text-muted-foreground">Signed in</span>}
            />
            <SettingsRow
              label="Sign out"
              description="Log out of your account"
              action={
                <Button variant="outline" size="sm" onClick={() => signOut()} className="text-xs">
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
                </Button>
              }
            />
          </>
        ) : (
          <SettingsRow
            label="Not signed in"
            description="Sign in to sync your playlists and liked songs"
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")} className="text-xs">
                Sign in
              </Button>
            }
          />
        )}
      </SettingsSection>

      {/* Audio Quality */}
      <SettingsSection icon={Disc3} title="Audio Quality">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(QUALITY_LABELS) as AudioQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`rounded-lg px-4 py-3 text-left transition-all border ${
                quality === q
                  ? "border-[hsl(var(--dynamic-accent))] bg-[hsl(var(--dynamic-accent)/0.1)]"
                  : "border-border/30 bg-white/5 hover:bg-white/10"
              }`}
            >
              <p className={`text-sm font-semibold ${quality === q ? "text-[hsl(var(--dynamic-accent))]" : "text-foreground"}`}>
                {QUALITY_LABELS[q].label}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{QUALITY_LABELS[q].desc}</p>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Playback */}
      <SettingsSection icon={MonitorSpeaker} title="Playback">
        <SettingsRow
          label="Radio Mode"
          description="Auto-play similar tracks when your queue ends"
          action={
            <Button
              variant={radioMode ? "default" : "outline"}
              size="sm"
              onClick={toggleRadioMode}
              className="text-xs min-w-[60px]"
              style={radioMode ? { backgroundColor: `hsl(var(--dynamic-accent))` } : {}}
            >
              {radioMode ? "ON" : "OFF"}
            </Button>
          }
        />

        <SettingsRow
          label="Crossfade"
          description={crossfadeDuration === 0 ? "Disabled" : `${crossfadeDuration}s between tracks`}
          action={
            <span className="text-xs font-mono" style={{ color: crossfadeDuration > 0 ? `hsl(var(--dynamic-accent))` : undefined }}>
              {crossfadeDuration === 0 ? "Off" : `${crossfadeDuration}s`}
            </span>
          }
        />
        <div className="px-1">
          <VolumeBar volume={crossfadeNorm} onChange={handleCrossfadeChange} className="w-full" />
        </div>

        <SettingsRow
          label="Playback Speed"
          description="Adjust the speed of audio playback"
          action={
            <span className="text-xs font-mono" style={{ color: playbackSpeed !== 1 ? `hsl(var(--dynamic-accent))` : undefined }}>
              {playbackSpeed}x
            </span>
          }
        />
        <div className="flex gap-2 flex-wrap">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all border ${
                playbackSpeed === speed
                  ? "border-[hsl(var(--dynamic-accent))] bg-[hsl(var(--dynamic-accent)/0.1)] text-[hsl(var(--dynamic-accent))]"
                  : "border-border/30 bg-white/5 hover:bg-white/10 text-foreground"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Volume */}
      <SettingsSection icon={Volume2} title="Volume">
        <SettingsRow
          label="Master Volume"
          description="Control the overall volume level"
          action={
            <span className="text-xs font-mono">{Math.round(volume * 100)}%</span>
          }
        />
        <div className="px-1">
          <VolumeBar volume={volume} onChange={setVolume} className="w-full" />
        </div>
      </SettingsSection>

      {/* Sleep Timer */}
      <SettingsSection icon={Moon} title="Sleep Timer">
        {sleepMinutes !== null ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
              <span style={{ color: `hsl(var(--dynamic-accent))` }} className="font-mono font-semibold">
                {formatRemaining(remaining)}
              </span>
              <span className="text-muted-foreground">remaining</span>
            </span>
            <Button variant="outline" size="sm" onClick={clearSleepTimer} className="text-xs">
              <TimerOff className="w-3.5 h-3.5 mr-1.5" /> Cancel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {SLEEP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => startSleepTimer(opt.value)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium border border-border/30 bg-white/5 hover:bg-white/10 transition-all text-foreground"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </SettingsSection>

      {/* About */}
      <SettingsSection icon={Shield} title="About">
        <SettingsRow
          label="Nobbb Music"
          description="Version 1.0.0"
          action={<span className="text-xs text-muted-foreground">©2024</span>}
        />
      </SettingsSection>
    </div>
  );
}
