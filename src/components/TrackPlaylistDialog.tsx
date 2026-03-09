import { ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PlaylistCreateDialog, type PlaylistCreateSubmitPayload } from "@/components/PlaylistCreateDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlaylists } from "@/hooks/usePlaylists";
import type { Track } from "@/types/music";

interface TrackPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: Track;
}

export function TrackPlaylistDialog({
  open,
  onOpenChange,
  track,
}: TrackPlaylistDialogProps) {
  const { playlists, addTrack, createPlaylist, getLastPlaylistError } = usePlaylists();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    const result = await addTrack(playlistId, track);
    if (result.added) {
      toast.success(`Added to ${playlistName}`);
      onOpenChange(false);
      return;
    }
    if (result.reason === "duplicate") {
      toast.info(`Already in ${playlistName}`);
      onOpenChange(false);
      return;
    }
    toast.error(`Failed to add to ${playlistName}`);
  };

  const handleCreateAndAdd = async (payload: PlaylistCreateSubmitPayload) => {
    const id = await createPlaylist(payload.name, payload.description, {
      cover_url: payload.coverUrl || null,
      visibility: payload.visibility,
    });
    if (!id) {
      toast.error(getLastPlaylistError() || "Failed to create playlist");
      return;
    }

    const result = await addTrack(id, track);
    if (result.added) {
      toast.success(`Saved to "${payload.name}"`);
      setNewPlaylistName("");
      setShowCreatePlaylist(false);
      onOpenChange(false);
      return;
    }

    if (result.reason === "duplicate") {
      toast.info(`Track already exists in "${payload.name}"`);
      setNewPlaylistName("");
      setShowCreatePlaylist(false);
      onOpenChange(false);
      return;
    }

    toast.error("Playlist created, but failed to add track");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl border border-white/10 bg-black/95 p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-5 py-4 text-left">
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">Add to playlist</DialogTitle>
            <DialogDescription className="text-sm text-white/52">
              Save <span className="font-medium text-white">{track.title}</span> into one of your playlists.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="menu-sweep-hover flex h-12 w-full justify-start gap-3 border border-white/10 bg-white/[0.03] px-4 text-white/80 hover:bg-white/[0.06] hover:text-black"
              onClick={() => setShowCreatePlaylist(true)}
            >
              <Plus className="h-4 w-4" />
              New Playlist
            </Button>

            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    className="menu-sweep-hover flex w-full items-center gap-3 border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-white/80 transition-colors hover:bg-white/[0.06] hover:text-black"
                    onClick={() => void handleAddToPlaylist(playlist.id, playlist.name)}
                  >
                    <ListMusic className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{playlist.name}</p>
                      <p className="truncate text-xs text-white/45">
                        {playlist.track_count} track{playlist.track_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
                  No playlists yet. Create one and add this track.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PlaylistCreateDialog
        open={showCreatePlaylist}
        onOpenChange={setShowCreatePlaylist}
        value={newPlaylistName}
        onValueChange={setNewPlaylistName}
        onSubmit={handleCreateAndAdd}
        submitLabel="Create & Add Track"
      />
    </>
  );
}
