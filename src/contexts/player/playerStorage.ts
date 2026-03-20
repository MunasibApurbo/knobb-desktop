import { AudioQuality, PlayerState } from "@/contexts/player/playerTypes";
import { isAudioQuality } from "@/lib/audioQuality";
import { Track } from "@/types/music";
import { normalizeTrackIdentity } from "@/lib/trackIdentity";

const AUDIO_QUALITY_KEY = "audio-quality";
const AUTO_QUALITY_KEY = "settings-auto-quality";
const NORMALIZATION_KEY = "audio-normalization";
const EQUALIZER_ENABLED_KEY = "equalizer-enabled";
const EQUALIZER_GAINS_KEY = "equalizer-gains";
const EQUALIZER_PRESET_KEY = "equalizer-preset";
const PREAMP_DB_KEY = "audio-preamp-db";
const MONO_AUDIO_KEY = "mono-audio-enabled";
const CROSSFADE_DURATION_KEY = "crossfade-duration";
const PLAYBACK_SPEED_KEY = "playback-speed";
const PRESERVE_PITCH_KEY = "preserve-pitch";
const PLAYER_STATE_KEY = "player-state-v1";
const DEFAULT_EQ_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
type PersistedPlayerState = Pick<
  PlayerState,
  "currentTime" | "currentTrack" | "duration" | "queue" | "repeat" | "rightPanelTab" | "showRightPanel" | "shuffle" | "volume"
>;

function readStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function readStoredNumber(key: string, fallback: number) {
  const raw = readStorage(key);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredBoolean(key: string, fallback = false) {
  const raw = readStorage(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function readStoredEqGains() {
  const raw = readStorage(EQUALIZER_GAINS_KEY);
  if (!raw) return [...DEFAULT_EQ_GAINS];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_EQ_GAINS.length) {
      return [...DEFAULT_EQ_GAINS];
    }
    return parsed.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : 0));
  } catch {
    return [...DEFAULT_EQ_GAINS];
  }
}

function readStoredAudioQuality(): AudioQuality {
  const raw = readStorage(AUDIO_QUALITY_KEY);
  return isAudioQuality(raw) ? raw : "HIGH";
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    typeof track.artist === "string" &&
    typeof track.album === "string" &&
    typeof track.duration === "number" &&
    typeof track.year === "number" &&
    typeof track.coverUrl === "string" &&
    typeof track.canvasColor === "string"
  );
}

function isPersistableTrack(track: Track) {
  return !track.isLocal && !track.localFileId;
}

function sanitizeStoredTrack(track: Track): Track | null {
  if (!isPersistableTrack(track)) return null;

  const normalizedTrack = normalizeTrackIdentity(track);
  const persistableTrack = { ...normalizedTrack };
  delete persistableTrack.streamUrl;
  delete persistableTrack.streamUrls;
  delete persistableTrack.streamTypes;
  return persistableTrack;
}

function readStoredPlayerState(): Partial<PersistedPlayerState> {
  const raw = readStorage(PLAYER_STATE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerState>;
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.filter(isTrack).map(sanitizeStoredTrack).filter((track): track is Track => Boolean(track))
      : [];
    const currentTrack = isTrack(parsed.currentTrack) ? sanitizeStoredTrack(parsed.currentTrack) : null;
    const currentTime = typeof parsed.currentTime === "number" && Number.isFinite(parsed.currentTime) ? parsed.currentTime : 0;
    const duration = typeof parsed.duration === "number" && Number.isFinite(parsed.duration) ? parsed.duration : 0;
    const volume = typeof parsed.volume === "number" && Number.isFinite(parsed.volume) ? Math.max(0, Math.min(1, parsed.volume)) : 1;
    const repeat = parsed.repeat === "all" || parsed.repeat === "one" || parsed.repeat === "off" ? parsed.repeat : "off";
    const rightPanelTab = parsed.rightPanelTab === "queue" ? "queue" : "lyrics";

    return {
      currentTime,
      currentTrack,
      duration: duration || currentTrack?.duration || 0,
      queue,
      repeat,
      rightPanelTab,
      showRightPanel: parsed.showRightPanel === true,
      shuffle: parsed.shuffle === true,
      volume,
    };
  } catch {
    return {};
  }
}

