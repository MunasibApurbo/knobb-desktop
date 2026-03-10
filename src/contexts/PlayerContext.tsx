import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlbumPlaybackTarget,
  AudioQuality,
  PlayerState,
  RightPanelTab,
} from "@/contexts/player/playerTypes";
import {
  createInitialPlayerState,
  persistAutoQualityEnabled,
  persistAudioQuality,
  persistCrossfadeDuration,
  persistEqualizerEnabled,
  persistEqGains,
  persistEqPreset,
  persistMonoAudioEnabled,
  persistNormalization,
  persistPreampDb,
  persistPreservePitch,
  persistPlayerState,
  persistPlaybackSpeed,
} from "@/contexts/player/playerStorage";
import { applyTrackAccent } from "@/contexts/player/playerAppearance";
import {
  getNextQueueIndex,
  getPreviousQueueIndex,
  getQueueTrackIndex,
  removeQueueTrack,
  reorderQueueTracks,
} from "@/contexts/player/playerQueue";
import { useOptionalAuth } from "@/contexts/AuthContext";
import type { AudioEngine } from "@/lib/audioEngine";
import { EQ_PRESETS } from "@/lib/audioEngineShared";
import {
  getPlaybackDeviceId,
  getPlaybackDeviceName,
  removePlaybackSession,
  type PlaybackSessionSnapshot,
  upsertPlaybackSession,
} from "@/lib/playbackSessions";
import { getSupabaseClient, loadAudioEngineModule, loadMusicApiModule, reportClientErrorLazy } from "@/lib/runtimeModules";
import { loadProfilePreferences, persistProfilePreferences } from "@/lib/profilePreferences";
import { getRecoveryQualityOrder, isAudioQuality } from "@/lib/audioQuality";
import { getResolvableTidalId } from "@/lib/trackIdentity";
import { filterPlayableTracks, isTrackPlayable } from "@/lib/trackPlayback";
import { Track } from "@/types/music";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { syncDiscordPresence } from "@/lib/discordPresence";
import { useSettings } from "@/contexts/SettingsContext";
import { showErrorToast, showInfoToast } from "@/lib/toast";

const MEDIA_SESSION_SKIP_SECONDS = 10;
const MEDIA_SESSION_ARTWORK_SIZES = ["96x96", "128x128", "192x192", "256x256", "384x384", "512x512"] as const;
const MEDIA_SESSION_FALLBACK_ARTWORK_URL = "/brand/logo-k-black-square-512.png";
const AUDIO_ERROR_CODE_REGEX = /\(code\s+(\d+)\)/i;
const PLAYER_PROGRESS_RENDER_STEP_SECONDS = 0.25;
const PLAYER_DURATION_RENDER_EPSILON_SECONDS = 0.5;

type PlayerTimelineState = Pick<PlayerState, "currentTime" | "duration">;
type PlayerContextState = Omit<PlayerState, "currentTime" | "duration">;

function getAudioErrorCode(error: string) {
  const match = error.match(AUDIO_ERROR_CODE_REGEX);
  if (!match) return null;

  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

function isAutoQualityEnabled(state: Pick<PlayerState, "autoQualityEnabled">) {
  return state.autoQualityEnabled;
}

function getEqPresetFromGains(gains: number[]) {
  for (const [preset, values] of Object.entries(EQ_PRESETS)) {
    if (values.every((value, index) => Math.abs(value - (gains[index] || 0)) < 0.01)) {
      return preset;
    }
  }

  return "custom";
}

function getTrackMixQueueKey(track: Pick<Track, "id" | "tidalId">) {
  return track.tidalId ? `tidal:${track.tidalId}` : `app:${track.id}`;
}

function getTrackMixId(track: Pick<Track, "mixes">) {
  const mixId = track.mixes?.TRACK_MIX;
  if (mixId === null || mixId === undefined || mixId === "") return null;
  return String(mixId);
}

function getPrimaryArtistName(track: Pick<Track, "artist" | "artists">) {
  const namedArtist = track.artists?.find((artist) => artist.name.trim().length > 0)?.name?.trim();
  if (namedArtist) return namedArtist;

  return track.artist
    .split(",")[0]
    ?.trim() || "";
}

function buildTrackMixQueue(seedTrack: Track, candidateTracks: Track[]) {
  const seen = new Set<string>();
  const queue: Track[] = [];

  for (const track of [seedTrack, ...candidateTracks]) {
    const key = getTrackMixQueueKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(track);
  }

  return queue;
}

interface PlayerContextType extends PlayerContextState {
  play: (track: Track, queue?: Track[]) => void;
  playAlbum: (album: AlbumPlaybackTarget) => Promise<void>;
  addToQueue: (track: Track) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setVolume: (volume: number) => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab: RightPanelTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setAutoQualityEnabled: (enabled: boolean) => void;
  setQuality: (quality: AudioQuality) => void;
  toggleNormalization: () => void;
  toggleEqualizer: () => void;
  setEqBandGain: (bandIndex: number, gainDb: number) => void;
  applyEqPreset: (preset: string) => void;
  resetEqualizer: () => void;
  setPreampDb: (value: number) => void;
  setMonoAudioEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (seconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPreservePitch: (enabled: boolean) => void;
  setSleepTimer: (minutes: number) => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  playArtist: (artistId: number, artistName?: string) => Promise<void>;
  startTrackMix: (track: Track) => Promise<void>;
  restoreRemoteSession: (snapshot: PlaybackSessionSnapshot) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerTimelineContext = createContext<PlayerTimelineState | null>(null);

type SyncedPlayerPreferences = Pick<
  PlayerState,
  | "autoQualityEnabled"
  | "quality"
  | "normalization"
  | "equalizerEnabled"
  | "eqGains"
  | "eqPreset"
  | "preampDb"
  | "monoAudioEnabled"
  | "crossfadeDuration"
  | "playbackSpeed"
  | "preservePitch"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSyncedPlayerPreferences(value: unknown): Partial<SyncedPlayerPreferences> {
  if (!isRecord(value)) return {};

  const eqGains = Array.isArray(value.eqGains) && value.eqGains.every((gain) => typeof gain === "number" && Number.isFinite(gain))
    ? value.eqGains
    : undefined;

  return {
    ...(typeof value.autoQualityEnabled === "boolean" ? { autoQualityEnabled: value.autoQualityEnabled } : {}),
    ...(isAudioQuality(value.quality)
      ? { quality: value.quality }
      : {}),
    ...(typeof value.normalization === "boolean" ? { normalization: value.normalization } : {}),
    ...(typeof value.equalizerEnabled === "boolean" ? { equalizerEnabled: value.equalizerEnabled } : {}),
    ...(eqGains ? { eqGains } : {}),
    ...(typeof value.eqPreset === "string" ? { eqPreset: value.eqPreset } : {}),
    ...(typeof value.preampDb === "number" && Number.isFinite(value.preampDb) ? { preampDb: value.preampDb } : {}),
    ...(typeof value.monoAudioEnabled === "boolean" ? { monoAudioEnabled: value.monoAudioEnabled } : {}),
    ...(typeof value.crossfadeDuration === "number" && Number.isFinite(value.crossfadeDuration)
      ? { crossfadeDuration: value.crossfadeDuration }
      : {}),
    ...(typeof value.playbackSpeed === "number" && Number.isFinite(value.playbackSpeed) ? { playbackSpeed: value.playbackSpeed } : {}),
    ...(typeof value.preservePitch === "boolean" ? { preservePitch: value.preservePitch } : {}),
  };
}

function hasSyncedPlayerPreferences(value: Partial<SyncedPlayerPreferences>) {
  return Object.keys(value).length > 0;
}

function getTrackDisplayTitle(track: Track) {
  return track.title?.trim() || "Unknown Title";
}

function getTrackDisplayArtist(track: Track) {
  const artistNames = track.artists
    ?.map((artist) => artist.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (artistNames && artistNames.length > 0) {
    return artistNames.join(", ");
  }

  return track.artist?.trim() || "Unknown Artist";
}

function getMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return null;
  }

  return navigator.mediaSession;
}

function toAbsoluteUrl(url: string) {
  if (!url) return null;
  if (typeof window === "undefined") return url;

  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function inferMediaArtworkType(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".avif")) return "image/avif";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".svg")) return "image/svg+xml";
    if (pathname.endsWith(".ico")) return "image/x-icon";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  } catch {
    return undefined;
  }

  return undefined;
}

