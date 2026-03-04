import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { Play, Mic2, ChevronRight, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import {
  searchArtists,
  searchAlbums,
  tidalTrackToAppTrack,
  getTidalImageUrl,
  getRecommendations,
  TidalAlbum,
} from "@/lib/monochromeApi";
import { Track } from "@/types/music";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { Button } from "@/components/ui/button";
import { useRecommendations } from "@/hooks/useRecommendations";

// Curated pool of real artist names – Monochrome-style approach
const ARTIST_POOL = [
  "sabrina carpenter", "chappell roan", "tyla", "central cee", "ice spice", "sza",
  "drake", "the weeknd", "taylor swift", "billie eilish", "dua lipa", "kendrick lamar",
  "bad bunny", "travis scott", "ariana grande", "post malone", "doja cat", "olivia rodrigo",
  "harry styles", "lana del rey", "frank ocean", "tyler the creator", "kanye west", "rihanna",
  "beyonce", "ed sheeran", "bruno mars", "adele", "j cole", "21 savage",
  "metro boomin", "future", "lil uzi vert", "playboi carti", "don toliver", "chase atlantic",
];
const ALBUM_QUERIES = ["new releases 2025", "top albums 2025"];

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

/* ── Section header with optional "See all" and reload button ── */
function SectionHeader({
  title,
  onSeeAll,
  onReload,
  loading,
}: {
  title: string;
  onSeeAll?: () => void;
  onReload?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border border-white/10 border-b-0">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-3">
        {onReload && (
          <button
            onClick={onReload}
            className="flex items-center justify-center w-7 h-7  text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all"
            title={`Refresh ${title}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See all <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Card wrapper ── */
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
      className={`hover-desaturate-card relative group cursor-pointer border-r border-b border-white/10 transition-colors hover:bg-white/[0.03] flex flex-col ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

/* ── Track card ── */
function TrackCard({ track, tracks }: { track: Track; tracks: Track[] }) {
  const { play, currentTrack } = usePlayer();
  const isCurrent = currentTrack?.id === track.id;
  return (
    <TrackContextMenu track={track} tracks={tracks}>
      <CardShell onClick={() => play(track, tracks)}>
        <div className="relative overflow-hidden aspect-square shadow-sm w-full">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            className="absolute bottom-3 right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 z-20 hover:scale-110"
            style={{ background: `hsl(var(--dynamic-accent))` }}
          >
            <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
          </div>
        </div>
        <div className="p-3 pt-2 md:p-4 md:pt-3 flex-1 flex flex-col justify-center">
          <p
            className={`text-sm font-medium leading-tight mb-[2px] truncate ${isCurrent ? "font-semibold" : "text-foreground"}`}
            style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}
          >
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground/80 truncate">{track.artist}</p>
        </div>
      </CardShell>
    </TrackContextMenu>
  );
}

/* ── Artist card ── */
function ArtistCard({ id, name, picture, onClick }: { id: number; name: string; picture: string; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="relative overflow-hidden aspect-[3/2] shadow-sm mx-auto w-full">
        <img
          src={picture || "/placeholder.svg"}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <div className="p-3 pt-2 md:p-4 md:pt-3 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium leading-tight mb-[2px] text-foreground text-center truncate">{name}</p>
        <div className="flex items-center justify-center gap-1">
          <Mic2 className="w-[14px] h-[14px] text-muted-foreground/80" />
          <p className="text-xs text-muted-foreground/80">Artist</p>
        </div>
      </div>
    </CardShell>
  );
}

/* ── Album card with cover art ── */
function HomeAlbumCard({ album, navigate, playAlbum }: { album: TidalAlbum; navigate: any; playAlbum: any }) {
  const coverUrl = album.cover ? getTidalImageUrl(album.cover, "750x750") : "/placeholder.svg";
  return (
    <CardShell
      onClick={() => {
        const artistName = album.artists?.[0]?.name || album.artist?.name || "";
        const params = new URLSearchParams();
        if (album.title) params.set("title", album.title);
        if (artistName) params.set("artist", artistName);
        navigate(`/album/tidal-${album.id}?${params.toString()}`);
      }}
    >
      <div className="relative overflow-hidden aspect-square shadow-sm bg-muted w-full">
        <img
          src={coverUrl}
          alt={album.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />
        <div
          className="absolute bottom-3 right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 z-20 hover:scale-110"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            playAlbum(album);
          }}
        >
          <Play className="w-5 h-5 text-foreground ml-0.5 fill-current" />
        </div>
      </div>
      <div className="p-3 pt-2 md:p-4 md:pt-3 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium leading-tight mb-[2px] text-foreground truncate">{album.title}</p>
        <p className="text-xs text-muted-foreground/80 truncate">{album.artist?.name || album.artists?.[0]?.name || "Various Artists"}</p>
      </div>
    </CardShell>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

const CARD_GRID = "hover-desaturate-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 mb-0 border-l border-t border-white/10";

const getTrackHistoryKey = (track: Track) => {
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return `tidal:${track.tidalId}`;
  }
  if (track.id) return `id:${track.id}`;
  return `fallback:${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
};

const dedupeLatestHistoryTracks = (tracks: Track[]) => {
  const seen = new Set<string>();
  const deduped: Track[] = [];

  for (const track of tracks) {
    const key = getTrackHistoryKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(track);
  }

  return deduped;
};

const Index = () => {
  const { play, playAlbum } = usePlayer();
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { recommendations: forYouTracks, loading: loadingForYou } = useRecommendations();
  const navigate = useNavigate();

  // Recommendations
  const [recommendedArtists, setRecommendedArtists] = useState<{ id: number; name: string; picture: string }[]>([]);
  const [recommendedAlbums, setRecommendedAlbums] = useState<TidalAlbum[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  // UI state
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [reloadingSection, setReloadingSection] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  /* ── Reload a specific recommendation section ── */
  const reloadSection = useCallback(async (section: string) => {
    setReloadingSection(section);
    try {
      switch (section) {
        case "recommended": {
          // Fetch fresh recommendations with a slightly different seed
          const seed = recommendedTracks[0]?.tidalId || recentTracks[0]?.tidalId;
          if (seed) {
            const recs = await getRecommendations(seed);
            // Shuffle the results for variety
            const shuffled = recs.sort(() => Math.random() - 0.5);
            setRecommendedTracks(shuffled.map(tidalTrackToAppTrack).slice(0, 12));
          }
          break;
        }
        case "recalbums": {
          const queries = ["best albums 2025", "new music 2025", "top albums", "new releases"];
          const randomQuery = queries[Math.floor(Math.random() * queries.length)];
          const albums = await searchAlbums(randomQuery, 12);
          setRecommendedAlbums(albums);
          break;
        }
        case "recartists": {
          // Pick 12 random artists from curated pool
          const shuffled = [...ARTIST_POOL].sort(() => Math.random() - 0.5).slice(0, 12);
          const results = await Promise.all(
            shuffled.map(async (q) => {
              try {
                const res = await searchArtists(q);
                if (res.length > 0) {
                  return { id: res[0].id, name: res[0].name, picture: res[0].picture ? getTidalImageUrl(res[0].picture, "1080x720") : "" };
                }
              } catch { }
              return null;
            })
          );
          const filtered = results.filter((r): r is { id: number; name: string; picture: string } => r !== null && r.picture !== "");
          if (filtered.length > 0) setRecommendedArtists(filtered);
          break;
        }
      }
    } catch (e) {
      console.error(`Failed to reload ${section}:`, e);
    } finally {
      setReloadingSection(null);
    }
  }, [recommendedTracks, recentTracks]);

  /* ── Initial content load ── */
  const loadContent = useCallback(async () => {
    setError(false);
    try {
      // Recommended / Discovery Artists – pick 12 random from curated pool
      const artistPicks = [...ARTIST_POOL].sort(() => Math.random() - 0.5).slice(0, 12);
      const discoveryResults = await Promise.all(
        artistPicks.map(async (q) => {
          try {
            const results = await searchArtists(q);
            if (results.length > 0 && results[0].picture) {
              return { id: results[0].id, name: results[0].name, picture: getTidalImageUrl(results[0].picture, "1080x720") };
            }
          } catch { }
          return null;
        })
      );
      setRecommendedArtists(discoveryResults.filter((r): r is { id: number; name: string; picture: string } => r !== null));

      // Recommended Albums
      try {
        const allAlbums: TidalAlbum[] = [];
        for (const q of ALBUM_QUERIES) {
          const albums = await searchAlbums(q, 8);
          allAlbums.push(...albums);
        }
        const uniqueAlbums = Array.from(
          new Map(allAlbums.map(a => [a.id, a])).values()
        ).slice(0, 12);
        setRecommendedAlbums(uniqueAlbums);
      } catch (e) {
        console.error("Failed to load recommended albums:", e);
      }

      setLoaded(true);
    } catch (e) {
      console.error("Failed to load home content:", e);
      setError(true);
      setLoaded(true);
    }
  }, []);

  /* ── Load history-based content ── */
  useEffect(() => {
    if (user) {
      getHistory(20).then(async (h) => {
        const latestUniqueHistory = dedupeLatestHistoryTracks(h);
        setRecentTracks(latestUniqueHistory.slice(0, 10));

        // Recommendations from most recent tracks
        if (latestUniqueHistory.length > 0 && latestUniqueHistory[0].tidalId) {
          try {
            const recs = await getRecommendations(latestUniqueHistory[0].tidalId);
            const appRecs = recs.map(tidalTrackToAppTrack).slice(0, 12);

            if (latestUniqueHistory.length > 1 && latestUniqueHistory[1].tidalId) {
              try {
                const recs2 = await getRecommendations(latestUniqueHistory[1].tidalId);
                const appRecs2 = recs2.map(tidalTrackToAppTrack).slice(0, 12);
                const allRecs = [...appRecs];
                for (const r of appRecs2) {
                  if (!allRecs.some(existing => existing.id === r.id)) {
                    allRecs.push(r);
                  }
                }
                setRecommendedTracks(allRecs.slice(0, 12));
              } catch {
                setRecommendedTracks(appRecs);
              }
            } else {
              setRecommendedTracks(appRecs);
            }
          } catch (e) {
            console.error("Failed to load recommendations:", e);
          }
        }
      });
    }
  }, [user, getHistory]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      loadContent();
    }
  }, [loadContent]);

  // Safety net: never leave the home page in perpetual loading state.
  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => {
      setLoaded(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  if (!loaded) {
    return (
      <PageTransition>
        <div className="px-4 py-4 border-b border-white/10">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{getGreeting()}</h1>
        </div>
        <div className="px-4 py-8 flex items-center gap-3 text-muted-foreground border-b border-white/10">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading your homepage...</span>
        </div>
        <div className="px-4 py-6">
          <LoadingSkeleton />
        </div>
      </PageTransition>
    );
  }

  if (
    error &&
    forYouTracks.length === 0 &&
    recommendedTracks.length === 0 &&
    recommendedAlbums.length === 0 &&
    recommendedArtists.length === 0 &&
    recentTracks.length === 0
  ) {
    return (
      <PageTransition>
        <div className="hover-desaturate-page">
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
        </div>
      </PageTransition>
    );
  }

  const getSectionTracks = (tracks: Track[], section: string) =>
    expandedSections.has(section) ? tracks : tracks.slice(0, 5);

  return (
    <PageTransition>
      <div className="hover-desaturate-page">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground px-4 py-4 border-b border-white/10">{getGreeting()}</h1>

        {/* For You — Algorithmic Recommendations */}
        {forYouTracks.length > 0 && (
          <>
            <SectionHeader
              title="For You"
              onSeeAll={() => toggleSection("foryou")}
              loading={loadingForYou}
            />
            <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
              {getSectionTracks(forYouTracks, "foryou").map((track, i) => (
                <TrackCard key={`foryou-${track.id}-${i}`} track={track} tracks={forYouTracks} />
              ))}
            </motion.div>
          </>
        )}

        {/* Recommended Songs — Generic Selection */}
        {recommendedTracks.length > 0 && forYouTracks.length === 0 && (
          <>
            <SectionHeader
              title="Recommended Songs"
              onSeeAll={() => toggleSection("recommended")}
              onReload={() => reloadSection("recommended")}
              loading={reloadingSection === "recommended"}
            />
            <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
              {getSectionTracks(recommendedTracks, "recommended").map((track) => (
                <TrackCard key={`rec-${track.id}`} track={track} tracks={recommendedTracks} />
              ))}
            </motion.div>
          </>
        )}

        {/* Recently Played */}
        {recentTracks.length > 0 && (
          <>
            <SectionHeader title="Recently Played" onSeeAll={() => navigate("/history")} />
            <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
              {recentTracks.slice(0, 5).map((track, i) => (
                <TrackCard key={`recent-${track.id}-${i}`} track={track} tracks={recentTracks} />
              ))}
            </motion.div>
          </>
        )}

        {/* Recommended Albums */}
        {recommendedAlbums.length > 0 && (
          <>
            <SectionHeader
              title="Recommended Albums"
              onSeeAll={() => toggleSection("recalbums")}
              onReload={() => reloadSection("recalbums")}
              loading={reloadingSection === "recalbums"}
            />
            <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
              {(expandedSections.has("recalbums") ? recommendedAlbums : recommendedAlbums.slice(0, 5)).map((album) => (
                <HomeAlbumCard key={`recalbum-${album.id}`} album={album} navigate={navigate} playAlbum={playAlbum} />
              ))}
            </motion.div>
          </>
        )}

        {/* Recommended Artists */}
        {recommendedArtists.length > 0 && (
          <>
            <SectionHeader
              title="Recommended Artists"
              onSeeAll={() => toggleSection("recartists")}
              onReload={() => reloadSection("recartists")}
              loading={reloadingSection === "recartists"}
            />
            <motion.div variants={stagger} initial="hidden" animate="show" className={CARD_GRID}>
              {(expandedSections.has("recartists") ? recommendedArtists : recommendedArtists.slice(0, 5)).map((artist, i) => (
                <ArtistCard
                  key={`disc-${artist.name}-${i}`}
                  id={artist.id}
                  name={artist.name}
                  picture={artist.picture}
                  onClick={() => navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
                />
              ))}
            </motion.div>
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default Index;
