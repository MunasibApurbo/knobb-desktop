import type { PostgrestError } from "@supabase/supabase-js";
import type {
  PlaylistAccessRole,
  PlaylistRecord,
  PlaylistVisibility,
  UserPlaylist,
} from "@/hooks/playlists/types";
import type { Track } from "@/types/music";
import { buildTrackKey } from "@/lib/librarySources";

export function getTrackKey(track: Track) {
  return buildTrackKey(track);
}

export function isUniqueViolation(error: PostgrestError | null) {
  return !!error && error.code === "23505";
}

function normalizePlaylistError(error: { code?: string | null; message?: string | null } | null | undefined) {
  return `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
}

export function isMissingPlaylistColumnsError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  columns: string[],
) {
  const normalized = normalizePlaylistError(error);
  if (!normalized.includes("column") && !normalized.includes("schema cache")) return false;
  return columns.some((column) => normalized.includes(column.toLowerCase()));
}

export function isMissingPlaylistRpcError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  functionName: string,
) {
  const normalized = normalizePlaylistError(error);
  return (
    normalized.includes(functionName.toLowerCase()) &&
    (normalized.includes("function") ||
      normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("could not find"))
  );
}

export function normalizeRole(role: string | null | undefined): PlaylistAccessRole {
  if (role === "owner" || role === "editor") return role;
  return "viewer";
}

export function normalizeVisibility(
  value: string | null | undefined,
): PlaylistVisibility {
  if (value === "public" || value === "shared") return value;
  return "private";
}

export function buildPlaylist(
  playlist: PlaylistRecord,
  userId: string,
  collaboratorRole: PlaylistAccessRole | undefined,
  tracks: Track[],
  options?: {
    accessRole?: PlaylistAccessRole;
    trackCount?: number;
    tracksLoaded?: boolean;
  },
): UserPlaylist {
  const trackCount = options?.trackCount ?? playlist.track_count ?? tracks.length;

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || "",
    cover_url: playlist.cover_url,
    created_at: playlist.created_at,
    owner_user_id: playlist.user_id,
    access_role:
      options?.accessRole ??
      (playlist.access_role
        ? normalizeRole(playlist.access_role)
        : playlist.user_id === userId
          ? "owner"
          : collaboratorRole || "viewer"),
    visibility: normalizeVisibility(playlist.visibility),
    share_token: playlist.share_token,
    track_count: trackCount,
    tracks_loaded: options?.tracksLoaded ?? trackCount === tracks.length,
    tracks,
  };
}

export function buildOptimisticPlaylist(
  userId: string,
  name: string,
  description: string,
  options?: {
    cover_url?: string | null;
    visibility?: PlaylistVisibility;
  },
): UserPlaylist {
  return {
    id: `temp-${crypto.randomUUID()}`,
    name,
    description,
    cover_url: options?.cover_url ?? null,
    created_at: new Date().toISOString(),
    owner_user_id: userId,
    access_role: "owner",
    visibility: options?.visibility ?? "private",
    share_token: crypto.randomUUID(),
    track_count: 0,
    tracks_loaded: true,
    tracks: [],
  };
}
