import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  albumId: number;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl?: string | null;
  albumYear?: number | null;
}

const LOCAL_SAVED_ALBUMS_KEY = "nobb.saved-albums";

const buildStorageKey = (userId: string) => `${LOCAL_SAVED_ALBUMS_KEY}:${userId}`;

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
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : `local-${albumId}`,
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

const readLocalSavedAlbums = (userId: string): SavedAlbum[] => {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return sortByCreatedAtDesc(
      parsed.map(normalizeSavedAlbum).filter(Boolean) as SavedAlbum[]
    );
  } catch (error) {
    console.error("Failed to read local saved albums", error);
    return [];
  }
};

const writeLocalSavedAlbums = (userId: string, albums: SavedAlbum[]) => {
  try {
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(albums));
  } catch (error) {
    console.error("Failed to persist local saved albums", error);
  }
};

const mergeSavedAlbums = (primary: SavedAlbum[], secondary: SavedAlbum[]) => {
  const byAlbumId = new Map<number, SavedAlbum>();
  for (const album of primary) byAlbumId.set(album.album_id, album);
  for (const album of secondary) {
    if (!byAlbumId.has(album.album_id)) byAlbumId.set(album.album_id, album);
  }
  return sortByCreatedAtDesc(Array.from(byAlbumId.values()));
};

const isMissingSavedAlbumsTableError = (error: unknown) => {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");
  return message.toLowerCase().includes("saved_albums");
};

export function useSavedAlbums() {
  const { user } = useAuth();
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const savedAlbumsRef = useRef<SavedAlbum[]>([]);
  const remoteUnavailableRef = useRef(false);

  useEffect(() => {
    savedAlbumsRef.current = savedAlbums;
  }, [savedAlbums]);

  useEffect(() => {
    remoteUnavailableRef.current = false;
  }, [user?.id]);

  const setAndPersist = useCallback(
    (next: SavedAlbum[]) => {
      const normalized = sortByCreatedAtDesc(next);
      savedAlbumsRef.current = normalized;
      setSavedAlbums(normalized);
      if (user?.id) writeLocalSavedAlbums(user.id, normalized);
    },
    [user?.id]
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedAlbums([]);
      savedAlbumsRef.current = [];
      return;
    }

    const localSavedAlbums = readLocalSavedAlbums(user.id);
    if (localSavedAlbums.length > 0) {
      setAndPersist(localSavedAlbums);
    }

    if (remoteUnavailableRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_albums")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const remoteSavedAlbums = ((data || []) as unknown[])
        .map(normalizeSavedAlbum)
        .filter(Boolean) as SavedAlbum[];

      const merged = mergeSavedAlbums(remoteSavedAlbums, localSavedAlbums);
      setAndPersist(merged);

      const remoteIds = new Set(remoteSavedAlbums.map((album) => album.album_id));
      const unsynced = merged.filter((album) => !remoteIds.has(album.album_id));
      if (unsynced.length > 0) {
        await supabase.from("saved_albums").upsert(
          unsynced.map((album) => ({
            user_id: user.id,
            album_id: album.album_id,
            album_title: album.album_title,
            album_artist: album.album_artist,
            album_cover_url: album.album_cover_url,
            album_year: album.album_year,
          })),
          { onConflict: "user_id,album_id" }
        );
      }
    } catch (error) {
      console.error("Failed to fetch saved albums", error);
      if (isMissingSavedAlbumsTableError(error)) {
        remoteUnavailableRef.current = true;
      }
      if (localSavedAlbums.length === 0) setAndPersist([]);
    } finally {
      setLoading(false);
    }
  }, [setAndPersist, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || remoteUnavailableRef.current) return;

    const channel = supabase
      .channel(`saved-albums:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_albums",
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

  const isSaved = useCallback(
    (albumId: number) => savedAlbums.some((album) => album.album_id === albumId),
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

      const nextSavedAlbums = [
        nextAlbum,
        ...savedAlbumsRef.current.filter((album) => album.album_id !== albumId),
      ];
      setAndPersist(nextSavedAlbums);

      if (remoteUnavailableRef.current) return true;

      try {
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
        if (isMissingSavedAlbumsTableError(error)) {
          remoteUnavailableRef.current = true;
        }
      }

      return true;
    },
    [setAndPersist, user]
  );

  const removeSavedAlbum = useCallback(
    async (albumId: number) => {
      if (!user) return false;

      const nextSavedAlbums = savedAlbumsRef.current.filter(
        (album) => album.album_id !== albumId
      );
      setAndPersist(nextSavedAlbums);

      if (remoteUnavailableRef.current) return true;

      try {
        const { error } = await supabase
          .from("saved_albums")
          .delete()
          .eq("user_id", user.id)
          .eq("album_id", albumId);

        if (error) throw error;
      } catch (error) {
        console.error("Failed to remove saved album", error);
        if (isMissingSavedAlbumsTableError(error)) {
          remoteUnavailableRef.current = true;
        }
      }

      return true;
    },
    [setAndPersist, user]
  );

  const toggleSavedAlbum = useCallback(
    async (album: SavedAlbumInput) => {
      if (isSaved(album.albumId)) return removeSavedAlbum(album.albumId);
      return addSavedAlbum(album);
    },
    [addSavedAlbum, isSaved, removeSavedAlbum]
  );

  return {
    savedAlbums,
    loading,
    isSaved,
    addSavedAlbum,
    removeSavedAlbum,
    toggleSavedAlbum,
    refresh,
  };
}
