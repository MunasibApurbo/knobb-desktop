import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, startTransition } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/types/music";
import { normalizeTrackIdentity } from "@/lib/trackIdentity";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";
import { showErrorToast } from "@/lib/toast";
import { buildTrackKey } from "@/lib/librarySources";
import { hydrateArtistGridTrackPlayback } from "@/lib/artistGridPlayback";

interface LikedSongsContextType {
  likedSongs: Track[];
  isLiked: (trackId: string) => boolean;
  addLikedSong: (track: Track) => Promise<"added" | "duplicate" | "error">;
  toggleLike: (track: Track) => Promise<void>;
}

const LikedSongsContext = createContext<LikedSongsContextType | null>(null);
const LIKED_SONGS_STORAGE_KEY_PREFIX = "knobb-liked-songs:v1";

const getTrackKey = (track: Track) => {
  return buildTrackKey(track);
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

function getLikedSongsStorageKey(userId: string) {
  return `${LIKED_SONGS_STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeStoredLikedSongs(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalizedTracks: Track[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;

    try {
      normalizedTracks.push(normalizeTrackIdentity(candidate as Track));
    } catch {
      // Ignore malformed cached entries and keep the rest of the library usable.
    }
  }

  return dedupeTracks(normalizedTracks);
}

function readCachedLikedSongs(userId: string | null) {
  if (!userId) return [];

  const raw = safeStorageGetItem(getLikedSongsStorageKey(userId));
  if (!raw) return [];

  try {
    return normalizeStoredLikedSongs(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function LikedSongsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [likedSongs, setLikedSongs] = useState<Track[]>(() => readCachedLikedSongs(userId));
  const likedSongsRef = useRef<Track[]>([]);
  const hydratedUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    likedSongsRef.current = likedSongs;
  }, [likedSongs]);

  useEffect(() => {
    if (!userId) return;
    safeStorageSetItem(getLikedSongsStorageKey(userId), JSON.stringify(likedSongs));
  }, [likedSongs, userId]);

  useEffect(() => {
    if (hydratedUserIdRef.current === userId) return;

    hydratedUserIdRef.current = userId;
    const cachedLikedSongs = readCachedLikedSongs(userId);
    likedSongsRef.current = cachedLikedSongs;
    setLikedSongs(cachedLikedSongs);
  }, [userId]);

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

      const normalized = dedupeTracks(
        (data || []).map((row) =>
          normalizeTrackIdentity({
            ...(row.track_data as unknown as Track),
            addedAt: row.liked_at,
          }),
        ),
      );
      likedSongsRef.current = normalized;
      startTransition(() => {
        setLikedSongs(normalized);
      });
    } catch (e) {
      console.error("Failed to fetch liked songs:", e);
    }
  }, [user]);

  // Fetch liked songs on mount or user change (local-first, remote-sync)
  useEffect(() => {
    void fetchRemoteLikedSongs();
  }, [fetchRemoteLikedSongs]);

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

  const likedTrackIdSet = useMemo(
    () => new Set(likedSongs.map((track) => String(track.id))),
    [likedSongs],
  );

  const isLiked = useCallback(
    (trackId: string) => likedTrackIdSet.has(String(trackId)),
    [likedTrackIdSet]
  );

  const addLikedSong = useCallback(
    async (track: Track): Promise<"added" | "duplicate" | "error"> => {
      if (!user) {
        showErrorToast("Please sign in to like songs");
        return "error";
      }

      const normalizedTrack = normalizeTrackIdentity(await hydrateArtistGridTrackPlayback(track));
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

      const normalizedTrack = normalizeTrackIdentity(await hydrateArtistGridTrackPlayback(track));
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
