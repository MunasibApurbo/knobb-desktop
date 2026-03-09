import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { getTotalDuration } from "@/lib/utils";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Share, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { motion } from "framer-motion";
import { filterAudioTracks, getMix, tidalTrackToAppTrack } from "@/lib/musicApi";
import type { TidalMix } from "@/lib/musicApi";
import type { Track } from "@/types/music";
import { toast } from "sonner";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { isSameTrack } from "@/lib/trackIdentity";

export default function TrackMixPage() {
  const { mixId } = useParams();
  const [searchParams] = useSearchParams();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const [mix, setMix] = useState<TidalMix | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const scrollY = useMainScrollY();
  const fetchedRef = useRef<string>("");

  const fallbackTitle = searchParams.get("title") || "Track Mix";
  const fallbackArtist = searchParams.get("artist") || "";
  const fallbackCover = searchParams.get("cover") || "";
  const pageTitle = mix?.title?.trim() || fallbackTitle;
  const pageSubtitle = mix?.subTitle?.trim() || fallbackArtist;
  const pageDescription = mix?.description?.trim() || (fallbackTitle ? `Built around ${fallbackTitle}.` : "");
  const coverUrl = mix?.image || fallbackCover || tracks[0]?.coverUrl || "/placeholder.svg";

  usePageMetadata(!loading && !error && (mix || tracks.length > 0) ? {
    title: pageTitle,
    description: pageDescription || (pageSubtitle ? `Listen to ${pageTitle} by ${pageSubtitle} on Knobb.` : `Listen to ${pageTitle} on Knobb.`),
    image: coverUrl,
    imageAlt: `${pageTitle} mix artwork`,
    type: "music.playlist",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: pageTitle,
      description:
        pageDescription ||
        (pageSubtitle ? `Listen to ${pageTitle} by ${pageSubtitle} on Knobb.` : `Listen to ${pageTitle} on Knobb.`),
      image: coverUrl,
      numTracks: tracks.length || undefined,
      url:
        typeof window !== "undefined"
          ? new URL(window.location.pathname, window.location.origin).toString()
          : undefined,
    },
  } : null);

  const loadMix = useCallback(async () => {
    if (!mixId) return;
    setLoading(true);
    setError(false);

    try {
      const { mix: mixInfo, tracks: mixTracks } = await getMix(mixId);
      const appTracks = filterAudioTracks(
        mixTracks.map((track, index) => ({
          ...tidalTrackToAppTrack(track),
          id: `mix-${mixId}-${track.id}-${index}`,
        })),
      );

      setMix(mixInfo);
      setTracks(appTracks);
      setError(!mixInfo && appTracks.length === 0);
    } catch (loadError) {
      console.error("Failed to load mix:", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mixId]);

  useEffect(() => {
    if (!mixId || fetchedRef.current === mixId) return;
    fetchedRef.current = mixId;
    void loadMix();
  }, [loadMix, mixId]);

  if (loading) return <LoadingSkeleton variant="detail" />;

  if (error || (!mix && tracks.length === 0)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">Failed to load mix</p>
        <Button variant="outline" onClick={() => void loadMix()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  const isCurrentMix = currentTrack && tracks.some((track) => track.id === currentTrack.id);

  const handleShareMix = async () => {
    const url = window.location.href;
    setSharePending(true);

    try {
      await copyPlainTextToClipboard(url);
      toast.success("Mix link copied to clipboard");
    } finally {
      setSharePending(false);
    }
  };

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mobile-page-shell">
        <DetailHero
          artworkUrl={coverUrl}
          label="Mix"
          scrollY={scrollY}
          title={pageTitle}
          body={
            <>
              {pageSubtitle ? <p>{pageSubtitle}</p> : null}
              {pageDescription ? <p className="mt-2">{pageDescription}</p> : null}
            </>
          }
          meta={
            <>
              <span className="detail-chip">
                <span>Tracks</span>
                <strong>{tracks.length}</strong>
              </span>
              {tracks.length > 0 ? (
                <span className="detail-chip">
                  <span>Runtime</span>
                  <strong>{getTotalDuration(tracks)}</strong>
                </span>
              ) : null}
            </>
          }
        />

        <DetailActionBar columns={3} className="grid-cols-1 md:grid-cols-none">
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isCurrentMix) togglePlay();
              else if (tracks.length > 0) play(tracks[0], tracks);
            }}
          >
            {isCurrentMix && isPlaying ? (
              <Pause className="hero-action-icon mr-2 h-4 w-4 fill-current" />
            ) : (
              <Play className="hero-action-icon mr-2 h-4 w-4 fill-current" />
            )}
            <span className="hero-action-label relative z-10">Play</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (tracks.length === 0) return;
              const queue = [...tracks].sort(() => Math.random() - 0.5);
              play(queue[0], queue);
            }}
          >
            <Shuffle className="hero-action-icon mr-2 h-4 w-4" />
            <span className="hero-action-label relative z-10">Shuffle</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={() => void handleShareMix()} disabled={sharePending}>
            <Share className="hero-action-icon mr-2 h-4 w-4" />
            <span className="hero-action-label relative z-10">Share</span>
          </Button>
        </DetailActionBar>

        {tracks.length > 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <VirtualizedTrackList
              items={tracks}
              getItemKey={(track, index) => `${track.id}-${index}`}
              rowHeight={86}
              renderRow={(track, index) => {
                const isCurrent = isSameTrack(currentTrack, track);

                return (
                  <TrackContextMenu key={`${track.id}-${index}`} track={track} tracks={tracks}>
                    <TrackListRow
                      dragHandleLabel={`Drag ${track.title} to a playlist`}
                      index={index}
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
                      onPlay={() => play(track, tracks)}
                      onToggleLike={() => toggleLike(track)}
                      track={track}
                    />
                  </TrackContextMenu>
                );
              }}
            />
          </section>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No tracks found for this mix.</p>
        )}
      </motion.div>
    </PageTransition>
  );
}
