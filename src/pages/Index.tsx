import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Clock, TrendingUp, Music2, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchTracks, searchArtists, tidalTrackToAppTrack, getTidalImageUrl } from "@/lib/monochromeApi";
import { Track, formatDuration, albums, playlists, recentlyPlayed } from "@/data/mockData";
import { motion } from "framer-motion";

const FEATURED_QUERIES = ["trending 2025", "pop hits", "electronic", "hip hop new"];
const ARTIST_QUERIES = ["drake", "the weeknd", "taylor swift", "billie eilish", "dua lipa", "kendrick lamar"];

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
    </div>
  );
}

function TrackCard({ track, tracks, index }: { track: Track; tracks: Track[]; index: number }) {
  const { play, currentTrack, isPlaying } = usePlayer();
  const isCurrent = currentTrack?.id === track.id;

  return (
    <motion.div
      variants={fadeUp}
      className="glass-card rounded-md p-4 cursor-pointer group relative"
      onClick={() => play(track, tracks)}
    >
      <div className="relative mb-4 rounded-md overflow-hidden aspect-square shadow-lg">
        <img
          src={track.coverUrl}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Play button overlay - Dribbblish style */}
        <motion.div
          className="absolute bottom-2 right-2"
          initial={{ opacity: 0, y: 8 }}
          whileHover={{ scale: 1.05 }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
            style={{ background: `hsl(var(--dynamic-accent))` }}
          >
            {isCurrent && isPlaying ? (
              <div className="playing-bars flex items-end gap-[2px]">
                <span /><span /><span />
              </div>
            ) : (
              <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
            )}
          </div>
        </motion.div>
      </div>
      <p className="text-sm font-bold text-foreground truncate">{track.title}</p>
      <p className="text-xs text-muted-foreground truncate mt-1">{track.artist}</p>
    </motion.div>
  );
}

function ArtistCircle({ name, picture, onClick }: { name: string; picture: string; onClick: () => void }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col items-center gap-3 cursor-pointer group shrink-0"
      onClick={onClick}
    >
      <div className="w-[140px] h-[140px] rounded-full overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-2xl">
        <img
          src={picture || "/placeholder.svg"}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <p className="text-sm font-semibold text-foreground group-hover:underline transition-all text-center max-w-[140px] truncate">
        {name}
      </p>
      <p className="text-xs text-muted-foreground -mt-2">Artist</p>
    </motion.div>
  );
}

// Greeting based on time
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const Index = () => {
  const { play } = usePlayer();
  const navigate = useNavigate();
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

      const artistResults = await Promise.all(
        ARTIST_QUERIES.slice(0, 6).map(async (q) => {
          try {
            const results = await searchArtists(q);
            if (results.length > 0) {
              return { name: results[0].name, picture: results[0].picture ? getTidalImageUrl(results[0].picture, "320x320") : "" };
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
    (track: Track, queue: Track[]) => play(track, queue),
    [play]
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex gap-1 items-end"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              animate={{ scaleY: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
              className="w-1.5 h-8 rounded-full"
              style={{ background: `hsl(var(--dynamic-accent))` }}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Greeting - Dribbblish/Spotify style */}
      <h1 className="text-3xl font-bold text-foreground mb-6">{getGreeting()}</h1>

      {/* Quick Access Grid — 6 shortcut cards like Spotify */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
        {[...playlists.slice(0, 3), ...albums.slice(0, 3)].map((item) => (
          <motion.div
            key={item.id}
            variants={fadeUp}
            className="flex items-center bg-secondary/50 hover:bg-secondary/80 rounded-md overflow-hidden cursor-pointer group transition-colors"
            onClick={() => navigate(`/${item.id.startsWith("playlist") ? "playlist" : "album"}/${item.id}`)}
          >
            <img src={item.coverUrl} alt={item.title} className="w-12 h-12 object-cover shadow-md" />
            <span className="px-3 text-sm font-bold text-foreground truncate flex-1">{item.title}</span>
            <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 mr-2 shadow-lg"
              style={{ background: `hsl(var(--dynamic-accent))` }}>
              <Play className="w-4 h-4 text-foreground fill-current ml-0.5" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Trending Section */}
      <SectionHeader title="Trending Now" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-10">
        {trendingTracks.slice(0, 6).map((track, i) => (
          <TrackCard key={track.id} track={track} tracks={trendingTracks} index={i} />
        ))}
      </motion.div>

      {/* Popular Artists */}
      <SectionHeader title="Popular Artists" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 mb-10">
        {artists.map((artist, i) => (
          <ArtistCircle
            key={`${artist.name}-${i}`}
            name={artist.name}
            picture={artist.picture}
            onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
          />
        ))}
      </motion.div>

      {/* Pop Hits */}
      <SectionHeader title="Pop Hits" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-10">
        {popTracks.slice(0, 6).map((track, i) => (
          <TrackCard key={track.id} track={track} tracks={popTracks} index={i} />
        ))}
      </motion.div>

      {/* Electronic */}
      <SectionHeader title="Electronic" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-10">
        {electronicTracks.slice(0, 6).map((track, i) => (
          <TrackCard key={track.id} track={track} tracks={electronicTracks} index={i} />
        ))}
      </motion.div>

      {/* Hip Hop */}
      <SectionHeader title="Hip Hop" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mb-10">
        {hipHopTracks.slice(0, 6).map((track, i) => (
          <TrackCard key={track.id} track={track} tracks={hipHopTracks} index={i} />
        ))}
      </motion.div>
    </motion.div>
  );
};

export default Index;
