import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import {
  PlaylistAccessRole,
  PlaylistCollaborator,
  PlaylistVisibility,
  usePlaylists,
} from "@/hooks/usePlaylists";
import { getUserPlaylistCoverUrl } from "@/components/user-playlist/userPlaylistUtils";
import { copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { useMainScrollY } from "@/hooks/useMainScrollY";

export function useUserPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isFavoritePlaylist, toggleFavoritePlaylist } = useFavoritePlaylists();
  const {
    playlists,
    initialized,
    loading,
    removeTrack,
    deletePlaylist,
    updatePlaylistDetails,
    regenerateShareToken,
    moveTrack,
    loadPlaylistTracks,
    getCollaborators,
    inviteCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
  } = usePlaylists();

  const playlist = playlists.find((entry) => entry.id === id) || null;
  const isResolvingPlaylist = Boolean(id) && !playlist && (!initialized || loading);
  const scrollY = useMainScrollY();
  const [metadataName, setMetadataName] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [metadataCover, setMetadataCover] = useState("");
  const [metadataVisibility, setMetadataVisibility] = useState<PlaylistVisibility>(
    "private"
  );
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<PlaylistAccessRole, "owner">>(
    "viewer"
  );
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (!playlist) return;
    setMetadataName(playlist.name);
    setMetadataDescription(playlist.description || "");
    setMetadataCover(playlist.cover_url || "");
    setMetadataVisibility(playlist.visibility);
  }, [playlist]);

  useEffect(() => {
    if (!playlist || playlist.tracks_loaded) {
      setIsLoadingTracks(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTracks(true);

    void loadPlaylistTracks(playlist.id).finally(() => {
      if (!cancelled) {
        setIsLoadingTracks(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadPlaylistTracks, playlist]);

  const refreshCollaborators = useCallback(async () => {
    if (!playlist) return;
    setIsLoadingCollaborators(true);
    const rows = await getCollaborators(playlist.id);
    setCollaborators(rows);
    setIsLoadingCollaborators(false);
  }, [getCollaborators, playlist]);

  useEffect(() => {
    void refreshCollaborators();
  }, [refreshCollaborators]);

  const coverUrl = getUserPlaylistCoverUrl(playlist);
  const isCurrentPlaylist = !!(
    playlist &&
    currentTrack &&
    playlist.tracks.some((track) => track.id === currentTrack.id)
  );
  const isSavedPlaylist = playlist ? isFavoritePlaylist(playlist.id, "local") : false;
  const canEdit = playlist?.access_role === "owner" || playlist?.access_role === "editor";
  const isOwner = playlist?.access_role === "owner";

  const handlePlayAll = useCallback(() => {
    if (!playlist || playlist.tracks.length === 0) return;
    if (isCurrentPlaylist) {
      togglePlay();
      return;
    }
    play(playlist.tracks[0], playlist.tracks);
  }, [isCurrentPlaylist, play, playlist, togglePlay]);

  const handleShuffle = useCallback(() => {
    if (!playlist || playlist.tracks.length === 0) return;
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
  }, [play, playlist]);

  const handleToggleFavoritePlaylist = useCallback(async () => {
    if (!playlist) return;
    const currentlyFavorite = isFavoritePlaylist(playlist.id, "local");
    const success = await toggleFavoritePlaylist({
      source: "local",
      playlistId: playlist.id,
      playlistTitle: playlist.name,
      playlistCoverUrl: coverUrl || null,
    });

    if (!success) {
      toast.error("Failed to update playlist library");
      return;
    }

    toast.success(
      currentlyFavorite
        ? `Removed ${playlist.name} from your library`
        : `Saved ${playlist.name} to your library`
    );
  }, [coverUrl, isFavoritePlaylist, playlist, toggleFavoritePlaylist]);

  const handleCopyShareLink = useCallback(async () => {
    if (!playlist) return;
    const url = `${window.location.origin}/shared-playlist/${playlist.share_token}`;
    await copyPlainTextToClipboard(url);
    toast.success("Share link copied");
  }, [playlist]);

  const handleRegenerateShareLink = useCallback(async () => {
    if (!playlist || !isOwner) return;
    const token = await regenerateShareToken(playlist.id);
    if (!token) {
      toast.error("Failed to regenerate share link");
      return;
    }
    toast.success("Share link regenerated");
  }, [isOwner, playlist, regenerateShareToken]);

  const handleDeletePlaylist = useCallback(async () => {
    if (!playlist) return;
    const confirmed = window.confirm(`Delete "${playlist.name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deletePlaylist(playlist.id);
    toast.success("Playlist deleted");
    navigate("/");
  }, [deletePlaylist, navigate, playlist]);

  const handleSaveMetadata = useCallback(async () => {
    if (!playlist || !canEdit) return;
    if (!metadataName.trim()) {
      toast.error("Playlist name cannot be empty");
      return;
    }

    setIsSavingMetadata(true);
    const success = await updatePlaylistDetails(playlist.id, {
      name: metadataName,
      description: metadataDescription,
      cover_url: metadataCover.trim() || null,
      ...(isOwner ? { visibility: metadataVisibility } : {}),
    });
    setIsSavingMetadata(false);

    if (!success) {
      toast.error("Failed to save playlist details");
      return;
    }

    toast.success("Playlist details updated");
  }, [
    canEdit,
    isOwner,
    metadataCover,
    metadataDescription,
    metadataName,
    metadataVisibility,
    playlist,
    updatePlaylistDetails,
  ]);

  const handleInviteCollaborator = useCallback(async () => {
    if (!playlist || !isOwner) return;
    if (!inviteEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setIsInviting(true);
    const result = await inviteCollaborator(playlist.id, inviteEmail, inviteRole);
    setIsInviting(false);
    if (!result.ok) {
      toast.error(result.message || "Failed to invite collaborator");
      return;
    }
    setInviteEmail("");
    toast.success("Collaborator invited");
    await refreshCollaborators();
  }, [
    inviteCollaborator,
    inviteEmail,
    inviteRole,
    isOwner,
    playlist,
    refreshCollaborators,
  ]);

  const handleRoleChange = useCallback(
    async (
      collaboratorUserId: string,
      nextRole: Exclude<PlaylistAccessRole, "owner">
    ) => {
      if (!playlist) return;
      const ok = await updateCollaboratorRole(playlist.id, collaboratorUserId, nextRole);
      if (!ok) {
        toast.error("Failed to update role");
        return;
      }
      toast.success("Role updated");
      await refreshCollaborators();
    },
    [playlist, refreshCollaborators, updateCollaboratorRole]
  );

  const handleRemoveCollaborator = useCallback(
    async (collaboratorUserId: string) => {
      if (!playlist) return;
      const ok = await removeCollaborator(playlist.id, collaboratorUserId);
      if (!ok) {
        toast.error("Failed to remove collaborator");
        return;
      }
      toast.success("Collaborator removed");
      await refreshCollaborators();
    },
    [playlist, refreshCollaborators, removeCollaborator]
  );

  const handlePlayTrack = useCallback(
    (trackId: string) => {
      if (!playlist) return;
      const track = playlist.tracks.find((entry) => entry.id === trackId);
      if (!track) return;
      play(track, playlist.tracks);
    },
    [play, playlist]
  );

  const handleToggleLike = useCallback(
    (trackId: string) => {
      if (!playlist) return;
      const track = playlist.tracks.find((entry) => entry.id === trackId);
      if (!track) return;
      void toggleLike(track);
    },
    [playlist, toggleLike]
  );

  const handleMoveTrack = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!playlist) return;
      const ok = await moveTrack(playlist.id, fromIndex, toIndex);
      if (!ok) toast.error("Failed to reorder track");
    },
    [moveTrack, playlist]
  );

  const handleRemoveTrack = useCallback(
    (trackIndex: number) => {
      if (!playlist) return;
      void removeTrack(playlist.id, trackIndex);
    },
    [playlist, removeTrack]
  );

  const handleRemoveTracks = useCallback(
    async (trackIds: string[]) => {
      if (!playlist || trackIds.length === 0) return;

      const indicesToRemove = playlist.tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => trackIds.includes(track.id))
        .map(({ index }) => index)
        .sort((a, b) => b - a);

      for (const trackIndex of indicesToRemove) {
        await removeTrack(playlist.id, trackIndex);
      }
    },
    [playlist, removeTrack]
  );

  return {
    loading: loading || isLoadingTracks || isResolvingPlaylist,
    playlist,
    scrollY,
    coverUrl,
    currentTrack,
    isPlaying,
    isCurrentPlaylist,
    isSavedPlaylist,
    canEdit,
    isOwner,
    isLiked,
    shareVisibility: playlist?.visibility,
    metadataName,
    metadataDescription,
    metadataCover,
    metadataVisibility,
    isSavingMetadata,
    collaborators,
    isLoadingCollaborators,
    inviteEmail,
    inviteRole,
    isInviting,
    setMetadataName,
    setMetadataDescription,
    setMetadataCover,
    setMetadataVisibility,
    setInviteEmail,
    setInviteRole,
    handlePlayAll,
    handleShuffle,
    handleToggleFavoritePlaylist,
    handleCopyShareLink,
    handleRegenerateShareLink,
    handleDeletePlaylist,
    handleSaveMetadata,
    refreshCollaborators,
    handleInviteCollaborator,
    handleRoleChange,
    handleRemoveCollaborator,
    handlePlayTrack,
    handleToggleLike,
    handleMoveTrack,
    handleRemoveTrack,
    handleRemoveTracks,
  };
}
