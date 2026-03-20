import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { filterAudioTracks, searchTracks, tidalTrackToAppTrack } from "@/lib/musicApi";
import { Track } from "@/types/music";
import { Layers3, Loader2, Music2, Radio, UserRound, Video } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackCard } from "@/components/home/HomeMediaCards";
import { MediaCardShell } from "@/components/MediaCardShell";
import {
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";
import { PageTransition } from "@/components/PageTransition";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  getContentSwapVariants,
  getStaggerContainerVariants,
  getStaggerItemVariants,
} from "@/lib/motion";
import { type BrowseGenreDefinition } from "@/lib/browseGenres";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { cn } from "@/lib/utils";
import { fetchTidalGenreDetail, findBrowseGenreByToken } from "@/lib/tidalGenresApi";
import { useTidalGenres } from "@/hooks/useTidalGenres";

function buildGenreCapabilityItems(genre: BrowseGenreDefinition | null) {
  if (!genre) return [];

  return [
    genre.hasPlaylists ? { key: "playlists", label: "Playlists", icon: Radio } : null,
    genre.hasAlbums ? { key: "albums", label: "Albums", icon: Layers3 } : null,
    genre.hasTracks ? { key: "tracks", label: "Tracks", icon: Music2 } : null,
    genre.hasVideos ? { key: "videos", label: "Videos", icon: Video } : null,
    genre.hasArtists ? { key: "artists", label: "Artists", icon: UserRound } : null,
  ].filter((item): item is { key: string; label: string; icon: typeof Music2 } => Boolean(item));
}

export default function GenrePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedGenreMeta, setSelectedGenreMeta] = useState<BrowseGenreDefinition | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { isLiked, toggleLike } = useLikedSongs();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const { genres, usingLiveGenres } = useTidalGenres();
  const genresById = useMemo(
    () => new Map(genres.map((genre) => [genre.id, genre])),
    [genres],
  );
  const genreGridVariants = useMemo(
    () => getStaggerContainerVariants(motionEnabled, websiteMode),
    [motionEnabled, websiteMode],
  );
  const genreTileVariants = useMemo(
    () => getStaggerItemVariants(motionEnabled, websiteMode),
    [motionEnabled, websiteMode],
  );
  const resultsSwapVariants = useMemo(
    () => getContentSwapVariants(motionEnabled, websiteMode),
    [motionEnabled, websiteMode],
  );

  const loadGenre = useCallback(async (genre: BrowseGenreDefinition) => {
    setSelectedGenre(genre.id);
    setSelectedGenreMeta(genre);
    setLoading(true);
    try {
      const results = await searchTracks(genre.query, 20);
      setTracks(filterAudioTracks(results.map(t => tidalTrackToAppTrack(t))));
    } catch (e) {
      console.error("Failed to load genre:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestedGenreId = searchParams.get("genre");
    if (!requestedGenreId || requestedGenreId === selectedGenre) {
      return;
    }

    const genre = findBrowseGenreByToken(genres, requestedGenreId);
    if (!genre) {
      return;
    }

    void loadGenre(genre);
  }, [genres, loadGenre, searchParams, selectedGenre]);

  const handleSelectGenre = useCallback((genre: BrowseGenreDefinition) => {
    setSearchParams({ genre: genre.id });
    if (selectedGenre !== genre.id) {
      void loadGenre(genre);
    }
  }, [loadGenre, selectedGenre, setSearchParams]);

  const selectedGenreDefinition = selectedGenre ? genresById.get(selectedGenre) ?? null : null;
  const capabilityItems = useMemo(
    () => buildGenreCapabilityItems(selectedGenreMeta || selectedGenreDefinition),
    [selectedGenreDefinition, selectedGenreMeta],
  );

  useEffect(() => {
    const genre = selectedGenreDefinition;
    if (!genre?.apiPath) {
      setSelectedGenreMeta(genre ?? null);
      return;
    }

    let cancelled = false;

    void fetchTidalGenreDetail(genre.apiPath)
      .then((detail) => {
        if (!cancelled) {
          setSelectedGenreMeta(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedGenreMeta(genre);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGenreDefinition]);

  return (
    <PageTransition>
      <div className="page-shell hover-desaturate-page space-y-6">
        <section className={cn("browse-section page-panel", PANEL_SURFACE_CLASS)}>
          <div className="flex flex-col gap-2 px-4 py-5 md:px-6 md:py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Browse</p>
            <h1 className="text-[2rem] font-black tracking-tight text-white md:text-5xl">Browse All</h1>
            <p className="max-w-2xl text-sm text-white/66 md:text-base">
              Explore genres with the same motion language and card behavior used across the rest of KNOBB. The list now syncs with the official TIDAL genre API whenever it is available.
            </p>
          </div>
        </section>

        <section className={cn("browse-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          <div className="home-section-header hover-desaturate-meta px-4 py-3 md:px-6">
            <h2 className="text-xl font-bold text-foreground">Genres</h2>
          </div>
          <motion.div
            variants={genreGridVariants}
            initial="hidden"
            animate="show"
            className="media-card-grid hover-desaturate-grid gap-0 border-l border-t border-white/10"
          >
            {genres.map((genre) => (
              <MediaCardShell
                key={genre.id}
                variants={genreTileVariants}
                onClick={() => handleSelectGenre(genre)}
                className={cn(
                  "overflow-hidden text-left",
                  selectedGenre === genre.id && "ring-1 ring-inset ring-white/30",
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden shadow-sm">
                  {genre.imageUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${genre.imageUrl})` }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${genre.color}) 0%, hsl(${genre.color} / 0.72) 100%)`,
                      mixBlendMode: genre.imageUrl ? "multiply" : "normal",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
                </div>
                <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
                  <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/6 via-black/8 to-black/26" aria-hidden="true" />
                  <p className={`${MEDIA_CARD_TITLE_CLASS} truncate font-medium`}>{genre.label}</p>
                  <p className={`${MEDIA_CARD_META_CLASS} truncate`}>
                    {genre.source === "tidal-api" ? "Live TIDAL API" : "Genre"}
                  </p>
                </div>
              </MediaCardShell>
            ))}
          </motion.div>
        </section>

        <section className={cn("browse-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          <div className="home-section-header hover-desaturate-meta px-4 py-3 md:px-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">{selectedGenreDefinition?.label ?? "Pick a genre"}</h2>
              <p className="text-sm text-white/58">
                {selectedGenreDefinition
                  ? `${tracks.length} tracks ready to explore${usingLiveGenres ? " from a live TIDAL genre catalog" : ""}`
                  : "Choose a genre above to load its latest browse results."}
              </p>
            </div>
          </div>
          {capabilityItems.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-4 pb-4 md:px-6">
              {capabilityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/68"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                );
              })}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {selectedGenreDefinition ? (
              <motion.div
                key={selectedGenreDefinition.id}
                variants={resultsSwapVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="px-4 pb-4 md:px-6 md:pb-6"
              >
                {loading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <motion.div
                    variants={genreGridVariants}
                    initial="hidden"
                    animate="show"
                    className="media-card-grid hover-desaturate-grid gap-0 border-l border-t border-white/10"
                  >
                    {tracks.map((track, index) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        tracks={tracks}
                        liked={isLiked(track.id)}
                        onToggleLike={() => {
                          void toggleLike(track);
                        }}
                        isPriority={index < 6}
                      />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="browse-all-empty"
                variants={resultsSwapVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="px-4 pb-6 pt-2 text-sm text-white/58 md:px-6"
              >
                Hovering and selection now use the shared browse/card motion system.
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </PageTransition>
  );
}
