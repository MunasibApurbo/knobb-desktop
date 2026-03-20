import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { getTotalDuration, formatDuration, cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
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
import { motion } from "framer-motion";
import { PlaylistShareDropdownButton } from "@/components/PlaylistShareDropdownButton";
import { filterAudioTracks, getPlaylistWithTracks, getTidalImageUrl, tidalTrackToAppTrack } from "@/lib/musicApi";
import { Track } from "@/types/music";
import { toast } from "sonner";
import { PlaylistLink } from "@/components/PlaylistLink";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { downloadTracks } from "@/lib/downloadHelpers";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const isEmbedMode = useEmbedMode();
  const { user } = useAuth();
  const { downloadFormat } = useSettings();
  const { isFavoritePlaylist, toggleFavoritePlaylist } = useFavoritePlaylists();
  const [playlist, setPlaylist] = useState<{
    title: string;
    description: string;
    coverUrl: string;
  } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fetchedRef = useRef<string>("");
  const playlistId = id ? id.replace(/^tidal-/, "") : "";

  usePageMetadata(playlist ? {
    title: `${playlist.title} | Listen on Knobb`,
    description:
      playlist.description.trim() ||
      `Listen to ${playlist.title} on Knobb. ${tracks.length > 0 ? `${tracks.length} tracks in the playlist.` : ""} High-quality audio discovery and archives.`,
    image: playlist.coverUrl || undefined,
    imageAlt: `${playlist.title} playlist cover`,
    twitterCard: "summary",
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
    setError(false);

    try {
      const cleanId = id.replace(/^tidal-/, "");
      const { playlist: playlistInfo, tracks: loadedTracks } = await getPlaylistWithTracks(cleanId);

      if (!playlistInfo) {
        setError(true);
        return;
      }

      setPlaylist({
        title: playlistInfo.title,
        description: playlistInfo.description || "",
        coverUrl: getTidalImageUrl(playlistInfo.squareImage || playlistInfo.image || "", "750x750"),
      });

      const appTracks = filterAudioTracks(
        loadedTracks.map((track, index) => ({
          ...tidalTrackToAppTrack(track),
          id: `tidal-${track.id}-${index}`,
        })),
      );
      setTracks(appTracks);
    } catch (e) {
      console.error("Failed to load playlist:", e);
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    if (!id || fetchedRef.current === id) return;
    fetchedRef.current = id;
    loadPlaylist();
  }, [id, loadPlaylist]);

  if (error && !playlist) {
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

  const resolvedPlaylist = playlist ?? {
    title: "Playlist",
    description: "",
    coverUrl: tracks[0]?.coverUrl || "/placeholder.svg",
  };

  const isCurrentPlaylist = currentTrack && tracks.some((t) => isSameTrack(t, currentTrack));

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
            <img src={resolvedPlaylist.coverUrl || "/placeholder.svg"} alt={resolvedPlaylist.title} className="aspect-square w-full rounded-[22px] object-cover" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Knobb Playlist</p>
              <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-white">{resolvedPlaylist.title}</h1>
              {resolvedPlaylist.description ? (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/68">{resolvedPlaylist.description}</p>
              ) : null}
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                {tracks.length} tracks {tracks.length > 0 ? `• ${getTotalDuration(tracks)}` : ""}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="menu-sweep-hover rounded-full border border-white/10 bg-white text-black hover:bg-white/90"
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
                  className="menu-sweep-hover rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.1]"
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
                className="menu-sweep-hover grid w-full grid-cols-[28px_44px_minmax(0,1fr)_56px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
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

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="page-shell">
        <DetailHero
          artworkUrl={resolvedPlaylist.coverUrl || "/placeholder.svg"}
          artworkWrapper={(artwork) => (
            <PlaylistContextMenu
              title={resolvedPlaylist.title}
              playlistId={playlistId}
              coverUrl={resolvedPlaylist.coverUrl}
              kind="tidal"
              tracks={tracks}
            >
              {artwork}
            </PlaylistContextMenu>
          )}
          dragPayload={tracks.length > 0 ? {
            label: resolvedPlaylist.title,
            source: "playlist",
            tracks,
          } : undefined}
          label="Playlist"
          title={<PlaylistLink title={resolvedPlaylist.title} playlistId={playlistId} className="text-inherit" />}
          body={resolvedPlaylist.description ? <p>{resolvedPlaylist.description}</p> : undefined}
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
          <section className={cn("page-panel overflow-hidden border border-white/10", PANEL_SURFACE_CLASS)}>
            <VirtualizedTrackList
              items={tracks}
              getItemKey={(track, index) => `${track.id}-${index}`}
              rowHeight={86}
              className="content-visibility-list"
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
