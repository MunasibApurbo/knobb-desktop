import { Home, Library, Heart, Plus, Music, Compass, Clock, LogIn, LogOut, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { playlists, albums } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { FilterPill } from "@/components/ui/filter-pill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type FilterType = "playlists" | "albums" | "artists";

const mainNav = [
  { title: "Home", url: "/", icon: Home },
];

export function AppSidebar() {
  const [filter, setFilter] = useState<FilterType>("playlists");
  const { currentTrack } = usePlayer();
  const { user, signOut } = useAuth();
  const { likedSongs } = useLikedSongs();
  const { playlists: userPlaylists, createPlaylist } = usePlaylists();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const filters: { key: FilterType; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
  ];

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const id = await createPlaylist(newName.trim());
    if (id) {
      toast.success(`Created "${newName.trim()}"`);
      navigate(`/my-playlist/${id}`);
    }
    setNewName("");
    setShowCreate(false);
  }, [newName, createPlaylist, navigate]);

  return (
    <div className="w-[280px] shrink-0 h-full flex flex-col gap-2 py-2 pl-2">
      {/* Brand */}
      <button
        onClick={() => navigate("/")}
        className="px-4 py-3"
      >
        <span className="text-xl font-extrabold tracking-tight text-foreground">Nobbb</span>
      </button>

      {/* Library Card */}
      <div className="flex-1 bg-card/80 backdrop-blur-md rounded-lg flex flex-col min-h-0 border border-border/10">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/")}
          >
            <Library className="w-6 h-6" />
            <span className="text-sm font-bold">Your Library</span>
          </button>
          {user && (
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="px-4 pb-3">
          <FilterPill<FilterType>
            options={filters}
            value={filter}
            onChange={(v) => setFilter(v)}
          />
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 pb-4">
            {filter === "playlists" && (
              <>
                {/* Liked Songs */}
                <NavLink
                  to="/liked"
                  className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                  activeClassName="bg-accent/60 text-foreground"
                >
                  <div className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center relative"
                    style={{ background: "linear-gradient(135deg, hsl(250 80% 60%), hsl(200 80% 50%))" }}>
                    <Heart className="w-5 h-5 text-white fill-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-sm">Liked Songs</p>
                    <p className="text-xs text-muted-foreground truncate">Playlist · {likedSongs.length} songs</p>
                  </div>
                </NavLink>

                {/* User playlists */}
                {userPlaylists.map((pl) => (
                  <NavLink
                    key={pl.id}
                    to={`/my-playlist/${pl.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                    activeClassName="bg-accent/60 text-foreground"
                  >
                    <div className="w-12 h-12 rounded-md shrink-0 overflow-hidden bg-accent flex items-center justify-center">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate text-sm">{pl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Playlist · {pl.tracks.length} songs</p>
                    </div>
                  </NavLink>
                ))}

                {/* Mock playlists */}
                {playlists.map((pl) => {
                  const isNowPlaying = currentTrack && pl.tracks.some((t) => t.id === currentTrack.id);
                  return (
                    <NavLink
                      key={pl.id}
                      to={`/playlist/${pl.id}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                      activeClassName="bg-accent/60 text-foreground"
                    >
                      <div className="relative shrink-0">
                        <img src={pl.coverUrl} alt={pl.title} className="w-12 h-12 rounded-md object-cover" />
                        {isNowPlaying && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card" style={{ background: `hsl(var(--dynamic-accent))` }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold truncate text-sm ${isNowPlaying ? "" : "text-foreground"}`}
                          style={isNowPlaying ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                          {pl.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">Playlist · {pl.tracks.length} songs</p>
                      </div>
                    </NavLink>
                  );
                })}
              </>
            )}

            {filter === "albums" && albums.map((album) => (
              <NavLink
                key={album.id}
                to={`/album/${album.id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                activeClassName="bg-accent/60 text-foreground"
              >
                <img src={album.coverUrl} alt={album.title} className="w-12 h-12 rounded-md object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate text-sm">{album.title}</p>
                  <p className="text-xs text-muted-foreground truncate">Album · {album.artist}</p>
                </div>
              </NavLink>
            ))}

            {filter === "artists" && (
              <>
                {[...new Set(albums.map((a) => a.artist))].map((artist) => {
                  const album = albums.find((a) => a.artist === artist)!;
                  return (
                    <button
                      key={artist}
                      onClick={() => navigate(`/search?q=${encodeURIComponent(artist)}`)}
                      className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group w-full text-left"
                    >
                      <img src={album.coverUrl} alt={artist} className="w-12 h-12 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate text-sm">{artist}</p>
                        <p className="text-xs text-muted-foreground truncate">Artist</p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>

      
      </div>

      {/* Create Playlist Dialog */}
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
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
