import { useMemo, useState } from "react";
import { Code2, Copy, Heart, ListMusic, Play, Share2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PlaylistEmbedDialog } from "@/components/PlaylistEmbedDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import type { PlaylistVisibility } from "@/hooks/usePlaylists";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { filterAudioTracks, getPlaylistWithTracks, tidalTrackToAppTrack } from "@/lib/musicApi";
import {
  buildPlaylistPath,
  copyPlainTextToClipboard,
  type PlaylistRouteKind,
} from "@/lib/mediaNavigation";
import {
  buildPlaylistEmbedUrl,
  buildPlaylistShareUrl,
  canEmbedPlaylist,
} from "@/lib/playlistSharing";
import type { Track } from "@/types/music";

interface PlaylistContextMenuProps {
  title: string;
  playlistId?: string | number;
  shareToken?: string;
  coverUrl?: string | null;
  kind?: PlaylistRouteKind;
  visibility?: PlaylistVisibility;
  tracks?: Track[];
  onDelete?: () => void;
  children: React.ReactNode;
}

export function PlaylistContextMenu({
  title,
  playlistId,
  shareToken,
  coverUrl,
  kind = "tidal",
  visibility,
  tracks,
  onDelete,
  children,
}: PlaylistContextMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play } = usePlayer();
  const { isFavoritePlaylist, toggleFavoritePlaylist } = useFavoritePlaylists();
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);

  const routePath = buildPlaylistPath({ kind, playlistId, shareToken });
  const playlistShareUrl = useMemo(
    () => buildPlaylistShareUrl({ kind, playlistId, shareToken, visibility }),
    [kind, playlistId, shareToken, visibility],
  );
  const embedUrl = useMemo(
    () => buildPlaylistEmbedUrl({ kind, playlistId, shareToken, visibility }),
    [kind, playlistId, shareToken, visibility],
  );
  const embedState = useMemo(() => canEmbedPlaylist({ kind, visibility }), [kind, visibility]);
  const favoriteSource = useMemo(() => {
    if (kind === "user" || kind === "shared") return "local";
    if (kind === "tidal") return "tidal";
    return null;
  }, [kind]);
  const canToggleLibrary = favoriteSource !== null && playlistId !== undefined;
  const isSaved = canToggleLibrary
    ? isFavoritePlaylist(String(playlistId), favoriteSource || undefined)
    : false;
  const canPlay = (tracks?.length || 0) > 0 || kind === "tidal";

  const handlePlay = async () => {
    if (tracks && tracks.length > 0) {
      play(tracks[0], tracks);
      return;
    }

    if (kind !== "tidal" || playlistId === undefined) {
      if (routePath) navigate(routePath);
      return;
    }

    setIsLoadingPlaylist(true);
    try {
      const cleanPlaylistId = String(playlistId).replace(/^tidal-/, "");
      const { tracks: tidalTracks } = await getPlaylistWithTracks(cleanPlaylistId);
      const appTracks = filterAudioTracks(
        tidalTracks.map((track, index) => ({
          ...tidalTrackToAppTrack(track),
          id: `tidal-${track.id}-${index}`,
        })),
      );

      if (appTracks.length === 0) {
        toast.error("No playable tracks found in this playlist");
        return;
      }

      play(appTracks[0], appTracks);
    } catch (error) {
      console.error("Failed to play playlist:", error);
      toast.error("Failed to load playlist");
    } finally {
      setIsLoadingPlaylist(false);
    }
  };

  const handleToggleSaved = async () => {
    if (!canToggleLibrary || isSaving || playlistId === undefined) return;
    const source = favoriteSource;
    if (!source) return;

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    setIsSaving(true);
    const success = await toggleFavoritePlaylist({
      source,
      playlistId: String(playlistId),
      playlistTitle: title,
      playlistCoverUrl: coverUrl || null,
    });
    setIsSaving(false);

    if (!success) {
      toast.error("Failed to update playlist library");
      return;
    }

    toast.success(
      isSaved
        ? `Removed ${title} from your library`
        : `Saved ${title} to your library`,
    );
  };

  const handleCopyLink = async () => {
    if (!playlistShareUrl) return;
    await copyPlainTextToClipboard(playlistShareUrl);
    toast.success("Playlist link copied");
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem className="gap-2" onClick={() => void handlePlay()} disabled={!canPlay || isLoadingPlaylist}>
            <Play className="w-4 h-4" /> {isLoadingPlaylist ? "Loading..." : "Play"}
          </ContextMenuItem>
          {canToggleLibrary ? (
            <ContextMenuItem className="gap-2" onClick={() => void handleToggleSaved()} disabled={isSaving}>
              <Heart className={`w-4 h-4 ${isSaved ? "fill-current text-white" : ""}`} />
              {isSaved ? "Remove from Your Library" : "Save to Your Library"}
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-64">
              <ContextMenuItem className="gap-2" onClick={() => void handleCopyLink()} disabled={!playlistShareUrl}>
                <Copy className="w-4 h-4" />
                Copy playlist link
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2"
                onClick={() => setIsEmbedDialogOpen(true)}
                disabled={!embedState.allowed || !embedUrl}
              >
                <Code2 className="w-4 h-4" />
                Embed playlist
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {routePath ? (
            <ContextMenuItem className="gap-2" onClick={() => navigate(routePath)}>
              <ListMusic className="w-4 h-4" />
              {kind === "liked" ? "Open Liked Songs" : "Open Playlist"}
            </ContextMenuItem>
          ) : null}
          {onDelete ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem className="gap-2 text-red-400 focus:text-red-300" onClick={onDelete}>
                <Trash2 className="w-4 h-4" /> Delete Playlist
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      <PlaylistEmbedDialog
        open={isEmbedDialogOpen}
        onOpenChange={setIsEmbedDialogOpen}
        title={title}
        embedUrl={embedUrl}
        canEmbed={embedState.allowed}
        disabledReason={embedState.reason}
      />
    </>
  );
}
