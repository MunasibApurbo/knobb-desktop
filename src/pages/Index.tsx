import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { Play, Mic2, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { searchTracks, searchArtists, tidalTrackToAppTrack, getTidalImageUrl } from "@/lib/monochromeApi";
import { Track } from "@/data/mockData";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { Button } from "@/components/ui/button";

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

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Show all <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

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
      className={`glass-card rounded-lg p-3 md:p-3.5 cursor-pointer group relative transition-colors hover:bg-accent/15 ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

function TrackCard({ track, tracks }: { track: Track; tracks: Track[] }) {
  const { play, currentTrack, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const isCurrent = currentTrack?.id === track.id;

  return (
    <TrackContextMenu track={track} tracks={tracks}>
      <CardShell onClick={() => play(track, tracks)}>
        <div className="relative mb-3 rounded-md overflow-hidden aspect-square shadow-lg">
          <img
            src={track.coverUrl}
            alt={track.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
          <div
            className="absolute bottom-2 right-2 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
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
              navigate(`/artist/${track.artistId}?name=${encodeURIComponent(track.artist)}`);
            }
          }}
        >
          {track.artist}
        </p>
      </CardShell>
    </TrackContextMenu>
  );
}

function ArtistCard({ id, name, picture, onClick }: { id: number; name: string; picture: string; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="relative mb-3 rounded-full overflow-hidden aspect-square shadow-lg mx-auto">
        <img
          src={picture || "/placeholder.svg"}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />
        <div
          className="absolute bottom-2 right-2 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const CARD_GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 mb-10";

const Index = () => {
  const { play } = usePlayer();
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const navigate = useNavigate();
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [popTracks, setPopTracks] = useState<Track[]>([]);
  const [electronicTracks, setElectronicTracks] = useState<Track[]>([]);
  const [hipHopTracks, setHipHopTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<{ id: number; name: string; picture: string }[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const fetchedRef = useRef(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const loadContent = useCallback(async () => {
    setError(false);
    try {
      const [trending, pop, electronic, hiphop] = await Promise.all(
        FEATURED_QUERIES.map((q) => searchTracks(q, 12))
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
      setError(true);
      setLoaded(true);
    }
  }, []);

  // Load recent tracks
  useEffect(() => {
    if (user) {
      getHistory(10).then((h) => setRecentTracks(h));
    }
  }, [user, getHistory]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      loadContent();
    }
  }, [loadContent]);

  if (!loaded) return <LoadingSkeleton />;

  if (error && trendingTracks.length === 0) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg font-medium">Failed to load content</p>
          <Button
            variant="outline"
            onClick={() => { fetchedRef.current = false; loadContent(); }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      </PageTransition>
    );
  }

  const getSectionTracks = (tracks: Track[], section: string) =>
    expandedSections.has(section) ? tracks : tracks.slice(0, 6);

  return (
    <PageTransition>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{getGreeting()}</h1>

      {/* Recently Played */}
      {recentTracks.length > 0 && (
        <>
          <SectionHeader title="Recently Played" onSeeAll={() => navigate("/history")} />
          <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
            {recentTracks.slice(0, 6).map((track, i) => (
              <TrackCard key={`recent-${track.id}-${i}`} track={track} tracks={recentTracks} />
            ))}
          </motion.div>
        </>
      )}

      {/* Popular Artists */}
      <SectionHeader title="Popular Artists" />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {artists.map((artist, i) => (
          <ArtistCard
            key={`${artist.name}-${i}`}
            id={artist.id}
            name={artist.name}
            picture={artist.picture}
            onClick={() => navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
          />
        ))}
      </motion.div>

      {/* Trending */}
      <SectionHeader title="Trending Now" onSeeAll={() => toggleSection("trending")} />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {getSectionTracks(trendingTracks, "trending").map((track) => (
          <TrackCard key={track.id} track={track} tracks={trendingTracks} />
        ))}
      </motion.div>

      {/* Pop Hits */}
      <SectionHeader title="Pop Hits" onSeeAll={() => toggleSection("pop")} />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {getSectionTracks(popTracks, "pop").map((track) => (
          <TrackCard key={track.id} track={track} tracks={popTracks} />
        ))}
      </motion.div>

      {/* Electronic */}
      <SectionHeader title="Electronic" onSeeAll={() => toggleSection("electronic")} />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {getSectionTracks(electronicTracks, "electronic").map((track) => (
          <TrackCard key={track.id} track={track} tracks={electronicTracks} />
        ))}
      </motion.div>

      {/* Hip Hop */}
      <SectionHeader title="Hip Hop" onSeeAll={() => toggleSection("hiphop")} />
      <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
        {getSectionTracks(hipHopTracks, "hiphop").map((track) => (
          <TrackCard key={track.id} track={track} tracks={hipHopTracks} />
        ))}
      </motion.div>
    </PageTransition>
  );
};

export default Index;
