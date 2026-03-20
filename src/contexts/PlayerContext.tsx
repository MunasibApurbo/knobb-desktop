import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlbumPlaybackTarget,
  AudioQuality,
  PlaybackMode,
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
import type { PlaybackSource as AudioPlaybackSource } from "@/lib/audioEngineShared";
import {
  getPlaybackDeviceId,
  getPlaybackDeviceName,
  removePlaybackSession,
  type PlaybackSessionSnapshot,
  upsertPlaybackSession,
} from "@/lib/playbackSessions";
import {
  getSupabaseClient,
  loadAudioEngineModule,
  loadMusicApiModule,
  loadYoutubeMusicApiModule,
  reportClientErrorLazy,
  reportClientEventLazy,
} from "@/lib/runtimeModules";
import { loadProfilePreferences, persistProfilePreferences } from "@/lib/profilePreferences";
import {
  getEffectivePlaybackQuality,
  getAudioQualityTierFromResolvedLabel,
  getHighestResolvedAudioQuality,
  getPlayableAudioQualityForTrack,
  getRecoveryQualityOrderForSource,
  isAudioQuality,
} from "@/lib/audioQuality";
import { getResolvableTidalId } from "@/lib/trackIdentity";
import { filterPlayableTracks, isTrackPlayable } from "@/lib/trackPlayback";
import { Track } from "@/types/music";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { subscribeToDiscordPresenceBridge, syncDiscordPresence } from "@/lib/discordPresence";
import { subscribeToDiscordWebhookSettings, syncDiscordWebhookPresence } from "@/lib/discordWebhookPresence";
import { useSettings } from "@/contexts/SettingsContext";
import { showErrorToast, showInfoToast } from "@/lib/toast";
import { buildTrackKey, getTrackSource, getTrackSourceId } from "@/lib/librarySources";
import { primeMediaPlayback } from "@/lib/mediaPlaybackPrimer";
import { warmPlaybackOrigin } from "@/lib/playbackWarmup";
import { readStartupPerformanceBudget } from "@/lib/performanceProfile";
import { getMediaSessionTrackArtworkUrl, getTrackArtworkUrl } from "@/lib/trackArtwork";
import {
  formatResolvedVideoQuality,
  getVideoQualityPreference,
  type VideoQualityPreference,
} from "@/lib/videoPlaybackPreferences";
import { getYoutubeEmbedManager } from "@/lib/youtubeEmbedManager";
import { isPublishedRuntimeHost } from "@/lib/playbackEnvironment";

const MEDIA_SESSION_SKIP_SECONDS = 10;
const MEDIA_SESSION_ARTWORK_SIZES = ["96x96", "128x128", "192x192", "256x256", "384x384", "512x512"] as const;
const MEDIA_SESSION_FALLBACK_ARTWORK_URL = "/brand/logo-k-black-square-512.png";
const AUDIO_ERROR_CODE_REGEX = /\(code\s+(\d+)\)/i;
// Keep playback UI responsive without pushing React updates on every engine tick.
const PLAYER_PROGRESS_RENDER_STEP_SECONDS = 0.25;
const PLAYER_DURATION_RENDER_EPSILON_SECONDS = 0.5;
const PLAYER_BACKWARD_PROGRESS_TOLERANCE_SECONDS = 0.35;
const PENDING_SEEK_TIMEOUT_MS = 4000;
const PENDING_SEEK_TOLERANCE_SECONDS = 1.5;
const PLAYBACK_INTERRUPTION_RECOVERY_DELAY_MS = 2500;
const PLAYBACK_INTERRUPTION_HEALTH_WINDOW_MS = 15_000;
const PLAYBACK_INTERRUPTION_HEALTH_THRESHOLD = 3;
const PLAYBACK_INTERRUPTION_HEALTH_REPORT_COOLDOWN_MS = 30_000;
const UNEXPECTED_PAUSE_RECOVERY_DELAY_MS = 120;
const EXPECTED_PAUSE_GRACE_WINDOW_MS = 1500;
const AUTO_SKIP_ON_PLAYBACK_FAILURE = false;
const TIDAL_STREAMING_OUTAGE_TTL_MS = 3 * 60_000;
const TIDAL_STREAMING_OUTAGE_STORAGE_KEY = "knobb-tidal-streaming-outage";
const TIDAL_VIDEO_PLAYBACK_PREFERENCE: VideoQualityPreference = "1080p";
const TIDAL_PRIMARY_RESOLUTION_HEAD_START_MS = 350;
const PLAYBACK_SOURCE_RESOLUTION_CACHE_TTL_MS = 20_000;
let mediaSessionArtworkRequestId = 0;
type PendingSeekState = {
  expiresAt: number;
  time: number;
  trackId: string | null;
};

type PlayerTimelineState = Pick<PlayerState, "currentTime" | "duration"> & {
  pendingSeekTime: number | null;
};
type PlayerContextState = Omit<PlayerState, "currentTime" | "duration">;
type PlaybackTargetResolution = {
  resolvedAvailableAudioQualityLabels: string[];
  resolvedAudioQualityLabel: string | null;
  resolvedVideoQuality: string | null;
  source: AudioPlaybackSource | null;
  resolvedAudioQuality: AudioQuality | null;
  capability: Track["audioQuality"] | null;
};

type PlaybackSourceResolutionCacheEntry = {
  expiresAt: number;
  resolution: PlaybackTargetResolution;
};

type PlaybackInterruptionHealthState = {
  trackId: string | null;
  timestamps: number[];
  lastReportedAt: number;
};

type PlaybackStartupState = {
  attempt: number;
  trackId: string | null;
};

type TidalStreamingOutageState = {
  activeUntil: number;
  reason: string | null;
};

type WindowWithIdleCallback = Window & typeof globalThis & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

type TidalPlaybackResolution =
  | {
      quality: AudioQuality | null;
      capability: AudioQuality | null;
      source: AudioPlaybackSource;
    }
  | AudioPlaybackSource;

function getAudioErrorCode(error: string) {
  const match = error.match(AUDIO_ERROR_CODE_REGEX);
  if (!match) return null;

  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

function getPlaybackFailureReason(
  error: unknown,
  track: Pick<Track, "source" | "isVideo"> | null | undefined,
) {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";

  const normalized = message
    .replace(/^audio error:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (track?.source === "tidal") {
    if (
      lower.includes("no tidal credentials available") ||
      lower.includes("authentication failed") ||
      (lower.includes("oauth2/token") && lower.includes("403 forbidden")) ||
      lower.includes("token refresh failed")
    ) {
      return "TIDAL streaming authentication is currently unavailable";
    }

    if (lower.includes("all instances failed for /track/") || lower.includes("all instances failed for /video/")) {
      return "All available TIDAL streaming instances failed";
    }

    if (lower.includes("malformed track response") || lower.includes("could not resolve stream url")) {
      return "TIDAL returned an invalid playback source";
    }
  }

  if (track?.source === "youtube-music" && track.isVideo === true) {
    return normalized;
  }

  return null;
}

function formatPlaybackFailureToast(message: string) {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

function readPersistedTidalStreamingOutage(): TidalStreamingOutageState {
  if (typeof window === "undefined") {
    return { activeUntil: 0, reason: null };
  }

  try {
    const raw = window.sessionStorage.getItem(TIDAL_STREAMING_OUTAGE_STORAGE_KEY);
    if (!raw) {
      return { activeUntil: 0, reason: null };
    }

    const parsed = JSON.parse(raw) as Partial<TidalStreamingOutageState>;
    const activeUntil = Number(parsed.activeUntil) || 0;
    const reason = typeof parsed.reason === "string" ? parsed.reason : null;

    return activeUntil > Date.now()
      ? { activeUntil, reason }
      : { activeUntil: 0, reason: null };
  } catch {
    return { activeUntil: 0, reason: null };
  }
}

function persistTidalStreamingOutage(state: TidalStreamingOutageState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (state.activeUntil > Date.now()) {
      window.sessionStorage.setItem(TIDAL_STREAMING_OUTAGE_STORAGE_KEY, JSON.stringify(state));
    } else {
      window.sessionStorage.removeItem(TIDAL_STREAMING_OUTAGE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures for outage hints.
  }
}

function isTidalStreamingOutageError(error: unknown) {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("no tidal credentials available") ||
    normalized.includes("authentication failed") ||
    normalized.includes("token refresh failed") ||
    (normalized.includes("oauth2/token") && normalized.includes("403 forbidden")) ||
    normalized.includes("all instances failed for /track/") ||
    normalized.includes("all instances failed for /video/")
  );
}

function shouldAttemptAudioRecovery(error: string, track: Pick<Track, "source" | "isVideo"> | null | undefined) {
  const code = getAudioErrorCode(error);
  if (code === 2 || code === 3 || code === 4) {
    return true;
  }

  const normalized = error.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes("playback did not start")) {
    return true;
  }

  if (normalized.includes("playback stalled")) {
    return true;
  }

  if (normalized.includes("playback timeout") || normalized.includes("did not become ready")) {
    return true;
  }

  if (track?.source === "youtube-music" && track.isVideo !== true) {
    return (
      normalized.includes("network") ||
      normalized.includes("stalled") ||
      normalized.includes("decipher") ||
      normalized.includes("expired") ||
      normalized.includes("media aborted")
    );
  }

  return false;
}

function getEqPresetFromGains(gains: number[]) {
  for (const [preset, values] of Object.entries(EQ_PRESETS)) {
    if (values.every((value, index) => Math.abs(value - (gains[index] || 0)) < 0.01)) {
      return preset;
    }
  }

  return "custom";
}

function getTrackMixQueueKey(track: Pick<Track, "id" | "isLocal" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "album" | "duration">) {
  return buildTrackKey(track);
}

function getTrackMixId(track: Pick<Track, "mixes">) {
  const mixId = track.mixes?.TRACK_MIX;
  if (mixId === null || mixId === undefined || mixId === "") return null;
  return String(mixId);
}

function getPlaybackSourceRequestCacheKey(
  track: Pick<Track, "id" | "isLocal" | "isVideo" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "album" | "duration" | "streamUrl" | "streamUrls">,
  quality: AudioQuality,
  requestedAudioQuality: AudioQuality,
  forceRefresh: boolean,
) {
  const playbackVariant = getTrackVideoQualityPreference(track) ?? quality;
  const directUrlHint = track.isVideo === true
    ? ""
    : track.streamUrls?.[requestedAudioQuality] || (!track.tidalId ? track.streamUrl : "") || "";

  return `${track.isVideo === true ? "video" : "audio"}:${buildTrackKey(track)}:${playbackVariant}:${forceRefresh ? "refresh" : "cached"}:${directUrlHint}`;
}

function getPlaybackSourceResolutionCacheKey(
  track: Pick<Track, "id" | "isLocal" | "isVideo" | "source" | "sourceId" | "tidalId" | "title" | "artist" | "album" | "duration">,
  requestedAudioQuality: AudioQuality,
) {
  const playbackVariant = getTrackVideoQualityPreference(track) ?? requestedAudioQuality;
  return `${track.isVideo === true ? "video" : "audio"}:${buildTrackKey(track)}:${playbackVariant}`;
}

function getAnyCachedStreamUrl(streamUrls: Track["streamUrls"]) {
  for (const value of Object.values(streamUrls || {})) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

let customDirectPlaybackNonce = 0;

function shouldBustCustomDirectTrackUrl(
  track: Pick<Track, "id" | "isLocal" | "isVideo" | "source" | "tidalId">,
  type: AudioPlaybackSource["type"],
  url: string,
) {
  if (!url || type !== "direct" || track.isLocal || track.isVideo === true) {
    return false;
  }

  const source = getTrackSource(track);
  if (source === "youtube-music" || source === "local") {
    return false;
  }

  return !getResolvableTidalId(track);
}

function appendPlaybackCacheBust(url: string) {
  const nextNonce = `${Date.now().toString(36)}-${(++customDirectPlaybackNonce).toString(36)}`;

  try {
    const parsedUrl = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return url;
    }

    parsedUrl.searchParams.set("knobbPlayback", nextNonce);
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

function getCompatiblePlaybackFallbackSource(source: AudioPlaybackSource | null) {
  if (!source?.fallbackUrl) {
    return null;
  }

  return {
    ...(typeof source.fallbackVideoHeight === "number" ? { videoHeight: source.fallbackVideoHeight } : {}),
    ...(source.videoQualityPreference ? { videoQualityPreference: source.videoQualityPreference } : {}),
    url: source.fallbackUrl,
    type: "direct" as const,
  };
}

function getResolvedVideoQualityFromSource(source: AudioPlaybackSource | null | undefined) {
  return formatResolvedVideoQuality(source?.videoHeight);
}

function getTrackVideoQualityPreference(
  track: Pick<Track, "isVideo" | "source"> | null | undefined,
): VideoQualityPreference | null {
  if (track?.isVideo !== true) {
    return null;
  }

  if (track.source === "tidal") {
    return TIDAL_VIDEO_PLAYBACK_PREFERENCE;
  }

  return getVideoQualityPreference();
}

function getYoutubeEmbedSourceId(track: Pick<Track, "source" | "sourceId"> | null | undefined) {
  if (track?.source !== "youtube-music" || typeof track.sourceId !== "string") {
    return null;
  }

  const normalizedSourceId = track.sourceId.trim();
  return normalizedSourceId.length > 0 ? normalizedSourceId : null;
}

function shouldUseYoutubeEmbedPlayback(track: Pick<Track, "isVideo" | "source" | "sourceId"> | null | undefined) {
  if (!getYoutubeEmbedSourceId(track)) {
    return false;
  }

  return isPublishedRuntimeHost();
}

function isYoutubeEmbedEligibleTrack(track: Pick<Track, "isVideo" | "source" | "sourceId"> | null | undefined) {
  return track?.isVideo === true && Boolean(getYoutubeEmbedSourceId(track));
}

function getPrimaryArtistName(track: Pick<Track, "artist" | "artists">) {
  const namedArtist = track.artists?.find((artist) => artist.name.trim().length > 0)?.name?.trim();
  if (namedArtist) return namedArtist;

  return track.artist
    .split(",")[0]
    ?.trim() || "";
}

function normalizeFallbackSearchText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\((feat|ft|featuring)[^)]+\)/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFallbackTokenScore(target: string, candidate: string) {
  const targetTokens = target.split(" ").filter(Boolean);
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));

  return targetTokens.reduce((score, token) => (
    candidateTokens.has(token) ? score + 10 : score
  ), 0);
}

function scoreYoutubeMusicFallbackCandidate(
  target: Pick<Track, "title" | "artist" | "duration">,
  candidate: Pick<Track, "title" | "artist" | "duration">,
) {
  const targetTitle = normalizeFallbackSearchText(target.title);
  const candidateTitle = normalizeFallbackSearchText(candidate.title);
  const targetArtist = normalizeFallbackSearchText(target.artist);
  const candidateArtist = normalizeFallbackSearchText(candidate.artist);

  let score = 0;

  if (candidateTitle === targetTitle) {
    score += 140;
  } else if (candidateTitle.startsWith(targetTitle) || targetTitle.startsWith(candidateTitle)) {
    score += 110;
  } else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) {
    score += 80;
  } else {
    score += getFallbackTokenScore(targetTitle, candidateTitle);
  }

  if (candidateArtist === targetArtist) {
    score += 90;
  } else if (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist)) {
    score += 55;
  } else {
    score += getFallbackTokenScore(targetArtist, candidateArtist);
  }

  const durationDelta = Math.abs((target.duration || 0) - (candidate.duration || 0));
  if (durationDelta <= 2) {
    score += 40;
  } else if (durationDelta <= 5) {
    score += 25;
  } else if (durationDelta <= 10) {
    score += 12;
  } else {
    score -= Math.min(durationDelta, 45);
  }

  return score;
}

