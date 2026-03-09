import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildOptimisticPlaylist,
  buildPlaylist,
  getTrackKey,
  isUniqueViolation,
} from "@/hooks/playlists/helpers";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
import {
  getSupabaseClient,
  loadPlaylistCollaboratorsModule,
  loadPlaylistMutationsModule,
  loadPlaylistQueriesModule,
  reportClientErrorLazy,
} from "@/lib/runtimeModules";
import type {
  AddTrackResult,
  PlaylistCollaboratorRole,
  PlaylistDetailsUpdate,
  PlaylistRecord,
  PlaylistVisibility,
  UserPlaylist,
} from "@/hooks/playlists/types";
import type { Track } from "@/types/music";

export type {
  AddTrackResult,
  PlaylistAccessRole,
  PlaylistCollaborator,
  PlaylistCollaboratorRole,
  PlaylistVisibility,
  UserPlaylist,
} from "@/hooks/playlists/types";

function getPlaylistErrorMessage(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.trim();
  if (!message) return "Playlist could not be created.";

  const normalized = message.toLowerCase();
  if (normalized.includes("jwt") || normalized.includes("token") || normalized.includes("not authenticated")) {
    return "Your session expired. Sign in again and retry.";
  }

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "This account is not allowed to create playlists right now. Sign in again and retry.";
  }

  if (normalized.includes("infinite recursion detected in policy")) {
    return "Playlist permissions are out of date on the backend. Apply the latest Supabase migrations and retry.";
  }

  if (
    (normalized.includes("schema cache") || normalized.includes("column")) &&
    (normalized.includes("visibility") || normalized.includes("share_token"))
  ) {
    return "Playlist schema is out of date on the backend. Apply the latest Supabase migrations and retry.";
  }

  return message;
}

function mergePlaylistSummaries(
  previous: UserPlaylist[],
  incoming: UserPlaylist[],
): UserPlaylist[] {
  const previousById = new Map(previous.map((playlist) => [playlist.id, playlist]));

  return incoming.map((playlist) => {
    const existing = previousById.get(playlist.id);
    if (!existing || !existing.tracks_loaded) {
      return playlist;
    }

    if (existing.track_count !== playlist.track_count) {
      return {
        ...playlist,
        tracks: [],
        tracks_loaded: playlist.tracks_loaded,
      };
    }

    return {
      ...playlist,
      cover_url: playlist.cover_url || existing.cover_url,
      tracks: existing.tracks,
      tracks_loaded: existing.tracks_loaded,
    };
  });
}

