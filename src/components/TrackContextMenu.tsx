import { usePlayerCommands } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Track } from "@/types/music";
import { Disc3, Download, Heart, ListMusic, Play, Radio, Share, Trash2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { CreditsDialog } from "@/components/CreditsDialog";
import { TrackPlaylistDialog } from "@/components/TrackPlaylistDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { downloadTrack } from "@/lib/downloadHelpers";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import {
  buildArtistPath,
  buildTrackMixPath,
  copyPlainTextToClipboard,
  buildTrackShareUrl,
  navigateToTrackAlbum,
} from "@/lib/mediaNavigation";
import { getTrackMixId } from "@/lib/trackMix";
import { isTrackPlayable } from "@/lib/trackPlayback";

interface TrackContextMenuProps {
  track: Track;
  tracks?: Track[];
  children: React.ReactNode;
  contentClassName?: string;
  itemClassName?: string;
  separatorClassName?: string;
  onRemoveFromPlaylist?: () => void;
}

export function TrackContextMenu({
  track,
  tracks,
  children,
  contentClassName,
  itemClassName,
  separatorClassName,
  onRemoveFromPlaylist,
}: TrackContextMenuProps) {
  const { play, addToQueue, startTrackMix } = usePlayerCommands();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const { downloadFormat } = useSettings();
  const liked = isLiked(track.id);
  const trackMixPath = buildTrackMixPath(track);
  const trackShareUrl = buildTrackShareUrl(track);
  const hasTrackMixPage = Boolean(getTrackMixId(track) && trackMixPath);
  const mixActionLabel = track.isVideo
    ? "Open Mix Options"
    : hasTrackMixPage
      ? "Open Mix"
      : "Start Mix";
  const playable = isTrackPlayable(track);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  const handleShareTrackLink = async () => {
    if (!trackShareUrl) return;
    await copyPlainTextToClipboard(trackShareUrl);
    toast.success("Song link copied");
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    toast.info(`Downloading ${track.title}...`);
    const success = await downloadTrack(track, downloadFormat === "flac" ? "LOSSLESS" : "HIGH");
    if (success) toast.success(`${track.title} downloaded successfully`);
    else toast.error(`Failed to download ${track.title}`);
    setIsDownloading(false);
  };

  const handleGoToAlbum = async () => {
    const opened = await navigateToTrackAlbum(track, navigate);
    if (!opened) {
      toast.error("Album not found");
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className={cn("w-56", contentClassName)}>
          <ContextMenuItem
            className={cn("gap-2", itemClassName)}
            onClick={() => play(track, tracks || [track])}
            disabled={!playable}
          >
            <Play className="w-4 h-4" /> Play
          </ContextMenuItem>
          <ContextMenuItem
            className={cn("gap-2", itemClassName)}
            onClick={() => {
              if (trackMixPath) {
                navigate(trackMixPath);
                return;
              }

              void startTrackMix(track);
            }}
            disabled={!playable}
          >
            <Radio className="w-4 h-4" /> {mixActionLabel}
          </ContextMenuItem>
          <ContextMenuItem
            className={cn("gap-2", itemClassName)}
            onClick={() => {
              addToQueue(track);
              toast.success(`Queued ${track.title}`);
            }}
            disabled={!playable}
          >
            <ListMusic className="w-4 h-4" /> Add to Queue
          </ContextMenuItem>
          <ContextMenuItem
            className={cn("gap-2", itemClassName)}
            onClick={() => {
              toggleLike(track);
              toast.success(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
            }}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current text-white" : ""}`} />
            {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          </ContextMenuItem>

          {user && (
            <ContextMenuItem className={cn("gap-2", itemClassName)} onClick={() => setShowPlaylistDialog(true)}>
              <ListMusic className="w-4 h-4" /> Add to playlist
            </ContextMenuItem>
          )}
          {onRemoveFromPlaylist ? (
            <ContextMenuItem className={cn("gap-2", itemClassName)} onClick={onRemoveFromPlaylist}>
              <Trash2 className="w-4 h-4" /> Remove from playlist
            </ContextMenuItem>
          ) : null}

          {(track.album || track.artistId) && (
            <>
              <ContextMenuSeparator className={separatorClassName} />
              {track.artistId ? (
                <ContextMenuItem
                  className={cn("gap-2", itemClassName)}
                  onClick={() => navigate(buildArtistPath(track.artistId, track.artist))}
                >
                  <User className="w-4 h-4" /> Go to Artist
                </ContextMenuItem>
              ) : null}
              {track.album ? (
                <ContextMenuItem className={cn("gap-2", itemClassName)} onClick={() => void handleGoToAlbum()}>
                  <Disc3 className="w-4 h-4" /> Go to Album
                </ContextMenuItem>
              ) : null}
            </>
          )}
          <ContextMenuSeparator className={separatorClassName} />
          <ContextMenuItem
            className={cn("gap-2", itemClassName)}
            onClick={() => setIsCreditsOpen(true)}
          >
            <User className="w-4 h-4" /> View credits
          </ContextMenuItem>
          <ContextMenuItem className={cn("gap-2", itemClassName)} onClick={() => void handleShareTrackLink()} disabled={!trackShareUrl}>
            <Share className="w-4 h-4" /> Share song link
          </ContextMenuItem>
          <ContextMenuItem className={cn("gap-2", itemClassName)} onClick={handleDownload} disabled={isDownloading || !playable}>
            <Download className="w-4 h-4" /> {isDownloading ? "Downloading..." : "Download"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {showPlaylistDialog ? (
        <TrackPlaylistDialog
          open={showPlaylistDialog}
          onOpenChange={setShowPlaylistDialog}
          track={track}
        />
      ) : null}
      <CreditsDialog
        track={track}
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </>
  );
}
