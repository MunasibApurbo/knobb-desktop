import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/types/music";
import { normalizeTrackIdentity } from "@/lib/trackIdentity";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { showErrorToast } from "@/lib/toast";

interface LikedSongsContextType {
  likedSongs: Track[];
  isLiked: (trackId: string) => boolean;
  addLikedSong: (track: Track) => Promise<"added" | "duplicate" | "error">;
  toggleLike: (track: Track) => Promise<void>;
}

const LikedSongsContext = createContext<LikedSongsContextType | null>(null);

const getTrackKey = (track: Track) => {
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return String(track.tidalId);
  }
  if (track.id) return String(track.id);
  return `${track.title}|${track.artist}|${track.album}|${track.duration}`.toLowerCase();
};

const dedupeTracks = (tracks: Track[]) => {
  const seen = new Set<string>();
  const deduped: Track[] = [];
  for (const track of tracks) {
    const key = getTrackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(track);
  }
  return deduped;
};

export function LikedSongsProvider({ children }: { children: React.ReactNode }) {
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const likedSongsRef = useRef<Track[]>([]);

  useEffect(() => {
    likedSongsRef.current = likedSongs;
  }, [likedSongs]);

  const fetchRemoteLikedSongs = useCallback(async () => {
    if (!user) {
      setLikedSongs([]);
      likedSongsRef.current = [];
      return;
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("liked_songs")
        .select("track_data,track_key,liked_at")
        .order("liked_at", { ascending: false });

      if (error) throw error;

      const remoteLikedSongs = (data || []).map((row) =>
        normalizeTrackIdentity({
          ...(row.track_data as unknown as Track),
          addedAt: row.liked_at,
        })
      );

      const normalized = dedupeTracks(remoteLikedSongs);
      likedSongsRef.current = normalized;
      setLikedSongs(normalized);
    } catch (e) {
      console.error("Failed to fetch liked songs:", e);
    }
  }, [user]);

  // Fetch liked songs on mount or user change (local-first, remote-sync)
  useEffect(() => {
    if (!user) {
      void fetchRemoteLikedSongs();
      return;
    }

    return scheduleBackgroundTask(() => {
      void fetchRemoteLikedSongs();
    }, 900);
  }, [fetchRemoteLikedSongs, user]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let channel: RealtimeChannel | null = null;
    const cancel = scheduleBackgroundTask(() => {
      void (async () => {
        const supabase = await getSupabaseClient();
        if (!active) return;

        channel = supabase
          .channel(`liked-songs:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "liked_songs",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              void fetchRemoteLikedSongs();
            }
          )
          .subscribe();
      })();
    }, 1400);

    return () => {
      active = false;
      cancel();
      if (channel) {
        void getSupabaseClient().then((supabase) => supabase.removeChannel(channel!));
      }
    };
  }, [fetchRemoteLikedSongs, userId]);

  const isLiked = useCallback(
    (trackId: string) => likedSongs.some((t) => String(t.id) === String(trackId)),
    [likedSongs]
  );

  const addLikedSong = useCallback(
    async (track: Track): Promise<"added" | "duplicate" | "error"> => {
      if (!user) {
        showErrorToast("Please sign in to like songs");
        return "error";
      }

      const normalizedTrack = normalizeTrackIdentity(track);
      const targetKey = getTrackKey(normalizedTrack);
      const alreadyLiked = likedSongsRef.current.some((t) => getTrackKey(t) === targetKey);
      if (alreadyLiked) return "duplicate";

      const likedTrack = {
        ...normalizedTrack,
        addedAt: new Date().toISOString(),
      };
      const previous = likedSongsRef.current;
      const normalized = dedupeTracks([likedTrack, ...likedSongsRef.current]);
      likedSongsRef.current = normalized;
      setLikedSongs(normalized);

      try {
        const supabase = await getSupabaseClient();
        const persistableTrack = { ...likedTrack };
        delete persistableTrack.streamUrl;
        delete persistableTrack.addedAt;
        const likedSongInsert: TablesInsert<"liked_songs"> = {
          user_id: user.id,
          track_data: persistableTrack as unknown as Json,
          track_key: targetKey,
        };
        const { error } = await supabase.from("liked_songs").insert(likedSongInsert);
        if (error) throw error;
        return "added";
      } catch (e) {
        console.error("Failed to sync liked song", e);
        likedSongsRef.current = previous;
        setLikedSongs(previous);
        showErrorToast("Failed to sync liked song");
        return "error";
      }
    },
    [user]
  );

  const toggleLike = useCallback(
    async (track: Track) => {
      if (!user) {
        showErrorToast("Please sign in to like songs");
        return;
      }

      const normalizedTrack = normalizeTrackIdentity(track);
      const targetKey = getTrackKey(normalizedTrack);
      const currentlyLiked = likedSongsRef.current.some(
        (t) => getTrackKey(t) === targetKey
      );
      const likedTrack = {
        ...normalizedTrack,
        addedAt: new Date().toISOString(),
      };

      const nextLikedSongs = currentlyLiked
        ? likedSongsRef.current.filter((t) => getTrackKey(t) !== targetKey)
        : [likedTrack, ...likedSongsRef.current.filter((t) => getTrackKey(t) !== targetKey)];

      const previous = likedSongsRef.current;
      const normalized = dedupeTracks(nextLikedSongs);
      likedSongsRef.current = normalized;
      setLikedSongs(normalized);

      try {
        const supabase = await getSupabaseClient();
        if (currentlyLiked) {
          const { error } = await supabase
            .from("liked_songs")
            .delete()
            .eq("user_id", user.id)
            .eq("track_key", targetKey);
          if (error) throw error;
        } else {
          const persistableTrack = { ...likedTrack };
          delete persistableTrack.streamUrl;
          delete persistableTrack.addedAt;
          const likedSongInsert: TablesInsert<"liked_songs"> = {
            user_id: user.id,
            track_data: persistableTrack as unknown as Json,
            track_key: targetKey,
          };
          const { error } = await supabase.from("liked_songs").insert(likedSongInsert);
          if (error) throw error;
        }
      } catch (e) {
        console.error("Failed to sync liked song", e);
        // Rollback
        likedSongsRef.current = previous;
        setLikedSongs(previous);
        showErrorToast("Failed to sync liked song");
      }
    },
    [user]
  );

  return (
    <LikedSongsContext.Provider value={{ likedSongs, isLiked, addLikedSong, toggleLike }}>
      {children}
    </LikedSongsContext.Provider>
  );
}

export function useLikedSongs() {
  const ctx = useContext(LikedSongsContext);
  if (!ctx) throw new Error("useLikedSongs must be used inside LikedSongsProvider");
  return ctx;
}
