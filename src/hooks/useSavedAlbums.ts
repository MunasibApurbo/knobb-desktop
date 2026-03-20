import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";

export interface SavedAlbum {
  id: string;
  album_id: number;
  album_title: string;
  album_artist: string;
  album_cover_url: string | null;
  album_year: number | null;
  created_at: string;
}

interface SavedAlbumInput {
  albumId: number | string;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl?: string | null;
  albumYear?: number | null;
}

const normalizeSavedAlbum = (value: unknown): SavedAlbum | null => {
  const raw = value as Partial<SavedAlbum> | null;
  if (!raw) return null;

  const albumId = Number(raw.album_id);
  if (!Number.isFinite(albumId) || !raw.album_title) return null;

  const albumYear =
    typeof raw.album_year === "number" && Number.isFinite(raw.album_year)
      ? Math.round(raw.album_year)
      : null;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `local-${albumId}`,
    album_id: albumId,
    album_title: String(raw.album_title),
    album_artist: String(raw.album_artist || "Unknown Artist"),
    album_cover_url: raw.album_cover_url ? String(raw.album_cover_url) : null,
    album_year: albumYear,
    created_at:
      typeof raw.created_at === "string" && raw.created_at.trim()
        ? raw.created_at
        : new Date().toISOString(),
  };
};

const sortByCreatedAtDesc = (albums: SavedAlbum[]) =>
  [...albums].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

const SAVED_ALBUMS_STORAGE_KEY_PREFIX = "knobb-saved-albums:v1";

function getSavedAlbumsStorageKey(userId: string) {
  return `${SAVED_ALBUMS_STORAGE_KEY_PREFIX}:${userId}`;
}

function readCachedSavedAlbums(userId: string | null) {
  if (!userId) return [];

  const raw = safeStorageGetItem(getSavedAlbumsStorageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return sortByCreatedAtDesc(
      parsed.map(normalizeSavedAlbum).filter(Boolean) as SavedAlbum[],
    );
  } catch {
    return [];
  }
}

function useSavedAlbumsState() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>(() => readCachedSavedAlbums(userId));
  const [loading, setLoading] = useState(false);
  const savedAlbumsRef = useRef<SavedAlbum[]>([]);
  const hydratedUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    savedAlbumsRef.current = savedAlbums;
  }, [savedAlbums]);

  useEffect(() => {
    if (!userId) return;
    safeStorageSetItem(getSavedAlbumsStorageKey(userId), JSON.stringify(savedAlbums));
  }, [savedAlbums, userId]);

  useEffect(() => {
    if (hydratedUserIdRef.current === userId) return;

    hydratedUserIdRef.current = userId;
    const cachedSavedAlbums = readCachedSavedAlbums(userId);
    savedAlbumsRef.current = cachedSavedAlbums;
    setSavedAlbums(cachedSavedAlbums);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedAlbums([]);
      savedAlbumsRef.current = [];
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("saved_albums")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const remoteSavedAlbums = ((data || []) as unknown[])
        .map(normalizeSavedAlbum)
        .filter(Boolean) as SavedAlbum[];

      const normalized = sortByCreatedAtDesc(remoteSavedAlbums);
      savedAlbumsRef.current = normalized;
      setSavedAlbums(normalized);
    } catch (error) {
      console.error("Failed to fetch saved albums", error);
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
        .channel(`saved-albums:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "saved_albums",
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

  const isSaved = useCallback(
    (albumId: number | string) => typeof albumId === "number" && savedAlbums.some((album) => album.album_id === albumId),
    [savedAlbums]
  );

  const addSavedAlbum = useCallback(
    async ({
      albumId,
      albumTitle,
      albumArtist,
      albumCoverUrl,
      albumYear,
    }: SavedAlbumInput) => {
      if (!user) {
        toast.error("Sign in to save albums");
        return false;
      }

      if (typeof albumId !== "number") {
        toast.error("Saving albums is currently available for TIDAL albums only");
        return false;
      }

      const existing = savedAlbumsRef.current.find(
        (album) => album.album_id === albumId
      );
      const nextAlbum: SavedAlbum = {
        id: existing?.id || `local-${albumId}`,
        album_id: albumId,
        album_title: albumTitle,
        album_artist: albumArtist,
        album_cover_url: albumCoverUrl || existing?.album_cover_url || null,
        album_year: typeof albumYear === "number" ? Math.round(albumYear) : null,
        created_at: existing?.created_at || new Date().toISOString(),
      };

      const previousAlbums = savedAlbumsRef.current;
      const nextSavedAlbums = [
        nextAlbum,
        ...previousAlbums.filter((album) => album.album_id !== albumId),
      ];

      const normalized = sortByCreatedAtDesc(nextSavedAlbums);
      savedAlbumsRef.current = normalized;
      setSavedAlbums(normalized);

      try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from("saved_albums").upsert(
          {
            user_id: user.id,
            album_id: albumId,
            album_title: albumTitle,
            album_artist: albumArtist,
            album_cover_url: albumCoverUrl || null,
            album_year: typeof albumYear === "number" ? Math.round(albumYear) : null,
          },
          { onConflict: "user_id,album_id" }
        );

        if (error) throw error;
      } catch (error) {
        console.error("Failed to add saved album", error);

        // Revert on failure
        savedAlbumsRef.current = previousAlbums;
        setSavedAlbums(previousAlbums);
      }

      return true;
    },
    [user]
  );

  const removeSavedAlbum = useCallback(
    async (albumId: number | string) => {
      if (!user) return false;
      if (typeof albumId !== "number") return false;

      const nextSavedAlbums = savedAlbumsRef.current.filter(
        (album) => album.album_id !== albumId
      );

      const previousAlbums = savedAlbumsRef.current;
      savedAlbumsRef.current = nextSavedAlbums;
      setSavedAlbums(nextSavedAlbums);

      try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase
          .from("saved_albums")
          .delete()
          .eq("user_id", user.id)
          .eq("album_id", albumId);

        if (error) throw error;
      } catch (error) {
        console.error("Failed to remove saved album", error);
        // Revert on failure
        savedAlbumsRef.current = previousAlbums;
        setSavedAlbums(previousAlbums);
      }

      return true;
    },
    [user]
  );

  const toggleSavedAlbum = useCallback(
    async (album: SavedAlbumInput) => {
      if (isSaved(album.albumId)) return removeSavedAlbum(album.albumId);
      return addSavedAlbum(album);
    },
    [addSavedAlbum, isSaved, removeSavedAlbum]
  );

  return useMemo(
    () => ({
      savedAlbums,
      loading,
      isSaved,
      addSavedAlbum,
      removeSavedAlbum,
      toggleSavedAlbum,
      refresh,
    }),
    [addSavedAlbum, isSaved, loading, refresh, removeSavedAlbum, savedAlbums, toggleSavedAlbum],
  );
}

type SavedAlbumsContextValue = ReturnType<typeof useSavedAlbumsState>;

const SavedAlbumsContext = createContext<SavedAlbumsContextValue | null>(null);

export function SavedAlbumsProvider({ children }: { children: ReactNode }) {
  const value = useSavedAlbumsState();
  return createElement(SavedAlbumsContext.Provider, { value }, children);
}

export function useSavedAlbums() {
  const context = useContext(SavedAlbumsContext);
  if (!context) {
    throw new Error("useSavedAlbums must be used within SavedAlbumsProvider");
  }

  return context;
}
