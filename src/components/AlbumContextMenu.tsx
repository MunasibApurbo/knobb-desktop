import { useState } from "react";
import { Disc3, Heart, Play, Share2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  buildAlbumPath,
  buildArtistPath,
  shareOrCopy,
  toAbsoluteUrl,
} from "@/lib/mediaNavigation";

interface AlbumContextMenuProps {
  albumId: number | string;
  title: string;
  artist: string;
  artistId?: number;
  coverUrl?: string | null;
  year?: number | null;
  children: React.ReactNode;
}

export function AlbumContextMenu({
  albumId,
  title,
  artist,
  artistId,
  coverUrl,
  year,
  children,
}: AlbumContextMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playAlbum } = usePlayer();
  const { isSaved, toggleSavedAlbum } = useSavedAlbums();
  const [isSaving, setIsSaving] = useState(false);

  const numericAlbumId =
    typeof albumId === "number"
      ? albumId
      : Number.parseInt(String(albumId).replace("tidal-", ""), 10);

  const canSaveAlbum = Number.isFinite(numericAlbumId);
  const saved = canSaveAlbum ? isSaved(numericAlbumId) : false;
  const albumPath = buildAlbumPath({ albumId, title, artistName: artist });

  const handleToggleSaved = async () => {
    if (!canSaveAlbum || isSaving) return;

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    setIsSaving(true);
    const success = await toggleSavedAlbum({
      albumId: numericAlbumId,
      albumTitle: title,
      albumArtist: artist,
      albumCoverUrl: coverUrl || null,
      albumYear: year || null,
    });
    setIsSaving(false);

    if (!success) {
      toast.error("Failed to update album library");
      return;
    }

    toast.success(
      saved
        ? `Removed ${title} from your library`
        : `Saved ${title} to your library`,
    );
  };

  const handleShare = async () => {
    await shareOrCopy({
      title,
      text: `${title} — ${artist}`,
      url: toAbsoluteUrl(albumPath),
      successMessage: "Album link copied to clipboard",
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          className="gap-2"
          onClick={() =>
            void playAlbum({
              id: albumId,
              title,
              artist: { name: artist },
            })
          }
        >
          <Play className="w-4 h-4" /> Play
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2"
          onClick={() => void handleToggleSaved()}
          disabled={!canSaveAlbum || isSaving}
        >
          <Heart className={`w-4 h-4 ${saved ? "fill-current text-white" : ""}`} />
          {saved ? "Remove from Your Library" : "Save to Your Library"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2" onClick={() => void handleShare()}>
          <Share2 className="w-4 h-4" /> Share
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => navigate(albumPath)}>
          <Disc3 className="w-4 h-4" /> Open Album
        </ContextMenuItem>
        {artistId ? (
          <ContextMenuItem
            className="gap-2"
            onClick={() => navigate(buildArtistPath(artistId, artist))}
          >
            <UserRound className="w-4 h-4" /> Open Artist
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
