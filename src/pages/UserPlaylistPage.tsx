import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { PlaylistShareDropdownButton } from "@/components/PlaylistShareDropdownButton";
import { UserPlaylistActions } from "@/components/user-playlist/UserPlaylistActions";
import { UserPlaylistHero } from "@/components/user-playlist/UserPlaylistHero";
import { UserPlaylistManageMenu } from "@/components/user-playlist/UserPlaylistManageMenu";
import { UserPlaylistTracksSection } from "@/components/user-playlist/UserPlaylistTracksSection";
import { userPlaylistActionBtnClass } from "@/components/user-playlist/userPlaylistUtils";
import { DetailHero } from "@/components/detail/DetailHero";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserPlaylistPage } from "@/hooks/useUserPlaylistPage";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";
import { downloadTracks } from "@/lib/downloadHelpers";
import {
  Music,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Track } from "@/types/music";
import { toast } from "sonner";

export default function UserPlaylistPage() {
  const { setActiveScope } = useTrackSelectionShortcutsContext();
  const { downloadFormat } = useSettings();
  const {
    loading,
    playlist,
    coverUrl,
    currentTrack,
    isPlaying,
    isCurrentPlaylist,
    isSavedPlaylist,
    canEdit,
    isOwner,
    isLiked,
    shareVisibility,
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
  } = useUserPlaylistPage();
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const playlistTrackIds = new Set((playlist?.tracks || []).map((track) => track.id));
    setSelectedTrackIds((previous) => previous.filter((id) => playlistTrackIds.has(id)));
  }, [playlist]);

  const clearSelection = useCallback(() => {
    setSelectedTrackIds([]);
    setLastSelectedIndex(null);
  }, []);

  const selectAll = useCallback(() => {
    if (!playlist) return;
    setSelectedTrackIds(playlist.tracks.map((track) => track.id));
    setLastSelectedIndex(playlist.tracks.length > 0 ? playlist.tracks.length - 1 : null);
  }, [playlist]);

  const deleteSelection = useCallback(async () => {
    if (!canEdit || selectedTrackIds.length === 0) return;
    await handleRemoveTracks(selectedTrackIds);
    clearSelection();
  }, [canEdit, clearSelection, handleRemoveTracks, selectedTrackIds]);

  const handleDownloadPlaylist = useCallback(async () => {
    if (!playlist || playlist.tracks.length === 0 || isDownloading) return;
    const confirmed = window.confirm(`Download all ${playlist.tracks.length} tracks from "${playlist.name}"?`);
    if (!confirmed) return;

    setIsDownloading(true);
    toast.info(`Downloading ${playlist.name}...`);

    const quality = downloadFormat === "flac" ? "LOSSLESS" : "HIGH";
    const result = await downloadTracks(playlist.tracks, quality);

    setIsDownloading(false);

    if (result.successCount === result.total) {
      toast.success(`Downloaded ${playlist.name}`);
      return;
    }

    if (result.successCount > 0) {
      toast.warning(`Downloaded ${result.successCount} of ${result.total} tracks from ${playlist.name}`);
      return;
    }

    toast.error(`Failed to download ${playlist.name}`);
  }, [downloadFormat, isDownloading, playlist]);

  const selectionScope = useMemo(() => (
    !playlist
      ? null
      : {
          id: `playlist:${playlist.id}`,
          selectedCount: canEdit ? selectedTrackIds.length : 0,
          selectAll,
          clearSelection,
          deleteSelection,
          collectionActions: {
            download: () => void handleDownloadPlaylist(),
            play: handlePlayAll,
            share: () => void handleCopyShareLink(),
            shuffle: handleShuffle,
            toggleSaved: () => void handleToggleFavoritePlaylist(),
          },
        }
  ), [
    canEdit,
    clearSelection,
    deleteSelection,
    handleCopyShareLink,
    handleDownloadPlaylist,
    handlePlayAll,
    handleShuffle,
    handleToggleFavoritePlaylist,
    playlist,
    selectAll,
    selectedTrackIds.length,
  ]);

  useEffect(() => {
    if (!selectionScope) {
      setActiveScope(null);
      return;
    }

    setActiveScope(selectionScope);

    return () => {
      setActiveScope(null);
    };
  }, [selectionScope, setActiveScope]);

  const handleTrackClick = useCallback((event: React.MouseEvent<HTMLElement>, track: Track, index: number) => {
    if (!playlist || !selectionScope) return;

    setActiveScope(selectionScope);

    if (event.shiftKey && lastSelectedIndex !== null) {
      event.preventDefault();
      const [start, end] = [lastSelectedIndex, index].sort((a, b) => a - b);
      const rangeIds = playlist.tracks.slice(start, end + 1).map((item) => item.id);
      setSelectedTrackIds((previous) => Array.from(new Set([...previous, ...rangeIds])));
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      setSelectedTrackIds((previous) =>
        previous.includes(track.id)
          ? previous.filter((id) => id !== track.id)
          : [...previous, track.id],
      );
      setLastSelectedIndex(index);
      return;
    }

    clearSelection();
    handlePlayTrack(track.id);
  }, [clearSelection, handlePlayTrack, lastSelectedIndex, playlist, selectionScope, setActiveScope]);

  const activatePlaylistShortcutScope = useCallback(() => {
    if (!selectionScope) return;
    setActiveScope(selectionScope);
  }, [selectionScope, setActiveScope]);

  if (!playlist && !loading) {
    return (
      <div className="text-center py-20">
        <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Playlist not found</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <PageTransition>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="page-shell"
        >
          <DetailHero
            artworkUrl="/placeholder.svg"
            label="Playlist"
            title="Playlist"
            body={<p>Opening playlist details.</p>}
          />
        </motion.div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="page-shell"
        onFocusCapture={activatePlaylistShortcutScope}
        onPointerDownCapture={activatePlaylistShortcutScope}
      >
        <UserPlaylistHero
          playlist={playlist}
          coverUrl={coverUrl}
          cornerAction={(
            <UserPlaylistManageMenu
              canEdit={canEdit}
              collaborators={collaborators}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              isInviting={isInviting}
              isLoadingCollaborators={isLoadingCollaborators}
              isOwner={!!isOwner}
              isSavingMetadata={isSavingMetadata}
              metadataCover={metadataCover}
              metadataDescription={metadataDescription}
              metadataName={metadataName}
              metadataVisibility={metadataVisibility}
              onCopyShareLink={() => void handleCopyShareLink()}
              onInvite={() => void handleInviteCollaborator()}
              onInviteEmailChange={setInviteEmail}
              onInviteRoleChange={setInviteRole}
              onMetadataCoverChange={setMetadataCover}
              onMetadataDescriptionChange={setMetadataDescription}
              onMetadataNameChange={setMetadataName}
              onMetadataVisibilityChange={setMetadataVisibility}
              onDeletePlaylist={() => void handleDeletePlaylist()}
              onRefreshCollaborators={() => void refreshCollaborators()}
              onRegenerateShareLink={() => void handleRegenerateShareLink()}
              onRemoveCollaborator={(collaboratorUserId) =>
                void handleRemoveCollaborator(collaboratorUserId)
              }
              onRoleChange={(collaboratorUserId, nextRole) =>
                void handleRoleChange(collaboratorUserId, nextRole)
              }
              onSaveMetadata={() => void handleSaveMetadata()}
            />
          )}
        />

        <UserPlaylistActions
          hasTracks={playlist.tracks.length > 0}
          isCurrentPlaylist={isCurrentPlaylist}
          isOwnerPlaylist={!!isOwner}
          isPlaying={isPlaying}
          isSavedPlaylist={isSavedPlaylist}
          isDownloading={isDownloading}
          onPlayAll={handlePlayAll}
          onShuffle={handleShuffle}
          onDownload={() => void handleDownloadPlaylist()}
          onToggleSaved={() => void handleToggleFavoritePlaylist()}
          shareControl={(
            <PlaylistShareDropdownButton
              title={playlist.name}
              kind="user"
              playlistId={playlist.id}
              shareToken={playlist.share_token}
              visibility={shareVisibility}
              className={userPlaylistActionBtnClass}
            />
          )}
        />

        <UserPlaylistTracksSection
          playlist={playlist}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          canEdit={!!canEdit}
          selectedTrackIds={selectedTrackIds}
          isLiked={isLiked}
          onTrackClick={handleTrackClick}
          onToggleLike={(track) => handleToggleLike(track.id)}
          onMoveTrack={(fromIndex, toIndex) => void handleMoveTrack(fromIndex, toIndex)}
          onRemoveTrack={(trackIndex) => handleRemoveTrack(trackIndex)}
        />
      </motion.div>
    </PageTransition>
  );
}
