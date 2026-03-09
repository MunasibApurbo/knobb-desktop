import { Share } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PlaylistVisibility } from "@/hooks/usePlaylists";
import { copyPlainTextToClipboard, type PlaylistRouteKind } from "@/lib/mediaNavigation";
import { buildPlaylistShareUrl } from "@/lib/playlistSharing";

interface PlaylistShareDropdownButtonProps {
  title: string;
  kind: PlaylistRouteKind;
  playlistId?: string | number;
  shareToken?: string;
  visibility?: PlaylistVisibility;
  className: string;
  labelClassName?: string;
  iconClassName?: string;
  align?: "start" | "end";
}

export function PlaylistShareDropdownButton({
  title,
  kind,
  playlistId,
  shareToken,
  visibility,
  className,
  labelClassName = "hero-action-label relative z-10",
  iconClassName = "hero-action-icon w-4 h-4 mr-2",
}: PlaylistShareDropdownButtonProps) {
  const playlistShareUrl = useMemo(
    () => buildPlaylistShareUrl({ kind, playlistId, shareToken, visibility }),
    [kind, playlistId, shareToken, visibility],
  );

  const handleCopyLink = async () => {
    if (!playlistShareUrl) return;
    await copyPlainTextToClipboard(playlistShareUrl);
    toast.success("Playlist link copied");
  };

  return (
    <Button
      variant="secondary"
      className={className}
      onClick={() => void handleCopyLink()}
      disabled={!playlistShareUrl}
      title={title}
    >
      <Share className={iconClassName} />
      <span className={labelClassName}>Share</span>
    </Button>
  );
}
