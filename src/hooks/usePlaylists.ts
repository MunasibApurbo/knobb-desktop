import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/data/mockData";

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  cover_url: string | null;
  created_at: string;
  tracks: Track[];
}

export function usePlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    if (!user) { setPlaylists([]); return; }
    setLoading(true);
    const { data: playlistRows } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

    if (!playlistRows) { setLoading(false); return; }

    const result: UserPlaylist[] = [];
    for (const pl of playlistRows as any[]) {
      const { data: trackRows } = await supabase
        .from("playlist_tracks")
        .select("*")
        .eq("playlist_id", pl.id)
        .order("position", { ascending: true });

      result.push({
        id: pl.id,
        name: pl.name,
        description: pl.description || "",
        cover_url: pl.cover_url,
        created_at: pl.created_at,
        tracks: (trackRows || []).map((t: any) => t.track_data as Track),
      });
    }
    setPlaylists(result);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const createPlaylist = useCallback(async (name: string, description = "") => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("playlists")
      .insert({ user_id: user.id, name, description })
      .select()
      .maybeSingle();
    if (error || !data) return null;
    await fetchPlaylists();
    return (data as any).id as string;
  }, [user, fetchPlaylists]);

  const deletePlaylist = useCallback(async (id: string) => {
    await supabase.from("playlists").delete().eq("id", id);
    await fetchPlaylists();
  }, [fetchPlaylists]);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    await supabase.from("playlists").update({ name }).eq("id", id);
    await fetchPlaylists();
  }, [fetchPlaylists]);

  const addTrack = useCallback(async (playlistId: string, track: Track) => {
    // Get current max position
    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = existing && existing.length > 0 ? (existing[0] as any).position + 1 : 0;

    await supabase.from("playlist_tracks").insert({
      playlist_id: playlistId,
      track_data: track as any,
      position: nextPos,
    });

    // Update cover if first track
    if (nextPos === 0) {
      await supabase.from("playlists").update({ cover_url: track.coverUrl }).eq("id", playlistId);
    }

    await fetchPlaylists();
  }, [fetchPlaylists]);

  const removeTrack = useCallback(async (playlistId: string, trackIndex: number) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    // Get all tracks for this playlist and delete the one at the index
    const { data: trackRows } = await supabase
      .from("playlist_tracks")
      .select("id, position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });

    if (trackRows && trackRows[trackIndex]) {
      await supabase.from("playlist_tracks").delete().eq("id", (trackRows[trackIndex] as any).id);
    }
    await fetchPlaylists();
  }, [playlists, fetchPlaylists]);

  return { playlists, loading, createPlaylist, deletePlaylist, renamePlaylist, addTrack, removeTrack, refresh: fetchPlaylists };
}
