import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Track } from "@/types/music";

interface LikedSongsContextType {
  likedSongs: Track[];
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: Track) => Promise<void>;
}

const LikedSongsContext = createContext<LikedSongsContextType | null>(null);

const LOCAL_LIKED_SONGS_KEY = "nobb.liked-songs";

const buildStorageKey = (userId: string) => `${LOCAL_LIKED_SONGS_KEY}:${userId}`;

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

const readLocalLikedSongs = (userId: string): Track[] => {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return dedupeTracks(parsed as Track[]);
  } catch (error) {
    console.error("Failed to read local liked songs", error);
    return [];
  }
};

const writeLocalLikedSongs = (userId: string, tracks: Track[]) => {
  try {
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(tracks));
  } catch (error) {
    console.error("Failed to persist local liked songs", error);
  }
};

const mergeLikedSongs = (primary: Track[], secondary: Track[]) => {
  const byKey = new Map<string, Track>();
  for (const track of primary) byKey.set(getTrackKey(track), track);
  for (const track of secondary) {
    const key = getTrackKey(track);
    if (!byKey.has(key)) byKey.set(key, track);
  }
  return Array.from(byKey.values());
};

const isMissingLikedSongsTableError = (error: unknown) => {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");
  return message.toLowerCase().includes("liked_songs");
};

export function LikedSongsProvider({ children }: { children: React.ReactNode }) {
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const { user } = useAuth();
  const likedSongsRef = useRef<Track[]>([]);
  const remoteUnavailableRef = useRef(false);

  useEffect(() => {
    likedSongsRef.current = likedSongs;
  }, [likedSongs]);

  useEffect(() => {
    remoteUnavailableRef.current = false;
  }, [user?.id]);

  const setAndPersist = useCallback(
    (next: Track[]) => {
      const normalized = dedupeTracks(next);
      likedSongsRef.current = normalized;
      setLikedSongs(normalized);
      if (user?.id) writeLocalLikedSongs(user.id, normalized);
    },
    [user?.id]
  );

  const fetchRemoteLikedSongs = useCallback(async () => {
    if (!user) {
      setLikedSongs([]);
      likedSongsRef.current = [];
      return;
    }

    const localLikedSongs = readLocalLikedSongs(user.id);
    if (localLikedSongs.length > 0) {
      setAndPersist(localLikedSongs);
    }

    if (remoteUnavailableRef.current) return;

    try {
      const { data, error } = await supabase
        .from("liked_songs")
        .select("track_data,track_key,liked_at")
        .order("liked_at", { ascending: false });

      if (error) throw error;

      const remoteLikedSongs = (data || []).map((row) => row.track_data as Track);
      const merged = mergeLikedSongs(remoteLikedSongs, localLikedSongs);
      setAndPersist(merged);
    } catch (e) {
      console.error("Failed to fetch liked songs:", e);
      if (isMissingLikedSongsTableError(e)) {
        remoteUnavailableRef.current = true;
      }
    }
  }, [user?.id, setAndPersist]);

  // Fetch liked songs on mount or user change (local-first, remote-sync)
  useEffect(() => {
    void fetchRemoteLikedSongs();
  }, [fetchRemoteLikedSongs]);

  useEffect(() => {
    if (!user || remoteUnavailableRef.current) return;

    const channel = supabase
      .channel(`liked-songs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "liked_songs",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchRemoteLikedSongs();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRemoteLikedSongs, user]);

  // (Supabase channel effect moved down)

  const isLiked = useCallback(
    (trackId: string) => likedSongs.some((t) => String(t.id) === String(trackId)),
    [likedSongs]
  );

  const toggleLike = useCallback(
    async (track: Track) => {
      if (!user) {
        toast.error("Please sign in to like songs");
        return;
      }

      const targetKey = getTrackKey(track);
      const currentlyLiked = likedSongsRef.current.some(
        (t) => getTrackKey(t) === targetKey
      );

      const nextLikedSongs = currentlyLiked
        ? likedSongsRef.current.filter((t) => getTrackKey(t) !== targetKey)
        : [track, ...likedSongsRef.current.filter((t) => getTrackKey(t) !== targetKey)];
      const previous = likedSongsRef.current;
      setAndPersist(nextLikedSongs);

      if (remoteUnavailableRef.current) return;

      try {
        if (currentlyLiked) {
          const { error } = await supabase
            .from("liked_songs")
            .delete()
            .eq("user_id", user.id)
            .eq("track_key", targetKey);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("liked_songs").insert({
            user_id: user.id,
            track_data: track as any,
            track_key: targetKey,
          });
          if (error) throw error;
        }
      } catch (e) {
        console.error("Failed to sync liked song", e);
        if (isMissingLikedSongsTableError(e)) {
          remoteUnavailableRef.current = true;
        } else {
          setAndPersist(previous);
          toast.error("Failed to sync liked song");
        }
      }
    },
    [setAndPersist, user]
  );

  return (
    <LikedSongsContext.Provider value={{ likedSongs, isLiked, toggleLike }}>
      {children}
    </LikedSongsContext.Provider>
  );
}

export function useLikedSongs() {
  const ctx = useContext(LikedSongsContext);
  if (!ctx) throw new Error("useLikedSongs must be used inside LikedSongsProvider");
  return ctx;
}
