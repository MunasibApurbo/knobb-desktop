import { ChevronLeft, ChevronRight, User, Search, Loader2, Play, X, Settings, History, Bell, LogIn, LogOut, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useCallback, useRef, useEffect } from "react";
import { allTracks, albums, playlists, formatDuration, Track } from "@/data/mockData";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterPill } from "@/components/ui/filter-pill";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TabType = "tidal" | "tracks" | "albums" | "playlists";

export function TopBar() {
  const navigate = useNavigate();
  const { currentTrack, play } = usePlayer();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabType>("tidal");
  const [tidalResults, setTidalResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.toLowerCase();

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
      if (tab === "tidal") handleSearch(value);
    }, 400);
  }, [tab, handleSearch]);

  const filteredTracks = q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 15);
  const filteredAlbums = q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums;
  const filteredPlaylists = q ? playlists.filter((p) => p.title.toLowerCase().includes(q)) : playlists;

  const tabs: { key: TabType; label: string }[] = [
    { key: "tidal", label: "Tidal" },
    { key: "tracks", label: "Library" },
    { key: "albums", label: "Albums" },
    { key: "playlists", label: "Playlists" },
  ];

  const handlePlayTrack = (track: Track, list: Track[]) => {
    play(track, list);
    setSearchOpen(false);
  };

  return (
    <header
      className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 shrink-0 sticky top-0 z-20"
    >
      {/* Navigation - hidden on mobile */}
      {!isMobile && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="w-8 h-8 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="w-8 h-8 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
            onClick={() => navigate(1)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Center: Search */}
      <div className="relative flex-1 max-w-lg mx-2 md:mx-4" ref={searchRef}>
        <div
          className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-full cursor-text transition-all ${
            searchOpen
              ? "bg-foreground/10 border border-foreground/20"
              : "bg-background/60 hover:bg-background/80"
          }`}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
          {searchOpen ? (
            <>
              <Input
                ref={inputRef}
                placeholder="What do you want to listen to?"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tab === "tidal") handleSearch(query);
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
              />
              {isSearching && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
              <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-full" onClick={(e) => { e.stopPropagation(); setSearchOpen(false); setQuery(""); }}>
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-muted-foreground flex-1">Search</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 shrink-0 rounded-full"
                onClick={(e) => { e.stopPropagation(); navigate("/genre"); }}
              >
                <Compass className="w-4 h-4 text-muted-foreground" />
              </Button>
            </>
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
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-3 pb-2 border-b border-border/50">
                <FilterPill<TabType>
                  options={tabs.map(t => ({ key: t.key, label: t.label }))}
                  value={tab}
                  onChange={(v) => { setTab(v); if (v === "tidal" && query) handleSearch(query); }}
                />
              </div>

              <ScrollArea className="max-h-[60vh]">
                <div className="p-2">
                  {tab === "tidal" && (
                    <>
                      {tidalResults.length === 0 && !isSearching && (
                        <div className="text-center py-8">
                          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground text-sm">Search for songs</p>
                        </div>
                      )}
                      {tidalResults.map((track) => (
                        <TrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, tidalResults)} />
                      ))}
                    </>
                  )}
                  {tab === "tracks" && (
                    <>
                      {filteredTracks.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground text-sm">No tracks found</p>
                        </div>
                      )}
                      {filteredTracks.map((track) => (
                        <TrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, filteredTracks)} />
                      ))}
                    </>
                  )}
                  {tab === "albums" && (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredAlbums.length === 0 && (
                        <div className="col-span-3 text-center py-8">
                          <p className="text-muted-foreground text-sm">No albums found</p>
                        </div>
                      )}
                      {filteredAlbums.map((album) => (
                        <button
                          key={album.id}
                          className="p-2 rounded-lg hover:bg-accent/30 transition-colors text-left"
                          onClick={() => { navigate(`/album/${album.id}`); setSearchOpen(false); }}
                        >
                          <img src={album.coverUrl} alt={album.title} className="w-full aspect-square rounded-md object-cover mb-1.5" />
                          <p className="text-xs font-bold truncate">{album.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {tab === "playlists" && (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredPlaylists.length === 0 && (
                        <div className="col-span-3 text-center py-8">
                          <p className="text-muted-foreground text-sm">No playlists found</p>
                        </div>
                      )}
                      {filteredPlaylists.map((pl) => (
                        <button
                          key={pl.id}
                          className="p-2 rounded-lg hover:bg-accent/30 transition-colors text-left"
                          onClick={() => { navigate(`/playlist/${pl.id}`); setSearchOpen(false); }}
                        >
                          <img src={pl.coverUrl} alt={pl.title} className="w-full aspect-square rounded-md object-cover mb-1.5" />
                          <p className="text-xs font-bold truncate">{pl.title}</p>
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

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full bg-background/60 hover:bg-background/80 transition-colors p-1 pr-2 md:pr-3">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                <User className="w-4 h-4 text-foreground" />
              </div>
              {!isMobile && (
                <span className="text-sm font-semibold text-foreground">
                  {user ? "Account" : "Menu"}
                </span>
              )}
            </button>
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
                <DropdownMenuItem onClick={() => { signOut(); }}>
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
    </header>
  );
}

function TrackRow({ track, currentTrack, onClick }: { track: Track; currentTrack: Track | null; onClick: () => void }) {
  const isCurrent = currentTrack?.id === track.id;
  return (
    <button
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-left group ${
        isCurrent ? "bg-accent/30" : "hover:bg-accent/15"
      }`}
      onClick={onClick}
    >
      <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
          style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
      </div>
      <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{formatDuration(track.duration)}</span>
      <Play className="w-4 h-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
