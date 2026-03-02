import { useState, useMemo, useCallback } from "react";
import { Search, Play, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { allTracks, albums, playlists, formatDuration, Track } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";
import { ArtistLink } from "@/components/ArtistLink";
import { motion } from "framer-motion";

type TabType = "tidal" | "tracks" | "albums" | "playlists";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabType>("tidal");
  const [tidalResults, setTidalResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { play, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const q = query.toLowerCase();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTidalResults([]);
      return;
    }
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

  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);
    searchTimeoutRef[0] = setTimeout(() => {
      if (tab === "tidal") handleSearch(value);
    }, 400);
  }, [tab, handleSearch]);

  const filteredTracks = useMemo(
    () => (q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 20)),
    [q]
  );
  const filteredAlbums = useMemo(
    () => (q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : albums),
    [q]
  );
  const filteredPlaylists = useMemo(
    () => (q ? playlists.filter((p) => p.title.toLowerCase().includes(q)) : playlists),
    [q]
  );

  const tabs: { key: TabType; label: string }[] = [
    { key: "tidal", label: "Tidal" },
    { key: "tracks", label: "Library" },
    { key: "albums", label: "Albums" },
    { key: "playlists", label: "Playlists" },
  ];

  return (
    <div>
      {/* Search input — Dribbblish style */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="What do you want to listen to?"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tab === "tidal") handleSearch(query);
          }}
          className="pl-12 bg-foreground text-background placeholder:text-background/50 border-0 rounded-full h-12 text-sm font-medium"
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-background/50 animate-spin" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === "tidal" && query) handleSearch(query);
            }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === t.key ? "bg-foreground text-background" : "bg-accent text-foreground hover:bg-accent/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tidal Results */}
      {tab === "tidal" && (
        <motion.div variants={stagger} initial="hidden" animate="show">
          {tidalResults.length === 0 && !isSearching && (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg font-medium">Search Tidal for songs and artists</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Start typing to discover music</p>
            </div>
          )}
          {tidalResults.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <motion.div
                key={track.id}
                variants={fadeUp}
                className={`flex items-center gap-4 px-4 py-2.5 cursor-pointer rounded-md transition-colors group
                  ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
                onClick={() => play(track, tidalResults)}
              >
                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                    style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                    {track.title}
                  </p>
                  <p className="text-xs truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /> · {track.album}</p>
                </div>
                <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                <Play className="w-4 h-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Library tracks */}
      {tab === "tracks" && (
        <motion.div variants={stagger} initial="hidden" animate="show">
          {filteredTracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <motion.div
                key={track.id}
                variants={fadeUp}
                className={`flex items-center gap-4 px-4 py-2.5 cursor-pointer rounded-md transition-colors group
                  ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
                onClick={() => play(track, filteredTracks)}
              >
                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                    style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                    {track.title}
                  </p>
                  <p className="text-xs truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /> · {track.album}</p>
                </div>
                <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {tab === "albums" && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredAlbums.map((album) => (
            <motion.div
              key={album.id}
              variants={fadeUp}
              className="glass-card rounded-md p-4 cursor-pointer group"
              onClick={() => navigate(`/album/${album.id}`)}
            >
              <div className="relative rounded-md overflow-hidden mb-3 aspect-square shadow-lg">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <p className="text-sm font-bold text-foreground truncate">{album.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{album.artist}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "playlists" && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredPlaylists.map((pl) => (
            <motion.div
              key={pl.id}
              variants={fadeUp}
              className="glass-card rounded-md p-4 cursor-pointer group"
              onClick={() => navigate(`/playlist/${pl.id}`)}
            >
              <div className="relative rounded-md overflow-hidden mb-3 aspect-square shadow-lg">
                <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <p className="text-sm font-bold text-foreground truncate">{pl.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{pl.description}</p>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
