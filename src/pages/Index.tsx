import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, TrendingUp, Music2, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchTracks, searchArtists, tidalTrackToAppTrack, getTidalImageUrl, TidalTrack } from "@/lib/monochromeApi";
import { Track, formatDuration } from "@/data/mockData";
import { motion } from "framer-motion";

const FEATURED_QUERIES = ["trending 2025", "pop hits", "electronic", "hip hop new"];
const ARTIST_QUERIES = ["drake", "the weeknd", "taylor swift", "billie eilish", "dua lipa", "kendrick lamar"];

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function HeroSection({ tracks, onPlay }: { tracks: Track[]; onPlay: (t: Track, q: Track[]) => void }) {
  const featured = tracks[0];
  if (!featured) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden h-72 mb-8 cursor-pointer group"
      onClick={() => onPlay(featured, tracks)}
    >
      <img src={featured.coverUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
      <div className="absolute bottom-0 left-0 p-8 flex items-end gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-foreground/70" />
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 font-semibold">Trending Now</p>
          </div>
          <h2 className="text-4xl font-black text-foreground tracking-tight">{featured.title}</h2>
          <p className="text-base text-foreground/70 mt-1 font-medium">{featured.artist} · {featured.album}</p>
        </div>
        <Button
          size="icon"
          className="w-14 h-14 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-y-0 translate-y-2"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(featured, tracks);
          }}
        >
          <Play className="w-6 h-6 text-foreground ml-0.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function TrackRow({ title, icon, tracks, onPlay }: { title: string; icon: React.ReactNode; tracks: Track[]; onPlay: (t: Track, q: Track[]) => void }) {
  const { currentTrack, isPlaying } = usePlayer();

  return (
    <motion.section variants={fadeUp} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-black text-foreground uppercase tracking-wide">{title}</h3>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {tracks.slice(0, 10).map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <motion.div
              key={track.id}
              variants={fadeUp}
              className={`glass-card p-3 w-44 shrink-0 cursor-pointer group relative ${isCurrent ? "border-foreground/30" : ""}`}
              onClick={() => onPlay(track, tracks)}
            >
              <div className="relative overflow-hidden mb-3 aspect-square">
                <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 flex items-center justify-center bg-foreground/90 transition-transform duration-300 scale-75 group-hover:scale-100">
                    <Play className="w-5 h-5 text-background ml-0.5" />
                  </div>
                </div>
                {isCurrent && isPlaying && (
                  <div className="absolute bottom-2 left-2 flex gap-0.5">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="w-1 bg-foreground animate-pulse"
                        style={{
                          height: `${8 + j * 4}px`,
                          animationDelay: `${j * 150}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-foreground truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDuration(track.duration)}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
}

function ArtistRow({ artists }: { artists: { name: string; picture: string }[] }) {
  const navigate = useNavigate();

  return (
    <motion.section variants={fadeUp} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Mic2 className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-lg font-black text-foreground uppercase tracking-wide">Popular Artists</h3>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {artists.map((artist, i) => (
          <motion.div
            key={`${artist.name}-${i}`}
            variants={fadeUp}
            className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
            onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
          >
            <div className="w-28 h-28 overflow-hidden border border-border/30 transition-all duration-300 group-hover:border-foreground/30 group-hover:shadow-lg">
              <img
                src={artist.picture ? getTidalImageUrl(artist.picture, "320x320") : "/placeholder.svg"}
                alt={artist.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <p className="text-xs font-semibold text-foreground group-hover:text-foreground/80 transition-colors truncate max-w-28 text-center">{artist.name}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}

const Index = () => {
  const { play } = usePlayer();
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [popTracks, setPopTracks] = useState<Track[]>([]);
  const [electronicTracks, setElectronicTracks] = useState<Track[]>([]);
  const [hipHopTracks, setHipHopTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<{ name: string; picture: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fetchedRef = useRef(false);

  const loadContent = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const [trending, pop, electronic, hiphop] = await Promise.all(
        FEATURED_QUERIES.map((q) => searchTracks(q, 10))
      );

      setTrendingTracks(trending.map(tidalTrackToAppTrack));
      setPopTracks(pop.map(tidalTrackToAppTrack));
      setElectronicTracks(electronic.map(tidalTrackToAppTrack));
      setHipHopTracks(hiphop.map(tidalTrackToAppTrack));

      // Fetch artists
      const artistResults = await Promise.all(
        ARTIST_QUERIES.slice(0, 6).map(async (q) => {
          try {
            const results = await searchArtists(q);
            if (results.length > 0) {
              return { name: results[0].name, picture: results[0].picture || "" };
            }
          } catch { }
          return { name: q, picture: "" };
        })
      );
      setArtists(artistResults);
      setLoaded(true);
    } catch (e) {
      console.error("Failed to load home content:", e);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handlePlay = useCallback(
    (track: Track, queue: Track[]) => {
      play(track, queue);
    },
    [play]
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex gap-1"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              animate={{ scaleY: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
              className="w-1 h-8 bg-foreground/30"
            />
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="page-enter"
    >
      <HeroSection tracks={trendingTracks} onPlay={handlePlay} />

      <motion.div initial="hidden" animate="show" variants={stagger}>
        <TrackRow title="Trending" icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />} tracks={trendingTracks} onPlay={handlePlay} />
        <ArtistRow artists={artists} />
        <TrackRow title="Pop Hits" icon={<Music2 className="w-5 h-5 text-muted-foreground" />} tracks={popTracks} onPlay={handlePlay} />
        <TrackRow title="Electronic" icon={<Music2 className="w-5 h-5 text-muted-foreground" />} tracks={electronicTracks} onPlay={handlePlay} />
        <TrackRow title="Hip Hop" icon={<Music2 className="w-5 h-5 text-muted-foreground" />} tracks={hipHopTracks} onPlay={handlePlay} />
      </motion.div>
    </motion.div>
  );
};

export default Index;
