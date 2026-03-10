import { supabase } from "@/integrations/supabase/client";
import {
  getTrackKey,
  isMissingPlaylistColumnsError,
} from "@/hooks/playlists/helpers";
import type {
  PlaylistCollaboratorRole,
  PlaylistDetailsUpdate,
  PlaylistRecord,
  PlaylistTrackRecord,
} from "@/hooks/playlists/types";
import type { Track } from "@/types/music";

export async function createPlaylistRecord(
  userId: string,
  name: string,
  description: string,
  options?: {
    cover_url?: string | null;
    visibility?: "private" | "shared" | "public";
  },
) {
  const result = await supabase
    .from("playlists")
    .insert({
      user_id: userId,
      name,
      description,
      cover_url: options?.cover_url ?? null,
      visibility: options?.visibility ?? "private",
    } as never)
    .select("id,name,description,cover_url,created_at,user_id,visibility,share_token")
    .maybeSingle<PlaylistRecord>();

  if (!result.error || !isMissingPlaylistColumnsError(result.error, ["visibility", "share_token"])) {
    return result;
  }

  return supabase
    .from("playlists")
    .insert({
      user_id: userId,
      name,
      description,
      cover_url: options?.cover_url ?? null,
    } as never)
    .select("id,name,description,cover_url,created_at,user_id")
    .maybeSingle<PlaylistRecord>();
}

export async function deletePlaylistRecord(id: string, userId: string) {
  return supabase.from("playlists").delete().eq("id", id).eq("user_id", userId);
}

export async function updatePlaylistRecord(
  id: string,
  updates: Required<PlaylistDetailsUpdate>,
) {
  return supabase
    .from("playlists")
    .update(updates as never)
    .eq("id", id);
}

export async function insertPlaylistTrackRecord(
  playlistId: string,
  track: Track,
  trackKey: string,
  position: number,
) {
  const persistableTrack = { ...track };
  delete persistableTrack.addedAt;
  const result = await supabase.from("playlist_tracks").insert({
    playlist_id: playlistId,
    track_data: persistableTrack as unknown as never,
    track_key: trackKey,
    position,
  } as never);

  if (!result.error || !isMissingPlaylistColumnsError(result.error, ["track_key"])) {
    return result;
  }

  return supabase.from("playlist_tracks").insert({
    playlist_id: playlistId,
    track_data: persistableTrack as unknown as never,
    position,
  } as never);
}

export async function setPlaylistCoverUrl(id: string, coverUrl: string | null) {
  return supabase.from("playlists").update({ cover_url: coverUrl } as never).eq("id", id);
}

export async function fetchPlaylistTrackRows(
  playlistId: string,
): Promise<{ data: PlaylistTrackRecord[] | null; error: Error | null }> {
  const result = await supabase
    .from("playlist_tracks")
    .select("id,playlist_id,position,track_key,track_data,added_at")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (!result.error || !isMissingPlaylistColumnsError(result.error, ["track_key"])) {
    return {
      data: (result.data || null) as unknown as PlaylistTrackRecord[] | null,
      error: (result.error as Error | null) || null,
    };
  }

  const fallback = await supabase
    .from("playlist_tracks")
    .select("id,playlist_id,position,track_data,added_at")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  const fallbackRows = ((fallback.data || []) as unknown as Array<Omit<PlaylistTrackRecord, "track_key">>).map((row) => ({
    ...row,
    track_key: getTrackKey(row.track_data),
  }));

  return {
    data: fallbackRows.length > 0 ? fallbackRows : null,
    error: (fallback.error as Error | null) || null,
  };
}

export async function updatePlaylistTrackPosition(id: string, position: number) {
  return supabase.from("playlist_tracks").update({ position } as never).eq("id", id);
}

export async function deletePlaylistTrackRecord(playlistId: string, trackKey: string) {
  const result = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("track_key", trackKey);

  if (!result.error || !isMissingPlaylistColumnsError(result.error, ["track_key"])) {
    return result;
  }

  const fallback = await supabase
    .from("playlist_tracks")
    .select("id,track_data")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (fallback.error || !fallback.data) {
    return { error: fallback.error };
  }

  const target = (fallback.data as unknown as Array<{ id: string; track_data: Track }>).find(
    (row) => getTrackKey(row.track_data) === trackKey,
  );

  if (!target) {
    return { error: null };
  }

  return supabase.from("playlist_tracks").delete().eq("id", target.id);
}

export async function fetchPlaylistTrackIds(playlistId: string) {
  const { data, error } = await supabase
    .from("playlist_tracks")
    .select("id")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  return {
    data: (data || null) as { id: string }[] | null,
    error: (error as Error | null) || null,
  };
}

export type { PlaylistCollaboratorRole };
