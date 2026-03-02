import { Home, Library, Heart, Plus, Music, Compass } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { playlists, albums } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type FilterType = "playlists" | "albums" | "artists";

const mainNav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Browse", url: "/genre", icon: Compass },
];

export function AppSidebar() {
  const [filter, setFilter] = useState<FilterType>("playlists");
  const { currentTrack } = usePlayer();
  const { likedSongs } = useLikedSongs();
  const navigate = useNavigate();

  const filters: { key: FilterType; label: string }[] = [
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Albums" },
    { key: "artists", label: "Artists" },
  ];

  return (
    <div className="w-[280px] shrink-0 h-full flex flex-col gap-2 py-2 pl-2">
      {/* Top Nav Card */}
      <div className="bg-card rounded-lg p-4">
        <nav className="space-y-1">
          {mainNav.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-4 px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-md"
              activeClassName="text-foreground"
            >
              <item.icon className="w-6 h-6" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Library Card */}
      <div className="flex-1 bg-card rounded-lg flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/")}
          >
            <Library className="w-6 h-6" />
            <span className="text-sm font-bold">Your Library</span>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                filter === f.key
                  ? "bg-foreground text-background"
                  : "bg-accent text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
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
                  <div className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, hsl(250 80% 60%), hsl(200 80% 50%))" }}>
                    <Heart className="w-5 h-5 text-white fill-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-sm">Liked Songs</p>
                    <p className="text-xs text-muted-foreground truncate">Playlist · {likedSongs.length} songs</p>
                  </div>
                </NavLink>
                {playlists.map((pl) => (
                  <NavLink
                    key={pl.id}
                    to={`/playlist/${pl.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-all group"
                    activeClassName="bg-accent/60 text-foreground"
                  >
                    <img src={pl.coverUrl} alt={pl.title} className="w-12 h-12 rounded-md object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate text-sm">{pl.title}</p>
                      <p className="text-xs text-muted-foreground truncate">Playlist · {pl.tracks.length} songs</p>
                    </div>
                  </NavLink>
                ))}
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

        {/* Now Playing Mini */}
        <AnimatePresence>
          {currentTrack && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="relative mx-2 mb-2 rounded-lg overflow-hidden"
            >
              <img src={currentTrack.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-50" />
              <div className="absolute inset-0 bg-background/60" />
              <div className="relative flex items-center gap-3 p-3">
                <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-10 h-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{currentTrack.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
