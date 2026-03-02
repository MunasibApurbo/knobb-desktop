import { useState, useMemo, useCallback } from "react";
import { Search, Play, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { allTracks, albums, playlists, formatDuration, Track } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { searchTracks, tidalTrackToAppTrack } from "@/lib/monochromeApi";

type TabType = "tidal" | "tracks" | "albums" | "playlists";

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

  // Debounced search
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

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "tidal", label: "Tidal", count: tidalResults.length },
    { key: "tracks", label: "Library", count: filteredTracks.length },
    { key: "albums", label: "Albums", count: filteredAlbums.length },
    { key: "playlists", label: "Playlists", count: filteredPlaylists.length },
  ];

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search Tidal for songs, artists..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tab === "tidal") handleSearch(query);
          }}
          className="pl-10 glass border-glass-border rounded-xl h-12 text-base"
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
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
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? "bg-foreground text-background" : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} {t.count !== undefined ? `(${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Tidal Results */}
      {tab === "tidal" && (
        <div className="glass rounded-xl overflow-hidden">
          {tidalResults.length === 0 && !isSearching && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Search Tidal to find and stream music
            </div>
          )}
          {tidalResults.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group
                  ${isCurrent ? "bg-accent/40" : "hover:bg-accent/20"}
                  ${i < tidalResults.length - 1 ? "border-b border-border/10" : ""}`}
                onClick={() => play(track, tidalResults)}
              >
                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? "font-semibold text-foreground" : "text-foreground/90"}`}>{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
                </div>
                <span className="text-sm text-muted-foreground">{formatDuration(track.duration)}</span>
                <Play className="w-4 h-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      )}

      {/* Library tracks */}
      {tab === "tracks" && (
        <div className="glass rounded-xl overflow-hidden">
          {filteredTracks.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group
                  ${isCurrent ? "bg-accent/40" : "hover:bg-accent/20"}
                  ${i < filteredTracks.length - 1 ? "border-b border-border/10" : ""}`}
                onClick={() => play(track, filteredTracks)}
              >
                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? "font-semibold text-foreground" : "text-foreground/90"}`}>{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
                </div>
                <span className="text-sm text-muted-foreground">{formatDuration(track.duration)}</span>
                <Play className="w-4 h-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      )}

      {tab === "albums" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAlbums.map((album) => (
            <div
              key={album.id}
              className="glass-card p-3 cursor-pointer group"
              onClick={() => navigate(`/album/${album.id}`)}
            >
              <div className="relative rounded-lg overflow-hidden mb-3 aspect-square">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-foreground" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{album.title}</p>
              <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "playlists" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredPlaylists.map((pl) => (
            <div
              key={pl.id}
              className="glass-card p-3 cursor-pointer group"
              onClick={() => navigate(`/playlist/${pl.id}`)}
            >
              <div className="relative rounded-lg overflow-hidden mb-3 aspect-square">
                <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-foreground" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{pl.title}</p>
              <p className="text-xs text-muted-foreground truncate">{pl.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
