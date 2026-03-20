import type { ReactNode } from "react";

import { DetailActionBar } from "@/components/detail/DetailActionBar";
import { Button } from "@/components/ui/button";
import {
  Download,
  Heart,
  Pause,
  Play,
  Shuffle,
} from "lucide-react";
import { userPlaylistActionBtnClass } from "@/components/user-playlist/userPlaylistUtils";

interface UserPlaylistActionsProps {
  hasTracks: boolean;
  isCurrentPlaylist: boolean;
  isOwnerPlaylist?: boolean;
  isPlaying: boolean;
  isSavedPlaylist: boolean;
  isDownloading: boolean;
  onPlayAll: () => void;
  onShuffle: () => void;
  onDownload: () => void;
  onToggleSaved: () => void;
  dragControl?: ReactNode;
  shareControl: ReactNode;
}

export function UserPlaylistActions({
  hasTracks,
  isCurrentPlaylist,
  isOwnerPlaylist = false,
  isPlaying,
  isSavedPlaylist,
  isDownloading,
  onPlayAll,
  onShuffle,
  onDownload,
  onToggleSaved,
  dragControl,
  shareControl,
}: UserPlaylistActionsProps) {
  return (
    <DetailActionBar columns={dragControl ? 6 : 5}>
      <Button
        variant="secondary"
        className={userPlaylistActionBtnClass}
        onClick={onPlayAll}
        disabled={!hasTracks}
      >
        {isCurrentPlaylist && isPlaying ? (
          <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
        ) : (
          <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
        )}
        <span className="hero-action-label relative z-10">Play</span>
      </Button>
      <Button
        variant="secondary"
        className={userPlaylistActionBtnClass}
        onClick={onShuffle}
        disabled={!hasTracks}
      >
        <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
        <span className="hero-action-label relative z-10">Shuffle</span>
      </Button>
      <Button
        variant="secondary"
        className={userPlaylistActionBtnClass}
        onClick={onDownload}
        disabled={!hasTracks || isDownloading}
      >
        <Download className="hero-action-icon w-4 h-4 mr-2" />
        <span className="hero-action-label relative z-10">{isDownloading ? "Downloading..." : "Download"}</span>
      </Button>
      <Button
        variant="secondary"
        className={userPlaylistActionBtnClass}
        onClick={onToggleSaved}
      >
        <Heart className={`hero-action-icon w-4 h-4 mr-2 ${isSavedPlaylist ? "fill-current" : ""}`} />
        <span className="hero-action-label relative z-10">
          {isOwnerPlaylist
            ? (isSavedPlaylist ? "Liked" : "Like")
            : (isSavedPlaylist ? "Saved" : "Add")}
        </span>
      </Button>
      {dragControl}
      {shareControl}
    </DetailActionBar>
  );
}
