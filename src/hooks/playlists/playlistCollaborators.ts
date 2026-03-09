import { supabase } from "@/integrations/supabase/client";
import { normalizeRole } from "@/hooks/playlists/helpers";
import type {
  PlaylistCollaborator,
  PlaylistCollaboratorRole,
} from "@/hooks/playlists/types";

export async function fetchPlaylistCollaborators(playlistId: string) {
  const { data, error } = await supabase.rpc(
    "get_playlist_collaborators",
    {
      target_playlist_id: playlistId,
    } as never,
  );

  if (error) {
    console.error("Failed to fetch collaborators", error);
    return [] as PlaylistCollaborator[];
  }

  return (data || []).map((entry) => ({
    user_id: entry.user_id,
    role: normalizeRole(entry.role),
    display_name: entry.display_name,
    avatar_url: entry.avatar_url,
  }));
}

export async function invitePlaylistCollaborator(
  playlistId: string,
  email: string,
  role: PlaylistCollaboratorRole,
) {
  const { error } = await supabase.rpc(
    "invite_playlist_collaborator",
    {
      target_playlist_id: playlistId,
      target_email: email.trim(),
      target_role: role,
    } as never,
  );

  if (error) {
    console.error("Failed to invite collaborator", error);
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "" };
}

export async function updatePlaylistCollaboratorRole(
  playlistId: string,
  collaboratorUserId: string,
  role: PlaylistCollaboratorRole,
) {
  const { error } = await supabase
    .from("playlist_collaborators")
    .update({ role } as never)
    .eq("playlist_id", playlistId)
    .eq("user_id", collaboratorUserId);

  if (error) {
    console.error("Failed to update collaborator role", error);
    return false;
  }

  return true;
}

export async function removePlaylistCollaborator(
  playlistId: string,
  collaboratorUserId: string,
) {
  const { error } = await supabase
    .from("playlist_collaborators")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("user_id", collaboratorUserId);

  if (error) {
    console.error("Failed to remove collaborator", error);
    return false;
  }

  return true;
}
