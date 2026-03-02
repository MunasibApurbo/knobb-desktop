import { useState, useMemo, useCallback } from "react";
import { Search, Play, Loader2, Mic2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { allTracks, albums, playlists, formatDuration, Track } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { searchTracks, searchArtists, searchAlbums, tidalTrackToAppTrack, getTidalImageUrl, TidalArtist, TidalAlbum } from "@/lib/monochromeApi";
import { ArtistLink } from "@/components/ArtistLink";
import { motion } from "framer-motion";

type TabType = "all" | "tracks" | "artists" | "albums" | "library";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabType>("all");
  const [tidalResults, setTidalResults] = useState<Track[]>([]);
  const [artistResults, setArtistResults] = useState<TidalArtist[]>([]);
  const [albumResults, setAlbumResults] = useState<TidalAlbum[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { play, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const q = query.toLowerCase();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTidalResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const [tracks, artists, fetchedAlbums] = await Promise.all([
        searchTracks(searchQuery),
        searchArtists(searchQuery),
        searchAlbums(searchQuery, 12),
      ]);
      setTidalResults(tracks.map(tidalTrackToAppTrack));
      setArtistResults(artists.slice(0, 8));
      setAlbumResults(fetchedAlbums);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);
    searchTimeoutRef[0] = setTimeout(() => handleSearch(value), 400);
  }, [handleSearch]);

  const filteredTracks = useMemo(
    () => (q ? allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : allTracks.slice(0, 20)),
    [q]
  );

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tracks", label: "Songs" },
    { key: "artists", label: "Artists" },
    { key: "albums", label: "Albums" },
    { key: "library", label: "Library" },
  ];

  const hasResults = tidalResults.length > 0 || artistResults.length > 0 || albumResults.length > 0;
  const CARD_GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="What do you want to listen to?"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch(query);
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
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === t.key ? "bg-foreground text-background" : "bg-accent text-foreground hover:bg-accent/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!hasResults && !isSearching && (tab === "all" || tab === "tracks" || tab === "artists" || tab === "albums") && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Search for songs, artists, and albums</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Start typing to discover music</p>
        </div>
      )}

      {/* ALL tab */}
      {tab === "all" && hasResults && (
        <div>
          {/* Top Result + Songs side by side */}
          {(tidalResults.length > 0 || artistResults.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-6 mb-8">
              {/* Top Result Card */}
              {artistResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3">Top result</h3>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-lg p-5 cursor-pointer group h-[220px] flex flex-col justify-end"
                    onClick={() => navigate(`/artist/${artistResults[0].id}?name=${encodeURIComponent(artistResults[0].name)}`)}
                  >
                    <img
                      src={artistResults[0].picture ? getTidalImageUrl(artistResults[0].picture, "320x320") : "/placeholder.svg"}
                      alt={artistResults[0].name}
                      className="w-24 h-24 rounded-full object-cover shadow-xl mb-4"
                    />
                    <p className="text-2xl font-black text-foreground truncate">{artistResults[0].name}</p>
                    <p className="text-xs text-muted-foreground font-semibold uppercase mt-1">Artist</p>
                  </motion.div>
                </div>
              )}

              {/* Top Songs */}
              {tidalResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3">Songs</h3>
                  <motion.div variants={stagger} initial="hidden" animate="show">
                    {tidalResults.slice(0, 4).map((track) => {
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
                            <p className="text-xs truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /></p>
                          </div>
                          <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {/* Artists row */}
          {artistResults.length > 1 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-foreground mb-3">Artists</h3>
              <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
                {artistResults.slice(0, 6).map((a) => (
                  <motion.div
                    key={a.id}
                    variants={fadeUp}
                    className="glass-card rounded-lg p-3.5 cursor-pointer group"
                    onClick={() => navigate(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`)}
                  >
                    <div className="relative mb-3 rounded-full overflow-hidden aspect-square shadow-lg mx-auto">
                      <img
                        src={a.picture ? getTidalImageUrl(a.picture, "320x320") : "/placeholder.svg"}
                        alt={a.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <p className="text-sm font-bold text-foreground truncate text-center">{a.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Mic2 className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Artist</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Albums row */}
          {albumResults.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-foreground mb-3">Albums</h3>
              <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
                {albumResults.slice(0, 6).map((album) => (
                  <motion.div
                    key={album.id}
                    variants={fadeUp}
                    className="glass-card rounded-lg p-3.5 cursor-pointer group"
                    onClick={() => navigate(`/album/tidal-${album.id}`)}
                  >
                    <div className="relative mb-3 rounded-md overflow-hidden aspect-square shadow-lg">
                      <img
                        src={getTidalImageUrl(album.cover, "480x480")}
                        alt={album.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div
                        className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                        style={{ background: `hsl(var(--dynamic-accent))` }}
                      >
                        <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{album.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{album.artist?.name || "Various Artists"}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* TRACKS tab */}
      {tab === "tracks" && (
        <motion.div variants={stagger} initial="hidden" animate="show">
          {tidalResults.map((track) => {
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

      {/* ARTISTS tab */}
      {tab === "artists" && (
        <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
          {artistResults.map((a) => (
            <motion.div
              key={a.id}
              variants={fadeUp}
              className="glass-card rounded-lg p-3.5 cursor-pointer group"
              onClick={() => navigate(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`)}
            >
              <div className="relative mb-3 rounded-full overflow-hidden aspect-square shadow-lg mx-auto">
                <img
                  src={a.picture ? getTidalImageUrl(a.picture, "320x320") : "/placeholder.svg"}
                  alt={a.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <p className="text-sm font-bold text-foreground truncate text-center">{a.name}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Mic2 className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Artist · Popularity {a.popularity}%</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ALBUMS tab */}
      {tab === "albums" && (
        <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
          {albumResults.map((album) => (
            <motion.div
              key={album.id}
              variants={fadeUp}
              className="glass-card rounded-lg p-3.5 cursor-pointer group"
              onClick={() => navigate(`/album/tidal-${album.id}`)}
            >
              <div className="relative mb-3 rounded-md overflow-hidden aspect-square shadow-lg">
                <img
                  src={getTidalImageUrl(album.cover, "480x480")}
                  alt={album.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                  style={{ background: `hsl(var(--dynamic-accent))` }}
                >
                  <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
                </div>
              </div>
              <p className="text-sm font-bold text-foreground truncate">{album.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{album.artist?.name || "Various Artists"}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* LIBRARY tab */}
      {tab === "library" && (
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
    </div>
  );
}