import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { Track } from "@/types/music";
import { Heart, Play, UserRound, Share2, Download, ListMusic, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { CreditsDialog } from "@/components/CreditsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { downloadTrack } from "@/lib/downloadHelpers";
import { useSettings } from "@/contexts/SettingsContext";

interface TrackContextMenuProps {
  track: Track;
  tracks?: Track[];
  children: React.ReactNode;
}

export function TrackContextMenu({ track, tracks, children }: TrackContextMenuProps) {
  const { play } = usePlayer();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const { playlists, addTrack, createPlaylist } = usePlaylists();
  const navigate = useNavigate();
  const { downloadFormat } = useSettings();
  const liked = isLiked(track.id);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleShare = () => {
    const text = `${track.title} — ${track.artist}`;
    if (navigator.share) {
      navigator.share({ title: track.title, text }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    toast.info(`Downloading ${track.title}...`);
    const success = await downloadTrack(track, downloadFormat === "flac" ? "LOSSLESS" : "HIGH");
    if (success) toast.success(`${track.title} downloaded successfully`);
    else toast.error(`Failed to download ${track.title}`);
    setIsDownloading(false);
  };

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    const result = await addTrack(playlistId, track);
    if (result.added) {
      toast.success(`Added to ${playlistName}`);
      return;
    }
    if (result.reason === "duplicate") {
      toast.info(`Already in ${playlistName}`);
      return;
    }
    toast.error(`Failed to add to ${playlistName}`);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;

    const id = await createPlaylist(newPlaylistName.trim());
    if (!id) {
      toast.error("Failed to create playlist");
      return;
    }

    const result = await addTrack(id, track);
    if (result.added) {
      toast.success(`Saved to "${newPlaylistName.trim()}"`);
    } else if (result.reason === "duplicate") {
      toast.info(`Track already exists in "${newPlaylistName.trim()}"`);
    } else {
      toast.error("Playlist created, but failed to add track");
    }

    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  };

  return (
    <>
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

          {user && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2 text-sm">
                <ListMusic className="w-4 h-4" /> Add to Playlist
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56 bg-card/95 backdrop-blur-xl border-border/30">
                <ContextMenuItem className="gap-2 text-sm" onClick={() => setShowCreatePlaylist(true)}>
                  <Plus className="w-4 h-4" /> New Playlist
                </ContextMenuItem>
                {playlists.length > 0 && <ContextMenuSeparator className="bg-border/30" />}
                {playlists.map((playlist) => (
                  <ContextMenuItem
                    key={playlist.id}
                    className="gap-2 text-sm"
                    onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
                  >
                    <ListMusic className="w-4 h-4" /> {playlist.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuItem className="gap-2 text-sm" onClick={handleDownload} disabled={isDownloading}>
            <Download className="w-4 h-4" /> {isDownloading ? "Downloading..." : "Download"}
          </ContextMenuItem>
          <ContextMenuItem className="gap-2 text-sm" onClick={handleShare}>
            <Share2 className="w-4 h-4" /> Share
          </ContextMenuItem>
          <ContextMenuItem
            className="gap-2 text-sm"
            onClick={() => setIsCreditsOpen(true)}
          >
            <UserRound className="w-4 h-4" /> View Credits
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
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-border/30 max-w-xs">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAndAdd();
            }}
            className="space-y-4"
          >
            <Input
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              className="bg-background border-border/30"
            />
            <Button type="submit" className="w-full" disabled={!newPlaylistName.trim()}>
              Create & Add Track
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <CreditsDialog
        track={track}
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </>
  );
}
