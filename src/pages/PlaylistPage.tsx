import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { getTotalDuration, formatDuration } from "@/lib/utils";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { PlaylistDragAction } from "@/components/PlaylistDragAction";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { Play, Pause, Shuffle, Heart, AlertCircle, RefreshCw, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { motion } from "framer-motion";
import { PlaylistShareDropdownButton } from "@/components/PlaylistShareDropdownButton";
import { filterAudioTracks, getPlaylistWithTracks, getTidalImageUrl, tidalTrackToAppTrack } from "@/lib/musicApi";
import { Track } from "@/types/music";
import { toast } from "sonner";
import { PlaylistLink } from "@/components/PlaylistLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { downloadTracks } from "@/lib/downloadHelpers";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MOBILE_ACTION_BUTTON_CLASS,
  MOBILE_SECONDARY_BUTTON_CLASS,
  MobileExperiencePage,
  MobileHero,
  MobileMetaChip,
  MobileSection,
} from "@/components/mobile/MobileExperienceLayout";

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const isEmbedMode = useEmbedMode();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { downloadFormat } = useSettings();
  const { isFavoritePlaylist, toggleFavoritePlaylist } = useFavoritePlaylists();
  const [playlist, setPlaylist] = useState<{
    title: string;
    description: string;
    coverUrl: string;
  } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const scrollY = useMainScrollY();
  const fetchedRef = useRef<string>("");
  const playlistId = id ? id.replace(/^tidal-/, "") : "";

  usePageMetadata(playlist ? {
    title: playlist.title,
    description:
      playlist.description.trim() ||
      `Play ${playlist.title} on Knobb.${tracks.length > 0 ? ` ${tracks.length} tracks in the playlist.` : ""}`,
    image: playlist.coverUrl || undefined,
    imageAlt: `${playlist.title} playlist cover`,
    robots: isEmbedMode ? "noindex, nofollow" : undefined,
    type: "music.playlist",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: playlist.title,
      numTracks: tracks.length || undefined,
      image: playlist.coverUrl || undefined,
      description:
        playlist.description.trim() || `Play ${playlist.title} on Knobb.`,
      url: typeof window !== "undefined" ? new URL(window.location.pathname, window.location.origin).toString() : undefined,
    },
  } : null);

  const loadPlaylist = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      const cleanId = id.replace(/^tidal-/, "");
      const { playlist: playlistInfo, tracks: tidalTracks } = await getPlaylistWithTracks(cleanId);

      if (!playlistInfo) {
        setError(true);
        return;
      }

      const coverId = playlistInfo.squareImage || playlistInfo.image || "";
      setPlaylist({
        title: playlistInfo.title,
        description: playlistInfo.description || "",
        coverUrl: getTidalImageUrl(coverId, "750x750"),
      });

      const appTracks = filterAudioTracks(
        tidalTracks.map((track, index) => ({
          ...tidalTrackToAppTrack(track),
          id: `tidal-${track.id}-${index}`,
        })),
      );
      setTracks(appTracks);
    } catch (e) {
      console.error("Failed to load playlist:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || fetchedRef.current === id) return;
    fetchedRef.current = id;
    loadPlaylist();
  }, [id, loadPlaylist]);

  if (loading) return <LoadingSkeleton variant="detail" />;

  if (error || !playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg font-medium">Failed to load playlist</p>
        <Button variant="outline" onClick={loadPlaylist} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    );
  }

  const isCurrentPlaylist = currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const handleToggleFavoritePlaylist = async () => {
    if (!playlist || !playlistId) return;

    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const currentlyFavorite = isFavoritePlaylist(playlistId, "tidal");
    const success = await toggleFavoritePlaylist({
      source: "tidal",
      playlistId,
      playlistTitle: playlist.title,
      playlistCoverUrl: playlist.coverUrl || null,
    });

    if (!success) {
      toast.error("Failed to update playlist library");
      return;
    }

    toast.success(
      currentlyFavorite
        ? `Removed ${playlist.title} from your library`
        : `Saved ${playlist.title} to your library`
    );
  };

  const handleDownloadPlaylist = async () => {
    if (tracks.length === 0 || isDownloading) return;
    const confirmed = window.confirm(`Download all ${tracks.length} tracks from "${playlist.title}"?`);
    if (!confirmed) return;

    setIsDownloading(true);
    toast.info(`Downloading ${playlist.title}...`);

    const quality = downloadFormat === "flac" ? "LOSSLESS" : "HIGH";
    const result = await downloadTracks(tracks, quality);

    setIsDownloading(false);

    if (result.successCount === result.total) {
      toast.success(`Downloaded ${playlist.title}`);
      return;
    }

    if (result.successCount > 0) {
      toast.warning(`Downloaded ${result.successCount} of ${result.total} tracks from ${playlist.title}`);
      return;
    }

    toast.error(`Failed to download ${playlist.title}`);
  };

  const isSavedPlaylist = playlistId ? isFavoritePlaylist(playlistId, "tidal") : false;
  const openFullPlaylist = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  if (isEmbedMode) {
    return (
      <div className="min-h-screen bg-[#050505] p-4 text-white">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
          <div className="grid gap-5 border-b border-white/10 p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-5">
            <img src={playlist.coverUrl || "/placeholder.svg"} alt={playlist.title} className="aspect-square w-full rounded-[22px] object-cover" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Knobb Playlist</p>
              <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-white">{playlist.title}</h1>
              {playlist.description ? (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/68">{playlist.description}</p>
              ) : null}
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                {tracks.length} tracks {tracks.length > 0 ? `• ${getTotalDuration(tracks)}` : ""}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="rounded-full border border-white/10 bg-white text-black hover:bg-white/90"
                  onClick={() => {
                    if (isCurrentPlaylist) togglePlay();
                    else if (tracks.length > 0) play(tracks[0], tracks);
                  }}
                  disabled={tracks.length === 0}
                >
                  {isCurrentPlaylist && isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  {isCurrentPlaylist && isPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.1]"
                  onClick={openFullPlaylist}
                >
                  Open in Knobb
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {tracks.slice(0, 5).map((track, index) => (
              <button
                key={`${track.id}-${index}`}
                className="grid w-full grid-cols-[28px_44px_minmax(0,1fr)_56px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                onClick={() => play(track, tracks)}
              >
                <span className="text-sm text-white/38">{index + 1}</span>
                <img src={track.coverUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                  <p className="truncate text-xs text-white/48">{track.artist}</p>
                </div>
                <span className="text-right text-xs font-mono text-white/45">{formatDuration(track.duration)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (isMobile) {
    return (
      <PageTransition>
        <MobileExperiencePage artworkUrl={playlist.coverUrl}>
          <MobileHero
            artworkUrl={playlist.coverUrl || "/placeholder.svg"}
            artworkAlt={playlist.title}
            eyebrow="Playlist"
            title={<PlaylistLink title={playlist.title} playlistId={playlistId} className="text-inherit" />}
            description={playlist.description ? <p>{playlist.description}</p> : <p>Handpicked sequencing with desktop-complete playback.</p>}
            meta={(
              <>
                <MobileMetaChip label="Tracks" value={tracks.length} />
                {tracks.length > 0 ? <MobileMetaChip label="Runtime" value={getTotalDuration(tracks)} /> : null}
                <MobileMetaChip label="Source" value="TIDAL" />
              </>
            )}
            actions={(
              <>
                <Button
                  variant="ghost"
                  className={MOBILE_ACTION_BUTTON_CLASS}
                  onClick={() => {
                    if (isCurrentPlaylist) togglePlay();
                    else if (tracks.length > 0) play(tracks[0], tracks);
                  }}
                >
                  {isCurrentPlaylist && isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  Play
                </Button>
                <Button
                  variant="ghost"
                  className={MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    if (tracks.length === 0) return;
                    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                    play(shuffled[0], shuffled);
                  }}
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle
                </Button>
                <Button
                  variant="ghost"
                  className={MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={handleToggleFavoritePlaylist}
                >
                  <Heart className={isSavedPlaylist ? "h-4 w-4 fill-current text-[hsl(var(--player-waveform))]" : "h-4 w-4"} />
                  {isSavedPlaylist ? "Saved" : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  className={MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={() => void handleDownloadPlaylist()}
                  disabled={tracks.length === 0 || isDownloading}
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
              </>
            )}
            footer={(
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/18 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Share ready</p>
                  <p className="mt-1 text-sm text-white/72">Open, copy, or drag the playlist like a first-class library object.</p>
                </div>
                <PlaylistShareDropdownButton
                  title={playlist.title}
                  kind="tidal"
                  playlistId={playlistId}
                  className={MOBILE_SECONDARY_BUTTON_CLASS}
                />
              </div>
            )}
          />

          <MobileSection eyebrow={`${tracks.length} tracks`} title="Track Order" contentClassName="px-0 pb-0">
            <VirtualizedTrackList
              items={tracks}
              getItemKey={(track) => track.id}
              rowHeight={86}
              renderRow={(track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);
                return (
                  <TrackContextMenu key={track.id} track={track} tracks={tracks}>
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
                      onPlay={() => play(track, tracks)}
                      onToggleLike={() => toggleLike(track)}
                      track={track}
                    />
                  </TrackContextMenu>
                );
              }}
            />
          </MobileSection>
        </MobileExperiencePage>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mobile-page-shell">
        <DetailHero
          artworkUrl={playlist.coverUrl || "/placeholder.svg"}
          dragPayload={tracks.length > 0 ? {
            label: playlist.title,
            source: "playlist",
            tracks,
          } : undefined}
          label="Playlist"
          scrollY={scrollY}
          title={<PlaylistLink title={playlist.title} playlistId={playlistId} className="text-inherit" />}
          body={playlist.description ? <p>{playlist.description}</p> : undefined}
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

        <DetailActionBar columns={6}>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isCurrentPlaylist) togglePlay();
              else if (tracks.length > 0) play(tracks[0], tracks);
            }}
          >
            {isCurrentPlaylist && isPlaying ? (
              <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            ) : (
              <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            )}
            <span className="hero-action-label relative z-10">Play</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (tracks.length === 0) return;
              const shuffled = [...tracks].sort(() => Math.random() - 0.5);
              play(shuffled[0], shuffled);
            }}
          >
            <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Shuffle</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => void handleDownloadPlaylist()}
            disabled={tracks.length === 0 || isDownloading}
          >
            <Download className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">{isDownloading ? "Downloading..." : "Download"}</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleToggleFavoritePlaylist}>
            <Heart className={`hero-action-icon w-4 h-4 mr-2 ${isSavedPlaylist ? "fill-current" : ""}`} />
            <span className="hero-action-label relative z-10">{isSavedPlaylist ? "Saved" : "Add"}</span>
          </Button>
          <PlaylistShareDropdownButton
            title={playlist.title}
            kind="tidal"
            playlistId={playlistId}
            className={DETAIL_ACTION_BUTTON_CLASS}
          />
          <PlaylistDragAction
            disabled={tracks.length === 0}
            payload={{
              label: playlist.title,
              source: "playlist",
              tracks,
            }}
          />
        </DetailActionBar>

        {tracks.length > 0 && (
          <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.02]">
            <VirtualizedTrackList
              items={tracks}
              getItemKey={(track, index) => `${track.id}-${index}`}
              rowHeight={86}
              renderRow={(track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);
                return (
                  <TrackContextMenu key={`${track.id}-${i}`} track={track} tracks={tracks}>
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
                      onPlay={() => play(track, tracks)}
                      onToggleLike={() => toggleLike(track)}
                      track={track}
                    />
                  </TrackContextMenu>
                );
              }}
            />
          </section>
        )}

        {tracks.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">No tracks found for this playlist.</p>
        )}
      </motion.div>
    </PageTransition>
  );
}
