import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";

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

const FAVORITE_PLAYLISTS_STORAGE_KEY_PREFIX = "knobb-favorite-playlists:v1";

const normalizeFavoritePlaylist = (value: unknown): FavoritePlaylist | null => {
  const raw = value as Partial<FavoritePlaylist> | null;
  if (!raw) return null;

  const playlistId = typeof raw.playlist_id === "string" ? raw.playlist_id.trim() : "";
  const playlistTitle = typeof raw.playlist_title === "string" ? raw.playlist_title.trim() : "";
  if (!playlistId || !playlistTitle) return null;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `local-${raw.source || "tidal"}-${playlistId}`,
    source: typeof raw.source === "string" && raw.source.trim() ? raw.source : "tidal",
    playlist_id: playlistId,
    playlist_title: playlistTitle,
    playlist_cover_url: raw.playlist_cover_url ? String(raw.playlist_cover_url) : null,
    created_at:
      typeof raw.created_at === "string" && raw.created_at.trim()
        ? raw.created_at
        : new Date().toISOString(),
  };
};

const sortByCreatedAtDesc = (rows: FavoritePlaylist[]) =>
  [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

function getFavoritePlaylistsStorageKey(userId: string) {
  return `${FAVORITE_PLAYLISTS_STORAGE_KEY_PREFIX}:${userId}`;
}

function readCachedFavoritePlaylists(userId: string | null) {
  if (!userId) return [];

  const raw = safeStorageGetItem(getFavoritePlaylistsStorageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return sortByCreatedAtDesc(
      parsed.map(normalizeFavoritePlaylist).filter(Boolean) as FavoritePlaylist[],
    );
  } catch {
    return [];
  }
}

function useFavoritePlaylistsState() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favoritePlaylists, setFavoritePlaylists] = useState<FavoritePlaylist[]>(() => readCachedFavoritePlaylists(userId));
  const [loading, setLoading] = useState(false);
  const favoritesRef = useRef<FavoritePlaylist[]>([]);
  const hydratedUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    favoritesRef.current = favoritePlaylists;
  }, [favoritePlaylists]);

  useEffect(() => {
    if (!userId) return;
    safeStorageSetItem(getFavoritePlaylistsStorageKey(userId), JSON.stringify(favoritePlaylists));
  }, [favoritePlaylists, userId]);

  useEffect(() => {
    if (hydratedUserIdRef.current === userId) return;

    hydratedUserIdRef.current = userId;
    const cachedFavoritePlaylists = readCachedFavoritePlaylists(userId);
    favoritesRef.current = cachedFavoritePlaylists;
    setFavoritePlaylists(cachedFavoritePlaylists);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavoritePlaylists([]);
      favoritesRef.current = [];
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("favorite_playlists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const normalized = sortByCreatedAtDesc((data || []) as FavoritePlaylist[]);
      favoritesRef.current = normalized;
      setFavoritePlaylists(normalized);
    } catch (error) {
      console.error("Failed to fetch favorite playlists", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh, user]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let channel: Awaited<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>["channel"]>> | null = null;

    void (async () => {
      const supabase = await getSupabaseClient();
      if (!active) return;

      channel = supabase
        .channel(`favorite-playlists:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "favorite_playlists",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void refresh();
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) {
        void getSupabaseClient().then((supabase) => supabase.removeChannel(channel!));
      }
    };
  }, [refresh, userId]);

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

      const nextFavorites = sortByCreatedAtDesc([
          optimistic,
          ...favoritesRef.current.filter(
            (item) =>
              !(item.playlist_id === playlistId && item.source.toLowerCase() === source.toLowerCase())
          ),
        ]);
      favoritesRef.current = nextFavorites;
      setFavoritePlaylists(nextFavorites);

      const supabase = await getSupabaseClient();
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
      const nextFavorites = previous.filter(
          (item) =>
            !(item.playlist_id === playlistId && item.source.toLowerCase() === source.toLowerCase())
        );
      favoritesRef.current = nextFavorites;
      setFavoritePlaylists(nextFavorites);

      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from("favorite_playlists")
        .delete()
        .eq("user_id", user.id)
        .eq("source", source)
        .eq("playlist_id", playlistId);

      if (error) {
        console.error("Failed to remove favorite playlist", error);
        favoritesRef.current = previous;
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

  return useMemo(
    () => ({
      favoritePlaylists,
      loading,
      isFavoritePlaylist,
      addFavoritePlaylist,
      removeFavoritePlaylist,
      toggleFavoritePlaylist,
      refresh,
    }),
    [
      addFavoritePlaylist,
      favoritePlaylists,
      isFavoritePlaylist,
      loading,
      refresh,
      removeFavoritePlaylist,
      toggleFavoritePlaylist,
    ],
  );
}

type FavoritePlaylistsContextValue = ReturnType<typeof useFavoritePlaylistsState>;

const FavoritePlaylistsContext = createContext<FavoritePlaylistsContextValue | null>(null);

export function FavoritePlaylistsProvider({ children }: { children: ReactNode }) {
  const value = useFavoritePlaylistsState();
  return createElement(FavoritePlaylistsContext.Provider, { value }, children);
}

export function useFavoritePlaylists() {
  const context = useContext(FavoritePlaylistsContext);
  if (!context) {
    throw new Error("useFavoritePlaylists must be used within FavoritePlaylistsProvider");
  }

  return context;
}