function buildYoutubeMusicFallbackQuery(track: Pick<Track, "title" | "artist" | "artists">) {
  const primaryArtist = getPrimaryArtistName(track);
  return [primaryArtist, track.title].filter(Boolean).join(" ").trim();
}

function pickYoutubeMusicFallbackTrack(
  track: Pick<Track, "artist" | "duration" | "isVideo" | "title">,
  candidates: Track[],
) {
  let bestMatch: Track | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.sourceId) continue;
    const score = scoreYoutubeMusicFallbackCandidate(track, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore >= 120 ? bestMatch : null;
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

function toTrackAudioQuality(quality: AudioQuality | null): Track["audioQuality"] | undefined {
  if (!quality || quality === "AUTO") return undefined;
  return quality;
}

function getRequestedAudioQualityForTrack(track: Track, quality: AudioQuality) {
  if (track.isVideo === true || quality === "AUTO") {
    return quality;
  }

  const capability = toTrackAudioQuality(track.audioQuality) || null;
  if (!capability) {
    return quality;
  }

  return getPlayableAudioQualityForTrack(
    quality,
    getTrackSource(track),
    capability,
    false,
  );
}

function applyTrackAudioCapability(track: Track, capability: Track["audioQuality"] | null): Track {
  if (!capability) return track;
  return track.audioQuality === capability
    ? track
    : {
        ...track,
        audioQuality: capability,
      };
}

interface PlayerContextType extends PlayerContextState {
  play: (track: Track, queue?: Track[]) => void;
  playbackMode: PlaybackMode;
  warmTrackPlayback: (track: Track) => void;
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
  refreshVideoPlaybackPreference: () => Promise<void>;
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
  playArtist: (artistId: number | string, artistName?: string, source?: "tidal" | "youtube-music") => Promise<void>;
  startTrackMix: (track: Track) => Promise<void>;
  restoreRemoteSession: (snapshot: PlaybackSessionSnapshot) => Promise<void>;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  setFullScreen: (open: boolean) => void;
}

type PlayerCommandContextType = Pick<
  PlayerContextType,
  | "play"
  | "warmTrackPlayback"
  | "playAlbum"
  | "addToQueue"
  | "togglePlay"
  | "next"
  | "previous"
  | "seek"
  | "toggleShuffle"
  | "toggleRepeat"
  | "setVolume"
  | "toggleRightPanel"
  | "openRightPanel"
  | "setRightPanelOpen"
  | "setRightPanelTab"
  | "setAutoQualityEnabled"
  | "setQuality"
  | "refreshVideoPlaybackPreference"
  | "toggleNormalization"
  | "toggleEqualizer"
  | "setEqBandGain"
  | "applyEqPreset"
  | "resetEqualizer"
  | "setPreampDb"
  | "setMonoAudioEnabled"
  | "setCrossfadeDuration"
  | "setPlaybackSpeed"
  | "setPreservePitch"
  | "setSleepTimer"
  | "reorderQueue"
  | "removeFromQueue"
  | "playArtist"
  | "startTrackMix"
  | "restoreRemoteSession"
  | "toggleFullScreen"
  | "setFullScreen"
>;

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerCommandContext = createContext<PlayerCommandContextType | null>(null);
const PlayerCurrentTrackContext = createContext<Track | null | undefined>(undefined);
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
  const quality = isAudioQuality(value.quality)
    ? value.quality
    : value.autoQualityEnabled === true
      ? "AUTO"
      : undefined;

  return {
    ...(quality ? { quality, autoQualityEnabled: quality === "AUTO" } : {}),
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
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".avif")) return "image/avif";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".svg")) return "image/svg+xml";
    if (pathname.endsWith(".ico")) return "image/x-icon";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (/(?:googleusercontent\.com|ggpht\.com)$/i.test(parsedUrl.hostname)) return "image/jpeg";
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
  mediaSessionArtworkRequestId += 1;

  if (!track || typeof MediaMetadata === "undefined") {
    mediaSession.metadata = null;
    return;
  }

  const title = getTrackDisplayTitle(track);
  const artist = getTrackDisplayArtist(track);
  const album = track.album?.trim() || "Unknown Album";
  const artworkUrl = getMediaSessionTrackArtworkUrl(track) || MEDIA_SESSION_FALLBACK_ARTWORK_URL;
  const artwork = buildMediaSessionArtwork(artworkUrl);
  const metadataInit = {
    title,
    artist,
    album,
    artwork: buildMediaSessionArtwork(artworkUrl),
  };

  mediaSession.metadata = new MediaMetadata(metadataInit);
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

function getPlaybackSyncNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export function shouldIgnoreProgressWhileSeekSettles(
  pendingSeek: PendingSeekState | null,
  next: { currentTime: number; trackId: string | null },
  now = getPlaybackSyncNow(),
  toleranceSeconds = PENDING_SEEK_TOLERANCE_SECONDS,
) {
  if (!pendingSeek) return false;
  if (pendingSeek.trackId !== next.trackId) return false;
  if (now >= pendingSeek.expiresAt) return false;
  if (!Number.isFinite(next.currentTime)) return false;

  return Math.abs(next.currentTime - pendingSeek.time) > toleranceSeconds;
}

export function stabilizePlaybackProgressTime(
  previousTime: number,
  nextTime: number,
  options: {
    duration: number;
    isPlaying: boolean;
    pendingSeek: PendingSeekState | null;
  },
  backwardToleranceSeconds = PLAYER_BACKWARD_PROGRESS_TOLERANCE_SECONDS,
) {
  if (!Number.isFinite(nextTime)) return previousTime;
  if (!Number.isFinite(previousTime) || previousTime < 0) return nextTime;
  if (!options.isPlaying || options.pendingSeek) return nextTime;
  if (nextTime >= previousTime) return nextTime;

  const isNearTrackBoundary =
    nextTime <= PLAYER_PROGRESS_RENDER_STEP_SECONDS ||
    (options.duration > 0 && options.duration - nextTime <= PLAYER_PROGRESS_RENDER_STEP_SECONDS);

  if (isNearTrackBoundary) {
    return nextTime;
  }

  return previousTime - nextTime <= backwardToleranceSeconds
    ? previousTime
    : nextTime;
}

