import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cast,
  Check,
  ExternalLink,
  Globe2,
  Laptop2,
  Loader2,
  Smartphone,
  Speaker,
  Tv2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAudioEngine } from "@/lib/audioEngine";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  getPlaybackDeviceId,
  listPlaybackSessions,
  type PlaybackSessionSnapshot,
} from "@/lib/playbackSessions";
import { cn } from "@/lib/utils";

type OutputDevice = {
  deviceId: string;
  label: string;
};

type MediaDevicesWithAudioOutput = MediaDevices & {
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
};

const PANEL_CARD_CLASS =
  "rounded-[var(--surface-radius-lg)] border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const ROW_CARD_CLASS =
  "rounded-[var(--surface-radius-md)] border border-white/10 bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";
const ICON_TILE_CLASS =
  "rounded-[var(--surface-radius-sm)] border border-white/10 bg-black/20 text-muted-foreground";
const OUTLINE_BUTTON_CLASS =
  "rounded-[var(--surface-radius-md)] border border-white/12 bg-white/[0.03] text-foreground hover:bg-white/[0.05]";

function getDeviceLabel(device: MediaDeviceInfo, index: number) {
  if (device.deviceId === "default") return "This computer";
  if (device.label?.trim()) return device.label.trim();
  return `Audio output ${index + 1}`;
}

function getDeviceIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("tv") || normalized.includes("display")) return Tv2;
  if (normalized.includes("phone") || normalized.includes("iphone") || normalized.includes("android")) return Smartphone;
  if (
    normalized.includes("speaker") ||
    normalized.includes("headphone") ||
    normalized.includes("airpods") ||
    normalized.includes("earbud") ||
    normalized.includes("sonos") ||
    normalized.includes("homepod")
  ) {
    return Speaker;
  }
  return Laptop2;
}

