import { Home, Library, Heart, Plus, Music, Compass, Clock, LogIn, LogOut, User, ChevronLeft, ChevronRight, Search, Loader2, X, History, Bell, Play, AlignJustify, BarChart3, Settings } from "lucide-react";
import { useSidebarCollapsed } from "@/components/Layout";
import { NavLink } from "@/components/NavLink";
import { playlists, albums } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useSearch } from "@/contexts/SearchContext";
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
type SearchTab = "all" | "tracks" | "artists" | "albums" | "playlists";

const searchTabs: { key: SearchTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tracks", label: "Songs" },
  { key: "artists", label: "Artists" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
];

export function AppSidebar() {
  const [filter, setFilter] = useState<FilterType>("playlists");
  const { currentTrack } = usePlayer();
  const { user, signOut } = useAuth();
  const { likedSongs } = useLikedSongs();
  const { playlists: userPlaylists, createPlaylist } = usePlaylists();
  const { searchOpen, setSearchOpen, query, onQueryChange, isSearching, closeSearch, handleSearch, searchTab, setSearchTab } = useSearch();
  const { collapsed, expandPanel } = useSidebarCollapsed();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filters: { key: FilterType; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
  ];

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

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

  // Collapsed sidebar - Spotify style compact strip
  if (collapsed) {
    return (
      <div className="w-full h-full flex flex-col gap-1.5">
        {/* Top: Home + Search icons only */}
        <div className="rounded-lg glass-heavy py-3 flex flex-col items-center gap-2">
          <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Home">
            <Home className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => { setSearchOpen(true); expandPanel(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Menu">
                <AlignJustify className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/history")}>
                  <History className="w-4 h-4 mr-2" /> History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/stats")}>
                  <BarChart3 className="w-4 h-4 mr-2" /> Listening Stats
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <Bell className="w-4 h-4 mr-2" /> Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                {user ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/auth")}>
                      <LogIn className="w-4 h-4 mr-2" /> Sign in
                    </DropdownMenuItem>
                  </>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Library: icon-only thumbnails */}
        <div className="flex-1 rounded-lg glass-heavy flex flex-col items-center min-h-0 overflow-hidden py-3 gap-1">
          <button className="w-8 h-8 flex items-center justify-center shrink-0 mb-1" title="Your Library">
            <Library className="w-4 h-4 text-muted-foreground" />
          </button>
          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col items-center gap-1 px-1">
              <button
                onClick={() => navigate("/liked")}
                className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center hover:brightness-110 transition"
                title="Liked Songs"
                style={{ background: "linear-gradient(135deg, hsl(250 80% 60%), hsl(200 80% 50%))" }}
              >
                <Heart className="w-3.5 h-3.5 text-white fill-white" />
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center bg-white/5 hover:bg-white/10 transition"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
              {userPlaylists.map((pl) => (
                <button key={pl.id} onClick={() => navigate(`/my-playlist/${pl.id}`)} title={pl.name} className="shrink-0">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-accent flex items-center justify-center hover:brightness-110 transition">
                    {pl.cover_url ? (
                      <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-1.5">
      {/* Top section: Brand + Nav + Menu + Search */}
      <div className={`rounded-lg glass-heavy px-3 py-3 flex flex-col gap-3 transition-all duration-300 ${searchOpen ? "flex-1 min-h-0" : ""}`} style={{ overflow: 'hidden' }}>
        {/* Brand row with nav and menu */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-1">
            <span className="text-lg font-extrabold tracking-tight text-foreground">Nobbb</span>
          </button>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10" onClick={() => navigate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10">
                  <AlignJustify className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/history")}>
                  <History className="w-4 h-4 mr-2" /> History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/stats")}>
                  <BarChart3 className="w-4 h-4 mr-2" /> Listening Stats
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <Bell className="w-4 h-4 mr-2" /> Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                {user ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/auth")}>
                      <LogIn className="w-4 h-4 mr-2" /> Sign in
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search bar */}
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
                  if (e.key === "Enter") handleSearch(query);
                  if (e.key === "Escape") closeSearch();
                }}
                className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 min-w-0"
              />
              {isSearching && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
              <Button variant="ghost" size="icon" className="w-5 h-5 shrink-0 rounded-full" onClick={(e) => { e.stopPropagation(); closeSearch(); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground flex-1">Search</span>
          )}
        </div>

        {/* Search tabs + results inside the box */}
        {searchOpen && (
          <>
            <FilterPill<SearchTab>
              options={searchTabs.map(t => ({ key: t.key, label: t.label }))}
              value={searchTab}
              onChange={(v) => { setSearchTab(v); }}
            />
            <ScrollArea className="flex-1 -mx-3">
              <SidebarSearchResults />
            </ScrollArea>
          </>
        )}
      </div>

      {/* Library Card - hidden when search is open */}
      <div className={`flex-1 rounded-lg flex flex-col min-h-0 glass-heavy transition-all duration-300 ${searchOpen ? "hidden" : ""}`}>
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

                {/* Settings link */}
                <NavLink
                  to="/settings"
                  className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                  activeClassName="bg-accent/60 text-foreground"
                >
                  <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center bg-white/5">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-sm">Settings</p>
                    <p className="text-xs text-muted-foreground truncate">Preferences & account</p>
                  </div>
                </NavLink>
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

function SidebarSearchResults() {
  const { searchTab, tidalTracks, tidalArtists, tidalAlbums, isSearching, filteredTracks, filteredAlbums, filteredPlaylists, closeSearch, query } = useSearch();
  const { currentTrack, play } = usePlayer();
  const navigate = useNavigate();

  const handlePlayTrack = (track: Track, list: Track[]) => {
    play(track, list);
    closeSearch();
  };

  const q = query.toLowerCase();

  // "All" tab shows a mix of everything
  if (searchTab === "all") {
    const hasQuery = q.length > 0;
    if (!hasQuery && !isSearching) {
      return (
        <div className="text-center py-10 px-3">
          <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-xs">Search songs, artists, albums...</p>
        </div>
      );
    }
    return (
      <div className="px-3 space-y-3">
        {/* Top Artists */}
        {tidalArtists.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">Artists</p>
            {tidalArtists.slice(0, 3).map((artist) => (
              <button key={artist.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`); closeSearch(); }}>
                <div className="w-9 h-9 rounded-full bg-accent overflow-hidden shrink-0">
                  {artist.imageUrl ? <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" /> : <User className="w-4 h-4 m-2.5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{artist.name}</p>
                  <p className="text-[10px] text-muted-foreground">Artist</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* Top Albums */}
        {tidalAlbums.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">Albums</p>
            {tidalAlbums.slice(0, 3).map((album) => (
              <button key={album.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/album/${album.id}`); closeSearch(); }}>
                <img src={album.coverUrl} alt={album.title} className="w-9 h-9 rounded object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{album.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* Songs */}
        {tidalTracks.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">Songs</p>
            {tidalTracks.slice(0, 6).map((track) => (
              <SidebarTrackRow key={track.id} track={track} isCurrent={currentTrack?.id === track.id} onClick={() => handlePlayTrack(track, tidalTracks)} />
            ))}
          </div>
        )}
        {/* Local Playlists */}
        {filteredPlaylists.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">Playlists</p>
            {filteredPlaylists.slice(0, 3).map((pl) => (
              <button key={pl.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/playlist/${pl.id}`); closeSearch(); }}>
                <img src={pl.coverUrl} alt={pl.title} className="w-9 h-9 rounded object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{pl.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{pl.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {tidalTracks.length === 0 && tidalArtists.length === 0 && tidalAlbums.length === 0 && !isSearching && (
          <p className="text-center text-muted-foreground text-xs py-10">No results found</p>
        )}
      </div>
    );
  }

  return (
    <div className="px-3">
      {searchTab === "tracks" && (
        <>
          {tidalTracks.length === 0 && !isSearching && <p className="text-center text-muted-foreground text-xs py-10">No songs found</p>}
          {tidalTracks.map((track) => (
            <SidebarTrackRow key={track.id} track={track} isCurrent={currentTrack?.id === track.id} onClick={() => handlePlayTrack(track, tidalTracks)} />
          ))}
        </>
      )}
      {searchTab === "artists" && (
        <>
          {tidalArtists.length === 0 && !isSearching && <p className="text-center text-muted-foreground text-xs py-10">No artists found</p>}
          {tidalArtists.map((artist) => (
            <button key={artist.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`); closeSearch(); }}>
              <div className="w-9 h-9 rounded-full bg-accent overflow-hidden shrink-0">
                {artist.imageUrl ? <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" /> : <User className="w-4 h-4 m-2.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{artist.name}</p>
                <p className="text-[10px] text-muted-foreground">Artist</p>
              </div>
            </button>
          ))}
        </>
      )}
      {searchTab === "albums" && (
        <>
          {tidalAlbums.length === 0 && !isSearching && <p className="text-center text-muted-foreground text-xs py-10">No albums found</p>}
          {tidalAlbums.map((album) => (
            <button key={album.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/album/${album.id}`); closeSearch(); }}>
              <img src={album.coverUrl} alt={album.title} className="w-9 h-9 rounded object-cover shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{album.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
              </div>
            </button>
          ))}
        </>
      )}
      {searchTab === "playlists" && (
        <>
          {filteredPlaylists.length === 0 && <p className="text-center text-muted-foreground text-xs py-10">No playlists found</p>}
          {filteredPlaylists.map((pl) => (
            <button key={pl.id} className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-left" onClick={() => { navigate(`/playlist/${pl.id}`); closeSearch(); }}>
              <img src={pl.coverUrl} alt={pl.title} className="w-9 h-9 rounded object-cover shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{pl.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{pl.description}</p>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function SidebarTrackRow({ track, isCurrent, onClick }: { track: Track; isCurrent: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-md transition-colors text-left group ${isCurrent ? "bg-white/10" : "hover:bg-white/5"}`}
      onClick={onClick}
    >
      <img src={track.coverUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isCurrent ? "font-semibold" : ""}`} style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
          {track.title}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{track.artist} · {track.album}</p>
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
    </button>
  );
}
