import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Track } from "@/types/music";
import { getTotalDuration } from "@/lib/utils";
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
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArtistsLink } from "@/components/ArtistsLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { downloadTracks } from "@/lib/downloadHelpers";
import { copyPlainTextToClipboard, getTrackShareIdentifier } from "@/lib/mediaNavigation";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { getReleaseYear } from "@/lib/releaseDates";
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

export default function AlbumPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { user } = useAuth();
  const { downloadFormat } = useSettings();
  const isMobile = useIsMobile();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const scrollY = useMainScrollY();
  const fetchedRef = useRef<string>("");
  const sharedTrackScrollRef = useRef<string | null>(null);

  usePageMetadata(albumInfo ? {
    title: `${albumInfo.title} - ${albumInfo.artist}`,
    description: `Stream ${albumInfo.title} by ${albumInfo.artist} on Knobb.${tracks.length > 0 ? ` ${tracks.length} tracks ready to play.` : ""}`,
    image: albumInfo.coverUrl || undefined,
    imageAlt: `${albumInfo.title} album cover`,
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
    setLoading(true);

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
      } finally {
        setLoading(false);
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

  if (loading) return <LoadingSkeleton variant="detail" />;

  if (error || !albumInfo) {
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

  const isCurrentAlbum = currentTrack && tracks.some((t) => t.id === currentTrack.id);
  const albumIsSaved = tidalAlbumId ? isSaved(tidalAlbumId) : false;

  const handleShareAlbum = async () => {
    const url = window.location.href;
    await copyPlainTextToClipboard(url);
    toast.success("Album link copied to clipboard");
  };

  const handleToggleSavedAlbum = async () => {
    if (!tidalAlbumId) return;
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
  };

  const handleDownloadAlbum = async () => {
    if (tracks.length === 0 || isDownloading) return;
    const confirmed = window.confirm(`Download all ${tracks.length} tracks from "${albumInfo.title}"?`);
    if (!confirmed) return;

    setIsDownloading(true);
    toast.info(`Downloading ${albumInfo.title}...`);

    const quality = downloadFormat === "flac" ? "LOSSLESS" : "HIGH";
    const result = await downloadTracks(tracks, quality);

    setIsDownloading(false);

    if (result.successCount === result.total) {
      toast.success(`Downloaded ${albumInfo.title}`);
      return;
    }

    if (result.successCount > 0) {
      toast.warning(`Downloaded ${result.successCount} of ${result.total} tracks from ${albumInfo.title}`);
      return;
    }

    toast.error(`Failed to download ${albumInfo.title}`);
  };

  if (isMobile) {
    return (
      <PageTransition>
        <MobileExperiencePage artworkUrl={albumInfo.coverUrl} accentColor={albumInfo.canvasColor}>
          <MobileHero
            artworkUrl={albumInfo.coverUrl || "/placeholder.svg"}
            artworkAlt={albumInfo.title}
            accentColor={albumInfo.canvasColor}
            eyebrow="Album"
            title={albumInfo.title}
            description={(
              <ArtistsLink
                name={albumInfo.artist}
                artists={[{ id: albumInfo.artistId, name: albumInfo.artist }]}
                className="text-sm font-semibold text-white/84 hover:text-white hover:underline"
              />
            )}
            meta={(
              <>
                <MobileMetaChip label="Tracks" value={tracks.length} />
                {tracks.length > 0 ? <MobileMetaChip label="Runtime" value={getTotalDuration(tracks)} /> : null}
                {albumInfo.year ? <MobileMetaChip label="Year" value={albumInfo.year} /> : null}
              </>
            )}
            actions={(
              <>
                <Button
                  variant="ghost"
                  className={MOBILE_ACTION_BUTTON_CLASS}
                  onClick={() => {
                    if (isCurrentAlbum) togglePlay();
                    else if (tracks.length) play(tracks[0], tracks);
                  }}
                >
                  {isCurrentAlbum && isPlaying ? (
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
                  onClick={() => void handleDownloadAlbum()}
                  disabled={tracks.length === 0 || isDownloading}
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
                <Button
                  variant="ghost"
                  className={MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={handleToggleSavedAlbum}
                >
                  <Heart className={albumIsSaved ? "h-4 w-4 fill-current text-[hsl(var(--player-waveform))]" : "h-4 w-4"} />
                  {albumIsSaved ? "Saved" : "Add"}
                </Button>
              </>
            )}
            footer={(
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/18 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Deep link ready</p>
                  <p className="mt-1 text-sm text-white/72">Share the album or jump to any track.</p>
                </div>
                <Button variant="ghost" className={MOBILE_SECONDARY_BUTTON_CLASS} onClick={handleShareAlbum}>
                  <Share className="h-4 w-4" />
                  Share
                </Button>
              </div>
            )}
          />

          {tracks.length > 0 ? (
            <MobileSection eyebrow={`${tracks.length} tracks`} title="Tracklist" contentClassName="px-0 pb-0">
              <div>
                {tracks.map((track, i) => {
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
                })}
              </div>
            </MobileSection>
          ) : null}
        </MobileExperiencePage>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mobile-page-shell">
        <DetailHero
          accentColor={albumInfo.canvasColor}
          artworkUrl={albumInfo.coverUrl || "/placeholder.svg"}
          dragPayload={tracks.length > 0 ? {
            label: albumInfo.title,
            source: "album",
            tracks,
          } : undefined}
          label="Album"
          scrollY={scrollY}
          title={albumInfo.title}
          body={(
            <div className="flex items-center gap-2">
              <ArtistsLink
                name={albumInfo.artist}
                artists={[{ id: albumInfo.artistId, name: albumInfo.artist }]}
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
              {albumInfo.year ? (
                <span className="detail-chip">
                  <span>Year</span>
                  <strong>{albumInfo.year}</strong>
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
          <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.02]">
            <div>
              {tracks.map((track, i) => {
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
              })}
            </div>
          </section>
        )}
      </motion.div>
    </PageTransition>
  );
}
