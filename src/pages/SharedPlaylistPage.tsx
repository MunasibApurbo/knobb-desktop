import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { Track } from "@/types/music";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { PlaylistDragAction } from "@/components/PlaylistDragAction";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { Button } from "@/components/ui/button";
import { Loader2, Music, Play, Pause, Download, ExternalLink } from "lucide-react";
import { PlaylistShareDropdownButton } from "@/components/PlaylistShareDropdownButton";
import { downloadTracks } from "@/lib/downloadHelpers";
import { formatDuration, getTotalDuration } from "@/lib/utils";
import { toast } from "sonner";
import { PlaylistLink } from "@/components/PlaylistLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { APP_HOME_PATH } from "@/lib/routes";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";

type SharedPlaylist = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  visibility: string;
};

export default function SharedPlaylistPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const isEmbedMode = useEmbedMode();
  const { downloadFormat } = useSettings();
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<SharedPlaylist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  usePageMetadata(playlist ? {
    title: playlist.name,
    description:
      playlist.description?.trim() ||
      `Open the shared playlist ${playlist.name} on Knobb.${tracks.length > 0 ? ` ${tracks.length} tracks available.` : ""}`,
    image: playlist.cover_url || tracks[0]?.coverUrl || undefined,
    imageAlt: `${playlist.name} playlist cover`,
    robots: isEmbedMode ? "noindex, nofollow" : undefined,
    type: "music.playlist",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: playlist.name,
      numTracks: tracks.length || undefined,
      image: playlist.cover_url || tracks[0]?.coverUrl || undefined,
      description: playlist.description?.trim() || `Shared playlist on Knobb.`,
      url:
        typeof window !== "undefined"
          ? new URL(window.location.pathname, window.location.origin).toString()
          : undefined,
    },
  } : null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data: playlistRows, error: playlistError } = await supabase.rpc(
        "get_shared_playlist_by_token",
        {
          target_token: token,
        }
      );

      if (playlistError || !playlistRows || playlistRows.length === 0) {
        console.error("Failed to load shared playlist", playlistError);
        setPlaylist(null);
        setTracks([]);
        setLoading(false);
        return;
      }

      const row = playlistRows[0];
      setPlaylist({
        id: row.id,
        name: row.name,
        description: row.description,
        cover_url: row.cover_url,
        visibility: row.visibility,
      });

      const { data: trackRows, error: tracksError } = await supabase.rpc(
        "get_shared_playlist_tracks_by_token",
        {
          target_token: token,
        }
      );

      if (tracksError) {
        console.error("Failed to load shared playlist tracks", tracksError);
        setTracks([]);
      } else {
        setTracks((trackRows || []).map((item) => item.track_data as unknown as Track));
      }
      setLoading(false);
    };

    void load();
  }, [token]);

  const cover = playlist?.cover_url || tracks[0]?.coverUrl || "/placeholder.svg";
  const isCurrentPlaylist = useMemo(
    () => !!currentTrack && tracks.some((track) => track.id === currentTrack.id),
    [currentTrack, tracks]
  );

  const handlePlay = () => {
    if (tracks.length === 0) return;
    if (isCurrentPlaylist) {
      togglePlay();
      return;
    }
    play(tracks[0], tracks);
  };

  const handleDownloadPlaylist = async () => {
    if (!playlist || tracks.length === 0 || isDownloading) return;
    const confirmed = window.confirm(`Download all ${tracks.length} tracks from "${playlist.name}"?`);
    if (!confirmed) return;

    setIsDownloading(true);
    toast.info(`Downloading ${playlist.name}...`);

    const quality = downloadFormat === "flac" ? "LOSSLESS" : "HIGH";
    const result = await downloadTracks(tracks, quality);

    setIsDownloading(false);

    if (result.successCount === result.total) {
      toast.success(`Downloaded ${playlist.name}`);
      return;
    }

    if (result.successCount > 0) {
      toast.warning(`Downloaded ${result.successCount} of ${result.total} tracks from ${playlist.name}`);
      return;
    }

    toast.error(`Failed to download ${playlist.name}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center py-20 space-y-4">
        <Music className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Shared playlist unavailable</p>
        <Button variant="outline" onClick={() => navigate(APP_HOME_PATH)}>
          Go Home
        </Button>
      </div>
    );
  }

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
            <img src={cover} alt={playlist.name} className="aspect-square w-full rounded-[22px] object-cover" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Shared Playlist</p>
              <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-white">{playlist.name}</h1>
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
                  onClick={handlePlay}
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

  return (
    <div className="mobile-page-shell">
      <DetailHero
        artworkUrl={cover}
        dragPayload={tracks.length > 0 ? {
          label: playlist.name,
          source: "playlist",
          tracks,
        } : undefined}
        label="Shared Playlist"
        title={(
          <PlaylistLink
            title={playlist.name}
            kind="shared"
            shareToken={token}
            className="text-inherit"
          />
        )}
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

      <DetailActionBar columns={4}>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={handlePlay}
          disabled={tracks.length === 0}
        >
          {isCurrentPlaylist && isPlaying ? (
            <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
          ) : (
            <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
          )}
          <span className="hero-action-label">Play</span>
        </Button>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={() => void handleDownloadPlaylist()}
          disabled={tracks.length === 0 || isDownloading}
        >
          <Download className="hero-action-icon w-4 h-4 mr-2" />
          <span className="hero-action-label">{isDownloading ? "Downloading..." : "Download"}</span>
        </Button>
        <PlaylistShareDropdownButton
          title={playlist.name}
          kind="shared"
          shareToken={token}
          visibility={playlist.visibility === "public" ? "public" : "shared"}
          className={DETAIL_ACTION_BUTTON_CLASS}
          labelClassName="hero-action-label"
        />
        <PlaylistDragAction
          disabled={tracks.length === 0}
          payload={{
            label: playlist.name,
            source: "playlist",
            tracks,
          }}
        />
      </DetailActionBar>

      <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.02]">
        {tracks.map((track, index) => {
          const isCurrent = isSameTrack(currentTrack, track);
          return (
            <TrackContextMenu key={`${track.id}-${index}`} track={track} tracks={tracks}>
              <TrackListRow
                dragHandleLabel={`Drag ${track.title} to a playlist`}
                index={index}
                isCurrent={isCurrent}
                isPlaying={isCurrentPlaylist && isPlaying}
                onDragHandleStart={(event) => {
                  startPlaylistDrag(event.dataTransfer, {
                    label: track.title,
                    source: "track",
                    tracks: [track],
                  });
                }}
                onPlay={() => play(track, tracks)}
                track={track}
                trailingContent={formatDuration(track.duration)}
              />
            </TrackContextMenu>
          );
        })}
      </section>
    </div>
  );
}
