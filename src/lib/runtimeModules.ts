type SupabaseModule = typeof import("@/integrations/supabase/client");
type MusicApiModule = typeof import("@/lib/musicApi");
type ObservabilityModule = typeof import("@/lib/observability");
type AudioEngineModule = typeof import("@/lib/audioEngine");
type YoutubeMusicApiModule = typeof import("@/lib/youtubeMusicApi");
type PlaylistQueriesModule = typeof import("@/hooks/playlists/playlistQueries");
type PlaylistMutationsModule = typeof import("@/hooks/playlists/playlistMutations");
type PlaylistCollaboratorsModule = typeof import("@/hooks/playlists/playlistCollaborators");

let supabaseClientPromise: Promise<SupabaseModule["supabase"]> | null = null;
let musicApiModulePromise: Promise<MusicApiModule> | null = null;
let observabilityModulePromise: Promise<ObservabilityModule> | null = null;
let audioEngineModulePromise: Promise<AudioEngineModule> | null = null;
let youtubeMusicApiModulePromise: Promise<YoutubeMusicApiModule> | null = null;
let playlistQueriesModulePromise: Promise<PlaylistQueriesModule> | null = null;
let playlistMutationsModulePromise: Promise<PlaylistMutationsModule> | null = null;
let playlistCollaboratorsModulePromise: Promise<PlaylistCollaboratorsModule> | null = null;

function loadWithReset<T>(load: () => Promise<T>, reset: () => void) {
  return load().catch((error) => {
    reset();
    throw error;
  });
}

export function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = loadWithReset(
      () => import("@/integrations/supabase/client").then((module) => module.supabase),
      () => {
        supabaseClientPromise = null;
      },
    );
  }

  return supabaseClientPromise;
}

export function loadMusicApiModule() {
  if (!musicApiModulePromise) {
    musicApiModulePromise = loadWithReset(
      () => import("@/lib/musicApi"),
      () => {
        musicApiModulePromise = null;
      },
    );
  }

  return musicApiModulePromise;
}

export function loadAudioEngineModule() {
  if (!audioEngineModulePromise) {
    audioEngineModulePromise = loadWithReset(
      () => import("@/lib/audioEngine"),
      () => {
        audioEngineModulePromise = null;
      },
    );
  }

  return audioEngineModulePromise;
}

export function loadYoutubeMusicApiModule() {
  if (!youtubeMusicApiModulePromise) {
    youtubeMusicApiModulePromise = loadWithReset(
      () => import("@/lib/youtubeMusicApi"),
      () => {
        youtubeMusicApiModulePromise = null;
      },
    );
  }

  return youtubeMusicApiModulePromise;
}

export function loadPlaylistQueriesModule() {
  if (!playlistQueriesModulePromise) {
    playlistQueriesModulePromise = loadWithReset(
      () => import("@/hooks/playlists/playlistQueries"),
      () => {
        playlistQueriesModulePromise = null;
      },
    );
  }

  return playlistQueriesModulePromise;
}

export function loadPlaylistMutationsModule() {
  if (!playlistMutationsModulePromise) {
    playlistMutationsModulePromise = loadWithReset(
      () => import("@/hooks/playlists/playlistMutations"),
      () => {
        playlistMutationsModulePromise = null;
      },
    );
  }

  return playlistMutationsModulePromise;
}

export function loadPlaylistCollaboratorsModule() {
  if (!playlistCollaboratorsModulePromise) {
    playlistCollaboratorsModulePromise = loadWithReset(
      () => import("@/hooks/playlists/playlistCollaborators"),
      () => {
        playlistCollaboratorsModulePromise = null;
      },
    );
  }

  return playlistCollaboratorsModulePromise;
}

function loadObservabilityModule() {
  if (!observabilityModulePromise) {
    observabilityModulePromise = loadWithReset(
      () => import("@/lib/observability"),
      () => {
        observabilityModulePromise = null;
      },
    );
  }

  return observabilityModulePromise;
}

export async function reportClientErrorLazy(
  error: unknown,
  eventName: string,
  payload: Record<string, unknown> = {},
) {
  try {
    const module = await loadObservabilityModule();
    await module.reportClientError(error, eventName, payload);
  } catch {
    // Diagnostics should never block the UI.
  }
}

export async function reportClientEventLazy(
  level: "info" | "warn" | "error",
  eventName: string,
  message = "",
  payload: Record<string, unknown> = {},
  source?: string,
) {
  try {
    const module = await loadObservabilityModule();
    await module.reportClientEvent({
      level,
      eventName,
      message,
      payload,
      source,
    });
  } catch {
    // Diagnostics should never block the UI.
  }
}
