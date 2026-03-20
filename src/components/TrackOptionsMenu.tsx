import { useState, type ReactNode } from "react";
import { Cast, Disc3, Download, Heart, ListMusic, MoreHorizontal, Play, Radio, Share, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditsDialog } from "@/components/CreditsDialog";
import { TrackPlaylistDialog } from "@/components/TrackPlaylistDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { downloadTrack } from "@/lib/downloadHelpers";
import {
  buildArtistPath,
  buildTrackMixPath,
  copyPlainTextToClipboard,
  buildTrackShareUrl,
  navigateToTrackAlbum,
} from "@/lib/mediaNavigation";
import { getTrackMixId } from "@/lib/trackMix";
import type { Track } from "@/types/music";

type TrackOptionsMenuProps = {
  track: Track;
  tracks?: Track[];
  buttonClassName?: string;
  triggerIcon?: ReactNode;
  onShareTrack?: () => Promise<void> | void;
  onConnectDevice?: () => void;
  shareLabel?: string;
};

export function TrackOptionsMenu({
  track,
  tracks,
  buttonClassName = "h-11 w-11 rounded-full border border-white/10 bg-black/30 text-white/78 backdrop-blur-xl hover:bg-white/10 hover:text-white",
  triggerIcon,
  onShareTrack,
  onConnectDevice,
  shareLabel = "Share song link",
}: TrackOptionsMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const { addToQueue, play, startTrackMix } = usePlayer();
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
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  const handleShareTrackLink = async () => {
    if (onShareTrack) {
      await onShareTrack();
      return;
    }
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
    if (!opened) toast.error("Album not found");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={buttonClassName}>
            {triggerIcon ?? <MoreHorizontal className="h-[18px] w-[18px]" absoluteStrokeWidth />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-56"
        >
          <DropdownMenuItem className="gap-2" onClick={() => play(track, tracks || [track])}>
            <Play className="h-4 w-4" />
            Play
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              if (trackMixPath) {
                navigate(trackMixPath);
                return;
              }

              void startTrackMix(track);
            }}
          >
            <Radio className="h-4 w-4" />
            {mixActionLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              addToQueue(track);
              toast.success(`Queued ${track.title}`);
            }}
          >
            <ListMusic className="h-4 w-4" />
            Add to Queue
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              toggleLike(track);
              toast.success(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
            }}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current text-white" : ""}`} />
            {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          </DropdownMenuItem>

          {user ? (
            <DropdownMenuItem className="gap-2" onClick={() => setShowPlaylistDialog(true)}>
              <ListMusic className="h-4 w-4" />
              Add to playlist
            </DropdownMenuItem>
          ) : null}

          {(track.album || track.artistId) ? <DropdownMenuSeparator /> : null}
          {track.artistId ? (
            <DropdownMenuItem
              className="gap-2"
              onClick={() => navigate(buildArtistPath(track.artistId!, track.artist))}
            >
              <User className="h-4 w-4" />
              Go to Artist
            </DropdownMenuItem>
          ) : null}
          {track.album ? (
            <DropdownMenuItem className="gap-2" onClick={() => void handleGoToAlbum()}>
              <Disc3 className="h-4 w-4" />
              Go to Album
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => setIsCreditsOpen(true)}>
            <User className="h-4 w-4" />
            View credits
          </DropdownMenuItem>
          {onConnectDevice ? (
            <DropdownMenuItem className="gap-2" onClick={onConnectDevice}>
              <Cast className="h-4 w-4" />
              Connect to a device
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="gap-2" onClick={() => void handleShareTrackLink()} disabled={!trackShareUrl && !onShareTrack}>
            <Share className="h-4 w-4" />
            {shareLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            disabled={isDownloading}
            onClick={() => void handleDownload()}
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
