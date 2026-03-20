import { useMemo, useState } from "react";
import { Heart, ListMusic, Play, Share, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import type { PlaylistVisibility } from "@/hooks/usePlaylists";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DESTRUCTIVE_MENU_ITEM_CLASS } from "@/components/ui/surfaceStyles";
import { filterAudioTracks, getPlaylistWithTracks, tidalTrackToAppTrack } from "@/lib/musicApi";
import {
  buildPlaylistPath,
  copyPlainTextToClipboard,
  type PlaylistRouteKind,
} from "@/lib/mediaNavigation";
import { buildPlaylistShareUrl } from "@/lib/playlistSharing";
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

  const routePath = buildPlaylistPath({ kind, playlistId, shareToken });
  const playlistShareUrl = useMemo(
    () => buildPlaylistShareUrl({ kind, playlistId, shareToken, visibility }),
    [kind, playlistId, shareToken, visibility],
  );
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

    if (playlistId === undefined) {
      if (routePath) navigate(routePath);
      return;
    }

    setIsLoadingPlaylist(true);
    try {
      if (kind !== "tidal") {
        throw new Error("Playlist playback is only available for TIDAL and local playlists");
      }

      const appTracks = filterAudioTracks(
        (await getPlaylistWithTracks(String(playlistId).replace(/^tidal-/, ""))).tracks.map((track, index) => ({
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

  const handleShareLink = async () => {
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
          <ContextMenuItem className="gap-2" onClick={() => void handleShareLink()} disabled={!playlistShareUrl}>
            <Share className="w-4 h-4" />
            Share playlist link
          </ContextMenuItem>
          {routePath ? (
            <ContextMenuItem className="gap-2" onClick={() => navigate(routePath)}>
              <ListMusic className="w-4 h-4" />
              {kind === "liked" ? "Open Liked Songs" : "Open Playlist"}
            </ContextMenuItem>
          ) : null}
          {onDelete ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem className={`gap-2 ${DESTRUCTIVE_MENU_ITEM_CLASS}`} onClick={onDelete}>
                <Trash2 className="w-4 h-4" /> Delete Playlist
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
