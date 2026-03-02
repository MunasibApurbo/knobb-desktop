import { useSearch } from "@/contexts/SearchContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterPill } from "@/components/ui/filter-pill";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Loader2 } from "lucide-react";
import { Track, formatDuration } from "@/data/mockData";

type SearchTab = "tidal" | "tracks" | "albums" | "playlists";

const searchTabs: { key: SearchTab; label: string }[] = [
  { key: "tidal", label: "Tidal" },
  { key: "tracks", label: "Library" },
  { key: "albums", label: "Albums" },
  { key: "playlists", label: "Playlists" },
];

export function SearchOverlay() {
  const {
    searchOpen, searchTab, setSearchTab,
    tidalResults, isSearching,
    filteredTracks, filteredAlbums, filteredPlaylists,
    handleSearch, query, closeSearch,
  } = useSearch();
  const { currentTrack, play } = usePlayer();
  const navigate = useNavigate();

  const handlePlayTrack = (track: Track, list: Track[]) => {
    play(track, list);
    closeSearch();
  };

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-40 flex flex-col rounded-lg overflow-hidden"
          style={{ background: "hsl(0 0% 8% / 0.92)", backdropFilter: "blur(30px) saturate(150%)" }}
        >
          {/* Tab pills */}
          <div className="px-5 pt-5 pb-3 border-b border-white/8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground">Search</h2>
              {isSearching && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
            </div>
            <FilterPill<SearchTab>
              options={searchTabs.map(t => ({ key: t.key, label: t.label }))}
              value={searchTab}
              onChange={(v) => { setSearchTab(v); if (v === "tidal" && query) handleSearch(query); }}
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {searchTab === "tidal" && (
                <>
                  {tidalResults.length === 0 && !isSearching && (
                    <div className="text-center py-16">
                      <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Search for songs, artists, albums...</p>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {tidalResults.map((track) => (
                      <ResultTrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, tidalResults)} />
                    ))}
                  </div>
                </>
              )}
              {searchTab === "tracks" && (
                <>
                  {filteredTracks.length === 0 && <p className="text-center text-muted-foreground text-sm py-16">No tracks found</p>}
                  <div className="space-y-0.5">
                    {filteredTracks.map((track) => (
                      <ResultTrackRow key={track.id} track={track} currentTrack={currentTrack} onClick={() => handlePlayTrack(track, filteredTracks)} />
                    ))}
                  </div>
                </>
              )}
              {searchTab === "albums" && (
                <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredAlbums.length === 0 && <p className="col-span-full text-center text-muted-foreground text-sm py-16">No albums found</p>}
                  {filteredAlbums.map((album) => (
                    <button
                      key={album.id}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                      onClick={() => { navigate(`/album/${album.id}`); closeSearch(); }}
                    >
                      <img src={album.coverUrl} alt={album.title} className="w-full aspect-square rounded-md object-cover mb-2 group-hover:shadow-lg transition-shadow" />
                      <p className="text-xs font-bold truncate">{album.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
                    </button>
                  ))}
                </div>
              )}
              {searchTab === "playlists" && (
                <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredPlaylists.length === 0 && <p className="col-span-full text-center text-muted-foreground text-sm py-16">No playlists found</p>}
                  {filteredPlaylists.map((pl) => (
                    <button
                      key={pl.id}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                      onClick={() => { navigate(`/playlist/${pl.id}`); closeSearch(); }}
                    >
                      <img src={pl.coverUrl} alt={pl.title} className="w-full aspect-square rounded-md object-cover mb-2 group-hover:shadow-lg transition-shadow" />
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
  );
}

function ResultTrackRow({ track, currentTrack, onClick }: { track: Track; currentTrack: Track | null; onClick: () => void }) {
  const isCurrent = currentTrack?.id === track.id;
  return (
    <button
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-left group ${
        isCurrent ? "bg-white/10" : "hover:bg-white/5"
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
