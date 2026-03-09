import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
import { getSupabaseClient } from "@/lib/runtimeModules";

export interface FavoriteArtist {
    id: string;
    artist_id: number;
    artist_name: string;
    artist_image_url: string | null;
    created_at: string;
}

export interface FavoriteArtistInput {
    artistId: number;
    artistName: string;
    artistImageUrl?: string;
}

interface FavoriteArtistsContextType {
    favoriteArtists: FavoriteArtist[];
    loading: boolean;
    isFavorite: (artistId: number) => boolean;
    addFavorite: (artist: FavoriteArtistInput) => Promise<boolean>;
    removeFavorite: (artistId: number) => Promise<boolean>;
    toggleFavorite: (artist: FavoriteArtistInput) => Promise<boolean>;
    refresh: () => Promise<void>;
}

const FavoriteArtistsContext = createContext<FavoriteArtistsContextType | null>(null);

const normalizeFavoriteArtist = (value: unknown): FavoriteArtist | null => {
    const raw = value as Partial<FavoriteArtist> | null;
    if (!raw) return null;

    const artistId = Number(raw.artist_id);
    if (!Number.isFinite(artistId) || !raw.artist_name) return null;

    return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `local-${artistId}`,
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

export function FavoriteArtistsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>([]);
    const [loading, setLoading] = useState(false);
    const favoritesRef = useRef<FavoriteArtist[]>([]);

    useEffect(() => {
        favoritesRef.current = favoriteArtists;
    }, [favoriteArtists]);

    const refresh = useCallback(async () => {
        if (!user) {
            setFavoriteArtists([]);
            favoritesRef.current = [];
            return;
        }

        setLoading(true);
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from("favorite_artists")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const remoteFavorites = ((data || []) as unknown[])
                .map(normalizeFavoriteArtist)
                .filter(Boolean) as FavoriteArtist[];

            const normalized = sortByCreatedAtDesc(remoteFavorites);
            favoritesRef.current = normalized;
            setFavoriteArtists(normalized);
        } catch (error) {
            console.error("Failed to fetch favorite artists", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            void refresh();
            return;
        }

        return scheduleBackgroundTask(() => {
            void refresh();
        }, 900);
    }, [refresh, user]);

    useEffect(() => {
        if (!userId) return;

        let active = true;
        let channel: RealtimeChannel | null = null;
        const cancel = scheduleBackgroundTask(() => {
            void (async () => {
                const supabase = await getSupabaseClient();
                if (!active) return;

                channel = supabase
                    .channel(`favorite-artists:${userId}`)
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "favorite_artists",
                            filter: `user_id=eq.${userId}`,
                        },
                        () => {
                            void refresh();
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
    }, [refresh, userId]);

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

            const previousFavorites = favoritesRef.current;
            const nextFavorites = [
                nextArtist,
                ...previousFavorites.filter((artist) => artist.artist_id !== artistId),
            ];

            const normalized = sortByCreatedAtDesc(nextFavorites);
            favoritesRef.current = normalized;
            setFavoriteArtists(normalized);

            try {
                const supabase = await getSupabaseClient();
                const favoriteArtistInsert: TablesInsert<"favorite_artists"> = {
                    user_id: user.id,
                    artist_id: artistId,
                    artist_name: artistName,
                    artist_image_url: artistImageUrl || null,
                };

                const { error } = await supabase
                    .from("favorite_artists")
                    .upsert(favoriteArtistInsert, { onConflict: "user_id,artist_id" });

                if (error) throw error;
            } catch (error) {
                console.error("Failed to add favorite artist", error);

                // Revert on failure
                favoritesRef.current = previousFavorites;
                setFavoriteArtists(previousFavorites);
            }

            return true;
        },
        [user]
    );

    const removeFavorite = useCallback(
        async (artistId: number) => {
            if (!user) return false;

            const nextFavorites = favoritesRef.current.filter(
                (artist) => artist.artist_id !== artistId
            );

            const previousFavorites = favoritesRef.current;
            favoritesRef.current = nextFavorites;
            setFavoriteArtists(nextFavorites);

            try {
                const supabase = await getSupabaseClient();
                const { error } = await supabase
                    .from("favorite_artists")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("artist_id", artistId);

                if (error) throw error;
            } catch (error) {
                console.error("Failed to remove favorite artist", error);

                // Revert on failure
                favoritesRef.current = previousFavorites;
                setFavoriteArtists(previousFavorites);
            }

            return true;
        },
        [user]
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

    return (
        <FavoriteArtistsContext.Provider
            value={{
                favoriteArtists,
                loading,
                isFavorite,
                addFavorite,
                removeFavorite,
                toggleFavorite,
                refresh,
            }}
        >
            {children}
        </FavoriteArtistsContext.Provider>
    );
}

export function useFavoriteArtists() {
    const context = useContext(FavoriteArtistsContext);
    if (!context) {
        throw new Error("useFavoriteArtists must be used within a FavoriteArtistsProvider");
    }
    return context;
}
