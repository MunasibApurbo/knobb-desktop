import { Home, Library, Heart, Plus, Music, Compass, Clock, LogIn, LogOut, User, ChevronLeft, ChevronRight, Search, Loader2, Play, X, History, Bell, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { playlists, albums, allTracks, formatDuration, Track } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { FilterPill } from "@/components/ui/filter-pill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterType = "playlists" | "albums" | "artists";
type SearchTab = "tidal" | "tracks" | "albums" | "playlists";

export function AppSidebar() {
  const [filter, setFilter] = useState<FilterType>("playlists");
  const { currentTrack, play } = usePlayer();
  const { user, signOut } = useAuth();
  const { likedSongs } = useLikedSongs();
  const { playlists: userPlaylists, createPlaylist } = usePlaylists();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchTab, setSearchTab] = useState<SearchTab>("tidal");
  const [tidalResults, setTidalResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.toLowerCase();

  const filters: { key: FilterType; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
  ];

  const searchTabs: { key: SearchTab; label: string }[] = [
    { key: "tidal", label: "Tidal" },
    { key: "tracks", label: "Library" },
    { key: "albums", label: "Albums" },
    { key: "playlists", label: "Playlists" },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (searchOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setTidalResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchTracks(searchQuery);
      setTidalResults(results.map(tidalTrackToAppTrack));
    } catch (e) {
      console.error("Tidal search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (searchTab === "tidal") handleSearch(value);
    }, 400);
  }, [searchTab, handleSearch]);

  const filteredTracks = q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 15);
  const filteredAlbums = q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums;
  const filteredPlaylists = q ? playlists.filter((p) => p.title.toLowerCase().includes(q)) : playlists;

  const handlePlayTrack = (track: Track, list: Track[]) => {
    play(track, list);
    setSearchOpen(false);
  };

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
    <div className="w-full h-full flex flex-col gap-1.5">
      {/* Top section: Brand + Nav + Menu */}
      <div className="rounded-lg glass-heavy px-3 py-3 flex flex-col gap-3">
        {/* Brand row with nav and menu */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-1">
            <span className="text-lg font-extrabold tracking-tight text-foreground">Nobbb</span>
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/history")}>
                      <User className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/history")}>
                      <History className="w-4 h-4 mr-2" /> History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/liked")}>
                      <Bell className="w-4 h-4 mr-2" /> Notifications
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => navigate("/auth")}>
                    <LogIn className="w-4 h-4 mr-2" /> Sign in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative" ref={searchRef}>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-text transition-all ${
              searchOpen
                ? "bg-white/10 border border-white/15"
                : "bg-white/5 hover:bg-white/10"
            }`}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            {searchOpen ? (
              <>
                <Input
                  ref={inputRef}
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchTab === "tidal") handleSearch(query);
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                  className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
                />
                {isSearching && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
                <Button variant="ghost" size="icon" className="w-5 h-5 shrink-0 rounded-full" onClick={(e) => { e.stopPropagation(); setSearchOpen(false); setQuery(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground flex-1">Search</span>
            )}
          </div>

          {/* Search Dropdown */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50"
              >
                <div className="p-2 pb-1.5 border-b border-border/50">
                  <FilterPill<SearchTab>
                    options={searchTabs.map(t => ({ key: t.key, label: t.label }))}
                    value={searchTab}
                    onChange={(v) => { setSearchTab(v); if (v === "tidal" && query) handleSearch(query); }}
                  />
                </div>

                <ScrollArea className="max-h-[50vh]">
                  <div className="p-1.5">
                    {searchTab === "tidal" && (
                      <>
                        {tidalResults.length === 0 && !isSearching && (
                          <div className="text-center py-6">
                            <Search className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                            <p className="text-muted-foreground text-xs">Search for songs</p>
                          </div>
                        )}
                        {tidalResults.map((track) => (
                          <SearchTrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, tidalResults)} />
                        ))}
                      </>
                    )}
                    {searchTab === "tracks" && (
                      <>
                        {filteredTracks.length === 0 && <p className="text-center text-muted-foreground text-xs py-6">No tracks found</p>}
                        {filteredTracks.map((track) => (
                          <SearchTrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, filteredTracks)} />
                        ))}
                      </>
                    )}
                    {searchTab === "albums" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {filteredAlbums.length === 0 && <p className="col-span-2 text-center text-muted-foreground text-xs py-6">No albums found</p>}
                        {filteredAlbums.map((album) => (
                          <button
                            key={album.id}
                            className="p-1.5 rounded-md hover:bg-accent/30 transition-colors text-left"
                            onClick={() => { navigate(`/album/${album.id}`); setSearchOpen(false); }}
                          >
                            <img src={album.coverUrl} alt={album.title} className="w-full aspect-square rounded object-cover mb-1" />
                            <p className="text-[11px] font-bold truncate">{album.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchTab === "playlists" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {filteredPlaylists.length === 0 && <p className="col-span-2 text-center text-muted-foreground text-xs py-6">No playlists found</p>}
                        {filteredPlaylists.map((pl) => (
                          <button
                            key={pl.id}
                            className="p-1.5 rounded-md hover:bg-accent/30 transition-colors text-left"
                            onClick={() => { navigate(`/playlist/${pl.id}`); setSearchOpen(false); }}
                          >
                            <img src={pl.coverUrl} alt={pl.title} className="w-full aspect-square rounded object-cover mb-1" />
                            <p className="text-[11px] font-bold truncate">{pl.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{pl.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Library Card */}
      <div className="flex-1 rounded-lg flex flex-col min-h-0 glass-heavy">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/")}
          >
            <Library className="w-5 h-5" />
            <span className="text-sm font-bold">Your Library</span>
          </button>
          {user && (
            <button
              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="px-4 pb-2">
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
                <NavLink
                  to="/liked"
                  className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                  activeClassName="bg-accent/60 text-foreground"
                >
                  <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, hsl(250 80% 60%), hsl(200 80% 50%))" }}>
                    <Heart className="w-4 h-4 text-white fill-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-sm">Liked Songs</p>
                    <p className="text-xs text-muted-foreground truncate">Playlist · {likedSongs.length} songs</p>
                  </div>
                </NavLink>

                {userPlaylists.map((pl) => (
                  <NavLink
                    key={pl.id}
                    to={`/my-playlist/${pl.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                    activeClassName="bg-accent/60 text-foreground"
                  >
                    <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-accent flex items-center justify-center">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate text-sm">{pl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Playlist · {pl.tracks.length} songs</p>
                    </div>
                  </NavLink>
                ))}

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
                        <img src={pl.coverUrl} alt={pl.title} className="w-10 h-10 rounded-md object-cover" />
                        {isNowPlaying && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card" style={{ background: `hsl(var(--dynamic-accent))` }} />
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
                <img src={album.coverUrl} alt={album.title} className="w-10 h-10 rounded-md object-cover shrink-0" />
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
                      <img src={album.coverUrl} alt={artist} className="w-10 h-10 rounded-full object-cover shrink-0" />
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

function SearchTrackRow({ track, currentTrack, onClick }: { track: Track; currentTrack: Track | null; onClick: () => void }) {
  const isCurrent = currentTrack?.id === track.id;
  return (
    <button
      className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md transition-colors text-left group ${
        isCurrent ? "bg-accent/30" : "hover:bg-accent/15"
      }`}
      onClick={onClick}
    >
      <img src={track.coverUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isCurrent ? "font-semibold" : ""}`}
          style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
          {track.title}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
      </div>
      <Play className="w-3.5 h-3.5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