export function buildMediaSessionArtwork(url: string | null | undefined): MediaImage[] | undefined {
  const absoluteUrl = toAbsoluteUrl(url || "");
  if (!absoluteUrl) return undefined;

  const type = inferMediaArtworkType(absoluteUrl);
  const tidalSizedImageMatch = absoluteUrl.match(/^(https?:\/\/[^/]*tidal[^/]*\/images\/.+\/)(\d+x\d+)(\.[a-z0-9]+)$/i);

  if (tidalSizedImageMatch) {
    const [, baseUrl, , extension] = tidalSizedImageMatch;
    return MEDIA_SESSION_ARTWORK_SIZES.map((size) => ({
      src: `${baseUrl}${size}${extension}`,
      sizes: size,
      ...(type ? { type } : {}),
    }));
  }

  const inlineSizeMatch = absoluteUrl.match(/(?:^|\/)(\d+x\d+)\.[a-z0-9]+(?:$|\?)/i);
  return [
    {
      src: absoluteUrl,
      ...(inlineSizeMatch ? { sizes: inlineSizeMatch[1] } : {}),
      ...(type ? { type } : {}),
    },
  ];
}

function updateMediaSessionMetadata(track: Track | null) {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;

  if (!track || typeof MediaMetadata === "undefined") {
    mediaSession.metadata = null;
    return;
  }

  const artwork = buildMediaSessionArtwork(track.coverUrl || MEDIA_SESSION_FALLBACK_ARTWORK_URL);

  mediaSession.metadata = new MediaMetadata({
    title: getTrackDisplayTitle(track),
    artist: getTrackDisplayArtist(track),
    album: track.album?.trim() || "Unknown Album",
    artwork,
  });
}

function updateMediaSessionPlaybackState(isPlaying: boolean, hasCurrentTrack: boolean) {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;

  mediaSession.playbackState = hasCurrentTrack
    ? (isPlaying ? "playing" : "paused")
    : "none";
}

type MediaSessionPositionStateInput = {
  duration: number;
  playbackRate: number;
  position: number;
};

export function buildMediaSessionPositionState(
  position: number,
  duration: number,
  playbackRate: number,
): MediaSessionPositionStateInput | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;

  return {
    duration,
    playbackRate: Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1,
    position: Math.min(Math.max(position, 0), duration),
  };
}

function clearMediaSessionPositionState() {
  const mediaSession = getMediaSession();
  const setPositionState = mediaSession?.setPositionState as ((state?: MediaSessionPositionStateInput) => void) | undefined;
  if (!setPositionState) return;

  try {
    setPositionState();
  } catch {
    // Ignore platform-specific Media Session failures.
  }
}

function updateMediaSessionPositionState(
  position: number,
  duration: number,
  playbackRate: number,
) {
  const mediaSession = getMediaSession();
  if (!mediaSession || typeof mediaSession.setPositionState !== "function") return;

  const nextPositionState = buildMediaSessionPositionState(position, duration, playbackRate);
  if (!nextPositionState) {
    clearMediaSessionPositionState();
    return;
  }

  try {
    mediaSession.setPositionState(nextPositionState);
  } catch {
    // Ignore platform-specific Media Session failures.
  }
}

function shouldCommitPlayerProgressUpdate(
  previous: { currentTime: number; duration: number; isPlaying: boolean; trackId: string | null },
  next: { currentTime: number; duration: number; isPlaying: boolean; trackId: string | null },
) {
  if (previous.trackId !== next.trackId) return true;
  if (previous.isPlaying !== next.isPlaying) return true;
  if (Math.abs(previous.duration - next.duration) >= PLAYER_DURATION_RENDER_EPSILON_SECONDS) return true;
  if (Math.abs(previous.currentTime - next.currentTime) >= PLAYER_PROGRESS_RENDER_STEP_SECONDS) return true;
  if (next.currentTime <= PLAYER_PROGRESS_RENDER_STEP_SECONDS) return true;
  if (next.duration > 0 && next.duration - next.currentTime <= PLAYER_PROGRESS_RENDER_STEP_SECONDS) return true;
  return false;
}

function setMediaSessionActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  const mediaSession = getMediaSession();
  if (!mediaSession || typeof mediaSession.setActionHandler !== "function") return;

  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // Ignore unsupported handlers on browsers with partial Media Session support.
  }
}

