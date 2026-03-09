import { ChevronLeft, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { HOME_SECTION_CONFIG, isHomeSectionKey } from "@/lib/homeSections";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export default function HomeSectionPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section: string }>();
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { favoriteArtists } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const {
    error,
    loaded,
    newReleases,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    recentTracks,
    reloadingSection,
    reloadSection,
    retryInitialLoad,
  } = useHomeFeeds({
    favoriteArtists,
    getHistory,
    userId: user?.id,
  });

  if (!section || !isHomeSectionKey(section)) {
    return <Navigate to="/" replace />;
  }

  const config = HOME_SECTION_CONFIG[section];
  const items =
    section === "recommended"
      ? recommendedTracks
      : section === "newreleases"
        ? newReleases
        : section === "recent"
          ? recentTracks
          : section === "recalbums"
            ? recommendedAlbums
            : recommendedArtists;

  if (!loaded) {
    return <LoadingSkeleton variant="grid" />;
  }

  if (error && items.length === 0) {
    return (
      <PageTransition>
        <div className="hover-desaturate-page space-y-8 px-4 py-8 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 text-center">
            <p className="text-lg font-semibold text-foreground">Failed to load {config.title.toLowerCase()}</p>
            <button
              type="button"
              onClick={() => {
                void retryInitialLoad();
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="hover-desaturate-page space-y-8 px-4 py-8 md:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">{config.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{items.length} cards</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void reloadSection(section);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${reloadingSection === section ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {items.length > 0 ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="media-card-grid hover-desaturate-grid">
            {config.itemType === "track" &&
              (items as typeof recommendedTracks).map((track, index, allTracks) => (
                <motion.div key={`${section}-${track.id}-${index}`} variants={stagger}>
                  <TrackCard
                    track={track}
                    tracks={allTracks}
                    liked={isLiked(track.id)}
                    onToggleLike={() => {
                      void toggleLike(track);
                    }}
                  />
                </motion.div>
              ))}

            {config.itemType === "album" &&
              (items as typeof recommendedAlbums).map((album) => (
                <motion.div key={`${section}-${album.id}`} variants={stagger}>
                  <HomeAlbumCard
                    album={album}
                    saved={isAlbumSaved(album.id)}
                    onToggleSave={() => {
                      void toggleSavedAlbum({
                        albumId: album.id,
                        albumTitle: album.title,
                        albumArtist: album.artist || "Various Artists",
                        albumCoverUrl: album.coverUrl,
                      });
                    }}
                  />
                </motion.div>
              ))}

            {config.itemType === "artist" &&
              (items as typeof recommendedArtists).map((artist) => (
                <motion.div key={`${section}-${artist.id}`} variants={stagger}>
                  <ArtistCardWrapper artist={artist} />
                </motion.div>
              ))}
          </motion.div>
        ) : (
          <div className="border border-white/10 px-5 py-10 text-center text-muted-foreground">
            Nothing to show here right now. <Link to="/" className="underline underline-offset-4">Go back home</Link>.
          </div>
        )}
      </div>
    </PageTransition>
  );
}
