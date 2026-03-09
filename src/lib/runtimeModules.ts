type SupabaseModule = typeof import("@/integrations/supabase/client");
type MusicApiModule = typeof import("@/lib/musicApi");
type ObservabilityModule = typeof import("@/lib/observability");
type AudioEngineModule = typeof import("@/lib/audioEngine");
type PlaylistQueriesModule = typeof import("@/hooks/playlists/playlistQueries");
type PlaylistMutationsModule = typeof import("@/hooks/playlists/playlistMutations");
type PlaylistCollaboratorsModule = typeof import("@/hooks/playlists/playlistCollaborators");

let supabaseClientPromise: Promise<SupabaseModule["supabase"]> | null = null;
let musicApiModulePromise: Promise<MusicApiModule> | null = null;
let observabilityModulePromise: Promise<ObservabilityModule> | null = null;
let audioEngineModulePromise: Promise<AudioEngineModule> | null = null;
let playlistQueriesModulePromise: Promise<PlaylistQueriesModule> | null = null;
let playlistMutationsModulePromise: Promise<PlaylistMutationsModule> | null = null;
let playlistCollaboratorsModulePromise: Promise<PlaylistCollaboratorsModule> | null = null;

export function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@/integrations/supabase/client").then((module) => module.supabase);
  }

  return supabaseClientPromise;
}

export function loadMusicApiModule() {
  if (!musicApiModulePromise) {
    musicApiModulePromise = import("@/lib/musicApi");
  }

  return musicApiModulePromise;
}

export function loadAudioEngineModule() {
  if (!audioEngineModulePromise) {
    audioEngineModulePromise = import("@/lib/audioEngine");
  }

  return audioEngineModulePromise;
}

export function loadPlaylistQueriesModule() {
  if (!playlistQueriesModulePromise) {
    playlistQueriesModulePromise = import("@/hooks/playlists/playlistQueries");
  }

  return playlistQueriesModulePromise;
}

export function loadPlaylistMutationsModule() {
  if (!playlistMutationsModulePromise) {
    playlistMutationsModulePromise = import("@/hooks/playlists/playlistMutations");
  }

  return playlistMutationsModulePromise;
}

export function loadPlaylistCollaboratorsModule() {
  if (!playlistCollaboratorsModulePromise) {
    playlistCollaboratorsModulePromise = import("@/hooks/playlists/playlistCollaborators");
  }

  return playlistCollaboratorsModulePromise;
}

function loadObservabilityModule() {
  if (!observabilityModulePromise) {
    observabilityModulePromise = import("@/lib/observability");
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
