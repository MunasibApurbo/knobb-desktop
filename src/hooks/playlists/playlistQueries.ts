import { supabase } from "@/integrations/supabase/client";
import {
  buildPlaylist,
  isMissingPlaylistRpcError,
  normalizeRole,
} from "@/hooks/playlists/helpers";
import type {
  PlaylistRecord,
  PlaylistTrackRpcRecord,
  UserPlaylist,
} from "@/hooks/playlists/types";
import type { Track } from "@/types/music";

const playlistCache = new Map<string, UserPlaylist[]>();
const playlistRequestCache = new Map<string, Promise<UserPlaylist[]>>();

function clonePlaylist(playlist: UserPlaylist): UserPlaylist {
  return {
    ...playlist,
    tracks: [...playlist.tracks],
  };
}

function clonePlaylists(playlists: UserPlaylist[]) {
  return playlists.map(clonePlaylist);
}

export function invalidateUserPlaylistsCache(userId?: string) {
  if (userId) {
    playlistCache.delete(userId);
    playlistRequestCache.delete(userId);
    return;
  }

  playlistCache.clear();
  playlistRequestCache.clear();
}

async function fetchLegacyUserPlaylists(userId: string): Promise<UserPlaylist[]> {
  const { data, error } = await supabase
    .from("playlists")
    .select("id,name,description,cover_url,created_at,user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to fetch legacy playlists", error);
    return [];
  }

  return (data as PlaylistRecord[]).map((playlist) =>
    buildPlaylist(
      playlist,
      userId,
      undefined,
      [],
      {
        accessRole: "owner",
        trackCount: 0,
        tracksLoaded: false,
      },
    ),
  );
}

export async function fetchUserPlaylists(
  userId: string,
  options?: { force?: boolean },
): Promise<UserPlaylist[]> {
  if (!options?.force) {
    const cached = playlistCache.get(userId);
    if (cached) return clonePlaylists(cached);

    const inFlight = playlistRequestCache.get(userId);
    if (inFlight) {
      return clonePlaylists(await inFlight);
    }
  }

  const request = (async () => {
    const { data: playlistRows, error: playlistError } = await supabase.rpc(
      "get_user_playlist_summaries",
    );

    if (playlistError || !playlistRows) {
      if (isMissingPlaylistRpcError(playlistError, "get_user_playlist_summaries")) {
        const playlists = await fetchLegacyUserPlaylists(userId);
        playlistCache.set(userId, clonePlaylists(playlists));
        return playlists;
      }

      console.error("Failed to fetch playlists", playlistError);
      return [];
    }

    const playlists = (playlistRows as PlaylistRecord[]).map((playlist) =>
      buildPlaylist(
        playlist,
        userId,
        undefined,
        [],
        {
          accessRole: playlist.access_role ? normalizeRole(playlist.access_role) : undefined,
          trackCount: Number(playlist.track_count ?? 0),
          tracksLoaded: Number(playlist.track_count ?? 0) === 0,
        },
      ),
    );

    playlistCache.set(userId, clonePlaylists(playlists));
    return playlists;
  })();

  playlistRequestCache.set(userId, request);

  try {
    return clonePlaylists(await request);
  } finally {
    playlistRequestCache.delete(userId);
  }
}

export async function fetchPlaylistTracks(playlistId: string): Promise<Track[] | null> {
  const { data, error } = await supabase.rpc("get_playlist_tracks", {
    target_playlist_id: playlistId,
  });

  if (error) {
    if (isMissingPlaylistRpcError(error, "get_playlist_tracks")) {
      const fallback = await supabase
        .from("playlist_tracks")
        .select("position,added_at,track_data")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (fallback.error) {
        console.error("Failed to fetch playlist tracks", fallback.error);
        return null;
      }

      return ((fallback.data || []) as unknown as PlaylistTrackRpcRecord[]).map((row) => ({
        ...(row.track_data as Track),
        addedAt: row.added_at,
      }));
    }

    console.error("Failed to fetch playlist tracks", error);
    return null;
  }

  return ((data || []) as unknown as PlaylistTrackRpcRecord[]).map((row) => ({
    ...(row.track_data as Track),
    addedAt: row.added_at,
  }));
}

export function subscribeToPlaylistChanges(userId: string, onChange: () => void) {
  return supabase
    .channel(`library-playlists:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "playlists",
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "playlist_tracks",
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "playlist_collaborators",
      },
      onChange,
    )
    .subscribe();
}

export async function removePlaylistSubscription(channel: Awaited<ReturnType<typeof subscribeToPlaylistChanges>>) {
  await supabase.removeChannel(channel);
}