function usePlaylistsState() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(() => Boolean(user));
  const [initialized, setInitialized] = useState(false);
  const [lastPlaylistError, setLastPlaylistError] = useState<string | null>(null);
  const playlistsRef = useRef<UserPlaylist[]>([]);
  const lastPlaylistErrorRef = useRef<string | null>(null);

  const setPlaylistError = useCallback((message: string | null) => {
    lastPlaylistErrorRef.current = message;
    setLastPlaylistError(message);
  }, []);

  const invalidatePlaylistsCache = useCallback(async (userId?: string) => {
    const { invalidateUserPlaylistsCache } = await loadPlaylistQueriesModule();
    invalidateUserPlaylistsCache(userId);
  }, []);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      setInitialized(true);
      return;
    }

    setLoading(true);
    setInitialized(false);
    try {
      const { fetchUserPlaylists } = await loadPlaylistQueriesModule();
      const nextPlaylists = await fetchUserPlaylists(user.id);
      setPlaylists((previous) => mergePlaylistSummaries(previous, nextPlaylists));
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      void fetchPlaylists();
      return;
    }

    return scheduleBackgroundTask(() => {
      void fetchPlaylists();
    }, 900);
  }, [fetchPlaylists, user]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let channel: Awaited<
      ReturnType<Awaited<ReturnType<typeof loadPlaylistQueriesModule>>["subscribeToPlaylistChanges"]>
    > | null = null;
    const cancel = scheduleBackgroundTask(() => {
      void (async () => {
        const { invalidateUserPlaylistsCache, subscribeToPlaylistChanges } = await loadPlaylistQueriesModule();
        if (!active) return;

        channel = subscribeToPlaylistChanges(user.id, () => {
          invalidateUserPlaylistsCache(user.id);
          void fetchPlaylists();
        });
      })();
    }, 1400);

    return () => {
      active = false;
      cancel();
      if (channel) {
        void loadPlaylistQueriesModule().then(({ removePlaylistSubscription }) => removePlaylistSubscription(channel!));
      }
    };
  }, [fetchPlaylists, user]);

  const loadPlaylistTracks = useCallback(async (playlistId: string, force = false) => {
    const existing = playlistsRef.current.find((playlist) => playlist.id === playlistId);
    if (!existing) return [] as Track[];
    if (existing.tracks_loaded && !force) return existing.tracks;

    const { fetchPlaylistTracks } = await loadPlaylistQueriesModule();
    const tracks = await fetchPlaylistTracks(playlistId);
    if (!tracks) {
      return existing.tracks;
    }

    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              cover_url: playlist.cover_url || tracks[0]?.coverUrl || null,
              track_count: tracks.length,
              tracks,
              tracks_loaded: true,
            }
          : playlist
      )
    );

    return tracks;
  }, []);

  const createPlaylist = useCallback(
    async (
      name: string,
      description = "",
      options?: {
        cover_url?: string | null;
        visibility?: PlaylistVisibility;
      }
    ) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setPlaylistError("Playlist name is required.");
        return null;
      }

      setPlaylistError(null);

      const ownerId =
        user?.id ||
        (
          await getSupabaseClient().then((supabase) => supabase.auth.getUser()).catch(() => ({
            data: { user: null },
          }))
        ).data.user?.id;

      if (!ownerId) {
        const message = "Your session expired. Sign in again and retry.";
        setPlaylistError(message);
        pushAppDiagnostic({
          level: "error",
          title: "Couldn't create playlist",
          message,
          source: "playlists",
          dedupeKey: "playlist-create:no-session",
        });
        return null;
      }

      const existing = playlistsRef.current.find(
        (playlist) => playlist.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) return existing.id;

      const optimistic = buildOptimisticPlaylist(ownerId, trimmedName, description, options);
      setPlaylists((prev) => [optimistic, ...prev]);

      const { createPlaylistRecord } = await loadPlaylistMutationsModule();
      const { data, error } = await createPlaylistRecord(ownerId, trimmedName, description, options);

      if (error || !data) {
        const message = getPlaylistErrorMessage(error);
        console.error("Failed to create playlist", error);
        setPlaylistError(message);
        pushAppDiagnostic({
          level: "error",
          title: "Couldn't create playlist",
          message,
          source: "playlists",
          dedupeKey: `playlist-create:${message}`,
        });
        void reportClientErrorLazy(error || message, "playlist_create_failed", {
          hasUser: Boolean(user?.id),
          playlistName: trimmedName,
          visibility: options?.visibility ?? "private",
        });
        setPlaylists((prev) => prev.filter((playlist) => playlist.id !== optimistic.id));
        return null;
      }

      void invalidatePlaylistsCache(ownerId);
      const persistedPlaylist: PlaylistRecord = {
        ...data,
        description: data.description ?? description,
        share_token: data.share_token ?? optimistic.share_token,
        visibility: data.visibility ?? options?.visibility ?? "private",
      };
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === optimistic.id
            ? buildPlaylist(persistedPlaylist, ownerId, "owner", [], {
                accessRole: "owner",
                trackCount: 0,
                tracksLoaded: true,
              })
            : playlist
        )
      );

      return data.id;
    },
    [invalidatePlaylistsCache, setPlaylistError, user]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      const previous = playlistsRef.current;
      setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));

      const { deletePlaylistRecord } = await loadPlaylistMutationsModule();
      const { error } = await deletePlaylistRecord(id, user?.id || "");

      if (error) {
        console.error("Failed to delete playlist", error);
        setPlaylists(previous);
        return;
      }

      void invalidatePlaylistsCache(user?.id);
    },
    [invalidatePlaylistsCache, user]
  );

  const updatePlaylistDetails = useCallback(
    async (
      id: string,
      updates: {
        name?: string;
        description?: string;
        cover_url?: string | null;
        visibility?: PlaylistVisibility;
        share_token?: string;
      }
    ) => {
      const previous = playlistsRef.current;
      const target = previous.find((playlist) => playlist.id === id);
      if (!target) return false;

      const nextName = updates.name?.trim() || target.name;
      const nextDescription =
        updates.description !== undefined ? updates.description : target.description;
      const nextCover =
        updates.cover_url !== undefined ? updates.cover_url : target.cover_url;
      const nextVisibility =
        updates.visibility !== undefined ? updates.visibility : target.visibility;
      const nextShareToken =
        updates.share_token !== undefined ? updates.share_token : target.share_token;

      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === id
            ? {
                ...playlist,
                name: nextName,
                description: nextDescription,
                cover_url: nextCover,
                visibility: nextVisibility,
                share_token: nextShareToken,
              }
            : playlist
        )
      );

      const payload: Required<PlaylistDetailsUpdate> = {
        name: nextName,
        description: nextDescription,
        cover_url: nextCover,
        visibility: nextVisibility,
        share_token: nextShareToken,
      };
      const { updatePlaylistRecord } = await loadPlaylistMutationsModule();
      const { error } = await updatePlaylistRecord(id, payload);

      if (error) {
        console.error("Failed to update playlist details", error);
        setPlaylists(previous);
        return false;
      }

      void invalidatePlaylistsCache(user?.id);
      return true;
    },
    [invalidatePlaylistsCache, user?.id]
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      await updatePlaylistDetails(id, { name: trimmedName });
    },
    [updatePlaylistDetails]
  );

  const regenerateShareToken = useCallback(
    async (id: string) => {
      const token = crypto.randomUUID();
      const ok = await updatePlaylistDetails(id, { share_token: token });
      if (!ok) return null;
      return token;
    },
    [updatePlaylistDetails]
  );

  const addTrack = useCallback(
    async (playlistId: string, track: Track): Promise<AddTrackResult> => {
      const target = playlistsRef.current.find((playlist) => playlist.id === playlistId);
      if (!target) return { added: false, reason: "error" };

      const incomingTrackKey = getTrackKey(track);
      const alreadyExists = target.tracks_loaded && target.tracks.some(
        (existingTrack) => getTrackKey(existingTrack) === incomingTrackKey
      );
      if (alreadyExists) return { added: false, reason: "duplicate" };

      const previous = playlistsRef.current;
      const optimisticTrack = {
        ...track,
        addedAt: new Date().toISOString(),
      };
      setPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                track_count: playlist.track_count + 1,
                tracks: playlist.tracks_loaded
                  ? [...playlist.tracks, optimisticTrack]
                  : playlist.tracks,
                cover_url: playlist.cover_url || optimisticTrack.coverUrl || null,
              }
            : playlist
        )
      );

      const nextPosition = target.track_count;
      const { insertPlaylistTrackRecord, setPlaylistCoverUrl } = await loadPlaylistMutationsModule();
      const { error: insertError } = await insertPlaylistTrackRecord(
        playlistId,
        track,
        incomingTrackKey,
        nextPosition,
      );

      if (insertError) {
        if (isUniqueViolation(insertError)) {
          void invalidatePlaylistsCache(user?.id);
          void fetchPlaylists();
          return { added: false, reason: "duplicate" };
        }
        console.error("Failed to add track to playlist", insertError);
        setPlaylists(previous);
        return { added: false, reason: "error" };
      }

      void invalidatePlaylistsCache(user?.id);
      if (nextPosition === 0 && track.coverUrl) {
        const { error: coverError } = await setPlaylistCoverUrl(playlistId, track.coverUrl);
        if (coverError) {
          console.error("Failed to update playlist cover", coverError);
        }
      }

      return { added: true };
    },
    [fetchPlaylists, invalidatePlaylistsCache, user?.id]
  );

  const createPlaylistWithTracks = useCallback(
    async (
      name: string,
      tracks: Track[],
      options?: {
        cover_url?: string | null;
        description?: string;
        visibility?: PlaylistVisibility;
      }
    ) => {
      const playlistId = await createPlaylist(name, options?.description || "", {
        cover_url: options?.cover_url,
        visibility: options?.visibility,
      });
      if (!playlistId) return null;

      let addedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (const track of tracks) {
        const result = await addTrack(playlistId, track);
        if (result.added) {
          addedCount += 1;
        } else if (result.reason === "duplicate") {
          duplicateCount += 1;
        } else {
          failedCount += 1;
        }
      }

      return {
        addedCount,
        duplicateCount,
        failedCount,
        playlistId,
      };
    },
    [addTrack, createPlaylist]
  );

  const importTracksToPlaylist = useCallback(
    async (
      playlistId: string,
      tracks: Track[],
      onProgress?: (progress: {
        addedCount: number;
        current: number;
        duplicateCount: number;
        failedCount: number;
        total: number;
      }) => void,
    ) => {
      let addedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (let index = 0; index < tracks.length; index += 1) {
        const result = await addTrack(playlistId, tracks[index]);

        if (result.added) {
          addedCount += 1;
        } else if (result.reason === "duplicate") {
          duplicateCount += 1;
        } else {
          failedCount += 1;
        }

        onProgress?.({
          addedCount,
          current: index + 1,
          duplicateCount,
          failedCount,
          total: tracks.length,
        });

        if ((index + 1) % 5 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }

      return {
        addedCount,
        duplicateCount,
        failedCount,
      };
    },
    [addTrack]
  );

  const moveTrack = useCallback(
    async (playlistId: string, fromIndex: number, toIndex: number) => {
      let playlist = playlistsRef.current.find((entry) => entry.id === playlistId);
      if (!playlist) return false;
      if (!playlist.tracks_loaded && playlist.track_count > 0) {
        await loadPlaylistTracks(playlistId);
        playlist = playlistsRef.current.find((entry) => entry.id === playlistId);
      }
      if (!playlist?.tracks_loaded) return false;
      if (fromIndex < 0 || fromIndex >= playlist.tracks.length) return false;
      if (toIndex < 0 || toIndex >= playlist.tracks.length) return false;
      if (fromIndex === toIndex) return true;

      const previous = playlistsRef.current;
      const reordered = [...playlist.tracks];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      setPlaylists((prev) =>
        prev.map((entry) =>
          entry.id === playlistId
            ? {
                ...entry,
                tracks: reordered,
              }
            : entry
        )
      );

      const { fetchPlaylistTrackRows, updatePlaylistTrackPosition } = await loadPlaylistMutationsModule();
      const { data: rows, error: rowsError } = await fetchPlaylistTrackRows(playlistId);

      if (rowsError || !rows) {
        console.error("Failed to fetch track positions for reorder", rowsError);
        setPlaylists(previous);
        return false;
      }

      const rowIdByTrackKey = new Map(rows.map((row) => [row.track_key, row.id]));
      const updates = reordered
        .map((track, index) => {
          const id = rowIdByTrackKey.get(getTrackKey(track));
          if (!id) return null;
          return { id, position: index };
        })
        .filter((item): item is { id: string; position: number } => item !== null);

      const results = await Promise.all(
        updates.map((update) =>
          updatePlaylistTrackPosition(update.id, update.position)
        )
      );

      if (results.some((result) => result.error)) {
        console.error("Failed to persist track reorder", results);
        setPlaylists(previous);
        return false;
      }

      void invalidatePlaylistsCache(user?.id);
      return true;
    },
    [invalidatePlaylistsCache, loadPlaylistTracks, user?.id]
  );

  const removeTrack = useCallback(
    async (playlistId: string, trackIndex: number) => {
      let playlist = playlistsRef.current.find((entry) => entry.id === playlistId);
      if (playlist && !playlist.tracks_loaded && playlist.track_count > 0) {
        await loadPlaylistTracks(playlistId);
        playlist = playlistsRef.current.find((entry) => entry.id === playlistId);
      }
      if (!playlist || trackIndex < 0 || trackIndex >= playlist.tracks.length) return;

      const previous = playlistsRef.current;
      const targetTrack = playlist.tracks[trackIndex];
      const targetTrackKey = getTrackKey(targetTrack);
      const remaining = playlist.tracks.filter((_, index) => index !== trackIndex);

      setPlaylists((prev) =>
        prev.map((entry) =>
          entry.id === playlistId
            ? {
                ...entry,
                track_count: remaining.length,
                tracks: remaining,
                cover_url: remaining[0]?.coverUrl || null,
              }
            : entry
        )
      );

      const {
        deletePlaylistTrackRecord,
        fetchPlaylistTrackIds,
        setPlaylistCoverUrl,
        updatePlaylistTrackPosition,
      } = await loadPlaylistMutationsModule();
      const { error: deleteError } = await deletePlaylistTrackRecord(playlistId, targetTrackKey);

      if (deleteError) {
        console.error("Failed to remove track from playlist", deleteError);
        setPlaylists(previous);
        return;
      }

      const { error: coverError } = await setPlaylistCoverUrl(
        playlistId,
        remaining[0]?.coverUrl || null,
      );
      if (coverError) {
        console.error("Failed to update cover after track removal", coverError);
      }

      const { data: rows, error: listError } = await fetchPlaylistTrackIds(playlistId);

      if (!listError && rows) {
        await Promise.all(
          rows.map((row, index) =>
            updatePlaylistTrackPosition(row.id, index)
          )
        );
      }

      void invalidatePlaylistsCache(user?.id);
    },
    [invalidatePlaylistsCache, loadPlaylistTracks, user?.id]
  );

  const getCollaborators = useCallback(async (playlistId: string) => {
    const { fetchPlaylistCollaborators } = await loadPlaylistCollaboratorsModule();
    return fetchPlaylistCollaborators(playlistId);
  }, []);

  const inviteCollaborator = useCallback(
    async (playlistId: string, email: string, role: PlaylistCollaboratorRole) => {
      if (!user) return { ok: false, message: "Not signed in" };
      const { invitePlaylistCollaborator } = await loadPlaylistCollaboratorsModule();
      return invitePlaylistCollaborator(playlistId, email, role);
    },
    [user]
  );

  const updateCollaboratorRole = useCallback(
    async (playlistId: string, collaboratorUserId: string, role: PlaylistCollaboratorRole) => {
      const { updatePlaylistCollaboratorRole } = await loadPlaylistCollaboratorsModule();
      return updatePlaylistCollaboratorRole(playlistId, collaboratorUserId, role);
    },
    []
  );

  const removeCollaborator = useCallback(
    async (playlistId: string, collaboratorUserId: string) => {
      const { removePlaylistCollaborator } = await loadPlaylistCollaboratorsModule();
      return removePlaylistCollaborator(playlistId, collaboratorUserId);
    },
    []
  );

  return useMemo(
    () => ({
      playlists,
      initialized,
      loading,
      lastPlaylistError,
      getLastPlaylistError: () => lastPlaylistErrorRef.current,
      createPlaylist,
      createPlaylistWithTracks,
      importTracksToPlaylist,
      deletePlaylist,
      renamePlaylist,
      updatePlaylistDetails,
      regenerateShareToken,
      addTrack,
      moveTrack,
      removeTrack,
      loadPlaylistTracks,
      getCollaborators,
      inviteCollaborator,
      updateCollaboratorRole,
      removeCollaborator,
      refresh: async () => {
        await invalidatePlaylistsCache(user?.id);
        await fetchPlaylists();
      },
    }),
    [
      addTrack,
      createPlaylist,
      createPlaylistWithTracks,
      deletePlaylist,
      fetchPlaylists,
      getCollaborators,
      importTracksToPlaylist,
      initialized,
      invalidatePlaylistsCache,
      inviteCollaborator,
      lastPlaylistError,
      loadPlaylistTracks,
      loading,
      moveTrack,
      playlists,
      regenerateShareToken,
      removeCollaborator,
      removeTrack,
      renamePlaylist,
      updateCollaboratorRole,
      updatePlaylistDetails,
      user?.id,
    ],
  );
}

type PlaylistsContextValue = ReturnType<typeof usePlaylistsState>;

const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const value = usePlaylistsState();

  return createElement(PlaylistsContext.Provider, { value }, children);
}

export function usePlaylists() {
  const context = useContext(PlaylistsContext);

  if (!context) {
    throw new Error("usePlaylists must be used within PlaylistsProvider");
  }

  return context;
}
