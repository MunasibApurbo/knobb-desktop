import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FavoriteArtist {
  id: string;
  artist_id: number;
  artist_name: string;
  artist_image_url: string | null;
  created_at: string;
}

interface FavoriteArtistInput {
  artistId: number;
  artistName: string;
  artistImageUrl?: string;
}

const LOCAL_FAVORITES_KEY = "nobb.favorite-artists";

const buildStorageKey = (userId: string) => `${LOCAL_FAVORITES_KEY}:${userId}`;

const normalizeFavoriteArtist = (value: unknown): FavoriteArtist | null => {
  const raw = value as Partial<FavoriteArtist> | null;
  if (!raw) return null;

  const artistId = Number(raw.artist_id);
  if (!Number.isFinite(artistId) || !raw.artist_name) return null;

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : `local-${artistId}`,
    artist_id: artistId,
    artist_name: String(raw.artist_name),
    artist_image_url: raw.artist_image_url ? String(raw.artist_image_url) : null,
    created_at:
      typeof raw.created_at === "string" && raw.created_at.trim()
        ? raw.created_at
        : new Date().toISOString(),
  };
};

const sortByCreatedAtDesc = (artists: FavoriteArtist[]) =>
  [...artists].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

const readLocalFavorites = (userId: string): FavoriteArtist[] => {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return sortByCreatedAtDesc(
      parsed.map(normalizeFavoriteArtist).filter(Boolean) as FavoriteArtist[]
    );
  } catch (error) {
    console.error("Failed to read local favorite artists", error);
    return [];
  }
};

const writeLocalFavorites = (userId: string, favorites: FavoriteArtist[]) => {
  try {
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(favorites));
  } catch (error) {
    console.error("Failed to persist local favorite artists", error);
  }
};

const mergeFavorites = (primary: FavoriteArtist[], secondary: FavoriteArtist[]) => {
  const byArtistId = new Map<number, FavoriteArtist>();

  for (const artist of primary) {
    byArtistId.set(artist.artist_id, artist);
  }

  for (const artist of secondary) {
    if (!byArtistId.has(artist.artist_id)) {
      byArtistId.set(artist.artist_id, artist);
    }
  }

  return sortByCreatedAtDesc(Array.from(byArtistId.values()));
};

export function useFavoriteArtists() {
  const { user } = useAuth();
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const favoritesRef = useRef<FavoriteArtist[]>([]);

  useEffect(() => {
    favoritesRef.current = favoriteArtists;
  }, [favoriteArtists]);

  const setAndPersist = useCallback(
    (next: FavoriteArtist[]) => {
      const normalized = sortByCreatedAtDesc(next);
      favoritesRef.current = normalized;
      setFavoriteArtists(normalized);
      if (user?.id) {
        writeLocalFavorites(user.id, normalized);
      }
    },
    [user?.id]
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setFavoriteArtists([]);
      favoritesRef.current = [];
      return;
    }

    const localFavorites = readLocalFavorites(user.id);
    if (localFavorites.length > 0) {
      setAndPersist(localFavorites);
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("favorite_artists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const remoteFavorites = ((data || []) as unknown[])
        .map(normalizeFavoriteArtist)
        .filter(Boolean) as FavoriteArtist[];

      const merged = mergeFavorites(remoteFavorites, localFavorites);
      setAndPersist(merged);

      const remoteIds = new Set(remoteFavorites.map((artist) => artist.artist_id));
      const unsynced = merged.filter((artist) => !remoteIds.has(artist.artist_id));
      if (unsynced.length > 0) {
        await supabase.from("favorite_artists").upsert(
          unsynced.map((artist) => ({
            user_id: user.id,
            artist_id: artist.artist_id,
            artist_name: artist.artist_name,
            artist_image_url: artist.artist_image_url,
          })) as any[],
          { onConflict: "user_id,artist_id" }
        );
      }
    } catch (error) {
      console.error("Failed to fetch favorite artists", error);
      if (localFavorites.length === 0) {
        setAndPersist([]);
      }
    } finally {
      setLoading(false);
    }
  }, [setAndPersist, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`favorite-artists:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorite_artists",
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

  const isFavorite = useCallback(
    (artistId: number) =>
      favoriteArtists.some((artist) => artist.artist_id === artistId),
    [favoriteArtists]
  );

  const addFavorite = useCallback(
    async ({ artistId, artistName, artistImageUrl }: FavoriteArtistInput) => {
      if (!user) {
        toast.error("Sign in to favorite artists");
        return false;
      }

      const existing = favoritesRef.current.find(
        (artist) => artist.artist_id === artistId
      );
      const nextArtist: FavoriteArtist = {
        id: existing?.id || `local-${artistId}`,
        artist_id: artistId,
        artist_name: artistName,
        artist_image_url: artistImageUrl || existing?.artist_image_url || null,
        created_at: existing?.created_at || new Date().toISOString(),
      };

      const nextFavorites = [
        nextArtist,
        ...favoritesRef.current.filter((artist) => artist.artist_id !== artistId),
      ];
      setAndPersist(nextFavorites);

      try {
        const { error } = await supabase.from("favorite_artists").upsert(
          {
            user_id: user.id,
            artist_id: artistId,
            artist_name: artistName,
            artist_image_url: artistImageUrl || null,
          } as any,
          { onConflict: "user_id,artist_id" }
        );

        if (error) throw error;
      } catch (error) {
        console.error("Failed to add favorite artist", error);
      }

      return true;
    },
    [setAndPersist, user]
  );

  const removeFavorite = useCallback(
    async (artistId: number) => {
      if (!user) return false;

      const nextFavorites = favoritesRef.current.filter(
        (artist) => artist.artist_id !== artistId
      );
      setAndPersist(nextFavorites);

      try {
        const { error } = await supabase
          .from("favorite_artists")
          .delete()
          .eq("user_id", user.id)
          .eq("artist_id", artistId);

        if (error) throw error;
      } catch (error) {
        console.error("Failed to remove favorite artist", error);
      }

      return true;
    },
    [setAndPersist, user]
  );

  const toggleFavorite = useCallback(
    async (artist: FavoriteArtistInput) => {
      if (isFavorite(artist.artistId)) {
        return removeFavorite(artist.artistId);
      }
      return addFavorite(artist);
    },
    [addFavorite, isFavorite, removeFavorite]
  );

  return {
    favoriteArtists,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refresh,
  };
}
