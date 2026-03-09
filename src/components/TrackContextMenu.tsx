import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Track } from "@/types/music";
import { Disc3, Download, Heart, ListMusic, Play, Radio, Share2, UserRound } from "lucide-react";
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
}

export function TrackContextMenu({ track, tracks, children }: TrackContextMenuProps) {
  const { play, addToQueue, startTrackMix } = usePlayer();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const { downloadFormat } = useSettings();
  const liked = isLiked(track.id);
  const trackMixPath = buildTrackMixPath(track);
  const trackShareUrl = buildTrackShareUrl(track);
  const hasTrackMixPage = Boolean(getTrackMixId(track) && trackMixPath);
  const playable = isTrackPlayable(track);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  const handleCopyTrackLink = async () => {
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
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            className="gap-2"
            onClick={() => play(track, tracks || [track])}
            disabled={!playable}
          >
            <Play className="w-4 h-4" /> Play
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2"
            onClick={() => {
              if (trackMixPath) {
                navigate(trackMixPath);
                return;
              }

              void startTrackMix(track);
            }}
            disabled={!playable}
          >
            <Radio className="w-4 h-4" /> {hasTrackMixPage ? "Open Mix" : "Start Mix"}
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2"
            onClick={() => {
              addToQueue(track);
              toast.success(`Queued ${track.title}`);
            }}
            disabled={!playable}
          >
            <ListMusic className="w-4 h-4" /> Add to Queue
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2"
            onClick={() => {
              toggleLike(track);
              toast.success(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
            }}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current text-white" : ""}`} />
            {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          </ContextMenuItem>

          {user && (
            <ContextMenuItem className="gap-2" onClick={() => setShowPlaylistDialog(true)}>
              <ListMusic className="w-4 h-4" /> Add to playlist
            </ContextMenuItem>
          )}

          {(track.album || track.artistId) && (
            <>
              <ContextMenuSeparator />
              {track.artistId ? (
                <ContextMenuItem
                  className="gap-2"
                  onClick={() => navigate(buildArtistPath(track.artistId, track.artist))}
                >
                  <UserRound className="w-4 h-4" /> Go to Artist
                </ContextMenuItem>
              ) : null}
              {track.album ? (
                <ContextMenuItem className="gap-2" onClick={() => void handleGoToAlbum()}>
                  <Disc3 className="w-4 h-4" /> Go to Album
                </ContextMenuItem>
              ) : null}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            className="gap-2"
            onClick={() => setIsCreditsOpen(true)}
          >
            <UserRound className="w-4 h-4" /> View credits
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onClick={() => void handleCopyTrackLink()} disabled={!trackShareUrl}>
            <Share2 className="w-4 h-4" /> Share
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onClick={handleDownload} disabled={isDownloading || !playable}>
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
