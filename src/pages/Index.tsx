import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Mic2 } from "lucide-react";
import { searchTracks, searchArtists, tidalTrackToAppTrack, getTidalImageUrl } from "@/lib/monochromeApi";
import { Track, albums, playlists } from "@/data/mockData";
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
    </div>
  );
}

/* ── Unified Card Shell ── */
function CardShell({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={`glass-card rounded-lg p-3.5 cursor-pointer group relative transition-colors hover:bg-accent/15 ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

/* ── Track Card ── */
function TrackCard({ track, tracks }: { track: Track; tracks: Track[] }) {
  const { play, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const isCurrent = currentTrack?.id === track.id;

  return (
    <CardShell onClick={() => play(track, tracks)}>
      <div className="relative mb-3 rounded-md overflow-hidden aspect-square shadow-lg">
        <img
          src={track.coverUrl}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
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
      </div>
      <p className="text-sm font-bold text-foreground truncate">{track.title}</p>
      <p
        className="text-xs text-muted-foreground truncate mt-0.5 hover:underline"
        onClick={(e) => {
          if (track.artistId) {
            e.stopPropagation();
            navigate(`/artist/${track.artistId}`);
          }
        }}
      >
        {track.artist}
      </p>
    </CardShell>
  );
}

/* ── Artist Card (same shape as TrackCard) ── */
function ArtistCard({ id, name, picture, onClick }: { id: number; name: string; picture: string; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="relative mb-3 rounded-full overflow-hidden aspect-square shadow-lg mx-auto">
        <img
          src={picture || "/placeholder.svg"}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div
          className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
          style={{ background: `hsl(var(--dynamic-accent))` }}
        >
          <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
        </div>
      </div>
      <p className="text-sm font-bold text-foreground truncate text-center">{name}</p>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <Mic2 className="w-3 h-3 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Artist</p>
      </div>
    </CardShell>
  );
}

// Greeting based on time
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const CARD_GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-10";

const Index = () => {
  const { play } = usePlayer();
  const navigate = useNavigate();
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [popTracks, setPopTracks] = useState<Track[]>([]);
  const [electronicTracks, setElectronicTracks] = useState<Track[]>([]);
  const [hipHopTracks, setHipHopTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<{ id: number; name: string; picture: string }[]>([]);
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
              return { id: results[0].id, name: results[0].name, picture: results[0].picture ? getTidalImageUrl(results[0].picture, "320x320") : "" };
            }
          } catch { }
          return { id: 0, name: q, picture: "" };
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
      {/* Greeting */}
      <h1 className="text-3xl font-bold text-foreground mb-6">{getGreeting()}</h1>

      {/* Quick Access Grid */}
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

      {/* Popular Artists */}
      <SectionHeader title="Popular Artists" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {artists.map((artist, i) => (
          <ArtistCard
            key={`${artist.name}-${i}`}
            id={artist.id}
            name={artist.name}
            picture={artist.picture}
            onClick={() => navigate(`/artist/${artist.id}`)}
          />
        ))}
      </motion.div>

      {/* Trending */}
      <SectionHeader title="Trending Now" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {trendingTracks.slice(0, 6).map((track) => (
          <TrackCard key={track.id} track={track} tracks={trendingTracks} />
        ))}
      </motion.div>

      {/* Pop Hits */}
      <SectionHeader title="Pop Hits" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {popTracks.slice(0, 6).map((track) => (
          <TrackCard key={track.id} track={track} tracks={popTracks} />
        ))}
      </motion.div>

      {/* Electronic */}
      <SectionHeader title="Electronic" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {electronicTracks.slice(0, 6).map((track) => (
          <TrackCard key={track.id} track={track} tracks={electronicTracks} />
        ))}
      </motion.div>

      {/* Hip Hop */}
      <SectionHeader title="Hip Hop" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {hipHopTracks.slice(0, 6).map((track) => (
          <TrackCard key={track.id} track={track} tracks={hipHopTracks} />
        ))}
      </motion.div>
    </motion.div>
  );
};

export default Index;