export function updatePlaybackInterruptionHealth(
  state: PlaybackInterruptionHealthState,
  event: {
    occurredAt: number;
    trackId: string | null;
  },
  windowMs = PLAYBACK_INTERRUPTION_HEALTH_WINDOW_MS,
  threshold = PLAYBACK_INTERRUPTION_HEALTH_THRESHOLD,
  cooldownMs = PLAYBACK_INTERRUPTION_HEALTH_REPORT_COOLDOWN_MS,
) {
  if (!event.trackId) {
    return {
      nextState: {
        trackId: null,
        timestamps: [],
        lastReportedAt: 0,
      } satisfies PlaybackInterruptionHealthState,
      shouldWarn: false,
      interruptionCount: 0,
    };
  }

  const timestamps = state.trackId === event.trackId ? state.timestamps : [];
  const nextTimestamps = timestamps
    .filter((timestamp) => event.occurredAt - timestamp <= windowMs)
    .concat(event.occurredAt);
  const previousReportedAt = state.trackId === event.trackId ? state.lastReportedAt : 0;
  const shouldWarn =
    nextTimestamps.length >= threshold &&
    (previousReportedAt <= 0 || event.occurredAt - previousReportedAt >= cooldownMs);

  return {
    nextState: {
      trackId: event.trackId,
      timestamps: nextTimestamps,
      lastReportedAt: shouldWarn ? event.occurredAt : previousReportedAt,
    } satisfies PlaybackInterruptionHealthState,
    shouldWarn,
    interruptionCount: nextTimestamps.length,
  };
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

function shouldKeepRightPanelVisibleForEmbedVideo(
  state: Pick<PlayerState, "currentTrack" | "playbackMode">,
) {
  return state.playbackMode === "youtube-embed" && state.currentTrack?.isVideo === true;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const { discordPresenceEnabled, librarySource, rightPanelAutoOpen, rightPanelDefaultTab } = useSettings();
  const initialPlayerStateRef = useRef<PlayerState | null>(null);
  if (!initialPlayerStateRef.current) {
    initialPlayerStateRef.current = createInitialPlayerState();
  }

  const [state, setState] = useState<PlayerState>(initialPlayerStateRef.current);
  const [timeline, setTimeline] = useState<PlayerTimelineState>(() => ({
    currentTime: initialPlayerStateRef.current?.currentTime ?? 0,
    duration: initialPlayerStateRef.current?.duration ?? 0,
    pendingSeekTime: null,
  }));
  const [discordPresenceBridgeVersion, setDiscordPresenceBridgeVersion] = useState(0);
  const [discordWebhookSettingsVersion, setDiscordWebhookSettingsVersion] = useState(0);
  const [engineReadyVersion, setEngineReadyVersion] = useState(0);
  const mediaSessionTrackSignature = useMemo(() => {
    const track = state.currentTrack;
    if (!track) return "";

    const artistNames = track.artists?.map((artist) => artist.name || "").join("|") || "";
    return [
      track.id,
      track.title,
      track.artist,
      artistNames,
      track.album,
      track.coverUrl,
      track.source,
      track.sourceId,
      track.isVideo ? "video" : "audio",
    ].join("::");
  }, [state.currentTrack]);

  const engineRef = useRef<AudioEngine | null>(null);
  const enginePromiseRef = useRef<Promise<AudioEngine> | null>(null);
  const stateRef = useRef(state);
  const transitionInProgressRef = useRef(false);
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
  const playbackSourceRequestCacheRef = useRef(new Map<string, Promise<PlaybackTargetResolution>>());
  const playbackSourceResolutionCacheRef = useRef(new Map<string, PlaybackSourceResolutionCacheEntry>());
  const playbackSourceWarmCacheRef = useRef(new Map<string, Promise<void>>());
  const playbackStackWarmRef = useRef(false);
  const tidalStreamingOutageRef = useRef<TidalStreamingOutageState>(readPersistedTidalStreamingOutage());
  const dashModuleWarmupPromiseRef = useRef<Promise<void> | null>(null);
  const hlsModuleWarmupPromiseRef = useRef<Promise<void> | null>(null);
  const crossfadeAttemptRef = useRef(0);
  const playbackInterruptionHealthRef = useRef<PlaybackInterruptionHealthState>({
    trackId: null,
    timestamps: [],
    lastReportedAt: 0,
  });
  const playbackStartupRef = useRef<PlaybackStartupState | null>(null);
  const playbackAttemptRef = useRef(0);
  const playbackEngineTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSeekRef = useRef<PendingSeekState | null>(null);
  const pendingSeekTimeoutRef = useRef<number | null>(null);
  const playbackInterruptionTimeoutRef = useRef<number | null>(null);
  const expectedPauseUntilRef = useRef(0);
  const unexpectedPauseRecoveryTimeoutRef = useRef<number | null>(null);
  stateRef.current = {
    ...state,
    currentTime: timeline.currentTime,
    duration: timeline.duration,
  };
  const syncedPlayerPreferences = useMemo<SyncedPlayerPreferences>(() => ({
    autoQualityEnabled: state.quality === "AUTO",
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
    playbackSourceRequestCacheRef.current.clear();
    void loadYoutubeMusicApiModule()
      .then((module) => module.clearYoutubeMusicCache())
      .catch(() => undefined);
  }, [librarySource]);

  useEffect(() => {
    lastProgressRenderRef.current = {
      currentTime: timeline.currentTime,
      duration: timeline.duration,
      isPlaying: state.isPlaying,
      trackId: state.currentTrack?.id ?? null,
    };
  }, [timeline.currentTime, timeline.duration, state.currentTrack?.id, state.isPlaying]);

  const clearPendingSeek = useCallback((trackId?: string | null) => {
    const activePendingSeek = pendingSeekRef.current;
    if (!activePendingSeek) return;
    if (trackId !== undefined && activePendingSeek.trackId !== trackId) return;

    pendingSeekRef.current = null;
    if (pendingSeekTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(pendingSeekTimeoutRef.current);
      pendingSeekTimeoutRef.current = null;
    }

    setTimeline((prev) => (
      prev.pendingSeekTime === null
        ? prev
        : {
          ...prev,
          pendingSeekTime: null,
        }
    ));
  }, []);

  const clearPlaybackInterruptionRecovery = useCallback(() => {
    if (playbackInterruptionTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(playbackInterruptionTimeoutRef.current);
      playbackInterruptionTimeoutRef.current = null;
    }
  }, []);

  const clearUnexpectedPauseRecovery = useCallback(() => {
    if (unexpectedPauseRecoveryTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(unexpectedPauseRecoveryTimeoutRef.current);
      unexpectedPauseRecoveryTimeoutRef.current = null;
    }
  }, []);

  const markExpectedPause = useCallback((windowMs = EXPECTED_PAUSE_GRACE_WINDOW_MS) => {
    expectedPauseUntilRef.current = Math.max(expectedPauseUntilRef.current, Date.now() + windowMs);
    clearUnexpectedPauseRecovery();
  }, [clearUnexpectedPauseRecovery]);

  const beginPlaybackAttempt = useCallback(() => {
    const nextAttempt = playbackAttemptRef.current + 1;
    playbackAttemptRef.current = nextAttempt;
    return nextAttempt;
  }, []);

  const isPlaybackAttemptCurrent = useCallback((attempt: number) => (
    playbackAttemptRef.current === attempt
  ), []);

  const beginPlaybackStartup = useCallback((attempt: number, trackId: string | null) => {
    playbackStartupRef.current = {
      attempt,
      trackId,
    };
  }, []);

  const clearPlaybackStartup = useCallback((attempt?: number, trackId?: string | null) => {
    const activeStartup = playbackStartupRef.current;
    if (!activeStartup) return;
    if (attempt !== undefined && activeStartup.attempt !== attempt) return;
    if (trackId !== undefined && activeStartup.trackId !== trackId) return;
    playbackStartupRef.current = null;
  }, []);

  const isPlaybackStartupActiveForTrack = useCallback((trackId: string | null | undefined) => {
    const activeStartup = playbackStartupRef.current;
    if (!activeStartup) return false;
    if (trackId === undefined) return true;
    return activeStartup.trackId === trackId;
  }, []);

  const shouldUseYoutubeEmbedForTrack = useCallback((
    track: Pick<Track, "isVideo" | "source" | "sourceId"> | null | undefined,
  ) => {
    return shouldUseYoutubeEmbedPlayback(track);
  }, []);

  const withPlaybackEngineTransitionLock = useCallback(async <T,>(task: () => Promise<T>) => {
    const previousTransition = playbackEngineTransitionRef.current.catch(() => undefined);
    let releaseTransition!: () => void;

    playbackEngineTransitionRef.current = new Promise<void>((resolve) => {
      releaseTransition = resolve;
    });

    await previousTransition;

    try {
      return await task();
    } finally {
      releaseTransition();
    }
  }, []);

  const resetPlaybackInterruptionHealth = useCallback((trackId?: string | null) => {
    const activeHealth = playbackInterruptionHealthRef.current;
    if (trackId !== undefined && activeHealth.trackId !== trackId) {
      return;
    }

    playbackInterruptionHealthRef.current = {
      trackId: trackId ?? null,
      timestamps: [],
      lastReportedAt: 0,
    };
  }, []);

  const invalidatePendingCrossfadeHandoff = useCallback(() => {
    crossfadeAttemptRef.current += 1;
    transitionInProgressRef.current = false;
    engineRef.current?.cancelPendingCrossfade();
  }, []);

  const armPendingSeek = useCallback((time: number) => {
    const trackId = stateRef.current.currentTrack?.id ?? null;
    const expiresAt = getPlaybackSyncNow() + PENDING_SEEK_TIMEOUT_MS;

    if (pendingSeekTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(pendingSeekTimeoutRef.current);
      pendingSeekTimeoutRef.current = null;
    }

    pendingSeekRef.current = {
      expiresAt,
      time,
      trackId,
    };

    if (typeof window !== "undefined") {
      pendingSeekTimeoutRef.current = window.setTimeout(() => {
        const activePendingSeek = pendingSeekRef.current;
        if (!activePendingSeek) return;
        if (activePendingSeek.trackId !== trackId) return;
        if (Math.abs(activePendingSeek.time - time) > Number.EPSILON) return;

        pendingSeekRef.current = null;
        pendingSeekTimeoutRef.current = null;
        setTimeline((prev) => (
          prev.pendingSeekTime === null
            ? prev
            : {
              ...prev,
              pendingSeekTime: null,
            }
        ));
      }, PENDING_SEEK_TIMEOUT_MS);
    }
  }, []);

  useEffect(() => () => {
    if (pendingSeekTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(pendingSeekTimeoutRef.current);
    }
  }, []);

  useEffect(() => () => {
    clearPlaybackInterruptionRecovery();
  }, [clearPlaybackInterruptionRecovery]);

  useEffect(() => {
    clearPendingSeek();
  }, [clearPendingSeek, state.currentTrack?.id]);

  useEffect(() => {
    resetPlaybackInterruptionHealth(state.currentTrack?.id ?? null);
  }, [resetPlaybackInterruptionHealth, state.currentTrack?.id]);

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
            autoQualityEnabled: remotePreferences.quality
              ? remotePreferences.quality === "AUTO"
              : prev.autoQualityEnabled,
            eqGains: remotePreferences.eqGains ?? prev.eqGains,
          }));
          if (remotePreferences.quality !== undefined) {
            persistAutoQualityEnabled(remotePreferences.quality === "AUTO");
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

  const applyPlaybackSurfacePreference = useCallback((
    prev: PlayerState,
    track: Pick<Track, "isVideo" | "source" | "sourceId"> | null | undefined,
  ) => {
    if (track?.isVideo === true && shouldUseYoutubeEmbedForTrack(track)) {
      return withRightPanelVisibility(prev, true);
    }

    return applyAutoRightPanelPreference(prev);
  }, [applyAutoRightPanelPreference, shouldUseYoutubeEmbedForTrack]);

  useEffect(() => {
    if (rightPanelAutoOpen !== "while-playing") return;

    setState((prev) => {
      if (prev.isPlaying || !prev.showRightPanel || shouldKeepRightPanelVisibleForEmbedVideo(prev)) return prev;
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

  const warmPlaybackStack = useCallback((options: { includeDash?: boolean } = {}) => {
    const tasks: Promise<unknown>[] = [];

    if (!playbackStackWarmRef.current) {
      playbackStackWarmRef.current = true;
      void primeMediaPlayback();
      tasks.push(loadMusicApiModule());
      if (engineRef.current) {
        engineRef.current.preparePlayback();
      } else {
        tasks.push(
          ensureEngine().then((engine) => {
            engine.preparePlayback();
          }),
        );
      }
    }

    if (options.includeDash && !dashModuleWarmupPromiseRef.current) {
      dashModuleWarmupPromiseRef.current = ensureEngine()
        .then((engine) => engine.preloadSourceType("dash"))
        .catch(() => { })
        .then(() => undefined);
    }

    if (options.includeDash && !hlsModuleWarmupPromiseRef.current) {
      hlsModuleWarmupPromiseRef.current = ensureEngine()
        .then((engine) => engine.preloadSourceType("hls"))
        .catch(() => { })
        .then(() => undefined);
    }

    if (dashModuleWarmupPromiseRef.current) {
      tasks.push(dashModuleWarmupPromiseRef.current);
    }

    if (hlsModuleWarmupPromiseRef.current) {
      tasks.push(hlsModuleWarmupPromiseRef.current);
    }

    if (isPublishedRuntimeHost()) {
      tasks.push(
        getYoutubeEmbedManager()
          .warmup()
          .catch(() => undefined),
      );
    }

    return Promise.allSettled(tasks).then(() => undefined);
  }, [ensureEngine]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const budget = readStartupPerformanceBudget();
    let idleHandle: number | null = null;

    const warmOnInteraction = () => {
      void warmPlaybackStack();
    };

    window.addEventListener("pointerdown", warmOnInteraction, { capture: true, once: true, passive: true });
    window.addEventListener("keydown", warmOnInteraction, { capture: true, once: true });

    if (budget.canWarmPlaybackStackEagerly) {
      const idleWarm = () => {
        void warmPlaybackStack();
      };

      const win = window as WindowWithIdleCallback;
      if ("requestIdleCallback" in win) {
        idleHandle = win.requestIdleCallback(idleWarm, { timeout: 2500 });
      } else {
        idleHandle = win.setTimeout(idleWarm, 1400);
      }
    }

    return () => {
      window.removeEventListener("pointerdown", warmOnInteraction, true);
      window.removeEventListener("keydown", warmOnInteraction, true);
      const win = window as WindowWithIdleCallback;
      if (idleHandle !== null) {
        if ("cancelIdleCallback" in win) {
          win.cancelIdleCallback(idleHandle);
        } else {
          win.clearTimeout(idleHandle);
        }
      }
    };
  }, [warmPlaybackStack]);

  const resetAudioRecovery = useCallback((trackId: string | null = null) => {
    audioRecoveryRef.current = {
      trackId,
      attemptedQualities: [],
      active: false,
    };
  }, []);

  const warmPlaybackSourceUrl = useCallback((url: string) => {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(url, window.location.href);
    } catch {
      return Promise.resolve();
    }

    if (resolvedUrl.origin !== window.location.origin || resolvedUrl.pathname !== "/api/youtube-music") {
      return Promise.resolve();
    }

    const cacheKey = resolvedUrl.toString();
    const cachedWarmup = playbackSourceWarmCacheRef.current.get(cacheKey);
    if (cachedWarmup) {
      return cachedWarmup;
    }

    const warmup = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 4500);

      try {
        await fetch(cacheKey, {
          method: "HEAD",
          credentials: "same-origin",
          signal: controller.signal,
        });
      } catch {
        // Keep playback-source warmup best-effort so discovery never surfaces errors.
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    playbackSourceWarmCacheRef.current.set(cacheKey, warmup);
    return warmup;
  }, []);

  const warmResolvedPlaybackSource = useCallback((source: AudioPlaybackSource) => {
    if (source.type !== "direct") {
      return Promise.resolve();
    }

    const urls = [
      source.url,
      source.audioUrl,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (urls.length === 0) {
      return Promise.resolve();
    }

    return Promise.allSettled(urls.map((url) => warmPlaybackSourceUrl(url))).then(() => undefined);
  }, [warmPlaybackSourceUrl]);

  const deactivateYoutubeEmbedPlayback = useCallback(() => {
    const embedManager = getYoutubeEmbedManager();
    if (stateRef.current.playbackMode === "youtube-embed") {
      markExpectedPause();
    }
    embedManager.reset();
    embedManager.returnToGlobalHost();
  }, [markExpectedPause]);

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

  const recoverFromUnexpectedPause = useCallback((mode: PlaybackMode) => {
    if (typeof window === "undefined") {
      return false;
    }

    const currentTrack = stateRef.current.currentTrack;
    if (!currentTrack || !stateRef.current.isPlaying || stateRef.current.isLoading) {
      return false;
    }

    if (Date.now() <= expectedPauseUntilRef.current) {
      return false;
    }

    if (transitionInProgressRef.current || isPlaybackStartupActiveForTrack(currentTrack.id)) {
      return false;
    }

    clearUnexpectedPauseRecovery();
    unexpectedPauseRecoveryTimeoutRef.current = window.setTimeout(() => {
      unexpectedPauseRecoveryTimeoutRef.current = null;

      const activeTrack = stateRef.current.currentTrack;
      if (
        !activeTrack
        || activeTrack.id !== currentTrack.id
        || !stateRef.current.isPlaying
        || stateRef.current.isLoading
        || Date.now() <= expectedPauseUntilRef.current
      ) {
        return;
      }

      void (async () => {
        try {
          if (mode === "youtube-embed") {
            const embedManager = getYoutubeEmbedManager();
            if (!embedManager.isPaused()) {
              return;
            }

            await embedManager.play();
            return;
          }

          void primeMediaPlayback();
          const engine = engineRef.current ?? await ensureEngine();
          engine.preparePlayback();

          if (!engine.paused) {
            return;
          }

          if (engine.duration <= 0) {
            await loadAndPlayRef.current(activeTrack, { allowQueueFallback: false });
            return;
          }

          await engine.play().catch(async () => {
            await loadAndPlayRef.current(activeTrack, { allowQueueFallback: false });
          });
        } catch {
          clearCurrentStatus();
          setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
        }
      })();
    }, UNEXPECTED_PAUSE_RECOVERY_DELAY_MS);

    return true;
  }, [clearCurrentStatus, clearUnexpectedPauseRecovery, ensureEngine, isPlaybackStartupActiveForTrack]);

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

  const isTidalStreamingOutageActive = useCallback(() => {
    return tidalStreamingOutageRef.current.activeUntil > Date.now();
  }, []);

  const noteTidalStreamingOutage = useCallback((error: unknown) => {
    if (!isTidalStreamingOutageError(error)) {
      return;
    }

    const nextState = {
      activeUntil: Date.now() + TIDAL_STREAMING_OUTAGE_TTL_MS,
      reason: error instanceof Error ? error.message : typeof error === "string" ? error : null,
    };
    tidalStreamingOutageRef.current = nextState;
    persistTidalStreamingOutage(nextState);
  }, []);

  const clearTidalStreamingOutage = useCallback(() => {
    const nextState = {
      activeUntil: 0,
      reason: null,
    };
    tidalStreamingOutageRef.current = nextState;
    persistTidalStreamingOutage(nextState);
  }, []);

  const resolvePlaybackSource = useCallback(async (
    track: Track,
    quality: AudioQuality,
    forceRefresh = false,
  ) => {
    const requestedAudioQuality = getRequestedAudioQualityForTrack(track, quality);
    const resolutionCacheKey = getPlaybackSourceResolutionCacheKey(track, requestedAudioQuality);
    if (forceRefresh) {
      playbackSourceResolutionCacheRef.current.delete(resolutionCacheKey);
    } else {
      const cachedResolution = playbackSourceResolutionCacheRef.current.get(resolutionCacheKey);
      if (cachedResolution) {
        if (cachedResolution.expiresAt > Date.now()) {
          return cachedResolution.resolution;
        }

        playbackSourceResolutionCacheRef.current.delete(resolutionCacheKey);
      }
    }

    const requestCacheKey = getPlaybackSourceRequestCacheKey(track, quality, requestedAudioQuality, forceRefresh);
    const cachedRequest = playbackSourceRequestCacheRef.current.get(requestCacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = (async (): Promise<PlaybackTargetResolution> => {
      let youtubeMusicApiModulePromise: ReturnType<typeof loadYoutubeMusicApiModule> | null = null;
      const getYoutubeMusicApi = () => {
        youtubeMusicApiModulePromise ||= loadYoutubeMusicApiModule();
        return youtubeMusicApiModulePromise;
      };
      const shouldReuseCachedTrackSource = !track.isVideo && track.source !== "youtube-music" && !forceRefresh;
      let url = shouldReuseCachedTrackSource
        ? track.streamUrls?.[requestedAudioQuality] || (!track.tidalId ? track.streamUrl || getAnyCachedStreamUrl(track.streamUrls) : null)
        : null;
      let audioUrl: string | undefined;
      let fallbackUrl: string | undefined;
      let fallbackVideoHeight: number | undefined;
      let videoHeight: number | undefined;
      let type: AudioPlaybackSource["type"] = shouldReuseCachedTrackSource
        ? track.streamTypes?.[requestedAudioQuality] || "direct"
        : "direct";
      let resolvedAudioQuality: AudioQuality | null = null;
      let resolvedAvailableAudioQualityLabels: string[] = [];
      let resolvedAudioQualityLabel: string | null = null;
      let resolvedVideoQuality: string | null = null;
      let capability: AudioQuality | null = null;
      const source = getTrackSource(track);
      const sourceId = getTrackSourceId(track);
      const tidalId = getResolvableTidalId(track);
      const videoQualityPreference = getTrackVideoQualityPreference(track);

      const resolveYoutubeMusicFallback = async () => {
        const fallbackQuery = buildYoutubeMusicFallbackQuery(track);
        if (!fallbackQuery) {
          return null;
        }

        const youtubeMusicApi = await getYoutubeMusicApi();
        const fallbackSearch = await youtubeMusicApi.searchYoutubeMusicReference(fallbackQuery);
        const matchedTrack = pickYoutubeMusicFallbackTrack(
          track,
          track.isVideo === true ? fallbackSearch.videos : fallbackSearch.tracks,
        );
        if (!matchedTrack?.sourceId) {
          return null;
        }

        const fallbackSource = track.isVideo === true
          ? await youtubeMusicApi.getYoutubeMusicVideoPlaybackSource(matchedTrack.sourceId, videoQualityPreference || undefined)
          : await youtubeMusicApi.getYoutubeMusicPlaybackSource(matchedTrack.sourceId, requestedAudioQuality);
        if (!fallbackSource) {
          return null;
        }

        const availableAudioQualityLabels = Array.isArray(fallbackSource.availableAudioQualityLabels)
          ? fallbackSource.availableAudioQualityLabels.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [];
        const audioQualityLabel = typeof fallbackSource.audioQualityLabel === "string"
          ? fallbackSource.audioQualityLabel
          : null;
        let fallbackResolvedAudioQuality = getEffectivePlaybackQuality(requestedAudioQuality, "youtube-music", track.isVideo === true);
        if (track.isVideo === true) {
          fallbackResolvedAudioQuality = getAudioQualityTierFromResolvedLabel(
            audioQualityLabel,
            "youtube-music",
          ) || getHighestResolvedAudioQuality(
            availableAudioQualityLabels,
            audioQualityLabel,
            "youtube-music",
          ) || fallbackResolvedAudioQuality;
        }

        const fallbackCapability = track.isVideo === true
          ? toTrackAudioQuality(matchedTrack.audioQuality) || toTrackAudioQuality(track.audioQuality) || null
          : getHighestResolvedAudioQuality(
            availableAudioQualityLabels,
            audioQualityLabel,
            "youtube-music",
          ) || toTrackAudioQuality(matchedTrack.audioQuality) || toTrackAudioQuality(track.audioQuality) || null;

        return {
          source: fallbackSource,
          resolvedAudioQuality: fallbackResolvedAudioQuality,
          resolvedAvailableAudioQualityLabels: availableAudioQualityLabels,
          resolvedAudioQualityLabel: audioQualityLabel,
          resolvedVideoQuality: getResolvedVideoQualityFromSource(fallbackSource),
          capability: fallbackCapability,
        };
      };

      if ((!url || forceRefresh) && source === "youtube-music" && sourceId) {
        const youtubeMusicApi = await getYoutubeMusicApi();
        const resolvedSource = track.isVideo === true
          ? await youtubeMusicApi.getYoutubeMusicVideoPlaybackSource(sourceId, videoQualityPreference || undefined)
          : await youtubeMusicApi.getYoutubeMusicPlaybackSource(sourceId, requestedAudioQuality);
        if (resolvedSource) {
          url = resolvedSource.url;
          audioUrl = resolvedSource.audioUrl;
          fallbackUrl = resolvedSource.fallbackUrl;
          fallbackVideoHeight = resolvedSource.fallbackVideoHeight;
          videoHeight = resolvedSource.videoHeight;
          type = resolvedSource.type;
          resolvedAudioQuality = getEffectivePlaybackQuality(requestedAudioQuality, "youtube-music", track.isVideo === true);
          resolvedAvailableAudioQualityLabels = Array.isArray(resolvedSource.availableAudioQualityLabels)
            ? resolvedSource.availableAudioQualityLabels.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [];
          resolvedAudioQualityLabel = typeof resolvedSource.audioQualityLabel === "string"
            ? resolvedSource.audioQualityLabel
            : null;
          if (track.isVideo === true) {
            resolvedAudioQuality = getAudioQualityTierFromResolvedLabel(
              resolvedAudioQualityLabel,
              "youtube-music",
            ) || getHighestResolvedAudioQuality(
              resolvedAvailableAudioQualityLabels,
              resolvedAudioQualityLabel,
              "youtube-music",
            ) || resolvedAudioQuality;
          }
          resolvedVideoQuality = getResolvedVideoQualityFromSource(resolvedSource);
          if (track.isVideo !== true) {
            capability = getHighestResolvedAudioQuality(
              resolvedAvailableAudioQualityLabels,
              resolvedAudioQualityLabel,
              "youtube-music",
            ) || toTrackAudioQuality(track.audioQuality) || null;
          }
          track.source = "youtube-music";
          track.sourceId = sourceId;
          track.streamUrl = resolvedSource.url;
          track.streamUrls = {
            ...(track.streamUrls || {}),
            [requestedAudioQuality]: resolvedSource.url,
          };
          track.streamTypes = {
            ...(track.streamTypes || {}),
            [requestedAudioQuality]: resolvedSource.type,
          };
        }
      } else if (tidalId && (!url || forceRefresh)) {
        const musicApi = await loadMusicApiModule();
        let tidalResolutionError: unknown = null;
        const shouldBypassTidal = !forceRefresh && isTidalStreamingOutageActive();
        const applyTidalResolution = (resolvedSource: TidalPlaybackResolution) => {
          const res = resolvedSource;
          const playbackSource = track.isVideo === true
            ? {
                ...res,
                videoQualityPreference: videoQualityPreference || TIDAL_VIDEO_PLAYBACK_PREFERENCE,
              }
            : res.source;
          url = playbackSource.url;
          type = playbackSource.type;
          resolvedAudioQuality = getEffectivePlaybackQuality(requestedAudioQuality, "tidal", track.isVideo === true);
          if (track.isVideo === true) {
            resolvedAudioQuality = toTrackAudioQuality(track.audioQuality) || resolvedAudioQuality;
          }
          if (track.isVideo !== true) {
            capability = toTrackAudioQuality(res.capability) || null;
          }
          track.streamUrl = playbackSource.url;
          track.streamUrls = {
            ...(track.streamUrls || {}),
            [requestedAudioQuality]: playbackSource.url,
          };
          track.streamTypes = {
            ...(track.streamTypes || {}),
            [requestedAudioQuality]: playbackSource.type,
          };
          track.tidalId = tidalId;
          if (track.isVideo !== true && res.quality && isAudioQuality(res.quality)) {
            resolvedAudioQuality = res.quality;
          }
          clearTidalStreamingOutage();
        };
        const applyFallbackResolution = (fallbackResolution: Awaited<ReturnType<typeof resolveYoutubeMusicFallback>>) => {
          if (!fallbackResolution) {
            return;
          }

          url = fallbackResolution.source.url;
          audioUrl = fallbackResolution.source.audioUrl;
          fallbackUrl = fallbackResolution.source.fallbackUrl;
          fallbackVideoHeight = fallbackResolution.source.fallbackVideoHeight;
          videoHeight = fallbackResolution.source.videoHeight;
          type = fallbackResolution.source.type;
          resolvedAudioQuality = fallbackResolution.resolvedAudioQuality;
          resolvedAvailableAudioQualityLabels = fallbackResolution.resolvedAvailableAudioQualityLabels;
          resolvedAudioQualityLabel = fallbackResolution.resolvedAudioQualityLabel;
          resolvedVideoQuality = fallbackResolution.resolvedVideoQuality;
          capability = fallbackResolution.capability;
          if (!track.isVideo) {
            track.streamUrl = fallbackResolution.source.url;
          }
          track.streamUrls = {
            ...(track.streamUrls || {}),
            [requestedAudioQuality]: fallbackResolution.source.url,
          };
          track.streamTypes = {
            ...(track.streamTypes || {}),
            [requestedAudioQuality]: fallbackResolution.source.type,
          };
        };
        const resolveTidalPrimary = async () => {
          try {
            return track.isVideo === true
              ? await musicApi.getVideoPlaybackSource(tidalId)
              : await musicApi.getPlaybackSourceWithQuality(tidalId, requestedAudioQuality);
          } catch (error) {
            tidalResolutionError = error;
            noteTidalStreamingOutage(error);
            return null;
          }
        };
        if (forceRefresh) {
          musicApi.invalidateTrackStreamCache(tidalId);
        }
        if (shouldBypassTidal) {
          applyFallbackResolution(await resolveYoutubeMusicFallback().catch(() => null));
        } else {
          const tidalResolutionPromise = resolveTidalPrimary();
          const fallbackResolutionPromise = resolveYoutubeMusicFallback().catch(() => null);
          const firstReady = await Promise.race([
            tidalResolutionPromise.then((resolvedSource) => ({
              kind: "tidal" as const,
              resolvedSource,
            })),
            (async () => {
              await new Promise<void>((resolve) => {
                setTimeout(resolve, TIDAL_PRIMARY_RESOLUTION_HEAD_START_MS);
              });
              const resolvedFallback = await fallbackResolutionPromise;
              return {
                kind: "fallback" as const,
                resolvedFallback,
              };
            })(),
          ]);

          if (firstReady.kind === "tidal" && firstReady.resolvedSource) {
            applyTidalResolution(firstReady.resolvedSource);
          } else if (firstReady.kind === "fallback" && firstReady.resolvedFallback) {
            applyFallbackResolution(firstReady.resolvedFallback);
          } else {
            const [resolvedSource, resolvedFallback] = await Promise.all([
              tidalResolutionPromise,
              fallbackResolutionPromise,
            ]);
            if (resolvedSource) {
              applyTidalResolution(resolvedSource);
            } else if (resolvedFallback) {
              applyFallbackResolution(resolvedFallback);
            }
          }
        }

        if (!url && tidalResolutionError) {
          throw tidalResolutionError;
        }
      }

      if (!url) {
        const unresolvedResolution = {
          resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel,
          resolvedVideoQuality,
          source: null,
          resolvedAudioQuality,
          capability: toTrackAudioQuality(capability) || null,
        };
        playbackSourceResolutionCacheRef.current.delete(resolutionCacheKey);
        return unresolvedResolution;
      }

      const playbackUrl = shouldBustCustomDirectTrackUrl(track, type, url)
        ? appendPlaybackCacheBust(url)
        : url;

      const resolvedTarget = {
        source: {
          ...(audioUrl ? { audioUrl } : {}),
          ...(resolvedAvailableAudioQualityLabels.length > 0 ? { availableAudioQualityLabels: resolvedAvailableAudioQualityLabels } : {}),
          ...(resolvedAudioQualityLabel ? { audioQualityLabel: resolvedAudioQualityLabel } : {}),
          ...(fallbackUrl ? { fallbackUrl } : {}),
          ...(typeof fallbackVideoHeight === "number" ? { fallbackVideoHeight } : {}),
          ...(typeof videoHeight === "number" ? { videoHeight } : {}),
          url: playbackUrl,
          type,
        },
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        resolvedAudioQuality,
        capability: toTrackAudioQuality(capability) || null,
      };
      playbackSourceResolutionCacheRef.current.set(resolutionCacheKey, {
        expiresAt: Date.now() + PLAYBACK_SOURCE_RESOLUTION_CACHE_TTL_MS,
        resolution: resolvedTarget,
      });
      return resolvedTarget;
    })();

    playbackSourceRequestCacheRef.current.set(requestCacheKey, request);

    try {
      return await request;
    } finally {
      playbackSourceRequestCacheRef.current.delete(requestCacheKey);
    }
  }, [clearTidalStreamingOutage, isTidalStreamingOutageActive, noteTidalStreamingOutage]);

  const preparePlaybackTarget = useCallback(async (
    track: Track,
    quality: AudioQuality,
    forceRefresh = false,
  ) => {
    const enginePromise = ensureEngine();
    const sourcePromise = resolvePlaybackSource(track, quality, forceRefresh);
    const preparedSourcePromise = sourcePromise.then(async (resolution) => {
      if (!resolution.source) return resolution;
      warmPlaybackOrigin(resolution.source.url);
      const engine = await enginePromise;
      await engine.preloadSourceType(resolution.source.type);
      return resolution;
    });

    const [engine, resolution] = await Promise.all([enginePromise, preparedSourcePromise]);
    return {
      engine,
      resolvedAvailableAudioQualityLabels: resolution.resolvedAvailableAudioQualityLabels || [],
      resolvedAudioQualityLabel: resolution.resolvedAudioQualityLabel || null,
      resolvedVideoQuality: resolution.resolvedVideoQuality || null,
      source: resolution.source || null,
      resolvedAudioQuality: resolution.resolvedAudioQuality || null,
      capability: resolution.capability || null,
    };
  }, [ensureEngine, resolvePlaybackSource]);

  const prefetchPlaybackSource = useCallback((track: Track | null | undefined, quality = stateRef.current.quality) => {
    if (!track || track.isUnavailable || shouldUseYoutubeEmbedForTrack(track)) return;

    void resolvePlaybackSource(track, quality)
      .then(async (resolution) => {
        if (!resolution.source) return;
        warmPlaybackOrigin(resolution.source.url);
        if (resolution.source.type === "direct") {
          await warmResolvedPlaybackSource(resolution.source);
          return;
        }
        const engine = await ensureEngine();
        await Promise.allSettled([
          engine.preloadSourceType(resolution.source.type),
          warmResolvedPlaybackSource(resolution.source),
        ]);
      })
      .catch(() => {
        // Ignore background prefetch failures.
      });
  }, [ensureEngine, resolvePlaybackSource, shouldUseYoutubeEmbedForTrack, warmResolvedPlaybackSource]);

  const attemptYoutubeVideoFallbackPlayback = useCallback(async (track: Track) => {
    if (track.source !== "youtube-music" || track.isVideo !== true) {
      return false;
    }

    const playbackAttempt = beginPlaybackAttempt();
    const currentState = stateRef.current;
    const resumeTime = engineRef.current?.currentTime || currentState.currentTime || 0;
    const shouldResume = !(engineRef.current?.paused ?? true) || currentState.isPlaying;
    const {
      engine,
      source,
      resolvedAudioQuality,
      resolvedAvailableAudioQualityLabels,
      resolvedAudioQualityLabel,
      resolvedVideoQuality,
      capability,
    } = await preparePlaybackTarget(track, currentState.quality, true);
    const fallbackSource = getCompatiblePlaybackFallbackSource(source);

    if (!fallbackSource) {
      return false;
    }

    return withPlaybackEngineTransitionLock(async () => {
      if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
        return false;
      }

      await engine.restore(
        fallbackSource,
        track.replayGain || 0,
        track.peak || 1,
        resumeTime,
      );

      if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
        return false;
      }

      if (shouldResume) {
        await engine.play();
        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
          return false;
        }

        if (engine.paused) {
          throw new Error("Playback did not start after YouTube fallback recovery");
        }
      }

      setState((prev) => ({
        ...prev,
        currentTrack: prev.currentTrack ? applyTrackAudioCapability(prev.currentTrack, capability) : prev.currentTrack,
        resolvedAudioQuality,
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality: getResolvedVideoQualityFromSource(fallbackSource) || resolvedVideoQuality,
        duration: engine.duration || track.duration || prev.duration,
        isLoading: false,
        isPlaying: shouldResume && !engine.paused,
      }));
      setTimeline({
        currentTime: engine.currentTime || resumeTime,
        duration: engine.duration || track.duration || currentState.duration,
        pendingSeekTime: null,
      });
      showInfoToast(`"${track.title}" fell back to a compatible YouTube video stream.`);
      return true;
    });
  }, [beginPlaybackAttempt, isPlaybackAttemptCurrent, preparePlaybackTarget, withPlaybackEngineTransitionLock]);

  const handleTrackPlaybackFailure = useCallback(async (
    track: Track,
    error: unknown,
    options: {
      allowQueueFallback?: boolean;
      diagnosticTitle?: string;
      diagnosticMessage?: string;
      suppressDiagnostic?: boolean;
    } = {},
  ) => {
    const {
      allowQueueFallback = AUTO_SKIP_ON_PLAYBACK_FAILURE,
      diagnosticTitle = "Playback failed",
      diagnosticMessage = `Knobb couldn't load "${track.title}" right now.`,
      suppressDiagnostic = false,
    } = options;

    console.error("Failed to load track:", error);
    if (!suppressDiagnostic) {
      pushAppDiagnostic({
        level: "error",
        title: diagnosticTitle,
        message: diagnosticMessage,
        source: "player",
        dedupeKey: `track-load-failed:${track.id}`,
      });
    }
    void reportClientErrorLazy(error, "player_track_load_failed", {
      trackId: track.id,
      title: track.title,
    });

    const currentState = stateRef.current;
    const nextIndex = allowQueueFallback
      ? getNextQueueIndex(currentState.queue, track, currentState.shuffle, { wrap: currentState.repeat === "all" })
      : null;
    const nextTrack = nextIndex === null ? null : currentState.queue[nextIndex];

    if (nextTrack && nextTrack.id !== track.id) {
      showErrorToast(`"${track.title}" is unavailable right now. Skipping to the next track.`);
      await loadAndPlayRef.current(nextTrack);
      return;
    }

    const detailedReason = getPlaybackFailureReason(error, track);

    showErrorToast(
      detailedReason
        ? `"${track.title}" is unavailable to play right now. ${formatPlaybackFailureToast(detailedReason)}`
        : `"${track.title}" is unavailable to play right now.`,
    );
    deactivateYoutubeEmbedPlayback();
    clearCurrentStatus();
    setTimeline({
      currentTime: 0,
      duration: 0,
      pendingSeekTime: null,
    });
    setState((prev) => ({
      ...prev,
      currentTrack: null,
      resolvedAudioQuality: null,
      resolvedAvailableAudioQualityLabels: [],
      resolvedAudioQualityLabel: null,
      resolvedVideoQuality: null,
      playbackMode: "native",
      hasPlaybackStarted: false,
      currentTime: 0,
      duration: 0,
      isLoading: false,
      isPlaying: false,
    }));
  }, [clearCurrentStatus, deactivateYoutubeEmbedPlayback]);

  const attemptAudioRecovery = useCallback(async (error: string) => {
    const currentState = stateRef.current;
    const track = currentState.currentTrack;
    if (!track || !isTrackPlayable(track)) {
      return false;
    }

    if (!shouldAttemptAudioRecovery(error, track)) {
      return false;
    }

    const recoveryState = audioRecoveryRef.current;
    if (recoveryState.active) {
      return true;
    }

    if (recoveryState.trackId !== track.id) {
      resetAudioRecovery(track.id);
    }

    const lockedRecoveryQuality = currentState.resolvedAudioQuality
      ?? getPlayableAudioQualityForTrack(currentState.quality, track.source, track.audioQuality, track.isVideo === true);
    const orderedCandidates = getRecoveryQualityOrderForSource(lockedRecoveryQuality, track.source).filter(
      (quality) => !audioRecoveryRef.current.attemptedQualities.includes(quality),
    );

    if (orderedCandidates.length === 0) {
      return false;
    }

    audioRecoveryRef.current = {
      trackId: track.id,
      attemptedQualities: audioRecoveryRef.current.attemptedQualities,
      active: true,
    };

    try {
      const playbackAttempt = beginPlaybackAttempt();
      const resumeTime = engineRef.current?.currentTime || currentState.currentTime || 0;
      for (const nextQuality of orderedCandidates) {
        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
          return false;
        }

        audioRecoveryRef.current = {
          trackId: track.id,
          attemptedQualities: [...audioRecoveryRef.current.attemptedQualities, nextQuality],
          active: true,
        };

        try {
          const {
            engine,
            source,
            resolvedAudioQuality,
            resolvedAvailableAudioQualityLabels,
            resolvedAudioQualityLabel,
            resolvedVideoQuality,
            capability,
          } = await preparePlaybackTarget(track, nextQuality, true);
          if (!source) {
            throw new Error(`No stream URL available for ${nextQuality} recovery`);
          }

          const recovered = await withPlaybackEngineTransitionLock(async () => {
            if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
              return false;
            }

            await engine.restore(
              source,
              track.replayGain || 0,
              track.peak || 1,
              resumeTime,
            );

            if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
              return false;
            }

            await engine.play();

            if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
              return false;
            }

            if (engine.paused) {
              throw new Error(`Playback did not start after ${nextQuality} recovery`);
            }

            setState((prev) => ({
              ...prev,
              currentTrack: prev.currentTrack ? applyTrackAudioCapability(prev.currentTrack, capability) : prev.currentTrack,
              resolvedAudioQuality,
              resolvedAvailableAudioQualityLabels,
              resolvedAudioQualityLabel,
              resolvedVideoQuality: resolvedVideoQuality ?? prev.resolvedVideoQuality,
              duration: engine.duration || track.duration || prev.duration,
              isLoading: false,
              isPlaying: true,
            }));
            setTimeline({
              currentTime: engine.currentTime || resumeTime,
              duration: engine.duration || track.duration || currentState.duration,
              pendingSeekTime: null,
            });

            return true;
          });

          if (recovered) {
            return true;
          }
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
  }, [beginPlaybackAttempt, isPlaybackAttemptCurrent, preparePlaybackTarget, resetAudioRecovery, withPlaybackEngineTransitionLock]);

  const schedulePlaybackInterruptionRecovery = useCallback((reason: "waiting" | "stalled") => {
    if (typeof window === "undefined") return;

    const currentTrack = stateRef.current.currentTrack;
    const engine = engineRef.current;
    if (!currentTrack || !engine) return;

    clearPlaybackInterruptionRecovery();

    const trackId = currentTrack.id;
    playbackInterruptionTimeoutRef.current = window.setTimeout(() => {
      playbackInterruptionTimeoutRef.current = null;

      if (stateRef.current.currentTrack?.id !== trackId) {
        return;
      }

      const activeEngine = engineRef.current;
      if (!activeEngine || !activeEngine.isLoading) {
        return;
      }

      void attemptAudioRecovery(`Playback stalled after ${reason}`);
    }, PLAYBACK_INTERRUPTION_RECOVERY_DELAY_MS);
  }, [attemptAudioRecovery, clearPlaybackInterruptionRecovery]);

  const recordPlaybackInterruptionHealth = useCallback((reason: "waiting" | "stalled") => {
    const track = stateRef.current.currentTrack;
    if (!track) return;

    const occurredAt = Date.now();
    const { nextState, shouldWarn, interruptionCount } = updatePlaybackInterruptionHealth(
      playbackInterruptionHealthRef.current,
      {
        occurredAt,
        trackId: track.id,
      },
    );

    playbackInterruptionHealthRef.current = nextState;

    if (!shouldWarn) {
      return;
    }

    void reportClientEventLazy(
      "warn",
      "player_buffering_health_degraded",
      "Repeated playback interruptions detected",
      {
        interruptionCount,
        quality: stateRef.current.quality,
        reason,
        resolvedAudioQuality: stateRef.current.resolvedAudioQuality,
        source: track.source,
        trackId: track.id,
      },
      "player",
    );
  }, []);

  const loadAndPlay = useCallback(async (
    track: Track,
    options: { allowQueueFallback?: boolean } = {},
  ) => {
    const playbackAttempt = beginPlaybackAttempt();
    beginPlaybackStartup(playbackAttempt, track.id);
    invalidatePendingCrossfadeHandoff();
    deactivateYoutubeEmbedPlayback();
    const shouldUseYoutubeEmbed = shouldUseYoutubeEmbedForTrack(track);
    const youtubeEmbedSourceId = getYoutubeEmbedSourceId(track);
    if (!shouldUseYoutubeEmbed) {
      void warmPlaybackStack({ includeDash: track.isVideo === true });
    }
    resetAudioRecovery(track.id);

    if (!isTrackPlayable(track)) {
      await handleTrackPlaybackFailure(track, new Error("Track is unavailable for playback"), options);
      return;
    }

    setState((prev) => ({
      ...applyPlaybackSurfacePreference(prev, track),
      currentTrack: track,
      resolvedAudioQuality: null,
      resolvedAvailableAudioQualityLabels: [],
      resolvedAudioQualityLabel: null,
      resolvedVideoQuality: null,
      playbackMode: shouldUseYoutubeEmbed ? "youtube-embed" : "native",
      hasPlaybackStarted: true,
      currentTime: 0,
      duration: track.duration,
      isLoading: true,
      isPlaying: false,
    }));
    setTimeline({
      currentTime: 0,
      duration: track.duration,
      pendingSeekTime: null,
    });

    if (shouldUseYoutubeEmbed && youtubeEmbedSourceId) {
      try {
        const started = await withPlaybackEngineTransitionLock(async () => {
          const nativeEngine = engineRef.current ?? await ensureEngine();
          markExpectedPause();
          nativeEngine.pause();
          const embedManager = getYoutubeEmbedManager();
          await embedManager.load(youtubeEmbedSourceId, { autoplay: true });

          if (!isPlaybackAttemptCurrent(playbackAttempt)) {
            return false;
          }

          const nextDuration = embedManager.getDuration() || track.duration;
          setTimeline({
            currentTime: 0,
            duration: nextDuration,
            pendingSeekTime: null,
          });
          setState((prev) => ({
            ...prev,
            playbackMode: "youtube-embed",
            duration: nextDuration,
            isLoading: false,
            isPlaying: true,
          }));
          return true;
        });

        if (!isPlaybackAttemptCurrent(playbackAttempt)) {
          return;
        }
        if (!started) {
          throw new Error("YouTube embed playback did not start");
        }
        syncCurrentStatus(track);
        return;
      } catch (error) {
        if (!isPlaybackAttemptCurrent(playbackAttempt)) {
          return;
        }

        await handleTrackPlaybackFailure(track, error, options);
        return;
      } finally {
        clearPlaybackStartup(playbackAttempt, track.id);
      }
    }

    const playFromResolvedUrl = async (forceRefresh = false) => {
      const {
        engine,
        source,
        resolvedAudioQuality,
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        capability,
      } = await preparePlaybackTarget(track, stateRef.current.quality, forceRefresh);
      if (!source) {
        return false;
      }

      return withPlaybackEngineTransitionLock(async () => {
        if (!isPlaybackAttemptCurrent(playbackAttempt)) {
          return false;
        }

        const attemptPlayback = async (playbackSource: AudioPlaybackSource) => {
          await engine.load(playbackSource, track.replayGain || 0, track.peak || 1);
          if (!isPlaybackAttemptCurrent(playbackAttempt)) {
            return false;
          }

          await engine.play();
          if (!isPlaybackAttemptCurrent(playbackAttempt)) {
            return false;
          }

          if (engine.paused) {
            throw new Error(forceRefresh ? "Playback did not start after stream refresh" : "Playback did not start");
          }

          setState((prev) => ({
            ...prev,
            currentTrack: prev.currentTrack ? applyTrackAudioCapability(prev.currentTrack, capability) : prev.currentTrack,
            resolvedAudioQuality,
            resolvedAvailableAudioQualityLabels,
            resolvedAudioQualityLabel,
            resolvedVideoQuality: getResolvedVideoQualityFromSource(playbackSource) || resolvedVideoQuality,
            duration: engine.duration || track.duration || prev.duration,
            isLoading: false,
            isPlaying: !engine.paused,
          }));

          return true;
        };

        try {
          return await attemptPlayback(source);
        } catch (error) {
          const fallbackSource = getCompatiblePlaybackFallbackSource(source);
          if (!fallbackSource) {
            throw error;
          }

          console.warn("Split YouTube playback failed, falling back to muxed stream:", error);
          const started = await attemptPlayback(fallbackSource);
          if (started) {
            showInfoToast(`"${track.title}" fell back to a compatible YouTube video stream.`);
          }
          return started;
        }
      });
    };

    try {
      const started = await playFromResolvedUrl(false);
      if (!isPlaybackAttemptCurrent(playbackAttempt)) {
        return;
      }
      if (!started) {
        throw new Error("No stream URL available for track");
      }
      syncCurrentStatus(track);
      return;
    } catch (error) {
      if (!isPlaybackAttemptCurrent(playbackAttempt)) {
        return;
      }

      let finalError = error;
      const tidalId = getResolvableTidalId(track);
      const shouldRetryWithFreshSource = Boolean(tidalId) || track.source === "youtube-music";
      if (shouldRetryWithFreshSource) {
        try {
          const refreshed = await playFromResolvedUrl(true);
          if (!isPlaybackAttemptCurrent(playbackAttempt)) {
            return;
          }
          if (refreshed) {
            syncCurrentStatus(track);
            return;
          }
        } catch (refreshError) {
          finalError = refreshError;
        }
      }

      await handleTrackPlaybackFailure(track, finalError, options);
    } finally {
      clearPlaybackStartup(playbackAttempt, track.id);
    }
  }, [applyPlaybackSurfacePreference, beginPlaybackAttempt, beginPlaybackStartup, clearPlaybackStartup, deactivateYoutubeEmbedPlayback, ensureEngine, handleTrackPlaybackFailure, invalidatePendingCrossfadeHandoff, isPlaybackAttemptCurrent, markExpectedPause, preparePlaybackTarget, resetAudioRecovery, shouldUseYoutubeEmbedForTrack, syncCurrentStatus, warmPlaybackStack, withPlaybackEngineTransitionLock]);

  loadAndPlayRef.current = loadAndPlay;

  const warmTrackPlayback = useCallback((track: Track) => {
    if (!isTrackPlayable(track)) {
      return;
    }

    if (shouldUseYoutubeEmbedForTrack(track)) {
      void getYoutubeEmbedManager().warmup().catch(() => {
        // Keep hover/focus warmup best-effort so discovery never surfaces errors.
      });
      return;
    }

    void warmPlaybackStack({ includeDash: track.isVideo === true });
    void resolvePlaybackSource(track, stateRef.current.quality)
      .then((resolution) => {
        if (!resolution.source) {
          return;
        }

        const preloadType = resolution.source.type;
        if (engineRef.current) {
          return Promise.allSettled([
            engineRef.current.preloadSourceType(preloadType),
            warmResolvedPlaybackSource(resolution.source),
          ]).then(() => undefined);
        }

        return ensureEngine().then((engine) =>
          Promise.allSettled([
            engine.preloadSourceType(preloadType),
            warmResolvedPlaybackSource(resolution.source),
          ]).then(() => undefined),
        );
      })
      .catch(() => {
        // Keep hover/focus warmup best-effort so discovery never surfaces errors.
      });
  }, [ensureEngine, resolvePlaybackSource, shouldUseYoutubeEmbedForTrack, warmPlaybackStack, warmResolvedPlaybackSource]);

  const advanceToNext = useCallback((options: { allowWrap?: boolean; restartCurrentWhenQueueEmpty?: boolean } = {}) => {
    const { allowWrap = false, restartCurrentWhenQueueEmpty = false } = options;
    const currentState = stateRef.current;
    if (!currentState.currentTrack) return;

    if (currentState.queue.length === 0) {
      if (restartCurrentWhenQueueEmpty) {
        loadAndPlay(currentState.currentTrack);
      }
      return;
    }

    const nextIndex = getNextQueueIndex(
      currentState.queue,
      currentState.currentTrack,
      currentState.shuffle,
      { wrap: allowWrap },
    );

    if (nextIndex === null) return;
    loadAndPlay(currentState.queue[nextIndex]);
  }, [loadAndPlay]);

  const refreshCurrentTrackQuality = useCallback(async (quality: AudioQuality, previousQuality: AudioQuality) => {
    const currentState = stateRef.current;
    const track = currentState.currentTrack;
    if (!track) return;

    const playbackAttempt = beginPlaybackAttempt();
    invalidatePendingCrossfadeHandoff();
    const resumeTime = engineRef.current?.currentTime || currentState.currentTime || 0;
    const shouldResume = !(engineRef.current?.paused ?? true) || currentState.isPlaying;

    try {
      const {
        engine,
        source,
        resolvedAudioQuality,
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        capability,
      } = await preparePlaybackTarget(track, quality, true);
      if (!source) {
        throw new Error("No stream URL available for selected quality");
      }

      await withPlaybackEngineTransitionLock(async () => {
        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
          return;
        }

        await engine.restore(
          source,
          track.replayGain || 0,
          track.peak || 1,
          resumeTime,
        );

        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
          return;
        }

        if (shouldResume) {
          await engine.play();
          if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
            return;
          }
        }

        setState((prev) => ({
          ...prev,
          currentTrack: prev.currentTrack ? applyTrackAudioCapability(prev.currentTrack, capability) : prev.currentTrack,
          quality,
          resolvedAudioQuality,
          resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel,
          resolvedVideoQuality: resolvedVideoQuality ?? prev.resolvedVideoQuality,
          duration: engine.duration || track.duration || prev.duration,
          isLoading: false,
          isPlaying: shouldResume && !engine.paused,
        }));
        setTimeline({
          currentTime: engine.currentTime || resumeTime,
          duration: engine.duration || track.duration || currentState.duration,
          pendingSeekTime: null,
        });
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
  }, [beginPlaybackAttempt, invalidatePendingCrossfadeHandoff, isPlaybackAttemptCurrent, preparePlaybackTarget, withPlaybackEngineTransitionLock]);

  const refreshVideoPlaybackPreference = useCallback(async () => {
    const currentState = stateRef.current;
    const track = currentState.currentTrack;
    if (!track || track.isVideo !== true) {
      return;
    }

    if (currentState.playbackMode === "youtube-embed" && isYoutubeEmbedEligibleTrack(track)) {
      showInfoToast("Video quality is managed by YouTube for embedded playback.");
      return;
    }

    const playbackAttempt = beginPlaybackAttempt();
    invalidatePendingCrossfadeHandoff();
    const resumeTime = engineRef.current?.currentTime || currentState.currentTime || 0;
    const shouldResume = !(engineRef.current?.paused ?? true) || currentState.isPlaying;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const {
        engine,
        source,
        resolvedAudioQuality,
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        capability,
      } = await preparePlaybackTarget(track, currentState.quality, true);
      if (!source) {
        throw new Error("No stream URL available for selected video quality");
      }

      let nextResolvedVideoQuality = resolvedVideoQuality;
      await withPlaybackEngineTransitionLock(async () => {
        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
          return;
        }

        const restoreSource = async (playbackSource: AudioPlaybackSource) => {
          await engine.restore(
            playbackSource,
            track.replayGain || 0,
            track.peak || 1,
            resumeTime,
          );

          if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
            return false;
          }

          if (shouldResume) {
            await engine.play();
            if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== track.id) {
              return false;
            }
          }
          nextResolvedVideoQuality = getResolvedVideoQualityFromSource(playbackSource) || nextResolvedVideoQuality;
          return true;
        };

        try {
          const restored = await restoreSource(source);
          if (!restored) {
            return;
          }
        } catch (error) {
          const fallbackSource = getCompatiblePlaybackFallbackSource(source);
          if (!fallbackSource) {
            throw error;
          }

          console.warn("Split YouTube video refresh failed, falling back to muxed stream:", error);
          const restored = await restoreSource(fallbackSource);
          if (!restored) {
            return;
          }
          showInfoToast(`"${track.title}" fell back to a compatible YouTube video stream.`);
        }

        setState((prev) => ({
          ...prev,
          currentTrack: prev.currentTrack ? applyTrackAudioCapability(prev.currentTrack, capability) : prev.currentTrack,
          resolvedAudioQuality,
          resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel,
          resolvedVideoQuality: nextResolvedVideoQuality ?? prev.resolvedVideoQuality,
          duration: engine.duration || track.duration || prev.duration,
          isLoading: false,
          isPlaying: shouldResume && !engine.paused,
        }));
        setTimeline({
          currentTime: engine.currentTime || resumeTime,
          duration: engine.duration || track.duration || currentState.duration,
          pendingSeekTime: null,
        });
      });
    } catch (error) {
      console.error("Failed to refresh video playback preference:", error);
      void reportClientErrorLazy(error, "player_video_quality_refresh_failed", {
        source: track.source,
        sourceId: track.sourceId,
        trackId: track.id,
      });
      showErrorToast("Couldn't switch video quality right now.");
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [beginPlaybackAttempt, invalidatePendingCrossfadeHandoff, isPlaybackAttemptCurrent, preparePlaybackTarget, withPlaybackEngineTransitionLock]);

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
    engineRef.current.setLoop(state.repeat === "one");
  }, [engineReadyVersion, state.repeat]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPreservePitch(state.preservePitch);
  }, [engineReadyVersion, state.preservePitch]);


  useEffect(() => {
    if (!state.sleepTimerEndsAt) return;

    const remainingMs = state.sleepTimerEndsAt - Date.now();
    if (remainingMs <= 0) {
      markExpectedPause();
      if (stateRef.current.playbackMode === "youtube-embed") {
        getYoutubeEmbedManager().pause();
      } else {
        engineRef.current?.pause();
      }
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        sleepTimerEndsAt: null,
      }));
      showInfoToast("Sleep timer ended. Playback paused.");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      markExpectedPause();
      if (stateRef.current.playbackMode === "youtube-embed") {
        getYoutubeEmbedManager().pause();
      } else {
        engineRef.current?.pause();
      }
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        sleepTimerEndsAt: null,
      }));
      showInfoToast("Sleep timer ended. Playback paused.");
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [markExpectedPause, state.sleepTimerEndsAt]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.on("timeupdate", (currentTime: number, duration: number) => {
      const nextDuration = duration || stateRef.current.currentTrack?.duration || 0;
      const nextIsPlaying = !engine.paused;
      const nextTrackId = stateRef.current.currentTrack?.id ?? null;
      const activePendingSeek = pendingSeekRef.current;
      const stabilizedCurrentTime = stabilizePlaybackProgressTime(
        stateRef.current.currentTime,
        currentTime,
        {
          duration: nextDuration,
          isPlaying: nextIsPlaying,
          pendingSeek: activePendingSeek,
        },
      );
      const nextProgress = { currentTime: stabilizedCurrentTime, trackId: nextTrackId };

      if (shouldIgnoreProgressWhileSeekSettles(activePendingSeek, nextProgress)) {
        const stabilizedTime = activePendingSeek?.time ?? stateRef.current.currentTime;

        stateRef.current = {
          ...stateRef.current,
          currentTime: stabilizedTime,
          duration: nextDuration,
          isPlaying: nextIsPlaying,
        };

        setTimeline((prev) => (
          prev.duration === nextDuration
            ? prev
            : {
              ...prev,
              duration: nextDuration,
            }
        ));

        setState((prev) => {
          if (prev.duration === nextDuration && prev.isPlaying === nextIsPlaying) {
            return prev;
          }

          return {
            ...prev,
            duration: nextDuration,
            isPlaying: nextIsPlaying,
          };
        });
        return;
      }

      if (activePendingSeek?.trackId === nextTrackId) {
        clearPendingSeek(nextTrackId);
      }

      stateRef.current = {
        ...stateRef.current,
        currentTime: stabilizedCurrentTime,
        duration: nextDuration,
        isPlaying: nextIsPlaying,
      };

      const nextSnapshot = {
        currentTime: stabilizedCurrentTime,
        duration: nextDuration,
        isPlaying: nextIsPlaying,
        trackId: nextTrackId,
      };

      if (!shouldCommitPlayerProgressUpdate(lastProgressRenderRef.current, nextSnapshot)) {
        return;
      }

      lastProgressRenderRef.current = nextSnapshot;
      setTimeline((prev) => (
        prev.currentTime === stabilizedCurrentTime && prev.duration === nextDuration && prev.pendingSeekTime === null
          ? prev
          : {
            currentTime: stabilizedCurrentTime,
            duration: nextDuration,
            pendingSeekTime: null,
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
      if (engine.isCrossfading || transitionInProgressRef.current) return;
      const currentState = stateRef.current;
      if (currentState.repeat === "one") {
        engine.seek(0);
        void engine.play().catch(async () => {
          if (stateRef.current.currentTrack) {
            await loadAndPlay(stateRef.current.currentTrack, { allowQueueFallback: false });
          }
        });
        return;
      }

      if (currentState.currentTrack) {
        const currentIndex = getQueueTrackIndex(currentState.queue, currentState.currentTrack);
        const hasFollowingTrack = currentIndex >= 0 && currentIndex < currentState.queue.length - 1;

        if (currentState.repeat === "all" || hasFollowingTrack || currentState.shuffle) {
          advanceToNext({
            allowWrap: currentState.repeat === "all",
            restartCurrentWhenQueueEmpty: currentState.repeat === "all",
          });
          return;
        }
      }

      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false }));
    });

    engine.on("crossfade", async () => {
      const currentState = stateRef.current;
      if (!currentState.currentTrack || currentState.queue.length === 0) {
        engine.cancelPendingCrossfade();
        return;
      }

      const triggerTrack = currentState.currentTrack;
      const triggerTrackId = triggerTrack.id;

      const currentIndex = getQueueTrackIndex(currentState.queue, triggerTrack);
      if (currentState.repeat === "one") {
        engine.cancelPendingCrossfade();
        return;
      }

      if (!currentState.shuffle && currentIndex === currentState.queue.length - 1 && currentState.repeat !== "all") {
        engine.cancelPendingCrossfade();
        return;
      }

      const nextIndex = getNextQueueIndex(
        currentState.queue,
        triggerTrack,
        currentState.shuffle,
        { wrap: currentState.repeat === "all" },
      );
      if (nextIndex === null) {
        engine.cancelPendingCrossfade();
        return;
      }

      const nextTrack = currentState.queue[nextIndex];
      const nextTrackQueueKey = getTrackMixQueueKey(nextTrack);
      const crossfadeAttempt = crossfadeAttemptRef.current + 1;
      crossfadeAttemptRef.current = crossfadeAttempt;

      const {
        source,
        resolvedAudioQuality,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        capability,
      } = await preparePlaybackTarget(nextTrack, currentState.quality);
      if (!source) {
        engine.cancelPendingCrossfade();
        return;
      }

      if (crossfadeAttemptRef.current !== crossfadeAttempt || stateRef.current.currentTrack?.id !== triggerTrackId) {
        engine.cancelPendingCrossfade();
        return;
      }

      const latestState = stateRef.current;
      const latestNextIndex = getNextQueueIndex(
        latestState.queue,
        latestState.currentTrack,
        latestState.shuffle,
        { wrap: latestState.repeat === "all" },
      );
      if (latestNextIndex === null) {
        engine.cancelPendingCrossfade();
        return;
      }

      const latestNextTrack = latestState.queue[latestNextIndex];
      if (!latestNextTrack || getTrackMixQueueKey(latestNextTrack) !== nextTrackQueueKey) {
        engine.cancelPendingCrossfade();
        return;
      }

      transitionInProgressRef.current = true;
      setTimeline({
        currentTime: 0,
        duration: nextTrack.duration,
        pendingSeekTime: null,
      });
      setState((prev) => ({
        ...prev,
        currentTrack: applyTrackAudioCapability(nextTrack, capability),
        currentTime: 0,
        duration: nextTrack.duration,
        resolvedAudioQuality,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
      }));

      try {
        await engine.crossfadeInto(source, nextTrack.replayGain || 0, nextTrack.peak || 1);
      } catch (error) {
        if (crossfadeAttemptRef.current !== crossfadeAttempt || stateRef.current.currentTrack?.id !== nextTrack.id) {
          return;
        }

        console.error("Crossfade handoff failed:", error);
        void reportClientErrorLazy(error, "player_crossfade_handoff_failed", {
          trackId: nextTrack.id,
        });
        await loadAndPlay(nextTrack, { allowQueueFallback: false });
      } finally {
        if (crossfadeAttemptRef.current === crossfadeAttempt) {
          transitionInProgressRef.current = false;
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    });

    engine.on("play", () => {
      clearPlaybackInterruptionRecovery();
      clearUnexpectedPauseRecovery();
      clearPlaybackStartup(undefined, stateRef.current.currentTrack?.id ?? null);
      const currentTrack = stateRef.current.currentTrack;
      if (currentTrack) {
        syncCurrentStatus(currentTrack);
      }
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    });

    engine.on("pause", () => {
      if (recoverFromUnexpectedPause("native")) {
        return;
      }

      clearPlaybackInterruptionRecovery();
      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false }));
    });

    engine.on("error", (error: string) => {
      clearPlaybackInterruptionRecovery();
      void (async () => {
        if (error.startsWith("Web Audio effects unavailable:")) {
          console.warn("Audio engine warning:", error);
          void reportClientErrorLazy(error, "audio_engine_effects_unavailable");
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const currentTrack = stateRef.current.currentTrack;
        if (isPlaybackStartupActiveForTrack(currentTrack?.id)) {
          console.warn("Ignoring runtime media error during active playback startup:", error);
          return;
        }

        if (currentTrack?.source === "youtube-music" && currentTrack.isVideo === true) {
          try {
            const recoveredWithFallback = await attemptYoutubeVideoFallbackPlayback(currentTrack);
            if (recoveredWithFallback) {
              return;
            }
          } catch (fallbackError) {
            console.error("YouTube video fallback recovery failed:", fallbackError);
            void reportClientErrorLazy(fallbackError, "youtube_video_fallback_recovery_failed", {
              sourceId: currentTrack.sourceId,
              trackId: currentTrack.id,
            });
          }
        }

        const recovered = await attemptAudioRecovery(error);
        if (recovered) {
          return;
        }

        console.error("Audio engine error:", error);
        void reportClientErrorLazy(error, "audio_engine_error");

        const failedTrack = stateRef.current.currentTrack;
        if (failedTrack) {
          await handleTrackPlaybackFailure(failedTrack, error, {
            suppressDiagnostic: true,
          });
          return;
        }

        setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
      })();
    });

    engine.on("loadstart", () => {
      setState((prev) => ({ ...prev, isLoading: true }));
    });

    engine.on("interrupted", (reason) => {
      recordPlaybackInterruptionHealth(reason);
      schedulePlaybackInterruptionRecovery(reason);
    });

    engine.on("canplay", () => {
      clearPlaybackInterruptionRecovery();
      if (!engine.paused) {
        return;
      }

      setState((prev) => ({ ...prev, isLoading: false }));
    });

    return () => {
      engine.on("play", () => { });
      engine.on("pause", () => { });
      engine.on("ended", () => { });
      engine.on("timeupdate", () => { });
      engine.on("error", () => { });
      engine.on("loadstart", () => { });
      engine.on("canplay", () => { });
      engine.on("crossfade", () => { });
      engine.on("interrupted", () => { });
    };
  }, [advanceToNext, attemptAudioRecovery, attemptYoutubeVideoFallbackPlayback, clearCurrentStatus, clearPendingSeek, clearPlaybackInterruptionRecovery, clearPlaybackStartup, clearUnexpectedPauseRecovery, engineReadyVersion, handleTrackPlaybackFailure, isPlaybackStartupActiveForTrack, loadAndPlay, preparePlaybackTarget, recordPlaybackInterruptionHealth, recoverFromUnexpectedPause, schedulePlaybackInterruptionRecovery, syncCurrentStatus]);

  useEffect(() => {
    resetAudioRecovery(state.currentTrack?.id ?? null);
  }, [resetAudioRecovery, state.currentTrack?.id]);

  useEffect(() => clearUnexpectedPauseRecovery, [clearUnexpectedPauseRecovery]);

  useEffect(() => {
    if (!state.currentTrack) return;

    const nextIndex = getNextQueueIndex(state.queue, state.currentTrack, state.shuffle, {
      wrap: state.repeat === "all",
    });
    if (nextIndex === null) return;

    const nextTrack = state.queue[nextIndex];
    if (!nextTrack || nextTrack.isUnavailable) return;

    const timeoutId = window.setTimeout(() => {
      prefetchPlaybackSource(nextTrack, state.quality);
    }, nextTrack.isVideo === true ? 150 : state.isPlaying ? 1000 : 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [prefetchPlaybackSource, state.currentTrack, state.isPlaying, state.quality, state.queue, state.repeat, state.shuffle]);

  useEffect(() => {
    const embedManager = getYoutubeEmbedManager();

    const handleTimeUpdate = (currentTime: number, duration: number) => {
      if (stateRef.current.playbackMode !== "youtube-embed") {
        return;
      }

      const nextDuration = duration || stateRef.current.currentTrack?.duration || 0;
      const nextIsPlaying = !embedManager.isPaused();
      const nextTrackId = stateRef.current.currentTrack?.id ?? null;
      const activePendingSeek = pendingSeekRef.current;
      const stabilizedCurrentTime = stabilizePlaybackProgressTime(
        stateRef.current.currentTime,
        currentTime,
        {
          duration: nextDuration,
          isPlaying: nextIsPlaying,
          pendingSeek: activePendingSeek,
        },
      );

      if (activePendingSeek?.trackId === nextTrackId) {
        clearPendingSeek(nextTrackId);
      }

      stateRef.current = {
        ...stateRef.current,
        currentTime: stabilizedCurrentTime,
        duration: nextDuration,
        isPlaying: nextIsPlaying,
      };

      setTimeline((prev) => (
        prev.currentTime === stabilizedCurrentTime && prev.duration === nextDuration && prev.pendingSeekTime === null
          ? prev
          : {
            currentTime: stabilizedCurrentTime,
            duration: nextDuration,
            pendingSeekTime: null,
          }
      ));
      setState((prev) => {
        if (
          prev.duration === nextDuration &&
          prev.isPlaying === nextIsPlaying &&
          prev.isLoading === false
        ) {
          return prev;
        }

        return {
          ...prev,
          duration: nextDuration,
          isPlaying: nextIsPlaying,
          isLoading: false,
        };
      });
    };

    const handlePlay = () => {
      if (stateRef.current.playbackMode !== "youtube-embed") {
        return;
      }

      clearPlaybackInterruptionRecovery();
      clearUnexpectedPauseRecovery();
      clearPlaybackStartup(undefined, stateRef.current.currentTrack?.id ?? null);
      const currentTrack = stateRef.current.currentTrack;
      if (currentTrack) {
        syncCurrentStatus(currentTrack);
      }
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    };

    const handlePause = () => {
      if (stateRef.current.playbackMode !== "youtube-embed") {
        return;
      }

      if (recoverFromUnexpectedPause("youtube-embed")) {
        return;
      }

      clearPlaybackInterruptionRecovery();
      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
    };

    const handleEnded = () => {
      if (stateRef.current.playbackMode !== "youtube-embed") {
        return;
      }

      const currentState = stateRef.current;
      if (currentState.repeat === "one") {
        embedManager.seek(0);
        void embedManager.play();
        return;
      }

      if (currentState.currentTrack) {
        const currentIndex = getQueueTrackIndex(currentState.queue, currentState.currentTrack);
        const hasFollowingTrack = currentIndex >= 0 && currentIndex < currentState.queue.length - 1;

        if (currentState.repeat === "all" || hasFollowingTrack || currentState.shuffle) {
          advanceToNext({
            allowWrap: currentState.repeat === "all",
            restartCurrentWhenQueueEmpty: currentState.repeat === "all",
          });
          return;
        }
      }

      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    const handleError = (error: string) => {
      if (stateRef.current.playbackMode !== "youtube-embed") {
        return;
      }

      console.error("YouTube embed playback error:", error);
      void reportClientErrorLazy(error, "youtube_embed_error");
      showErrorToast("YouTube playback is unavailable right now.");
      clearCurrentStatus();
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
    };

    const unsubscribeTimeUpdate = embedManager.on("timeupdate", handleTimeUpdate);
    const unsubscribePlay = embedManager.on("play", handlePlay);
    const unsubscribePause = embedManager.on("pause", handlePause);
    const unsubscribeEnded = embedManager.on("ended", handleEnded);
    const unsubscribeError = embedManager.on("error", handleError);

    return () => {
      unsubscribeTimeUpdate();
      unsubscribePlay();
      unsubscribePause();
      unsubscribeEnded();
      unsubscribeError();
    };
  }, [advanceToNext, clearCurrentStatus, clearPendingSeek, clearPlaybackInterruptionRecovery, clearPlaybackStartup, clearUnexpectedPauseRecovery, deactivateYoutubeEmbedPlayback, recoverFromUnexpectedPause, syncCurrentStatus]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setVolume(state.volume);
  }, [engineReadyVersion, state.volume]);

  useLayoutEffect(() => applyTrackAccent(state.currentTrack), [state.currentTrack]);

  useEffect(() => {
    if (!state.currentTrack) {
      updateMediaSessionMetadata(null);
      return;
    }

    updateMediaSessionMetadata(state.currentTrack);
  }, [mediaSessionTrackSignature, state.currentTrack, state.isPlaying]);

  useEffect(() => {
    updateMediaSessionPlaybackState(state.isPlaying, Boolean(state.currentTrack));
  }, [state.currentTrack, state.isPlaying]);

  useEffect(() => {
    return subscribeToDiscordPresenceBridge(() => {
      setDiscordPresenceBridgeVersion((version) => version + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeToDiscordWebhookSettings(() => {
      setDiscordWebhookSettingsVersion((version) => version + 1);
    });
  }, []);

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
    discordPresenceBridgeVersion,
    discordPresenceEnabled,
    state.currentTrack,
    state.currentTrack?.id,
    state.isPlaying,
    discordPresenceTimeBucket,
    state.duration,
  ]);

  useEffect(() => {
    void syncDiscordWebhookPresence({
      track: state.currentTrack,
      isPlaying: state.isPlaying,
      currentTime: stateRef.current.currentTime,
      duration: state.duration || state.currentTrack?.duration || 0,
    }).catch((error) => {
      console.error("Failed to sync Discord web sharing", error);
    });
  }, [
    discordWebhookSettingsVersion,
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
        if (shouldUseYoutubeEmbedForTrack(restoredTrack)) {
          const youtubeEmbedSourceId = getYoutubeEmbedSourceId(restoredTrack);
          if (!youtubeEmbedSourceId) {
            return;
          }

          const embedManager = getYoutubeEmbedManager();
          await embedManager.load(youtubeEmbedSourceId, {
            autoplay: false,
            startSeconds: stateRef.current.currentTime,
          });

          const embedDuration = embedManager.getDuration() || restoredTrack.duration || stateRef.current.duration;
          setTimeline((prev) => ({
            ...prev,
            duration: embedDuration,
          }));
          setState((prev) => ({
            ...applyPlaybackSurfacePreference(prev, restoredTrack),
            playbackMode: "youtube-embed",
            duration: embedDuration,
            isLoading: false,
            isPlaying: false,
          }));
          return;
        }

        const {
          engine,
          source,
          resolvedAudioQuality,
          resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel,
          resolvedVideoQuality,
        } = await preparePlaybackTarget(restoredTrack, stateRef.current.quality);

        if (!source) return;

        await engine.restore(
          source,
          restoredTrack.replayGain || 0,
          restoredTrack.peak || 1,
          stateRef.current.currentTime,
        );
        setState((prev) => ({
          ...prev,
          resolvedAudioQuality: resolvedAudioQuality ?? prev.resolvedAudioQuality,
          resolvedAvailableAudioQualityLabels: resolvedAvailableAudioQualityLabels.length > 0
            ? resolvedAvailableAudioQualityLabels
            : prev.resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel: resolvedAudioQualityLabel ?? prev.resolvedAudioQualityLabel,
          resolvedVideoQuality: resolvedVideoQuality ?? prev.resolvedVideoQuality,
        }));
      } catch (error) {
        console.error("Failed to restore playback session:", error);
        void reportClientErrorLazy(error, "player_restore_failed");
      }
    })();
  }, [applyPlaybackSurfacePreference, preparePlaybackTarget, shouldUseYoutubeEmbedForTrack]);

  const restoreRemoteSession = useCallback(async (snapshot: PlaybackSessionSnapshot) => {
    const playbackAttempt = beginPlaybackAttempt();
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

    invalidatePendingCrossfadeHandoff();

    const queue = requestedQueue.some((track) => track.id === currentTrack.id)
      ? requestedQueue
      : [currentTrack, ...requestedQueue];
    const resumeTime = Math.max(0, snapshot.currentTime || 0);
    const nextQuality = snapshot.quality || stateRef.current.quality;
    const initialDuration = snapshot.duration || currentTrack.duration || previousState.duration;

    setState((prev) => ({
      ...applyPlaybackSurfacePreference(prev, currentTrack),
      currentTrack,
      resolvedAudioQuality: null,
      resolvedAvailableAudioQualityLabels: [],
      resolvedAudioQualityLabel: null,
      resolvedVideoQuality: null,
      queue,
      currentTime: resumeTime,
      duration: snapshot.duration || currentTrack.duration || prev.duration,
      hasPlaybackStarted: true,
      isLoading: true,
      isPlaying: false,
      autoQualityEnabled: nextQuality === "AUTO",
      quality: nextQuality,
    }));
    setTimeline({
      currentTime: resumeTime,
      duration: initialDuration,
      pendingSeekTime: null,
    });

    try {
      const {
        engine,
        source,
        resolvedAudioQuality,
        resolvedAvailableAudioQualityLabels,
        resolvedAudioQualityLabel,
        resolvedVideoQuality,
        capability,
      } = await preparePlaybackTarget(currentTrack, nextQuality);
      if (!source) {
        throw new Error("No stream URL available for the selected remote track");
      }

      await withPlaybackEngineTransitionLock(async () => {
        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== currentTrack.id) {
          return;
        }

        await engine.restore(
          source,
          currentTrack.replayGain || 0,
          currentTrack.peak || 1,
          resumeTime,
        );

        if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== currentTrack.id) {
          return;
        }

        if (snapshot.isPlaying) {
          await engine.play();
          if (!isPlaybackAttemptCurrent(playbackAttempt) || stateRef.current.currentTrack?.id !== currentTrack.id) {
            return;
          }
        } else {
          markExpectedPause();
          engine.pause();
        }

        persistAudioQuality(nextQuality);
        if (snapshot.isPlaying) {
          syncCurrentStatus(currentTrack);
        } else {
          clearCurrentStatus();
        }
        setState((prev) => ({
          ...applyPlaybackSurfacePreference(prev, currentTrack),
          currentTrack: applyTrackAudioCapability(currentTrack, capability),
          resolvedAudioQuality,
          resolvedAvailableAudioQualityLabels,
          resolvedAudioQualityLabel,
          resolvedVideoQuality,
          queue,
          duration: engine.duration || snapshot.duration || currentTrack.duration || prev.duration,
          hasPlaybackStarted: true,
          isLoading: false,
          isPlaying: snapshot.isPlaying && !engine.paused,
          autoQualityEnabled: nextQuality === "AUTO",
          quality: nextQuality,
        }));
        setTimeline({
          currentTime: engine.currentTime || resumeTime,
          duration: engine.duration || snapshot.duration || currentTrack.duration || initialDuration,
          pendingSeekTime: null,
        });
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
          const { source: previousSource } = await preparePlaybackTarget(previousTrack, previousQuality);
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
              markExpectedPause();
              engine.pause();
            }
          } else {
            markExpectedPause();
            engine.pause();
          }
        } else {
          markExpectedPause();
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
        pendingSeekTime: null,
      });
      setState(previousState);
      throw error;
    }
  }, [applyPlaybackSurfacePreference, beginPlaybackAttempt, clearCurrentStatus, ensureEngine, invalidatePendingCrossfadeHandoff, isPlaybackAttemptCurrent, markExpectedPause, preparePlaybackTarget, syncCurrentStatus, withPlaybackEngineTransitionLock]);

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
    void primeMediaPlayback();
    engineRef.current?.preparePlayback();
    const requestedQueue = queue ? filterPlayableTracks(queue) : [];
    const nextTrack = isTrackPlayable(track) ? track : requestedQueue[0];
    const nextQueue = nextTrack
      ? requestedQueue.length === 0
        ? [nextTrack]
        : requestedQueue.some((queuedTrack) => queuedTrack.id === nextTrack.id)
          ? requestedQueue
          : [nextTrack, ...requestedQueue]
      : requestedQueue;

    if (!nextTrack) {
      setState((prev) => ({
        ...prev,
        queue: nextQueue.length > 0 ? nextQueue : prev.queue,
        isLoading: false,
      }));
      if (!isTrackPlayable(track)) {
        showErrorToast(`"${track.title}" is unavailable to play right now.`);
      }
      return;
    }

    prefetchPlaybackSource(nextTrack);
    setState((prev) => ({
      ...applyPlaybackSurfacePreference(prev, nextTrack),
      hasPlaybackStarted: true,
      queue: nextQueue,
    }));
    void loadAndPlay(nextTrack);
  }, [applyPlaybackSurfacePreference, loadAndPlay, prefetchPlaybackSource]);

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

  const playArtist = useCallback(async (
    artistId: number | string,
    artistName?: string,
    source: "tidal" | "youtube-music" = "tidal",
  ) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      if (source !== "tidal" || typeof artistId !== "number") {
        throw new Error("YouTube Music artist playback is no longer supported outside search results");
      }

      const appTracks = await loadMusicApiModule().then(async (musicApi) => {
        const tracks = await musicApi.getArtistPopularTracks(artistId, 50);
        return filterPlayableTracks(tracks.map((track) => musicApi.tidalTrackToAppTrack(track)));
      });

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
        dedupeKey: `play-artist-failed:${source}:${artistId}`,
      });
      void reportClientErrorLazy(error, "player_artist_play_failed", { artistId: String(artistId), source });
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

    if (stateRef.current.playbackMode === "youtube-embed") {
      const embedManager = getYoutubeEmbedManager();
      void (async () => {
        if (embedManager.isPaused()) {
          setState((prev) => (
            prev.hasPlaybackStarted
              ? prev
              : { ...prev, hasPlaybackStarted: Boolean(prev.currentTrack) }
          ));
          await embedManager.play().catch((error) => {
            console.error("Failed to resume YouTube embed playback:", error);
            showErrorToast("YouTube playback is unavailable right now.");
          });
          return;
        }

        markExpectedPause();
        embedManager.pause();
      })();
      return;
    }

    void primeMediaPlayback();
    engineRef.current?.preparePlayback();
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

      markExpectedPause();
      engine.pause();
    })();
  }, [ensureEngine, loadAndPlay, markExpectedPause]);

  const next = useCallback(() => {
    if (!stateRef.current.hasPlaybackStarted && stateRef.current.currentTrack) {
      setState((prev) => ({ ...prev, hasPlaybackStarted: true }));
    }
    advanceToNext({
      allowWrap: stateRef.current.repeat === "all",
    });
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
    if (!currentState.currentTrack) return;

    if (!currentState.hasPlaybackStarted) {
      setState((prev) => ({ ...prev, hasPlaybackStarted: true }));
    }

    const currentPlaybackTime = currentState.playbackMode === "youtube-embed"
      ? getYoutubeEmbedManager().getCurrentTime()
      : (engineRef.current?.currentTime || 0);

    if (currentPlaybackTime > 3) {
      if (currentState.playbackMode === "youtube-embed") {
        getYoutubeEmbedManager().seek(0);
      } else {
        engineRef.current?.seek(0);
      }
      return;
    }

    if (currentState.queue.length === 0) {
      if (currentState.playbackMode === "youtube-embed") {
        getYoutubeEmbedManager().seek(0);
      } else {
        engineRef.current?.seek(0);
      }
      return;
    }

    const previousIndex = getPreviousQueueIndex(currentState.queue, currentState.currentTrack, {
      wrap: currentState.repeat === "all",
    });
    if (previousIndex === null) return;
    void loadAndPlay(currentState.queue[previousIndex]);
  }, [loadAndPlay]);

  const seek = useCallback((time: number) => {
    const currentDuration = stateRef.current.playbackMode === "youtube-embed"
      ? getYoutubeEmbedManager().getDuration()
      : engineRef.current?.duration
      || stateRef.current.duration
      || stateRef.current.currentTrack?.duration
      || 0;
    const nextTime = Number.isFinite(time)
      ? Math.min(Math.max(time, 0), currentDuration > 0 ? currentDuration : time)
      : 0;

    if (stateRef.current.playbackMode === "youtube-embed") {
      getYoutubeEmbedManager().seek(nextTime);
    } else {
      engineRef.current?.seek(nextTime);
    }
    armPendingSeek(nextTime);
    stateRef.current = {
      ...stateRef.current,
      currentTime: nextTime,
    };
    setTimeline((prev) => ({
      ...prev,
      currentTime: nextTime,
      pendingSeekTime: nextTime,
    }));
  }, [armPendingSeek]);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    const nextRepeat = stateRef.current.repeat === "off"
      ? "all"
      : stateRef.current.repeat === "all"
        ? "one"
        : "off";

    // Make repeat mode effective immediately for end-of-track handlers that read from the ref.
    stateRef.current = {
      ...stateRef.current,
      repeat: nextRepeat,
    };

    setState((prev) => ({
      ...prev,
      repeat: nextRepeat,
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

  const setFullScreen = useCallback((isFullScreen: boolean) => {
    setState((prev) => (prev.isFullScreen === isFullScreen ? prev : { ...prev, isFullScreen }));
  }, []);

  const toggleFullScreen = useCallback(() => {
    setState((prev) => ({ ...prev, isFullScreen: !prev.isFullScreen }));
  }, []);

  const setQuality = useCallback((quality: AudioQuality) => {
    const currentState = stateRef.current;
    const previousQuality = currentState.quality;
    if (previousQuality === quality) return;

    if (currentState.playbackMode === "youtube-embed" && getYoutubeEmbedSourceId(currentState.currentTrack)) {
      persistAudioQuality(quality);
      persistAutoQualityEnabled(quality === "AUTO");
      setState((prev) => ({
        ...prev,
        autoQualityEnabled: quality === "AUTO",
        quality,
        isLoading: false,
      }));
      showInfoToast("Playback quality is managed by YouTube for embedded playback.");
      return;
    }

    const currentTrack = currentState.currentTrack;
    const currentTrackSource = currentTrack ? getTrackSource(currentTrack) : null;
    const currentTrackCapability = currentTrack?.audioQuality || null;
    const currentResolvedQuality = currentState.resolvedAudioQuality
      || (currentTrack
        ? getPlayableAudioQualityForTrack(
            previousQuality,
            currentTrackSource,
            currentTrackCapability,
            currentTrack.isVideo === true,
          )
        : null);
    const nextResolvedQuality = currentTrack
      ? getPlayableAudioQualityForTrack(
          quality,
          currentTrackSource,
          currentTrackCapability,
          currentTrack.isVideo === true,
        )
      : null;
    const shouldReloadCurrentTrack = Boolean(currentTrack && currentResolvedQuality !== nextResolvedQuality);

    persistAudioQuality(quality);
    persistAutoQualityEnabled(quality === "AUTO");
    setState((prev) => ({
      ...prev,
      autoQualityEnabled: quality === "AUTO",
      quality,
      resolvedAudioQuality: shouldReloadCurrentTrack ? prev.resolvedAudioQuality : nextResolvedQuality,
      resolvedAvailableAudioQualityLabels: shouldReloadCurrentTrack ? [] : prev.resolvedAvailableAudioQualityLabels,
      resolvedAudioQualityLabel: shouldReloadCurrentTrack ? null : prev.resolvedAudioQualityLabel,
      isLoading: shouldReloadCurrentTrack ? true : prev.isLoading,
    }));

    if (currentTrack && shouldReloadCurrentTrack) {
      void refreshCurrentTrackQuality(quality, previousQuality);
    }
  }, [refreshCurrentTrackQuality]);

  const setAutoQualityEnabled = useCallback((enabled: boolean) => {
    const currentQuality = stateRef.current.quality;
    const nextQuality = enabled ? "AUTO" : currentQuality === "AUTO" ? "HIGH" : currentQuality;
    persistAutoQualityEnabled(enabled);
    persistAudioQuality(nextQuality);
    setState((prev) => ({
      ...prev,
      autoQualityEnabled: enabled,
      quality: nextQuality,
    }));
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
      const isEmbedMode = stateRef.current.playbackMode === "youtube-embed";
      const isPaused = isEmbedMode
        ? getYoutubeEmbedManager().isPaused()
        : (engineRef.current?.paused ?? true);

      if (!isPaused || stateRef.current.currentTrack) {
        togglePlay();
      }
    };
    const handlePause = () => {
      const isEmbedMode = stateRef.current.playbackMode === "youtube-embed";
      const isPaused = isEmbedMode
        ? getYoutubeEmbedManager().isPaused()
        : (engineRef.current?.paused ?? true);

      if (!isPaused) {
        togglePlay();
      }
    };
    const handleSeekBackward = (details?: MediaSessionActionDetails) => {
      const currentTime = stateRef.current.playbackMode === "youtube-embed"
        ? getYoutubeEmbedManager().getCurrentTime()
        : (engineRef.current?.currentTime || 0);
      seek(Math.max(0, currentTime - (details?.seekOffset || MEDIA_SESSION_SKIP_SECONDS)));
    };
    const handleSeekForward = (details?: MediaSessionActionDetails) => {
      const duration = stateRef.current.playbackMode === "youtube-embed"
        ? getYoutubeEmbedManager().getDuration()
        : engineRef.current?.duration || stateRef.current.duration || 0;
      const currentTime = stateRef.current.playbackMode === "youtube-embed"
        ? getYoutubeEmbedManager().getCurrentTime()
        : (engineRef.current?.currentTime || 0);
      const nextTime = currentTime + (details?.seekOffset || MEDIA_SESSION_SKIP_SECONDS);
      seek(duration > 0 ? Math.min(duration, nextTime) : nextTime);
    };
    const handleSeekTo = (details?: MediaSessionActionDetails) => {
      if (typeof details?.seekTime !== "number") return;
      seek(details.seekTime);
    };
    const handleStop = () => {
      markExpectedPause();
      if (stateRef.current.playbackMode === "youtube-embed") {
        getYoutubeEmbedManager().pause();
      } else {
        engineRef.current?.pause();
      }
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
  }, [markExpectedPause, next, previous, seek, togglePlay]);

  const contextValue = useMemo<PlayerContextType>(() => ({
    currentTrack: state.currentTrack,
    resolvedAudioQuality: state.resolvedAudioQuality,
    resolvedAvailableAudioQualityLabels: state.resolvedAvailableAudioQualityLabels,
    resolvedAudioQualityLabel: state.resolvedAudioQualityLabel,
    resolvedVideoQuality: state.resolvedVideoQuality,
    playbackMode: state.playbackMode,
    hasPlaybackStarted: state.hasPlaybackStarted,
    isPlaying: state.isPlaying,
    queue: state.queue,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    showRightPanel: state.showRightPanel,
    rightPanelTab: state.rightPanelTab,
    isLoading: state.isLoading,
    autoQualityEnabled: state.quality === "AUTO",
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
    isFullScreen: state.isFullScreen,
    play,
    warmTrackPlayback,
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
    refreshVideoPlaybackPreference,
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
    toggleFullScreen,
    setFullScreen,
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
    state.playbackMode,
    state.playbackSpeed,
    state.preampDb,
    state.preservePitch,
    state.quality,
    state.queue,
    state.resolvedAudioQuality,
    state.resolvedAvailableAudioQualityLabels,
    state.resolvedAudioQualityLabel,
    state.resolvedVideoQuality,
    state.repeat,
    state.rightPanelTab,
    state.showRightPanel,
    state.shuffle,
    state.sleepTimerEndsAt,
    state.isFullScreen,
    state.volume,
    setCrossfadeDuration,
    setEqBandGain,
    setMonoAudioEnabled,
    setAutoQualityEnabled,
    setPlaybackSpeed,
    setPreampDb,
    setPreservePitch,
    setQuality,
    refreshVideoPlaybackPreference,
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
    toggleFullScreen,
    setFullScreen,
    warmTrackPlayback,
  ]);

  const commandValue = useMemo<PlayerCommandContextType>(() => ({
    play,
    warmTrackPlayback,
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
    refreshVideoPlaybackPreference,
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
    toggleFullScreen,
    setFullScreen,
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
    setCrossfadeDuration,
    setEqBandGain,
    setMonoAudioEnabled,
    setAutoQualityEnabled,
    setPlaybackSpeed,
    setPreampDb,
    setPreservePitch,
    setQuality,
    refreshVideoPlaybackPreference,
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
    toggleFullScreen,
    setFullScreen,
    warmTrackPlayback,
  ]);

  return (
    <PlayerCommandContext.Provider value={commandValue}>
      <PlayerCurrentTrackContext.Provider value={state.currentTrack}>
        <PlayerContext.Provider value={contextValue}>
          <PlayerTimelineContext.Provider value={timeline}>
            {children}
          </PlayerTimelineContext.Provider>
        </PlayerContext.Provider>
      </PlayerCurrentTrackContext.Provider>
    </PlayerCommandContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}

export function usePlayerCommands() {
  const context = useContext(PlayerCommandContext);
  if (!context) throw new Error("usePlayerCommands must be used inside PlayerProvider");
  return context;
}

export function usePlayerCurrentTrack() {
  const context = useContext(PlayerCurrentTrackContext);
  if (context === undefined) throw new Error("usePlayerCurrentTrack must be used inside PlayerProvider");
  return context;
}

export function useOptionalPlayerWarmTrackPlayback() {
  return useContext(PlayerCommandContext)?.warmTrackPlayback;
}

export function usePlayerTimeline() {
  const context = useContext(PlayerTimelineContext);
  if (!context) throw new Error("usePlayerTimeline must be used inside PlayerProvider");
  return context;
}
