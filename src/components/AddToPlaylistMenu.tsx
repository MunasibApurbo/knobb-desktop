import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { Track } from "@/types/music";
import { PlaylistCreateDialog, type PlaylistCreateSubmitPayload } from "@/components/PlaylistCreateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ListMusic } from "lucide-react";
import { toast } from "sonner";

interface AddToPlaylistMenuProps {
  track: Track;
  children: React.ReactNode;
}

export function AddToPlaylistMenu({ track, children }: AddToPlaylistMenuProps) {
  const { user } = useAuth();
  const { playlists, addTrack, createPlaylist, getLastPlaylistError } = usePlaylists();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  if (!user) return <>{children}</>;

  const handleAdd = async (playlistId: string, playlistName: string) => {
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

  const handleCreate = async (payload: PlaylistCreateSubmitPayload) => {
    const id = await createPlaylist(payload.name, payload.description, {
      cover_url: payload.coverUrl || null,
      visibility: payload.visibility,
    });
    if (id) {
      const result = await addTrack(id, track);
      if (result.added) {
        toast.success(`Saved to "${payload.name}"`);
        setNewName("");
        setShowCreate(false);
      } else if (result.reason === "duplicate") {
        toast.info(`Track already exists in "${payload.name}"`);
        setNewName("");
        setShowCreate(false);
      } else {
        toast.error("Playlist created, but failed to add track");
      }
    } else {
      toast.error(getLastPlaylistError() || "Failed to create playlist");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Add to playlist</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Playlist
          </DropdownMenuItem>
          {playlists.length > 0 && <DropdownMenuSeparator />}
          {playlists.map((pl) => (
            <DropdownMenuItem key={pl.id} onClick={() => handleAdd(pl.id, pl.name)}>
              <ListMusic className="w-4 h-4 mr-2" />
              {pl.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <PlaylistCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        value={newName}
        onValueChange={setNewName}
        onSubmit={handleCreate}
        submitLabel="Create & Add Track"
      />
    </>
  );
}
