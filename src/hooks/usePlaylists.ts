import { useState, useCallback, useEffect, useRef } from "react";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/types/music";

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  cover_url: string | null;
  created_at: string;
  tracks: Track[];
}

export interface AddTrackResult {
  added: boolean;
  reason?: "duplicate" | "error";
}

const getTrackKey = (track: Track) => {
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return `tidal:${track.tidalId}`;
  }
  if (track.id) return `id:${track.id}`;
  return `fallback:${track.title.trim().toLowerCase()}::${track.artist
    .trim()
    .toLowerCase()}::${track.album.trim().toLowerCase()}::${track.duration}`;
};

const isUniqueViolation = (error: PostgrestError | null) =>
  !!error && error.code === "23505";

export function usePlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const playlistsRef = useRef<UserPlaylist[]>([]);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      return;
    }

    setLoading(true);
    try {
      const { data: playlistRows, error: playlistError } = await supabase
        .from("playlists")
        .select("id,name,description,cover_url,created_at")
        .order("created_at", { ascending: false });

      if (playlistError || !playlistRows) {
        console.error("Failed to fetch playlists", playlistError);
        setPlaylists([]);
        return;
      }

      const playlistIds = playlistRows.map((pl) => pl.id);
      let trackRows:
        | {
            playlist_id: string;
            position: number;
            track_data: Track;
          }[]
        | null = null;

      if (playlistIds.length > 0) {
        const { data, error } = await supabase
          .from("playlist_tracks")
          .select("playlist_id,position,track_data")
          .in("playlist_id", playlistIds)
          .order("position", { ascending: true });

        if (error) {
          console.error("Failed to fetch playlist tracks", error);
        } else {
          trackRows = (data || []) as typeof trackRows;
        }
      }

      const tracksByPlaylist = new Map<string, Track[]>();
      for (const row of trackRows || []) {
        const next = tracksByPlaylist.get(row.playlist_id) || [];
        next.push(row.track_data);
        tracksByPlaylist.set(row.playlist_id, next);
      }

      const nextPlaylists: UserPlaylist[] = playlistRows.map((pl) => ({
        id: pl.id,
        name: pl.name,
        description: pl.description || "",
        cover_url: pl.cover_url,
        created_at: pl.created_at,
        tracks: tracksByPlaylist.get(pl.id) || [],
      }));

      setPlaylists(nextPlaylists);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchPlaylists();
  }, [fetchPlaylists]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`library-playlists:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlists",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchPlaylists();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_tracks",
        },
        () => {
          void fetchPlaylists();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchPlaylists, user]);

  const createPlaylist = useCallback(
    async (name: string, description = "") => {
      if (!user) return null;
      const trimmedName = name.trim();
      if (!trimmedName) return null;

      const existing = playlistsRef.current.find(
        (pl) => pl.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) return existing.id;

      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: UserPlaylist = {
        id: tempId,
        name: trimmedName,
        description,
        cover_url: null,
        created_at: new Date().toISOString(),
        tracks: [],
      };
      setPlaylists((prev) => [optimistic, ...prev]);

      const { data, error } = await supabase
        .from("playlists")
        .insert({ user_id: user.id, name: trimmedName, description })
        .select("id,name,description,cover_url,created_at")
        .maybeSingle();

      if (error || !data) {
        console.error("Failed to create playlist", error);
        setPlaylists((prev) => prev.filter((pl) => pl.id !== tempId));
        return null;
      }

      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === tempId
            ? {
                id: data.id,
                name: data.name,
                description: data.description || "",
                cover_url: data.cover_url,
                created_at: data.created_at,
                tracks: [],
              }
            : pl
        )
      );

      return data.id;
    },
    [user]
  );

  const deletePlaylist = useCallback(async (id: string) => {
    const previous = playlistsRef.current;
    setPlaylists((prev) => prev.filter((pl) => pl.id !== id));

    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", id)
      .eq("user_id", user?.id || "");

    if (error) {
      console.error("Failed to delete playlist", error);
      setPlaylists(previous);
    }
  }, [user]);

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;

      const previous = playlistsRef.current;
      setPlaylists((prev) =>
        prev.map((pl) => (pl.id === id ? { ...pl, name: trimmedName } : pl))
      );

      const { error } = await supabase
        .from("playlists")
        .update({ name: trimmedName })
        .eq("id", id)
        .eq("user_id", user?.id || "");

      if (error) {
        console.error("Failed to rename playlist", error);
        setPlaylists(previous);
      }
    },
    [user]
  );

  const addTrack = useCallback(
    async (playlistId: string, track: Track): Promise<AddTrackResult> => {
      const target = playlistsRef.current.find((pl) => pl.id === playlistId);
      if (!target) return { added: false, reason: "error" };

      const incomingTrackKey = getTrackKey(track);
      const alreadyExists = target.tracks.some(
        (existingTrack) => getTrackKey(existingTrack) === incomingTrackKey
      );
      if (alreadyExists) return { added: false, reason: "duplicate" };

      const previous = playlistsRef.current;
      const optimisticTracks = [...target.tracks, track];
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? {
                ...pl,
                tracks: optimisticTracks,
                cover_url: pl.cover_url || track.coverUrl || null,
              }
            : pl
        )
      );

      const nextPosition = target.tracks.length;
      const { error: insertError } = await supabase.from("playlist_tracks").insert({
        playlist_id: playlistId,
        track_data: track as any,
        track_key: incomingTrackKey,
        position: nextPosition,
      });

      if (insertError) {
        if (isUniqueViolation(insertError)) {
          void fetchPlaylists();
          return { added: false, reason: "duplicate" };
        }
        console.error("Failed to add track to playlist", insertError);
        setPlaylists(previous);
        return { added: false, reason: "error" };
      }

      if (nextPosition === 0 && track.coverUrl) {
        const { error: coverError } = await supabase
          .from("playlists")
          .update({ cover_url: track.coverUrl })
          .eq("id", playlistId)
          .eq("user_id", user?.id || "");
        if (coverError) {
          console.error("Failed to update playlist cover", coverError);
        }
      }

      return { added: true };
    },
    [fetchPlaylists, user]
  );

  const removeTrack = useCallback(
    async (playlistId: string, trackIndex: number) => {
      const playlist = playlistsRef.current.find((pl) => pl.id === playlistId);
      if (!playlist || trackIndex < 0 || trackIndex >= playlist.tracks.length) return;

      const previous = playlistsRef.current;
      const targetTrack = playlist.tracks[trackIndex];
      const targetTrackKey = getTrackKey(targetTrack);
      const remaining = playlist.tracks.filter((_, idx) => idx !== trackIndex);

      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? {
                ...pl,
                tracks: remaining,
                cover_url: remaining[0]?.coverUrl || null,
              }
            : pl
        )
      );

      const { error: deleteError } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_key", targetTrackKey);

      if (deleteError) {
        console.error("Failed to remove track from playlist", deleteError);
        setPlaylists(previous);
        return;
      }

      const { error: coverError } = await supabase
        .from("playlists")
        .update({ cover_url: remaining[0]?.coverUrl || null })
        .eq("id", playlistId)
        .eq("user_id", user?.id || "");
      if (coverError) {
        console.error("Failed to update cover after track removal", coverError);
      }

      // Re-index positions on the backend to keep deterministic ordering.
      const { data: rows, error: listError } = await supabase
        .from("playlist_tracks")
        .select("id")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (!listError && rows) {
        await Promise.all(
          rows.map((row, index) =>
            supabase.from("playlist_tracks").update({ position: index }).eq("id", row.id)
          )
        );
      }
    },
    [user]
  );

  return {
    playlists,
    loading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addTrack,
    removeTrack,
    refresh: fetchPlaylists,
  };
}
