import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Track } from "@/data/mockData";
import { Heart, Play, ListPlus, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TrackContextMenuProps {
  track: Track;
  tracks?: Track[];
  children: React.ReactNode;
}

export function TrackContextMenu({ track, tracks, children }: TrackContextMenuProps) {
  const { play } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const liked = isLiked(track.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-card/95 backdrop-blur-xl border-border/30">
        <ContextMenuItem
          className="gap-2 text-sm"
          onClick={() => play(track, tracks || [track])}
        >
          <Play className="w-4 h-4" /> Play
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-border/30" />
        <ContextMenuItem
          className="gap-2 text-sm"
          onClick={() => {
            toggleLike(track);
            toast.success(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
          }}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-current text-[hsl(var(--dynamic-accent))]" : ""}`} />
          {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        </ContextMenuItem>
        {track.artistId && (
          <>
            <ContextMenuSeparator className="bg-border/30" />
            <ContextMenuItem
              className="gap-2 text-sm"
              onClick={() => navigate(`/artist/${track.artistId}?name=${encodeURIComponent(track.artist)}`)}
            >
              <UserRound className="w-4 h-4" /> Go to Artist
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
