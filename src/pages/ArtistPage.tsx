import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { searchArtists, searchTracks, getTidalImageUrl, tidalTrackToAppTrack, TidalArtist } from "@/lib/monochromeApi";
import { Track, formatDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function ArtistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();

  const [artist, setArtist] = useState<TidalArtist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const fetchedRef = useRef(false);

  const loadArtist = useCallback(async () => {
    if (fetchedRef.current || !id) return;
    fetchedRef.current = true;
    setLoading(true);

    try {
      const artistId = parseInt(id);

      // Search for the artist by ID or name
      const artists = await searchArtists(id);
      const found = artists.find((a) => a.id === artistId) || artists[0];
      if (found) {
        setArtist(found);
        
        // Search for tracks by artist name
        const tracks = await searchTracks(found.name, 20);
        setTopTracks(tracks.map(tidalTrackToAppTrack));
      }
    } catch (e) {
      console.error("Failed to load artist:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchedRef.current = false;
    loadArtist();
  }, [loadArtist]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artist) {
    return <div className="p-8 text-foreground">Artist not found.</div>;
  }

  const isCurrentArtist = currentTrack && topTracks.some((t) => t.id === currentTrack.id);
  const displayedTracks = showAllTracks ? topTracks : topTracks.slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Hero */}
      <div className="flex items-end gap-6 pb-8 -mx-6 -mt-16 px-6 pt-20"
        style={{
          background: "linear-gradient(180deg, hsl(var(--dynamic-accent) / 0.4) 0%, transparent 100%)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-56 h-56 rounded-full overflow-hidden shadow-2xl shrink-0"
        >
          <img
            src={artist.picture ? getTidalImageUrl(artist.picture, "750x750") : "/placeholder.svg"}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Artist</p>
          <h1 className="text-5xl font-black text-foreground mt-2 mb-3 truncate tracking-tight">{artist.name}</h1>
          <p className="text-sm text-foreground/70">
            Popularity: {artist.popularity}% · {topTracks.length} top tracks
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 mb-6 mt-4">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentArtist && isPlaying) togglePlay();
            else if (topTracks.length) play(topTracks[0], topTracks);
          }}
        >
          {isCurrentArtist && isPlaying ? (
            <Pause className="w-6 h-6 text-foreground fill-current" />
          ) : (
            <Play className="w-6 h-6 text-foreground fill-current ml-1" />
          )}
        </button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Shuffle className="w-5 h-5" />
        </Button>
      </div>

      {/* Popular Tracks */}
      {topTracks.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-4">Popular</h2>
          <motion.div variants={stagger} initial="hidden" animate="show" className="mb-2">
            {displayedTracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <motion.div
                  key={track.id}
                  variants={fadeUp}
                  className={`grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2.5 items-center cursor-pointer rounded-md transition-all group
                    ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
                  onClick={() => play(track, topTracks)}
                >
                  <span className="text-center text-sm text-muted-foreground">
                    {isCurrent && isPlaying ? (
                      <div className="playing-bars flex items-end gap-[2px] justify-center"><span /><span /><span /></div>
                    ) : (
                      <span className="group-hover:hidden">{i + 1}</span>
                    )}
                    <Play className="w-4 h-4 mx-auto text-foreground hidden group-hover:block" />
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                      style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                      {track.title}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{track.album}</span>
                  <button
                    className="flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
                  >
                    <Heart className={`w-4 h-4 transition-colors ${isLiked(track.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground hover:text-foreground"}`} />
                  </button>
                  <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
                </motion.div>
              );
            })}
          </motion.div>
          {topTracks.length > 5 && (
            <button
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8 px-4"
              onClick={() => setShowAllTracks(!showAllTracks)}
            >
              {showAllTracks ? "Show less" : "See more"}
            </button>
          )}
        </>
      )}

    </motion.div>
  );
}