export function createInitialPlayerState(): PlayerState {
  const storedPlayerState = readStoredPlayerState();
  const quality = readStoredAudioQuality();
  return {
    currentTrack: storedPlayerState.currentTrack ?? null,
    resolvedAudioQuality: null,
    resolvedAvailableAudioQualityLabels: [],
    resolvedAudioQualityLabel: null,
    resolvedVideoQuality: null,
    playbackMode: "native",
    hasPlaybackStarted: Boolean(storedPlayerState.currentTrack),
    isPlaying: false,
    currentTime: storedPlayerState.currentTime ?? 0,
    duration: storedPlayerState.duration ?? storedPlayerState.currentTrack?.duration ?? 0,
    queue: storedPlayerState.queue ?? [],
    shuffle: storedPlayerState.shuffle ?? false,
    repeat: storedPlayerState.repeat ?? "off",
    volume: storedPlayerState.volume ?? 1,
    showRightPanel: storedPlayerState.showRightPanel ?? false,
    rightPanelTab: storedPlayerState.rightPanelTab ?? "lyrics",
    isLoading: false,
    autoQualityEnabled: quality === "AUTO",
    quality,
    normalization: readStoredBoolean(NORMALIZATION_KEY),
    equalizerEnabled: readStoredBoolean(EQUALIZER_ENABLED_KEY),
    eqGains: readStoredEqGains(),
    eqPreset: readStorage(EQUALIZER_PRESET_KEY) || "flat",
    preampDb: readStoredNumber(PREAMP_DB_KEY, 0),
    monoAudioEnabled: readStoredBoolean(MONO_AUDIO_KEY),
    crossfadeDuration: readStoredNumber(CROSSFADE_DURATION_KEY, 0),
    playbackSpeed: readStoredNumber(PLAYBACK_SPEED_KEY, 1),
    preservePitch: readStoredBoolean(PRESERVE_PITCH_KEY, true),
    sleepTimerEndsAt: null,
    isFullScreen: false,
  };
}

export function persistAudioQuality(quality: AudioQuality) {
  writeStorage(AUDIO_QUALITY_KEY, quality);
}

export function persistAutoQualityEnabled(enabled: boolean) {
  writeStorage(AUTO_QUALITY_KEY, String(enabled));
}

export function persistNormalization(enabled: boolean) {
  writeStorage(NORMALIZATION_KEY, String(enabled));
}

export function persistEqualizerEnabled(enabled: boolean) {
  writeStorage(EQUALIZER_ENABLED_KEY, String(enabled));
}

export function persistEqGains(gains: number[]) {
  writeStorage(EQUALIZER_GAINS_KEY, JSON.stringify(gains));
}

export function persistEqPreset(preset: string) {
  writeStorage(EQUALIZER_PRESET_KEY, preset);
}

export function persistPreampDb(value: number) {
  writeStorage(PREAMP_DB_KEY, String(value));
}

export function persistMonoAudioEnabled(enabled: boolean) {
  writeStorage(MONO_AUDIO_KEY, String(enabled));
}

export function persistCrossfadeDuration(seconds: number) {
  writeStorage(CROSSFADE_DURATION_KEY, String(seconds));
}

export function persistPlaybackSpeed(speed: number) {
  writeStorage(PLAYBACK_SPEED_KEY, String(speed));
}

export function persistPreservePitch(enabled: boolean) {
  writeStorage(PRESERVE_PITCH_KEY, String(enabled));
}

export function persistPlayerState(state: PersistedPlayerState | PlayerState) {
  const payload: PersistedPlayerState = {
    currentTime: Math.max(0, state.currentTime || 0),
    currentTrack: state.currentTrack ? sanitizeStoredTrack(state.currentTrack) : null,
    duration: state.duration || state.currentTrack?.duration || 0,
    queue: state.queue.map(sanitizeStoredTrack).filter((track): track is Track => Boolean(track)),
    repeat: state.repeat,
    rightPanelTab: state.rightPanelTab,
    showRightPanel: state.showRightPanel,
    shuffle: state.shuffle,
    volume: state.volume,
  };

  writeStorage(PLAYER_STATE_KEY, JSON.stringify(payload));
}
