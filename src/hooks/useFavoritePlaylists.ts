import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FavoritePlaylist {
  id: string;
  source: string;
  playlist_id: string;
  playlist_title: string;
  playlist_cover_url: string | null;
  created_at: string;
}

interface FavoritePlaylistInput {
  source?: string;
  playlistId: string;
  playlistTitle: string;
  playlistCoverUrl?: string | null;
}

const sortByCreatedAtDesc = (rows: FavoritePlaylist[]) =>
  [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

export function useFavoritePlaylists() {
  const { user } = useAuth();
  const [favoritePlaylists, setFavoritePlaylists] = useState<FavoritePlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const favoritesRef = useRef<FavoritePlaylist[]>([]);

  useEffect(() => {
    favoritesRef.current = favoritePlaylists;
  }, [favoritePlaylists]);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavoritePlaylists([]);
      favoritesRef.current = [];
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("favorite_playlists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavoritePlaylists(sortByCreatedAtDesc((data || []) as FavoritePlaylist[]));
    } catch (error) {
      console.error("Failed to fetch favorite playlists", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`favorite-playlists:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorite_playlists",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  const isFavoritePlaylist = useCallback(
    (playlistId: string, source = "tidal") =>
      favoritePlaylists.some(
        (playlist) =>
          playlist.playlist_id === playlistId &&
          playlist.source.toLowerCase() === source.toLowerCase()
      ),
    [favoritePlaylists]
  );

  const addFavoritePlaylist = useCallback(
    async ({ source = "tidal", playlistId, playlistTitle, playlistCoverUrl }: FavoritePlaylistInput) => {
      if (!user) {
        toast.error("Sign in to save playlists");
        return false;
      }

      const optimistic: FavoritePlaylist = {
        id: `temp-${crypto.randomUUID()}`,
        source,
        playlist_id: playlistId,
        playlist_title: playlistTitle,
        playlist_cover_url: playlistCoverUrl || null,
        created_at: new Date().toISOString(),
      };

      setFavoritePlaylists((prev) =>
        sortByCreatedAtDesc([
          optimistic,
          ...prev.filter(
            (item) =>
              !(item.playlist_id === playlistId && item.source.toLowerCase() === source.toLowerCase())
          ),
        ])
      );

      const { error } = await supabase.from("favorite_playlists").upsert(
        {
          user_id: user.id,
          source,
          playlist_id: playlistId,
          playlist_title: playlistTitle,
          playlist_cover_url: playlistCoverUrl || null,
        },
        { onConflict: "user_id,source,playlist_id" }
      );

      if (error) {
        console.error("Failed to save favorite playlist", error);
        await refresh();
        return false;
      }

      return true;
    },
    [refresh, user]
  );

  const removeFavoritePlaylist = useCallback(
    async (playlistId: string, source = "tidal") => {
      if (!user) return false;

      const previous = favoritesRef.current;
      setFavoritePlaylists((prev) =>
        prev.filter(
          (item) =>
            !(item.playlist_id === playlistId && item.source.toLowerCase() === source.toLowerCase())
        )
      );

      const { error } = await supabase
        .from("favorite_playlists")
        .delete()
        .eq("user_id", user.id)
        .eq("source", source)
        .eq("playlist_id", playlistId);

      if (error) {
        console.error("Failed to remove favorite playlist", error);
        setFavoritePlaylists(previous);
        return false;
      }

      return true;
    },
    [user]
  );

  const toggleFavoritePlaylist = useCallback(
    async (playlist: FavoritePlaylistInput) => {
      const source = playlist.source || "tidal";
      if (isFavoritePlaylist(playlist.playlistId, source)) {
        return removeFavoritePlaylist(playlist.playlistId, source);
      }
      return addFavoritePlaylist({ ...playlist, source });
    },
    [addFavoritePlaylist, isFavoritePlaylist, removeFavoritePlaylist]
  );

  return {
    favoritePlaylists,
    loading,
    isFavoritePlaylist,
    addFavoritePlaylist,
    removeFavoritePlaylist,
    toggleFavoritePlaylist,
    refresh,
  };
}