export function ConnectDeviceDialog() {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [remoteSessions, setRemoteSessions] = useState<PlaybackSessionSnapshot[]>([]);
  const [isLoadingRemoteSessions, setIsLoadingRemoteSessions] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isTakingOver, setIsTakingOver] = useState<string | null>(null);
  const [supportsSinkSelection, setSupportsSinkSelection] = useState(false);
  const [canPromptForOutput, setCanPromptForOutput] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => getAudioEngine().getSinkId());
  const { user } = useAuth();
  const { restoreRemoteSession } = usePlayer();
  const currentPlaybackDeviceId = getPlaybackDeviceId();

  const refreshDevices = useCallback(async () => {
    const engine = getAudioEngine();
    setSelectedDeviceId(engine.getSinkId());
    setSupportsSinkSelection(engine.supportsSinkSelection());

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([{ deviceId: "default", label: "This computer" }]);
      setCanPromptForOutput(false);
      return;
    }

    try {
      const mediaDevices = navigator.mediaDevices as MediaDevicesWithAudioOutput;
      const available = await mediaDevices.enumerateDevices();
      const outputs = available.filter((device) => device.kind === "audiooutput");
      const unique = new Map<string, OutputDevice>();

      unique.set("default", { deviceId: "default", label: "This computer" });

      outputs.forEach((device, index) => {
        const deviceId = device.deviceId || `audio-output-${index}`;
        if (!unique.has(deviceId)) {
          unique.set(deviceId, {
            deviceId,
            label: getDeviceLabel(device, index),
          });
        }
      });

      setDevices(Array.from(unique.values()));
      setCanPromptForOutput(typeof mediaDevices.selectAudioOutput === "function");
    } catch (error) {
      console.error("Failed to enumerate audio output devices", error);
      setDevices([{ deviceId: "default", label: "This computer" }]);
      setCanPromptForOutput(false);
    }
  }, []);

  const refreshRemoteSessions = useCallback(async () => {
    if (!user) {
      setRemoteSessions([]);
      return;
    }

    setIsLoadingRemoteSessions(true);
    try {
      const sessions = await listPlaybackSessions(user.id);
      setRemoteSessions(sessions.filter((session) => session.deviceId !== currentPlaybackDeviceId));
    } catch (error) {
      console.error("Failed to load playback sessions", error);
      setRemoteSessions([]);
    } finally {
      setIsLoadingRemoteSessions(false);
    }
  }, [currentPlaybackDeviceId, user]);

  useEffect(() => {
    if (!open) return;
    void refreshDevices();
    void refreshRemoteSessions();

    const intervalId = window.setInterval(() => {
      void refreshRemoteSessions();
    }, 10000);

    const handleDeviceChange = () => {
      void refreshDevices();
    };

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    }

    return () => {
      window.clearInterval(intervalId);
      if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, [open, refreshDevices, refreshRemoteSessions]);

  const handleSelectDevice = useCallback(async (deviceId: string) => {
    setIsSwitching(deviceId);
    try {
      await getAudioEngine().setSinkId(deviceId);
      setSelectedDeviceId(deviceId);
      toast.success(deviceId === "default" ? "Playing on this computer" : "Audio output switched");
    } catch (error) {
      console.error("Failed to switch audio output device", error);
      toast.error("Could not switch audio output in this browser");
    } finally {
      setIsSwitching(null);
    }
  }, []);

  const handleChooseOutput = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithAudioOutput;
    if (typeof mediaDevices.selectAudioOutput !== "function") return;

    try {
      const selected = await mediaDevices.selectAudioOutput({
        deviceId: selectedDeviceId === "default" ? undefined : selectedDeviceId,
      });
      await handleSelectDevice(selected.deviceId || "default");
      await refreshDevices();
    } catch {
      // Ignore cancelled prompts.
    }
  }, [handleSelectDevice, refreshDevices, selectedDeviceId]);

  const handleTakeOverSession = useCallback(async (session: PlaybackSessionSnapshot) => {
    if (!session.currentTrack) {
      toast.error("That session does not have an active track.");
      return;
    }

    if (session.currentTrack.isLocal) {
      toast.error("Local files can only be resumed on the device that imported them.");
      return;
    }

    setIsTakingOver(session.id);
    try {
      await restoreRemoteSession(session);
      toast.success(`Continued playback from ${session.deviceName}.`);
      setOpen(false);
    } catch (error) {
      console.error("Failed to take over remote session", error);
      toast.error(error instanceof Error ? error.message : "Could not continue that session here.");
    } finally {
      setIsTakingOver(null);
    }
  }, [restoreRemoteSession]);

  const activeDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId],
  );

  const otherDevices = useMemo(
    () => devices.filter((device) => device.deviceId !== (activeDevice?.deviceId || "default")),
    [activeDevice?.deviceId, devices],
  );

  const ActiveIcon = getDeviceIcon(activeDevice?.label || "This computer");
  const isOnExternalDevice = selectedDeviceId !== "default";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`player-chrome-utility menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md transition-colors ${open || isOnExternalDevice
            ? "text-[hsl(var(--player-waveform))]"
            : "text-white/68 hover:text-white"
            }`}
          title="Connect to a device"
        >
          <Cast className="h-5 w-5" absoluteStrokeWidth />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={14}
        className="w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden border-white/10 bg-black/95 p-0 text-white shadow-[0_32px_100px_rgba(0,0,0,0.82)] supports-[backdrop-filter]:bg-black/88 supports-[backdrop-filter]:backdrop-blur-xl"
        role="dialog"
        aria-label="Connect to a device"
      >
        <div className="max-h-[min(34rem,calc(100vh-9rem))] overflow-y-auto overscroll-contain">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="space-y-2 text-left">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Connect</h2>
              <p className="text-sm text-muted-foreground">
                Switch playback to another audio output available in this browser.
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <button
              type="button"
              onClick={() => void handleSelectDevice(activeDevice?.deviceId || "default")}
              disabled={isSwitching !== null}
              className={cn(
                PANEL_CARD_CLASS,
                "group relative w-full overflow-hidden bg-white/[0.04] p-5 text-left transition-colors hover:border-white/20",
              )}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-100"
                style={{ background: "linear-gradient(135deg, hsl(var(--player-waveform) / 0.2), transparent 70%)" }}
              />
              <div className="relative z-10 flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[var(--surface-radius-sm)] border"
                  style={{
                    borderColor: "hsl(var(--player-waveform) / 0.45)",
                    backgroundColor: "hsl(var(--player-waveform) / 0.12)",
                    color: "hsl(var(--player-waveform))",
                  }}
                >
                  <ActiveIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-semibold text-foreground">
                    {activeDevice?.deviceId === "default" ? "This computer" : activeDevice?.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeDevice?.deviceId === "default" ? "Current audio output" : "Currently connected"}
                  </p>
                </div>
                {isSwitching === activeDevice?.deviceId ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--player-waveform))]" />
                ) : (
                  <Check className="h-5 w-5 text-[hsl(var(--player-waveform))]" />
                )}
              </div>
            </button>

            {user ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Other Knobb sessions</p>
                {isLoadingRemoteSessions ? (
                  <div className={cn(ROW_CARD_CLASS, "flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground")}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking your active sessions...
                  </div>
                ) : remoteSessions.length > 0 ? (
                  remoteSessions.map((session) => {
                    const Icon = getDeviceIcon(session.deviceName);
                    const sessionTrack = session.currentTrack;
                    const canTakeOver = Boolean(sessionTrack) && !sessionTrack?.isLocal;

                    return (
                      <div
                        key={session.id}
                        className={cn(ROW_CARD_CLASS, "flex items-center gap-4 px-4 py-3")}
                      >
                        <div className={cn(ICON_TILE_CLASS, "flex h-10 w-10 items-center justify-center")}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{session.deviceName}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {sessionTrack
                              ? `${sessionTrack.title} · ${sessionTrack.artist}${session.isPlaying ? " · Playing" : " · Paused"}`
                              : "No active playback"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className={cn(OUTLINE_BUTTON_CLASS, "h-9 px-3 text-xs font-semibold")}
                          disabled={!canTakeOver || isTakingOver !== null}
                          onClick={() => {
                            void handleTakeOverSession(session);
                          }}
                        >
                          {isTakingOver === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue here"}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className={cn(ROW_CARD_CLASS, "px-4 py-3 text-sm text-muted-foreground")}>
                    No other signed-in Knobb sessions are active right now.
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(ROW_CARD_CLASS, "flex gap-4 px-4 py-3")}>
                <Globe2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Sign in for account handoff</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Browser audio output switching works without an account, but remote Knobb session handoff needs sign-in.
                  </p>
                </div>
              </div>
            )}

            {supportsSinkSelection && otherDevices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Available outputs</p>
                {otherDevices.map((device) => {
                  const Icon = getDeviceIcon(device.label);
                  const isSelected = selectedDeviceId === device.deviceId;
                  return (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => void handleSelectDevice(device.deviceId)}
                      disabled={isSwitching !== null}
                      className={cn(
                        ROW_CARD_CLASS,
                        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                        isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
                      )}
                    >
                      <div className={cn(ICON_TILE_CLASS, "flex h-10 w-10 items-center justify-center")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{device.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Available on this system</p>
                      </div>
                      {isSwitching === device.deviceId ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--player-waveform))]" />
                      ) : isSelected ? (
                        <Check className="h-4 w-4 text-[hsl(var(--player-waveform))]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold text-foreground">No other devices found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {supportsSinkSelection
                      ? "Connect headphones, Bluetooth speakers, or another audio output and reopen this panel."
                      : "This browser does not expose audio output switching, so playback stays on this computer."}
                  </p>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-5">
                  <div className={cn(ROW_CARD_CLASS, "flex gap-4 px-4 py-4")}>
                    <Wifi className="mt-0.5 h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium text-foreground">Check your audio outputs</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bluetooth speakers, wired headphones, and system outputs appear here when the browser can access them.
                      </p>
                    </div>
                  </div>

                  <div className={cn(ROW_CARD_CLASS, "flex gap-4 px-4 py-4")}>
                    <Cast className="mt-0.5 h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium text-foreground">Use browser-supported routing</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Knobb can switch local audio outputs in supported browsers, but it does not yet hand off playback to remote account sessions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {(canPromptForOutput || supportsSinkSelection) && (
            <div className="border-t border-white/10 px-6 py-4">
              <div className={cn(PANEL_CARD_CLASS, "flex items-center justify-between gap-3 px-4 py-3")}>
                <div>
                  <p className="text-base font-medium text-foreground">What can I connect to?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    System speakers, Bluetooth audio, headphones, and other outputs your browser can route audio to.
                  </p>
                </div>
                {canPromptForOutput && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => void handleChooseOutput()}
                    title="Choose audio output"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
