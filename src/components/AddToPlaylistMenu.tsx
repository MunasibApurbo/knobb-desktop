import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { Track } from "@/types/music";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ListMusic, Music } from "lucide-react";
import { toast } from "sonner";

interface AddToPlaylistMenuProps {
  track: Track;
  children: React.ReactNode;
}

export function AddToPlaylistMenu({ track, children }: AddToPlaylistMenuProps) {
  const { user } = useAuth();
  const { playlists, addTrack, createPlaylist } = usePlaylists();
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createPlaylist(newName.trim());
    if (id) {
      const result = await addTrack(id, track);
      if (result.added) {
        toast.success(`Saved to "${newName.trim()}"`);
      } else if (result.reason === "duplicate") {
        toast.info(`Track already exists in "${newName.trim()}"`);
      } else {
        toast.error("Playlist created, but failed to add track");
      }
    } else {
      toast.error("Failed to create playlist");
    }
    setNewName("");
    setShowCreate(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-card/95 backdrop-blur-xl border-border/30">
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-border/30 max-w-xs">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <Input
              placeholder="Playlist name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="bg-background border-border/30"
            />
            <Button type="submit" className="w-full" disabled={!newName.trim()}>
              Create & Add Track
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