function withRightPanelVisibility<State extends Pick<PlayerState, "currentTrack" | "hasPlaybackStarted" | "showRightPanel">>(
  state: State,
  open: boolean,
): State {
  if (state.showRightPanel === open && (Boolean(state.currentTrack) || state.hasPlaybackStarted) === state.hasPlaybackStarted) {
    return state;
  }

  return {
    ...state,
    hasPlaybackStarted: Boolean(state.currentTrack) || state.hasPlaybackStarted,
    showRightPanel: open,
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { discordPresenceEnabled, rightPanelAutoOpen, rightPanelDefaultTab } = useSettings();
  const initialPlayerStateRef = useRef<PlayerState | null>(null);
  if (!initialPlayerStateRef.current) {
    initialPlayerStateRef.current = createInitialPlayerState();
  }

  const [state, setState] = useState<PlayerState>(initialPlayerStateRef.current);
  const [timeline, setTimeline] = useState<PlayerTimelineState>(() => ({
    currentTime: initialPlayerStateRef.current?.currentTime ?? 0,
    duration: initialPlayerStateRef.current?.duration ?? 0,
  }));
  const [engineReadyVersion, setEngineReadyVersion] = useState(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const enginePromiseRef = useRef<Promise<AudioEngine> | null>(null);
  const stateRef = useRef(state);
  const accountSyncReadyRef = useRef(false);
  const lastSyncedPlayerPreferencesRef = useRef<string | null>(null);
  const pendingPlayerSyncTimeoutRef = useRef<number | null>(null);
  const playbackRestoreAttemptedRef = useRef(false);
  const playbackDeviceIdRef = useRef(getPlaybackDeviceId());
  const playbackDeviceNameRef = useRef(getPlaybackDeviceName());
  const syncedPlaybackUserIdRef = useRef<string | null>(null);
  const lastProgressRenderRef = useRef({
    currentTime: timeline.currentTime,
    duration: timeline.duration,
    isPlaying: state.isPlaying,
    trackId: state.currentTrack?.id ?? null,
  });
  const loadAndPlayRef = useRef<(track: Track, options?: { allowQueueFallback?: boolean }) => Promise<void>>(async () => { });
  const audioRecoveryRef = useRef<{
    trackId: string | null;
    attemptedQualities: AudioQuality[];
    active: boolean;
  }>({
    trackId: null,
    attemptedQualities: [],
    active: false,
  });
  stateRef.current = {
    ...state,
    currentTime: timeline.currentTime,
    duration: timeline.duration,
  };
  const syncedPlayerPreferences = useMemo<SyncedPlayerPreferences>(() => ({
    autoQualityEnabled: state.autoQualityEnabled,
    quality: state.quality,
    normalization: state.normalization,
    equalizerEnabled: state.equalizerEnabled,
    eqGains: state.eqGains,
    eqPreset: state.eqPreset,
    preampDb: state.preampDb,
    monoAudioEnabled: state.monoAudioEnabled,
    crossfadeDuration: state.crossfadeDuration,
    playbackSpeed: state.playbackSpeed,
    preservePitch: state.preservePitch,
  }), [
    state.autoQualityEnabled,
    state.crossfadeDuration,
    state.eqGains,
    state.eqPreset,
    state.equalizerEnabled,
    state.monoAudioEnabled,
    state.normalization,
    state.playbackSpeed,
    state.preampDb,
    state.preservePitch,
    state.quality,
  ]);
  const syncedPlayerPreferencesRef = useRef(syncedPlayerPreferences);
  syncedPlayerPreferencesRef.current = syncedPlayerPreferences;

  useEffect(() => {
    lastProgressRenderRef.current = {
      currentTime: timeline.currentTime,
      duration: timeline.duration,
      isPlaying: state.isPlaying,
      trackId: state.currentTrack?.id ?? null,
    };
  }, [timeline.currentTime, timeline.duration, state.currentTrack?.id, state.isPlaying]);

  useEffect(() => {
    if (!user) {
      accountSyncReadyRef.current = false;
      lastSyncedPlayerPreferencesRef.current = null;
      if (pendingPlayerSyncTimeoutRef.current !== null) {
        window.clearTimeout(pendingPlayerSyncTimeoutRef.current);
        pendingPlayerSyncTimeoutRef.current = null;
      }
      return;
    }

    accountSyncReadyRef.current = false;
    let cancelled = false;

    void (async () => {
      const localSnapshot = syncedPlayerPreferencesRef.current;
      const localSnapshotKey = JSON.stringify(localSnapshot);

      try {
        const { data, error } = await loadProfilePreferences(user.id);
        if (cancelled) return;
        if (error) {
          accountSyncReadyRef.current = true;
          return;
        }

        const remotePreferences = parseSyncedPlayerPreferences(data?.player_preferences);
        if (hasSyncedPlayerPreferences(remotePreferences)) {
          const mergedSnapshot = { ...localSnapshot, ...remotePreferences };
          lastSyncedPlayerPreferencesRef.current = JSON.stringify(mergedSnapshot);
          setState((prev) => ({
            ...prev,
            ...remotePreferences,
            eqGains: remotePreferences.eqGains ?? prev.eqGains,
          }));
          if (remotePreferences.autoQualityEnabled !== undefined) {
            persistAutoQualityEnabled(remotePreferences.autoQualityEnabled);
          }
          if (remotePreferences.quality !== undefined) persistAudioQuality(remotePreferences.quality);
          if (remotePreferences.normalization !== undefined) persistNormalization(remotePreferences.normalization);
          if (remotePreferences.equalizerEnabled !== undefined) persistEqualizerEnabled(remotePreferences.equalizerEnabled);
          if (remotePreferences.eqGains !== undefined) persistEqGains(remotePreferences.eqGains);
          if (remotePreferences.eqPreset !== undefined) persistEqPreset(remotePreferences.eqPreset);
          if (remotePreferences.preampDb !== undefined) persistPreampDb(remotePreferences.preampDb);
          if (remotePreferences.monoAudioEnabled !== undefined) persistMonoAudioEnabled(remotePreferences.monoAudioEnabled);
          if (remotePreferences.crossfadeDuration !== undefined) persistCrossfadeDuration(remotePreferences.crossfadeDuration);
          if (remotePreferences.playbackSpeed !== undefined) persistPlaybackSpeed(remotePreferences.playbackSpeed);
          if (remotePreferences.preservePitch !== undefined) persistPreservePitch(remotePreferences.preservePitch);
        } else {
          lastSyncedPlayerPreferencesRef.current = localSnapshotKey;
          await persistProfilePreferences(user.id, { player_preferences: localSnapshot });
        }
      } finally {
        if (!cancelled) {
          accountSyncReadyRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !accountSyncReadyRef.current) return;

    const nextSnapshotKey = JSON.stringify(syncedPlayerPreferences);
    if (lastSyncedPlayerPreferencesRef.current === nextSnapshotKey) return;

    if (pendingPlayerSyncTimeoutRef.current !== null) {
      window.clearTimeout(pendingPlayerSyncTimeoutRef.current);
    }

    pendingPlayerSyncTimeoutRef.current = window.setTimeout(() => {
      pendingPlayerSyncTimeoutRef.current = null;
      lastSyncedPlayerPreferencesRef.current = nextSnapshotKey;
      void persistProfilePreferences(user.id, { player_preferences: syncedPlayerPreferences });
    }, 250);

    return () => {
      if (pendingPlayerSyncTimeoutRef.current !== null) {
        window.clearTimeout(pendingPlayerSyncTimeoutRef.current);
        pendingPlayerSyncTimeoutRef.current = null;
      }
    };
  }, [syncedPlayerPreferences, user]);

  const applyAutoRightPanelPreference = useCallback((prev: PlayerState) => {
    if (rightPanelAutoOpen === "never") {
      return prev;
    }

    const next = withRightPanelVisibility(prev, true);
    return next.rightPanelTab === rightPanelDefaultTab
      ? next
      : { ...next, rightPanelTab: rightPanelDefaultTab };
  }, [rightPanelAutoOpen, rightPanelDefaultTab]);

  useEffect(() => {
    if (rightPanelAutoOpen !== "while-playing") return;

    setState((prev) => {
      if (prev.isPlaying || !prev.showRightPanel) return prev;
      return withRightPanelVisibility(prev, false);
    });
  }, [rightPanelAutoOpen, state.isPlaying]);

  const applyStateToEngine = useCallback((engine: AudioEngine) => {
    const snapshot = stateRef.current;
    engine.setNormalization(snapshot.normalization);
    engine.setEqualizerEnabled(snapshot.equalizerEnabled);
    snapshot.eqGains.forEach((gain, index) => {
      engine.setEqBandGain(index, gain);
    });
    engine.setPreampDb(snapshot.preampDb);
    engine.setMonoAudioEnabled(snapshot.monoAudioEnabled);
    engine.setCrossfadeDuration(snapshot.crossfadeDuration);
    engine.setPlaybackRate(snapshot.playbackSpeed);
    engine.setPreservePitch(snapshot.preservePitch);
    engine.setVolume(snapshot.volume);
  }, []);

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;

    if (!enginePromiseRef.current) {
      enginePromiseRef.current = loadAudioEngineModule()
        .then((module) => {
          const engine = module.getAudioEngine();
          const isFirstReady = engineRef.current === null;
          engineRef.current = engine;
          applyStateToEngine(engine);
          if (isFirstReady) {
            setEngineReadyVersion((version) => version + 1);
          }
          return engine;
        })
        .catch((error) => {
          enginePromiseRef.current = null;
          throw error;
        });
    }

    return enginePromiseRef.current;
  }, [applyStateToEngine]);

  const resetAudioRecovery = useCallback((trackId: string | null = null) => {
    audioRecoveryRef.current = {
      trackId,
      attemptedQualities: [],
      active: false,
    };
  }, []);

  const syncCurrentStatus = useCallback((track: Track) => {
    if (!user) return;

    void getSupabaseClient()
      .then((supabase) =>
        supabase
          .from("current_status")
          .upsert(
            {
              user_id: user.id,
              track_title: track.title || null,
              artist_name: track.artist || null,
              cover_url: track.coverUrl || null,
              track_id: track.id ? String(track.id) : null,
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          ),
      )
      .then(({ error }) => {
        if (!error) return;

        console.error("Failed to update current status", error);
        pushAppDiagnostic({
          level: "warn",
          title: "Status sync is delayed",
          message: "Knobb couldn't update your live listening status right now.",
          source: "player",
          dedupeKey: "current-status-sync-failed",
        });
        void reportClientErrorLazy(error, "player_status_sync_failed");
      })
      .catch((error) => {
        console.error("Failed to update current status", error);
        pushAppDiagnostic({
          level: "warn",
          title: "Status sync is delayed",
          message: "Knobb couldn't update your live listening status right now.",
          source: "player",
          dedupeKey: "current-status-sync-failed",
        });
        void reportClientErrorLazy(error, "player_status_sync_failed");
      });
  }, [user]);

  const clearCurrentStatus = useCallback((userId: string | null | undefined = user?.id) => {
    if (!userId) return;

    void getSupabaseClient()
      .then((supabase) =>
        supabase
          .from("current_status")
          .delete()
          .eq("user_id", userId),
      )
      .then(({ error }) => {
        if (!error) return;

        console.error("Failed to clear current status", error);
        void reportClientErrorLazy(error, "player_status_clear_failed");
      })
      .catch((error) => {
        console.error("Failed to clear current status", error);
        void reportClientErrorLazy(error, "player_status_clear_failed");
      });
  }, [user?.id]);

  const resolvePlaybackSource = useCallback(async (
    track: Track,
    quality: AudioQuality,
    forceRefresh = false,
  ) => {
    let url = forceRefresh
      ? null
      : track.streamUrls?.[quality] || (!track.tidalId ? track.streamUrl : null);
    let type: "direct" | "dash" = forceRefresh ? "direct" : track.streamTypes?.[quality] || "direct";
    const tidalId = getResolvableTidalId(track);

    if (tidalId && (!url || forceRefresh)) {
      const musicApi = await loadMusicApiModule();
      if (forceRefresh) {
        musicApi.invalidateTrackStreamCache(tidalId);
      }
      const source = await musicApi.getPlaybackSource(tidalId, quality);
      if (source) {
        url = source.url;
        type = source.type;
        track.streamUrl = source.url;
        track.streamUrls = {
          ...(track.streamUrls || {}),
          [quality]: source.url,
        };
        track.streamTypes = {
          ...(track.streamTypes || {}),
          [quality]: source.type,
        };
        track.tidalId = tidalId;
      }
    }

    if (!url) return null;

    return {
      url,
      type,
    };
  }, []);

  const handleTrackPlaybackFailure = useCallback(async (
    track: Track,
    error: unknown,
    options: {
      allowQueueFallback?: boolean;
      diagnosticTitle?: string;
      diagnosticMessage?: string;
    } = {},
  ) => {
    const {
      allowQueueFallback = true,
      diagnosticTitle = "Playback failed",
      diagnosticMessage = `Knobb couldn't load "${track.title}" right now.`,
    } = options;

    console.error("Failed to load track:", error);
    pushAppDiagnostic({
      level: "error",
      title: diagnosticTitle,
      message: diagnosticMessage,
      source: "player",
      dedupeKey: `track-load-failed:${track.id}`,
    });
    void reportClientErrorLazy(error, "player_track_load_failed", {
      trackId: track.id,
      title: track.title,
    });

    const currentState = stateRef.current;
    const nextIndex = allowQueueFallback
      ? getNextQueueIndex(currentState.queue, track, currentState.shuffle)
      : null;
    const nextTrack = nextIndex === null ? null : currentState.queue[nextIndex];

    if (nextTrack && nextTrack.id !== track.id) {
      showErrorToast(`"${track.title}" is unavailable right now. Skipping to the next track.`);
      await loadAndPlayRef.current(nextTrack);
      return;
    }

    showErrorToast(`"${track.title}" is unavailable to play right now.`);
    clearCurrentStatus();
    setTimeline({
      currentTime: 0,
      duration: 0,
    });
    setState((prev) => ({
      ...prev,
      currentTrack: null,
      hasPlaybackStarted: false,
      currentTime: 0,
      duration: 0,
      isLoading: false,
      isPlaying: false,
    }));
  }, [clearCurrentStatus]);

  const attemptAudioRecovery = useCallback(async (error: string) => {
    const currentState = stateRef.current;
    const track = currentState.currentTrack;
    if (!track || !isTrackPlayable(track)) {
      return false;
    }

    if (getAudioErrorCode(error) !== 4) {
      return false;
    }

    const recoveryState = audioRecoveryRef.current;
    if (recoveryState.active) {
      return true;
    }

    if (recoveryState.trackId !== track.id) {
      resetAudioRecovery(track.id);
    }

    const recoveryCandidates = getRecoveryQualityOrder(currentState.quality).filter(
      (quality) => !audioRecoveryRef.current.attemptedQualities.includes(quality),
    );
    const orderedCandidates = isAutoQualityEnabled(stateRef.current)
      ? recoveryCandidates
      : recoveryCandidates.slice(0, 1);

    if (orderedCandidates.length === 0) {
      return false;
    }

    audioRecoveryRef.current = {
      trackId: track.id,
      attemptedQualities: audioRecoveryRef.current.attemptedQualities,
      active: true,
    };

    try {
      const engine = await ensureEngine();
      const resumeTime = engine.currentTime || currentState.currentTime || 0;
      for (const nextQuality of orderedCandidates) {
        audioRecoveryRef.current = {
          trackId: track.id,
          attemptedQualities: [...audioRecoveryRef.current.attemptedQualities, nextQuality],
          active: true,
        };

        try {
          const source = await resolvePlaybackSource(track, nextQuality, true);
          if (!source) {
            throw new Error(`No stream URL available for ${nextQuality} recovery`);
          }

          await engine.restore(
            source,
            track.replayGain || 0,
            track.peak || 1,
            resumeTime,
          );
          await engine.play();

          if (engine.paused) {
            throw new Error(`Playback did not start after ${nextQuality} recovery`);
          }

          setState((prev) => ({
            ...prev,
            duration: engine.duration || track.duration || prev.duration,
            isLoading: false,
            isPlaying: true,
          }));
          setTimeline({
            currentTime: engine.currentTime || resumeTime,
            duration: engine.duration || track.duration || currentState.duration,
          });

          if (nextQuality !== currentState.quality) {
            showInfoToast(`"${track.title}" resumed at ${nextQuality.toLowerCase()} quality.`);
          }

          return true;
        } catch (recoveryError) {
          console.warn("Audio recovery attempt failed:", recoveryError);
        }
      }

      return false;
    } finally {
      audioRecoveryRef.current = {
        ...audioRecoveryRef.current,
        active: false,
      };
    }
  }, [ensureEngine, resetAudioRecovery, resolvePlaybackSource]);

  const loadAndPlay = useCallback(async (
    track: Track,
    options: { allowQueueFallback?: boolean } = {},
  ) => {
    resetAudioRecovery(track.id);

    if (!isTrackPlayable(track)) {
      await handleTrackPlaybackFailure(track, new Error("Track is unavailable for playback"), options);
      return;
    }

    setState((prev) => ({
      ...prev,
      currentTrack: track,
      hasPlaybackStarted: true,
      currentTime: 0,
      duration: track.duration,
      isLoading: true,
      isPlaying: false,
    }));
    setTimeline({
      currentTime: 0,
      duration: track.duration,
    });

    const playFromResolvedUrl = async (forceRefresh = false) => {
      const source = await resolvePlaybackSource(track, stateRef.current.quality, forceRefresh);

      if (!source) {
        return false;
      }

      const engine = await ensureEngine();
      await engine.load(source, track.replayGain || 0, track.peak || 1);
      await engine.play();

      if (engine.paused) {
        throw new Error(forceRefresh ? "Playback did not start after stream refresh" : "Playback did not start");
      }

      return true;
    };

    try {
      const started = await playFromResolvedUrl(false);
      if (!started) {
        throw new Error("No stream URL available for track");
      }
      syncCurrentStatus(track);
      return;
    } catch (error) {
      let finalError = error;
      const tidalId = getResolvableTidalId(track);
      if (tidalId) {
        try {
          const refreshed = await playFromResolvedUrl(true);
          if (refreshed) {
            syncCurrentStatus(track);
            return;
          }
        } catch (refreshError) {
          finalError = refreshError;
        }
      }

      await handleTrackPlaybackFailure(track, finalError, options);
    }
  }, [ensureEngine, handleTrackPlaybackFailure, resetAudioRecovery, resolvePlaybackSource, syncCurrentStatus]);

  loadAndPlayRef.current = loadAndPlay;

  const advanceToNext = useCallback(() => {
    const currentState = stateRef.current;
    const nextIndex = getNextQueueIndex(
      currentState.queue,
      currentState.currentTrack,
      currentState.shuffle,
    );

    if (nextIndex === null) return;
    loadAndPlay(currentState.queue[nextIndex]);
  }, [loadAndPlay]);

  const refreshCurrentTrackQuality = useCallback(async (quality: AudioQuality, previousQuality: AudioQuality) => {
    const currentState = stateRef.current;
    const track = currentState.currentTrack;
    if (!track) return;

    const engine = await ensureEngine();
    const resumeTime = engine.currentTime || currentState.currentTime || 0;
    const shouldResume = !engine.paused || currentState.isPlaying;

    try {
      const source = await resolvePlaybackSource(track, quality, true);
      if (!source) {
        throw new Error("No stream URL available for selected quality");
      }

      await engine.restore(
        source,
        track.replayGain || 0,
        track.peak || 1,
        resumeTime,
      );

      if (shouldResume) {
        await engine.play();
      }

      setState((prev) => ({
        ...prev,
        quality,
        duration: engine.duration || track.duration || prev.duration,
        isLoading: false,
        isPlaying: shouldResume && !engine.paused,
      }));
      setTimeline({
        currentTime: engine.currentTime || resumeTime,
        duration: engine.duration || track.duration || currentState.duration,
      });
    } catch (error) {
      console.error("Failed to switch audio quality:", error);
      void reportClientErrorLazy(error, "player_quality_switch_failed", {
        trackId: track.id,
        quality,
      });
      showErrorToast("Couldn't switch audio quality right now.");
      persistAudioQuality(previousQuality);
      setState((prev) => ({
        ...prev,
        quality: previousQuality,
        isLoading: false,
      }));
    }
  }, [ensureEngine, resolvePlaybackSource]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setNormalization(state.normalization);
  }, [engineReadyVersion, state.normalization]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setEqualizerEnabled(state.equalizerEnabled);
  }, [engineReadyVersion, state.equalizerEnabled]);

  useEffect(() => {
    if (!engineRef.current) return;
    state.eqGains.forEach((gain, index) => {
      engineRef.current.setEqBandGain(index, gain);
    });
  }, [engineReadyVersion, state.eqGains]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPreampDb(state.preampDb);
  }, [engineReadyVersion, state.preampDb]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setMonoAudioEnabled(state.monoAudioEnabled);
  }, [engineReadyVersion, state.monoAudioEnabled]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setCrossfadeDuration(state.crossfadeDuration);
  }, [engineReadyVersion, state.crossfadeDuration]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPlaybackRate(state.playbackSpeed);
  }, [engineReadyVersion, state.playbackSpeed]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPreservePitch(state.preservePitch);
  }, [engineReadyVersion, state.preservePitch]);

  useEffect(() => {
    if (!state.sleepTimerEndsAt) return;

    const remainingMs = state.sleepTimerEndsAt - Date.now();
    if (remainingMs <= 0) {
      engineRef.current?.pause();
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        sleepTimerEndsAt: null,
      }));
      showInfoToast("Sleep timer ended. Playback paused.");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      engineRef.current?.pause();
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        sleepTimerEndsAt: null,
      }));
      showInfoToast("Sleep timer ended. Playback paused.");
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [state.sleepTimerEndsAt]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.on("timeupdate", (currentTime: number, duration: number) => {
      const nextDuration = duration || stateRef.current.currentTrack?.duration || 0;
      const nextIsPlaying = !engine.paused;
      const nextTrackId = stateRef.current.currentTrack?.id ?? null;

      stateRef.current = {
        ...stateRef.current,
        currentTime,
        duration: nextDuration,
        isPlaying: nextIsPlaying,
      };

      const nextSnapshot = {
        currentTime,
        duration: nextDuration,
        isPlaying: nextIsPlaying,
        trackId: nextTrackId,
      };

      if (!shouldCommitPlayerProgressUpdate(lastProgressRenderRef.current, nextSnapshot)) {
        return;
      }

      lastProgressRenderRef.current = nextSnapshot;
      setTimeline((prev) => (
        prev.currentTime === currentTime && prev.duration === nextDuration
          ? prev
          : {
            currentTime,
            duration: nextDuration,
          }
      ));

      setState((prev) => {
        if (
          prev.duration === nextDuration &&
          prev.isPlaying === nextIsPlaying
        ) {
          return prev;
        }

        return {
          ...prev,
          duration: nextDuration,
          isPlaying: nextIsPlaying,
        };
      });
    });

    engine.on("ended", () => {
      const currentState = stateRef.current;
      if (currentState.repeat === "one") {
        engine.seek(0);
        void engine.play();
        return;
      }

      if (currentState.queue.length > 0 && currentState.currentTrack) {
        const currentIndex = getQueueTrackIndex(currentState.queue, currentState.currentTrack);
        const hasFollowingTrack = currentIndex >= 0 && currentIndex < currentState.queue.length - 1;

        if (hasFollowingTrack || currentState.repeat === "all" || currentState.shuffle) {
          advanceToNext();
          return;
        }
      }

      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false }));
    });

    engine.on("crossfade", async () => {
      const currentState = stateRef.current;
      if (!currentState.currentTrack || currentState.queue.length === 0) return;

      const currentIndex = getQueueTrackIndex(currentState.queue, currentState.currentTrack);
      if (!currentState.shuffle && currentIndex === currentState.queue.length - 1 && currentState.repeat !== "all") {
        return;
      }

      const nextIndex = getNextQueueIndex(
        currentState.queue,
        currentState.currentTrack,
        currentState.shuffle,
      );
      if (nextIndex === null) return;

      const nextTrack = currentState.queue[nextIndex];
      setTimeline({
        currentTime: 0,
        duration: nextTrack.duration,
      });
      setState((prev) => ({
        ...prev,
        currentTrack: nextTrack,
        currentTime: 0,
        duration: nextTrack.duration,
      }));

      const source = await resolvePlaybackSource(nextTrack, currentState.quality);
      if (!source) return;

      await engine.crossfadeInto(source, nextTrack.replayGain || 0, nextTrack.peak || 1);
    });

    engine.on("play", () => {
      const currentTrack = stateRef.current.currentTrack;
      if (currentTrack) {
        syncCurrentStatus(currentTrack);
      }
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    });

    engine.on("pause", () => {
      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false }));
    });

    engine.on("error", (error: string) => {
      void (async () => {
        const recovered = await attemptAudioRecovery(error);
        if (recovered) {
          return;
        }

        console.error("Audio engine error:", error);
        pushAppDiagnostic({
          level: "error",
          title: "Audio engine hit an error",
          message: error,
          source: "player",
          dedupeKey: `audio-engine:${error}`,
        });
        void reportClientErrorLazy(error, "audio_engine_error");

        const currentTrack = stateRef.current.currentTrack;
        if (currentTrack) {
          await handleTrackPlaybackFailure(currentTrack, error, {
            diagnosticTitle: "Audio engine hit an error",
            diagnosticMessage: error,
          });
          return;
        }

        setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
      })();
    });

    engine.on("loadstart", () => {
      setState((prev) => ({ ...prev, isLoading: true }));
    });

    engine.on("canplay", () => {
      setState((prev) => ({ ...prev, isLoading: false }));
    });

    return () => { };
  }, [advanceToNext, attemptAudioRecovery, clearCurrentStatus, engineReadyVersion, handleTrackPlaybackFailure, resolvePlaybackSource, syncCurrentStatus]);

  useEffect(() => {
    resetAudioRecovery(state.currentTrack?.id ?? null);
  }, [resetAudioRecovery, state.currentTrack?.id]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setVolume(state.volume);
  }, [engineReadyVersion, state.volume]);

  useEffect(() => applyTrackAccent(state.currentTrack), [state.currentTrack]);

  useEffect(() => {
    updateMediaSessionMetadata(state.currentTrack);
  }, [state.currentTrack]);

  useEffect(() => {
    updateMediaSessionPlaybackState(state.isPlaying, Boolean(state.currentTrack));
  }, [state.currentTrack, state.isPlaying]);

  useEffect(() => {
    if (!state.currentTrack) {
      clearMediaSessionPositionState();
      return;
    }

    updateMediaSessionPositionState(
      timeline.currentTime,
      timeline.duration || state.currentTrack.duration,
      state.playbackSpeed,
    );
  }, [timeline.currentTime, timeline.duration, state.currentTrack, state.isPlaying, state.playbackSpeed]);

  const discordPresenceTimeBucket = Math.floor(timeline.currentTime / 15);

  useEffect(() => {
    void syncDiscordPresence({
      enabled: discordPresenceEnabled,
      track: state.currentTrack,
      isPlaying: state.isPlaying,
      currentTime: stateRef.current.currentTime,
      duration: state.duration || state.currentTrack?.duration || 0,
    }).catch((error) => {
      console.error("Failed to sync Discord presence", error);
    });
  }, [
    discordPresenceEnabled,
    state.currentTrack,
    state.currentTrack?.id,
    state.isPlaying,
    discordPresenceTimeBucket,
    state.duration,
  ]);

  useEffect(() => {
    persistPlayerState({
      currentTime: stateRef.current.currentTime,
      currentTrack: state.currentTrack,
      duration: state.duration,
      queue: state.queue,
      repeat: state.repeat,
      rightPanelTab: state.rightPanelTab,
      showRightPanel: state.showRightPanel,
      shuffle: state.shuffle,
      volume: state.volume,
    });
  }, [
    state.currentTrack,
    state.duration,
    state.queue,
    state.repeat,
    state.rightPanelTab,
    state.showRightPanel,
    state.shuffle,
    state.volume,
  ]);

  useEffect(() => {
    if (!state.currentTrack) return;

    const intervalId = window.setInterval(() => {
      persistPlayerState(stateRef.current);
    }, 2000);

    const flushState = () => {
      persistPlayerState(stateRef.current);
    };

    window.addEventListener("pagehide", flushState);
    window.addEventListener("beforeunload", flushState);
    document.addEventListener("visibilitychange", flushState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", flushState);
      window.removeEventListener("beforeunload", flushState);
      document.removeEventListener("visibilitychange", flushState);
      flushState();
    };
  }, [state.currentTrack]);

  useEffect(() => {
    if (playbackRestoreAttemptedRef.current) return;
    playbackRestoreAttemptedRef.current = true;

    const restoredTrack = stateRef.current.currentTrack;
    if (!restoredTrack) return;

    void (async () => {
      try {
        const engine = await ensureEngine();
        const source = await resolvePlaybackSource(restoredTrack, stateRef.current.quality);

        if (!source) return;

        await engine.restore(
          source,
          restoredTrack.replayGain || 0,
          restoredTrack.peak || 1,
          stateRef.current.currentTime,
        );
      } catch (error) {
        console.error("Failed to restore playback session:", error);
        void reportClientErrorLazy(error, "player_restore_failed");
      }
    })();
  }, [ensureEngine, resolvePlaybackSource]);

  const restoreRemoteSession = useCallback(async (snapshot: PlaybackSessionSnapshot) => {
    const previousState = stateRef.current;
    const previousQuality = previousState.quality;
    const previousTrack = previousState.currentTrack;
    const previousTime = engineRef.current?.currentTime || previousState.currentTime || 0;
    const previousWasPlaying = previousState.isPlaying;
    const requestedQueue = filterPlayableTracks(snapshot.queue);
    const preferredTrack = snapshot.currentTrack && isTrackPlayable(snapshot.currentTrack)
      ? snapshot.currentTrack
      : null;
    const currentTrack = preferredTrack || requestedQueue[0] || null;

    if (!currentTrack) {
      throw new Error("Remote session has no playable track.");
    }

    const queue = requestedQueue.some((track) => track.id === currentTrack.id)
      ? requestedQueue
      : [currentTrack, ...requestedQueue];
    const resumeTime = Math.max(0, snapshot.currentTime || 0);
    const nextQuality = snapshot.quality || stateRef.current.quality;
    const initialDuration = snapshot.duration || currentTrack.duration || previousState.duration;

    setState((prev) => ({
      ...applyAutoRightPanelPreference(prev),
      currentTrack,
      queue,
      currentTime: resumeTime,
      duration: snapshot.duration || currentTrack.duration || prev.duration,
      hasPlaybackStarted: true,
      isLoading: true,
      isPlaying: false,
      quality: nextQuality,
    }));
    setTimeline({
      currentTime: resumeTime,
      duration: initialDuration,
    });

    try {
      const engine = await ensureEngine();
      const source = await resolvePlaybackSource(currentTrack, nextQuality);
      if (!source) {
        throw new Error("No stream URL available for the selected remote track");
      }

      await engine.restore(
        source,
        currentTrack.replayGain || 0,
        currentTrack.peak || 1,
        resumeTime,
      );

      if (snapshot.isPlaying) {
        await engine.play();
      } else {
        engine.pause();
      }

      persistAudioQuality(nextQuality);
      if (snapshot.isPlaying) {
        syncCurrentStatus(currentTrack);
      } else {
        clearCurrentStatus();
      }
      setState((prev) => ({
        ...applyAutoRightPanelPreference(prev),
        currentTrack,
        queue,
        duration: engine.duration || snapshot.duration || currentTrack.duration || prev.duration,
        hasPlaybackStarted: true,
        isLoading: false,
        isPlaying: snapshot.isPlaying && !engine.paused,
        quality: nextQuality,
      }));
      setTimeline({
        currentTime: engine.currentTime || resumeTime,
        duration: engine.duration || snapshot.duration || currentTrack.duration || initialDuration,
      });
    } catch (error) {
      console.error("Failed to restore remote session:", error);
      void reportClientErrorLazy(error, "player_remote_restore_failed", {
        trackId: currentTrack.id,
      });

      persistAudioQuality(previousQuality);

      try {
        const engine = await ensureEngine();
        if (previousTrack) {
          const previousSource = await resolvePlaybackSource(previousTrack, previousQuality);
          if (previousSource) {
            await engine.restore(
              previousSource,
              previousTrack.replayGain || 0,
              previousTrack.peak || 1,
              previousTime,
            );

            if (previousWasPlaying) {
              await engine.play();
            } else {
              engine.pause();
            }
          } else {
            engine.pause();
          }
        } else {
          engine.pause();
        }
      } catch (rollbackError) {
        console.error("Failed to roll back remote session restore:", rollbackError);
        void reportClientErrorLazy(rollbackError, "player_remote_restore_rollback_failed", {
          trackId: previousTrack?.id || null,
        });
      }

      if (previousTrack && previousWasPlaying) {
        syncCurrentStatus(previousTrack);
      } else {
        clearCurrentStatus();
      }

      setTimeline({
        currentTime: previousTime,
        duration: previousState.duration,
      });
      setState(previousState);
      throw error;
    }
  }, [applyAutoRightPanelPreference, clearCurrentStatus, ensureEngine, resolvePlaybackSource, syncCurrentStatus]);

  const syncPlaybackSessionState = useCallback(() => {
    if (!user) return Promise.resolve();

    return upsertPlaybackSession({
      userId: user.id,
      deviceId: playbackDeviceIdRef.current,
      deviceName: playbackDeviceNameRef.current,
      currentTrack: stateRef.current.currentTrack,
      queue: stateRef.current.queue,
      currentTime: stateRef.current.currentTime,
      duration: stateRef.current.duration,
      isPlaying: stateRef.current.isPlaying,
      quality: stateRef.current.quality,
    });
  }, [user]);

  const play = useCallback((track: Track, queue?: Track[]) => {
    const nextQueue = queue ? filterPlayableTracks(queue) : undefined;
    const nextTrack = isTrackPlayable(track) ? track : nextQueue?.[0];

    if (!nextTrack) {
      setState((prev) => ({
        ...prev,
        queue: nextQueue ?? prev.queue,
        isLoading: false,
      }));
      if (!isTrackPlayable(track)) {
        showErrorToast(`"${track.title}" is unavailable to play right now.`);
      }
      return;
    }

    setState((prev) => ({
      ...applyAutoRightPanelPreference(prev),
      hasPlaybackStarted: true,
      ...(nextQueue ? { queue: nextQueue } : {}),
    }));
    void loadAndPlay(nextTrack);
  }, [applyAutoRightPanelPreference, loadAndPlay]);

  const playAlbum = useCallback(async (album: AlbumPlaybackTarget) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const musicApi = await loadMusicApiModule();
      const isTidal = typeof album.id === "string" ? album.id.startsWith("tidal-") : true;
      const tidalId = isTidal
        ? Number.parseInt(String(album.id).replace("tidal-", ""), 10)
        : Number(album.id);

      const { tracks } = await musicApi.getAlbumWithTracks(tidalId);
      const knownArtist = album.artists?.map((artist) => artist.name).join(", ") || album.artist?.name || "";
      let finalTracks = tracks;

      if (finalTracks.length === 0 && album.title) {
        finalTracks = await musicApi.searchAlbumTracksByName(album.title, knownArtist);
      }

      const appTracks = finalTracks.length > 0
        ? filterPlayableTracks(finalTracks.map((track) => musicApi.tidalTrackToAppTrack(track)))
        : [];

      if (appTracks.length > 0) {
        play(appTracks[0], appTracks);
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to play album:", error);
      pushAppDiagnostic({
        level: "warn",
        title: "Album playback is unavailable",
        message: "Knobb couldn't load this album's tracks right now.",
        source: "player",
        dedupeKey: "play-album-failed",
      });
      void reportClientErrorLazy(error, "player_album_play_failed", { albumId: album.id });
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [play]);

  const playArtist = useCallback(async (artistId: number, artistName?: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const musicApi = await loadMusicApiModule();
      const tracks = await musicApi.getArtistPopularTracks(artistId, 50);
      const appTracks = filterPlayableTracks(tracks.map((track) => musicApi.tidalTrackToAppTrack(track)));

      if (appTracks.length > 0) {
        play(appTracks[0], appTracks);
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to play artist:", error);
      pushAppDiagnostic({
        level: "warn",
        title: "Artist playback is unavailable",
        message: artistName
          ? `Knobb couldn't load tracks for ${artistName} right now.`
          : "Knobb couldn't load this artist's popular tracks right now.",
        source: "player",
        dedupeKey: `play-artist-failed:${artistId}`,
      });
      void reportClientErrorLazy(error, "player_artist_play_failed", { artistId });
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [play]);

  const startTrackMix = useCallback(async (track: Track) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const startQueue = (tracks: Track[]) => {
      const queue = buildTrackMixQueue(track, tracks);
      if (queue.length < 2) return false;
      play(queue[0], queue);
      return true;
    };

    try {
      const musicApi = await loadMusicApiModule();
      const trackMixId = getTrackMixId(track);
      if (trackMixId) {
        const mixTracks = filterPlayableTracks(
          (await musicApi.getMixWithTracks(trackMixId)).map((item) => musicApi.tidalTrackToAppTrack(item)),
        );
        if (startQueue(mixTracks)) return;
      }

      const tidalId = getResolvableTidalId(track);
      if (tidalId) {
        const recommendationTracks = filterPlayableTracks(
          (await musicApi.getRecommendations(tidalId)).map((item) => musicApi.tidalTrackToAppTrack(item)),
        );
        if (startQueue(recommendationTracks)) return;
      }

      const primaryArtistName = getPrimaryArtistName(track);
      let resolvedArtistId = track.artistId ?? null;

      if (!resolvedArtistId && primaryArtistName) {
        const artistResults = await musicApi.searchArtists(primaryArtistName, 8).catch(() => []);
        const normalizedArtistName = primaryArtistName.toLowerCase();
        const match =
          artistResults.find((artist) => artist.name.trim().toLowerCase() === normalizedArtistName) ||
          artistResults.find((artist) => artist.name.trim().toLowerCase().includes(normalizedArtistName)) ||
          artistResults[0];
        resolvedArtistId = match?.id ?? null;
      }

      if (resolvedArtistId) {
        await playArtist(resolvedArtistId, primaryArtistName);
        return;
      }

      showErrorToast("Mix unavailable for this track");
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error("Failed to start track mix:", error);
      pushAppDiagnostic({
        level: "warn",
        title: "Track mix is unavailable",
        message: `Knobb couldn't start a mix from "${track.title}" right now.`,
        source: "player",
        dedupeKey: `track-mix-failed:${track.id}`,
      });
      void reportClientErrorLazy(error, "player_track_mix_failed", {
        trackId: track.id,
        tidalId: track.tidalId,
      });
      showErrorToast("Couldn't start a mix for this track");
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [play, playArtist]);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) {
      return;
    }

    void (async () => {
      const engine = await ensureEngine();

      if (engine.paused) {
        setState((prev) => (
          prev.hasPlaybackStarted
            ? prev
            : { ...prev, hasPlaybackStarted: Boolean(prev.currentTrack) }
        ));
        if (stateRef.current.currentTrack && engine.duration <= 0) {
          await loadAndPlay(stateRef.current.currentTrack, { allowQueueFallback: false });
          return;
        }
        await engine.play().catch(async () => {
          if (stateRef.current.currentTrack) {
            await loadAndPlay(stateRef.current.currentTrack, { allowQueueFallback: false });
          }
        });
        return;
      }

      engine.pause();
    })();
  }, [ensureEngine, loadAndPlay]);

  const next = useCallback(() => {
    if (!stateRef.current.hasPlaybackStarted && stateRef.current.currentTrack) {
      setState((prev) => ({ ...prev, hasPlaybackStarted: true }));
    }
    advanceToNext();
  }, [advanceToNext]);

  const addToQueue = useCallback((track: Track) => {
    setState((prev) => {
      if (!prev.currentTrack && prev.queue.length === 0) {
        return { ...prev, queue: [track] };
      }

      if (!prev.currentTrack) {
        return { ...prev, queue: [...prev.queue, track] };
      }

      const currentIndex = getQueueTrackIndex(prev.queue, prev.currentTrack);
      if (currentIndex >= 0) {
        const nextQueue = [...prev.queue];
        nextQueue.splice(currentIndex + 1, 0, track);
        return { ...prev, queue: nextQueue };
      }

      return { ...prev, queue: [prev.currentTrack, track, ...prev.queue] };
    });
  }, []);

  const previous = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState.currentTrack || currentState.queue.length === 0) return;

    if (!currentState.hasPlaybackStarted) {
      setState((prev) => ({ ...prev, hasPlaybackStarted: true }));
    }

    if ((engineRef.current?.currentTime || 0) > 3) {
      engineRef.current?.seek(0);
      return;
    }

    const previousIndex = getPreviousQueueIndex(currentState.queue, currentState.currentTrack);
    if (previousIndex === null) return;
    void loadAndPlay(currentState.queue[previousIndex]);
  }, [loadAndPlay]);

  const seek = useCallback((time: number) => {
    const currentDuration = engineRef.current?.duration
      || stateRef.current.duration
      || stateRef.current.currentTrack?.duration
      || 0;
    const nextTime = Number.isFinite(time)
      ? Math.min(Math.max(time, 0), currentDuration > 0 ? currentDuration : time)
      : 0;

    engineRef.current?.seek(nextTime);
    setTimeline((prev) => ({
      currentTime: nextTime,
      duration: prev.duration,
    }));
    setState((prev) => ({ ...prev, currentTime: nextTime }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  }, []);

  const setRightPanelOpen = useCallback((open: boolean) => {
    setState((prev) => withRightPanelVisibility(prev, open));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState((prev) => withRightPanelVisibility(prev, !prev.showRightPanel));
  }, []);

  const openRightPanel = useCallback((tab: RightPanelTab) => {
    setState((prev) => {
      if (prev.showRightPanel && prev.rightPanelTab === tab) {
        return withRightPanelVisibility(prev, false);
      }

      const next = withRightPanelVisibility(prev, true);
      return next.rightPanelTab === tab
        ? next
        : { ...next, rightPanelTab: tab };
    });
  }, []);

  const setRightPanelTab = useCallback((tab: RightPanelTab) => {
    setState((prev) => (
      prev.rightPanelTab === tab
        ? prev
        : { ...prev, rightPanelTab: tab }
    ));
  }, []);

  const setQuality = useCallback((quality: AudioQuality) => {
    const previousQuality = stateRef.current.quality;
    if (previousQuality === quality) return;

    persistAudioQuality(quality);
    setState((prev) => ({
      ...prev,
      quality,
      isLoading: prev.currentTrack ? true : prev.isLoading,
    }));

    if (stateRef.current.currentTrack) {
      void refreshCurrentTrackQuality(quality, previousQuality);
    }
  }, [refreshCurrentTrackQuality]);

  const setAutoQualityEnabled = useCallback((enabled: boolean) => {
    persistAutoQualityEnabled(enabled);
    setState((prev) => ({ ...prev, autoQualityEnabled: enabled }));
  }, []);

  const toggleNormalization = useCallback(() => {
    setState((prev) => {
      const nextValue = !prev.normalization;
      persistNormalization(nextValue);
      return { ...prev, normalization: nextValue };
    });
  }, []);

  const toggleEqualizer = useCallback(() => {
    setState((prev) => {
      const nextValue = !prev.equalizerEnabled;
      persistEqualizerEnabled(nextValue);
      return { ...prev, equalizerEnabled: nextValue };
    });
  }, []);

  const setEqBandGain = useCallback((bandIndex: number, gainDb: number) => {
    setState((prev) => {
      const nextGains = [...prev.eqGains];
      nextGains[bandIndex] = gainDb;
      const nextPreset = getEqPresetFromGains(nextGains);
      persistEqGains(nextGains);
      persistEqPreset(nextPreset);
      engineRef.current?.setEqBandGain(bandIndex, gainDb);
      return { ...prev, eqGains: nextGains, eqPreset: nextPreset };
    });
  }, []);

  const applyEqPreset = useCallback((preset: string) => {
    const presetGains = EQ_PRESETS[preset as keyof typeof EQ_PRESETS];
    if (!presetGains) return;

    persistEqualizerEnabled(true);
    persistEqPreset(preset);
    persistEqGains([...presetGains]);
    setState((prev) => ({
      ...prev,
      equalizerEnabled: true,
      eqPreset: preset,
      eqGains: [...presetGains],
    }));
  }, []);

  const resetEqualizer = useCallback(() => {
    const flatGains = [...EQ_PRESETS.flat];
    persistEqualizerEnabled(false);
    persistEqPreset("flat");
    persistEqGains(flatGains);
    persistPreampDb(0);
    setState((prev) => ({
      ...prev,
      equalizerEnabled: false,
      eqPreset: "flat",
      eqGains: flatGains,
      preampDb: 0,
    }));
  }, []);

  const setPreampDb = useCallback((value: number) => {
    const nextValue = Math.max(-20, Math.min(20, value));
    persistPreampDb(nextValue);
    setState((prev) => ({ ...prev, preampDb: nextValue }));
    engineRef.current?.setPreampDb(nextValue);
  }, []);

  const setMonoAudioEnabled = useCallback((enabled: boolean) => {
    persistMonoAudioEnabled(enabled);
    setState((prev) => ({ ...prev, monoAudioEnabled: enabled }));
    engineRef.current?.setMonoAudioEnabled(enabled);
  }, []);

  const setCrossfadeDuration = useCallback((seconds: number) => {
    persistCrossfadeDuration(seconds);
    setState((prev) => ({ ...prev, crossfadeDuration: seconds }));
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    persistPlaybackSpeed(speed);
    setState((prev) => ({ ...prev, playbackSpeed: speed }));
    engineRef.current?.setPlaybackRate(speed);
  }, []);

  const setPreservePitch = useCallback((enabled: boolean) => {
    persistPreservePitch(enabled);
    setState((prev) => ({ ...prev, preservePitch: enabled }));
    engineRef.current?.setPreservePitch(enabled);
  }, []);

  const setSleepTimer = useCallback((minutes: number) => {
    const normalizedMinutes = Math.max(0, Math.round(minutes));
    setState((prev) => ({
      ...prev,
      sleepTimerEndsAt: normalizedMinutes > 0 ? Date.now() + normalizedMinutes * 60 * 1000 : null,
    }));
  }, []);

  const reorderQueue = useCallback((from: number, to: number) => {
    setState((prev) => ({ ...prev, queue: reorderQueueTracks(prev.queue, from, to) }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => ({ ...prev, queue: removeQueueTrack(prev.queue, index) }));
  }, []);

  useEffect(() => {
    const previousUserId = syncedPlaybackUserIdRef.current;
    const currentUserId = user?.id ?? null;

    if (previousUserId && previousUserId !== currentUserId) {
      clearCurrentStatus(previousUserId);
      void removePlaybackSession(previousUserId, playbackDeviceIdRef.current).catch(() => undefined);
    }

    syncedPlaybackUserIdRef.current = currentUserId;
  }, [clearCurrentStatus, user?.id]);

  useEffect(() => {
    if (!user) return;
    void syncPlaybackSessionState().catch((error) => {
      console.error("Failed to sync playback session", error);
    });

    const intervalId = window.setInterval(() => {
      void syncPlaybackSessionState().catch((error) => {
        console.error("Failed to sync playback session", error);
      });
    }, 15000);

    const handleVisibilityChange = () => {
      void syncPlaybackSessionState().catch(() => undefined);
    };

    const handlePageHide = () => {
      void removePlaybackSession(user.id, playbackDeviceIdRef.current).catch(() => undefined);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [syncPlaybackSessionState, user]);

  useEffect(() => {
    if (!user) return;

    const timeoutId = window.setTimeout(() => {
      void syncPlaybackSessionState().catch(() => undefined);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [
    state.currentTrack?.id,
    state.isPlaying,
    state.quality,
    state.queue,
    syncPlaybackSessionState,
    user,
  ]);

  useEffect(() => {
    const handlePlay = () => {
      if (!(engineRef.current?.paused ?? true) || stateRef.current.currentTrack) {
        togglePlay();
      }
    };
    const handlePause = () => {
      if (!(engineRef.current?.paused ?? true)) {
        togglePlay();
      }
    };
    const handleSeekBackward = (details?: MediaSessionActionDetails) => {
      seek(Math.max(0, (engineRef.current?.currentTime || 0) - (details?.seekOffset || MEDIA_SESSION_SKIP_SECONDS)));
    };
    const handleSeekForward = (details?: MediaSessionActionDetails) => {
      const duration = engineRef.current?.duration || stateRef.current.duration || 0;
      const nextTime = (engineRef.current?.currentTime || 0) + (details?.seekOffset || MEDIA_SESSION_SKIP_SECONDS);
      seek(duration > 0 ? Math.min(duration, nextTime) : nextTime);
    };
    const handleSeekTo = (details?: MediaSessionActionDetails) => {
      if (typeof details?.seekTime !== "number") return;
      seek(details.seekTime);
    };
    const handleStop = () => {
      engineRef.current?.pause();
      seek(0);
    };

    setMediaSessionActionHandler("play", handlePlay);
    setMediaSessionActionHandler("pause", handlePause);
    setMediaSessionActionHandler("previoustrack", previous);
    setMediaSessionActionHandler("nexttrack", next);
    setMediaSessionActionHandler("seekbackward", handleSeekBackward);
    setMediaSessionActionHandler("seekforward", handleSeekForward);
    setMediaSessionActionHandler("seekto", handleSeekTo);
    setMediaSessionActionHandler("stop", handleStop);

    return () => {
      setMediaSessionActionHandler("play", null);
      setMediaSessionActionHandler("pause", null);
      setMediaSessionActionHandler("previoustrack", null);
      setMediaSessionActionHandler("nexttrack", null);
      setMediaSessionActionHandler("seekbackward", null);
      setMediaSessionActionHandler("seekforward", null);
      setMediaSessionActionHandler("seekto", null);
      setMediaSessionActionHandler("stop", null);
    };
  }, [next, previous, seek, togglePlay]);

  const contextValue = useMemo<PlayerContextType>(() => ({
    currentTrack: state.currentTrack,
    hasPlaybackStarted: state.hasPlaybackStarted,
    isPlaying: state.isPlaying,
    queue: state.queue,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    showRightPanel: state.showRightPanel,
    rightPanelTab: state.rightPanelTab,
    isLoading: state.isLoading,
    autoQualityEnabled: state.autoQualityEnabled,
    quality: state.quality,
    normalization: state.normalization,
    equalizerEnabled: state.equalizerEnabled,
    eqGains: state.eqGains,
    eqPreset: state.eqPreset,
    preampDb: state.preampDb,
    monoAudioEnabled: state.monoAudioEnabled,
    crossfadeDuration: state.crossfadeDuration,
    playbackSpeed: state.playbackSpeed,
    preservePitch: state.preservePitch,
    sleepTimerEndsAt: state.sleepTimerEndsAt,
    play,
    playAlbum,
    addToQueue,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    toggleRightPanel,
    openRightPanel,
    setRightPanelOpen,
    setRightPanelTab,
    setAutoQualityEnabled,
    setQuality,
    toggleNormalization,
    toggleEqualizer,
    setEqBandGain,
    applyEqPreset,
    resetEqualizer,
    setPreampDb,
    setMonoAudioEnabled,
    setCrossfadeDuration,
    setPlaybackSpeed,
    setPreservePitch,
    setSleepTimer,
    reorderQueue,
    removeFromQueue,
    playArtist,
    startTrackMix,
    restoreRemoteSession,
  }), [
    addToQueue,
    applyEqPreset,
    next,
    openRightPanel,
    play,
    playAlbum,
    playArtist,
    previous,
    removeFromQueue,
    reorderQueue,
    resetEqualizer,
    restoreRemoteSession,
    seek,
    state.autoQualityEnabled,
    state.crossfadeDuration,
    state.currentTrack,
    state.eqGains,
    state.eqPreset,
    state.equalizerEnabled,
    state.hasPlaybackStarted,
    state.isLoading,
    state.isPlaying,
    state.monoAudioEnabled,
    state.normalization,
    state.playbackSpeed,
    state.preampDb,
    state.preservePitch,
    state.quality,
    state.queue,
    state.repeat,
    state.rightPanelTab,
    state.showRightPanel,
    state.shuffle,
    state.sleepTimerEndsAt,
    state.volume,
    setCrossfadeDuration,
    setEqBandGain,
    setMonoAudioEnabled,
    setAutoQualityEnabled,
    setPlaybackSpeed,
    setPreampDb,
    setPreservePitch,
    setQuality,
    setRightPanelOpen,
    setRightPanelTab,
    setSleepTimer,
    setVolume,
    startTrackMix,
    toggleEqualizer,
    toggleNormalization,
    togglePlay,
    toggleRepeat,
    toggleRightPanel,
    toggleShuffle,
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
      <PlayerTimelineContext.Provider value={timeline}>
        {children}
      </PlayerTimelineContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}

export function usePlayerTimeline() {
  const context = useContext(PlayerTimelineContext);
  if (!context) throw new Error("usePlayerTimeline must be used inside PlayerProvider");
  return context;
}
