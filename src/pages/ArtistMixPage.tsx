import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTotalDuration } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton, TrackListSkeleton } from "@/components/LoadingSkeleton";
import { Play, Pause, Shuffle, Heart, Share, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { useArtistPageData } from "@/hooks/useArtistPageData";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { isSameTrack } from "@/lib/trackIdentity";

export default function ArtistMixPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const artistName = searchParams.get("name") || "";
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const { artist, loading, radioLoading, radioTracks, scrollY, topTracks } = useArtistPageData({
    artistName,
    id,
    includeRadio: true,
  });
  const [sharePending, setSharePending] = useState(false);

  useEffect(() => {
    setSharePending(false);
  }, [artistName, id]);

  const artistImageUrl = useResolvedArtistImage(
    artist?.id,
    artist?.picture ? getTidalImageUrl(artist.picture, "750x750") : radioTracks[0]?.coverUrl || topTracks[0]?.coverUrl || "",
    artist?.name || artistName,
  );
  const pageLabel = artist && artist.mixes?.ARTIST_MIX ? "Mix" : "Radio";
  const pageTitle = artist ? `${artist.name} ${pageLabel}` : "";

  usePageMetadata(artist ? {
    title: pageTitle,
    description: `Listen to ${artist.name}'s ${pageLabel.toLowerCase()} on Knobb.`,
    image: artistImageUrl || radioTracks[0]?.coverUrl || topTracks[0]?.coverUrl || undefined,
    imageAlt: `${artist.name} ${pageLabel.toLowerCase()} artwork`,
    type: "music.playlist",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: pageTitle,
      description: `Listen to ${artist.name}'s ${pageLabel.toLowerCase()} on Knobb.`,
      image: artistImageUrl || radioTracks[0]?.coverUrl || topTracks[0]?.coverUrl || undefined,
      numTracks: radioTracks.length || undefined,
      url:
        typeof window !== "undefined"
          ? new URL(window.location.pathname, window.location.origin).toString()
          : undefined,
    },
  } : null);

  if (loading && !artist) return <LoadingSkeleton variant="detail" />;

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg font-medium">Artist mix not found</p>
      </div>
    );
  }

  const hasArtistMix = Boolean(artist.mixes?.ARTIST_MIX);
  const isCurrentMix = currentTrack && radioTracks.some((track) => track.id === currentTrack.id);
  const favorite = isFavorite(artist.id);

  const handleToggleFavorite = async () => {
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const success = await toggleFavorite({
      artistId: artist.id,
      artistName: artist.name,
      artistImageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite artist");
      return;
    }

    toast.success(favorite ? `Removed ${artist.name} from favorites` : `Added ${artist.name} to favorites`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    setSharePending(true);

    try {
      await copyPlainTextToClipboard(url);
      toast.success("Mix link copied to clipboard");
    } finally {
      setSharePending(false);
    }
  };

  const handlePlayMix = () => {
    if (isCurrentMix) {
      togglePlay();
      return;
    }

    if (radioTracks.length > 0) {
      const queue = hasArtistMix ? radioTracks : [...radioTracks].sort(() => Math.random() - 0.5);
      play(queue[0], queue);
      return;
    }

    toast.error(hasArtistMix ? "Artist mix is still loading" : "Artist radio is still loading");
  };

  const handleShuffleMix = () => {
    if (radioTracks.length === 0) return;
    const queue = [...radioTracks].sort(() => Math.random() - 0.5);
    play(queue[0], queue);
  };

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mobile-page-shell">
        <DetailHero
          artworkUrl={artistImageUrl || radioTracks[0]?.coverUrl || topTracks[0]?.coverUrl || "/placeholder.svg"}
          label={pageLabel}
          scrollY={scrollY}
          title={pageTitle}
          body={
            <>
              <p>Built from {artist.name}&rsquo;s catalog and related listening data.</p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-white/84 underline underline-offset-4 transition-colors hover:text-white"
                onClick={() => navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
              >
                Open artist page
              </button>
            </>
          }
          meta={
            <>
              <span className="detail-chip">
                <span>Tracks</span>
                <strong>{radioTracks.length}</strong>
              </span>
              {radioTracks.length > 0 ? (
                <span className="detail-chip">
                  <span>Runtime</span>
                  <strong>{getTotalDuration(radioTracks)}</strong>
                </span>
              ) : null}
            </>
          }
        />

        <DetailActionBar columns={4}>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handlePlayMix}>
            {isCurrentMix && isPlaying ? (
              <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            ) : (
              <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            )}
            <span className="hero-action-label relative z-10">Play</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleShuffleMix}>
            <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Shuffle</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleToggleFavorite}>
            <Heart
              className={`hero-action-icon w-4 h-4 mr-2 transition-colors ${favorite
                ? "fill-current text-[hsl(var(--player-waveform))] group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                : ""
                }`}
            />
            <span className="hero-action-label relative z-10">{favorite ? "Favorited" : "Add"}</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleShare} disabled={sharePending}>
            <Share className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Share</span>
          </Button>
        </DetailActionBar>

        {radioLoading && radioTracks.length === 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <TrackListSkeleton count={8} />
          </section>
        ) : radioTracks.length > 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div>
              {radioTracks.map((track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);

                return (
                  <TrackContextMenu key={`${track.id}-${i}`} track={track} tracks={radioTracks}>
                    <TrackListRow
                      dragHandleLabel={`Drag ${track.title} to a playlist`}
                      index={i}
                      isCurrent={isCurrent}
                      isLiked={isLiked(track.id)}
                      isPlaying={isPlaying}
                      onDragHandleStart={(event) => {
                        startPlaylistDrag(event.dataTransfer, {
                          label: track.title,
                          source: "track",
                          tracks: [track],
                        });
                      }}
                      onPlay={() => play(track, radioTracks)}
                      onToggleLike={() => toggleLike(track)}
                      track={track}
                    />
                  </TrackContextMenu>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-10">
            No tracks found for this {hasArtistMix ? "mix" : "radio"}.
          </p>
        )}
      </motion.div>
    </PageTransition>
  );
}
