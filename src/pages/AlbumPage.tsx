import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Track } from "@/types/music";
import { getTotalDuration, cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { filterAudioTracks, getAlbumWithTracks, searchAlbumTracksByName, getTidalImageUrl, tidalTrackToAppTrack, hexToHsl } from "@/lib/musicApi";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { Play, Pause, Shuffle, Heart, AlertCircle, RefreshCw, Share, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistsLink } from "@/components/ArtistsLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { downloadTracks } from "@/lib/downloadHelpers";
import { copyPlainTextToClipboard, getTrackShareIdentifier } from "@/lib/mediaNavigation";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { getReleaseYear } from "@/lib/releaseDates";
import { isSameTrack } from "@/lib/trackIdentity";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";

export default function AlbumPage() {
  const { setActiveScope } = useTrackSelectionShortcutsContext();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { user } = useAuth();
  const { downloadFormat } = useSettings();
  const { isSaved, toggleSavedAlbum } = useSavedAlbums();
  const { isLiked, toggleLike } = useLikedSongs();

  const urlTitle = searchParams.get("title") || "";
  const urlArtist = searchParams.get("artist") || "";
  const sharedTrackId = searchParams.get("trackId");
  const tidalAlbumId = id ? parseInt(id.replace("tidal-", "")) : null;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [albumInfo, setAlbumInfo] = useState<{
    title: string;
    artist: string;
    artistId?: number;
    coverUrl: string;
    year: number | null;
    canvasColor: string;
  } | null>(null);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fetchedRef = useRef<string>("");
  const sharedTrackScrollRef = useRef<string | null>(null);
  const isCurrentAlbum = currentTrack ? tracks.some((track) => isSameTrack(currentTrack, track)) : false;
  const albumIsSaved = tidalAlbumId ? isSaved(tidalAlbumId) : false;

  usePageMetadata(albumInfo ? {
    title: `${albumInfo.title} | Listen on Knobb`,
    description: `Listen to ${albumInfo.title} by ${albumInfo.artist} on Knobb. ${tracks.length > 0 ? `${tracks.length} tracks ready to play.` : ""} High-quality audio discovery and archives.`,
    image: albumInfo.coverUrl || undefined,
    imageAlt: `${albumInfo.title} album cover`,
    twitterCard: "summary",
    type: "music.album",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: albumInfo.title,
      byArtist: {
        "@type": "MusicGroup",
        name: albumInfo.artist,
      },
      datePublished: albumInfo.year ? String(albumInfo.year) : undefined,
      image: albumInfo.coverUrl || undefined,
      numTracks: tracks.length || undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      description: `Stream ${albumInfo.title} by ${albumInfo.artist} on Knobb.`,
    },
  } : null);

  const loadAlbum = useCallback(() => {
    if (!tidalAlbumId || !id) return;
    fetchedRef.current = id;
    setError(false);

    (async () => {
      try {
        const { album, tracks: albumTracks } = await getAlbumWithTracks(tidalAlbumId);

        const knownTitle = album?.title || urlTitle;
        const knownArtist = album?.artists?.map((a) => a.name).join(", ")
          || album?.artist?.name
          || urlArtist;

        let finalTracks = albumTracks;
        if (finalTracks.length === 0 && knownTitle) {
          finalTracks = await searchAlbumTracksByName(knownTitle, knownArtist);
        }

        const appTracks = filterAudioTracks(finalTracks.map(t => tidalTrackToAppTrack(t)));
        setTracks(appTracks);

        const title = album?.title || urlTitle || finalTracks[0]?.album?.title || "Unknown Album";
        const artist = knownArtist
          || finalTracks[0]?.artists?.map((a) => a.name).join(", ")
          || finalTracks[0]?.artist?.name
          || "Unknown";
        const artistId = album?.artist?.id || finalTracks[0]?.artist?.id;
        const cover = album?.cover || finalTracks[0]?.album?.cover || "";
        const year = getReleaseYear(album?.releaseDate, appTracks[0]?.year) || null;
        const color = album?.vibrantColor ? hexToHsl(album.vibrantColor) : appTracks[0]?.canvasColor || "220 70% 55%";

        setAlbumInfo({
          title,
          artist,
          artistId,
          coverUrl: getTidalImageUrl(cover, "750x750"),
          year,
          canvasColor: color,
        });
      } catch (e) {
        console.error("Failed to load album:", e);
        setError(true);
      }
    })();
  }, [id, tidalAlbumId, urlArtist, urlTitle]);

  useEffect(() => {
    if (fetchedRef.current !== id) loadAlbum();
  }, [id, loadAlbum]);

  useEffect(() => {
    if (!sharedTrackId || tracks.length === 0 || sharedTrackScrollRef.current === sharedTrackId) return;

    const target = document.getElementById(`track-${sharedTrackId}`);
    if (!target) return;

    sharedTrackScrollRef.current = sharedTrackId;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [sharedTrackId, tracks]);

  const handleShareAlbum = useCallback(async () => {
    const url = window.location.href;
    await copyPlainTextToClipboard(url);
    toast.success("Album link copied to clipboard");
  }, []);

  const handleToggleSavedAlbum = useCallback(async () => {
    if (!tidalAlbumId || !albumInfo) return;
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const success = await toggleSavedAlbum({
      albumId: tidalAlbumId,
      albumTitle: albumInfo.title,
      albumArtist: albumInfo.artist,
      albumCoverUrl: albumInfo.coverUrl || tracks[0]?.coverUrl || null,
      albumYear: albumInfo.year || null,
    });

    if (!success) {
      toast.error("Failed to update album library");
      return;
    }

    toast.success(
      albumIsSaved
        ? `Removed ${albumInfo.title} from your library`
        : `Saved ${albumInfo.title} to your library`
    );
  }, [albumInfo, albumIsSaved, navigate, tidalAlbumId, toggleSavedAlbum, tracks, user]);

  const handleDownloadAlbum = useCallback(async () => {
    if (!albumInfo || tracks.length === 0 || isDownloading) return;
    const confirmed = window.confirm(`Download all ${tracks.length} tracks from "${albumInfo.title}"?`);
    if (!confirmed) return;

    setIsDownloading(true);
    toast.info(`Downloading ${albumInfo.title}...`);

    try {
      const quality = downloadFormat === "flac" ? "LOSSLESS" : "HIGH";
      const result = await downloadTracks(tracks, quality);

      if (result.successCount === result.total) {
        toast.success(`Downloaded ${albumInfo.title}`);
        return;
      }

      if (result.successCount > 0) {
        toast.warning(`Downloaded ${result.successCount} of ${result.total} tracks from ${albumInfo.title}`);
        return;
      }

      toast.error(`Failed to download ${albumInfo.title}`);
    } finally {
      setIsDownloading(false);
    }
  }, [albumInfo, downloadFormat, isDownloading, tracks]);

  const albumShortcutScope = useMemo(() => (
    !albumInfo
      ? null
      : {
          id: `album:${tidalAlbumId ?? albumInfo.title}`,
          selectedCount: 0,
          selectAll: () => undefined,
          clearSelection: () => undefined,
          deleteSelection: () => undefined,
          collectionActions: {
            download: () => void handleDownloadAlbum(),
            play: () => {
              if (isCurrentAlbum) {
                togglePlay();
                return;
              }
              if (tracks.length > 0) {
                play(tracks[0], tracks);
              }
            },
            share: () => void handleShareAlbum(),
            shuffle: () => {
              if (tracks.length === 0) return;
              const shuffled = [...tracks].sort(() => Math.random() - 0.5);
              play(shuffled[0], shuffled);
            },
            toggleSaved: () => void handleToggleSavedAlbum(),
          },
        }
  ), [
    albumInfo,
    handleDownloadAlbum,
    handleShareAlbum,
    handleToggleSavedAlbum,
    isCurrentAlbum,
    play,
    tidalAlbumId,
    togglePlay,
    tracks,
  ]);

  useEffect(() => {
    if (!albumShortcutScope) {
      setActiveScope(null);
      return;
    }

    setActiveScope(albumShortcutScope);

    return () => {
      setActiveScope(null);
    };
  }, [albumShortcutScope, setActiveScope]);

  const activateAlbumShortcutScope = useCallback(() => {
    if (!albumShortcutScope) return;
    setActiveScope(albumShortcutScope);
  }, [albumShortcutScope, setActiveScope]);

  if (error && !albumInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg font-medium">Failed to load album</p>
        <Button variant="outline" onClick={loadAlbum} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    );
  }

  const resolvedAlbumInfo = albumInfo ?? {
    title: urlTitle || "Album",
    artist: urlArtist || "Unknown Artist",
    artistId: undefined,
    coverUrl: tracks[0]?.coverUrl || "/placeholder.svg",
    year: null,
    canvasColor: tracks[0]?.canvasColor || "220 70% 55%",
  };

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="page-shell"
        onFocusCapture={activateAlbumShortcutScope}
        onPointerDownCapture={activateAlbumShortcutScope}
      >
        <DetailHero
          accentColor={resolvedAlbumInfo.canvasColor}
          artworkUrl={resolvedAlbumInfo.coverUrl || "/placeholder.svg"}
          className="album-detail-hero"
          artworkWrapper={(artwork) => (
            <AlbumContextMenu
              albumId={resolvedAlbumInfo.id}
              title={resolvedAlbumInfo.title}
              artist={resolvedAlbumInfo.artist}
              artistId={resolvedAlbumInfo.artistId}
              coverUrl={resolvedAlbumInfo.coverUrl}
              year={resolvedAlbumInfo.year}
            >
              {artwork}
            </AlbumContextMenu>
          )}
          dragPayload={tracks.length > 0 ? {
            label: resolvedAlbumInfo.title,
            source: "album",
            tracks,
          } : undefined}
          label="Album"
          title={resolvedAlbumInfo.title}
          body={(
            <div className="flex items-center gap-2">
              <ArtistsLink
                name={resolvedAlbumInfo.artist}
                artists={[{ id: resolvedAlbumInfo.artistId, name: resolvedAlbumInfo.artist }]}
                className="text-sm font-semibold text-foreground/90 hover:underline"
              />
            </div>
          )}
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
              {resolvedAlbumInfo.year ? (
                <span className="detail-chip">
                  <span>Year</span>
                  <strong>{resolvedAlbumInfo.year}</strong>
                </span>
              ) : null}
            </>
          }
        />

        <DetailActionBar columns={5}>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isCurrentAlbum) togglePlay();
              else if (tracks.length) play(tracks[0], tracks);
            }}
          >
            {isCurrentAlbum && isPlaying ? (
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
            onClick={() => void handleDownloadAlbum()}
            disabled={tracks.length === 0 || isDownloading}
          >
            <Download className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">{isDownloading ? "Downloading..." : "Download"}</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleToggleSavedAlbum}>
            <Heart className={`hero-action-icon w-4 h-4 mr-2 ${albumIsSaved ? "fill-current text-[hsl(var(--player-waveform))] group-hover:text-[hsl(var(--dynamic-accent-foreground))]" : ""}`} />
            <span className="hero-action-label relative z-10">{albumIsSaved ? "Saved" : "Add"}</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleShareAlbum}>
            <Share className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Share</span>
          </Button>
        </DetailActionBar>

        {tracks.length > 0 && (
          <section className={cn("page-panel overflow-hidden border border-white/10", PANEL_SURFACE_CLASS)}>
            <VirtualizedTrackList
              items={tracks}
              getItemKey={(track) => track.id}
              rowHeight={86}
              className="content-visibility-list"
              renderRow={(track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);
                const trackShareId = getTrackShareIdentifier(track);
                const isSharedTrack = sharedTrackId !== null && sharedTrackId === trackShareId;
                return (
                  <TrackContextMenu key={track.id} track={track} tracks={tracks}>
                    <TrackListRow
                      id={trackShareId ? `track-${trackShareId}` : undefined}
                      className={isSharedTrack && !isCurrent ? "bg-[hsl(var(--player-waveform)/0.1)]" : undefined}
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
      </motion.div>
    </PageTransition>
  );
}
