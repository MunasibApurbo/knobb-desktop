import { useNavigate } from "react-router-dom";
import { memo, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { Heart, Play } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { usePlayerCommands, usePlayerCurrentTrack } from "@/contexts/PlayerContext";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { ArtistsLink } from "@/components/ArtistsLink";
import { AlbumLink } from "@/components/AlbumLink";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistCard } from "@/components/ArtistCard";
import { MediaCardShell } from "@/components/MediaCardShell";
import { MediaCardArtworkBackdrop } from "@/components/media-card";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { Track } from "@/types/music";
import { HomeAlbum, HomeArtist } from "@/hooks/useHomeFeeds";
import {
  MEDIA_CARD_ACTION_ICON_CLASS,
  MEDIA_CARD_ARTWORK_CLASS,
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_FAVORITE_BUTTON_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_PLAY_BUTTON_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";
import {
  getControlHover,
  getControlTap,
  getMotionProfile,
} from "@/lib/motion";
import { filterAudioTracks, getPlaylistWithTracks } from "@/lib/musicApi";
import { getTrackPlaybackIssue, isTrackPlayable } from "@/lib/trackPlayback";
import { isSameTrack } from "@/lib/trackIdentity";
import { tidalTrackToAppTrack } from "@/lib/musicApiTransforms";
import { buildAlbumPath, buildPlaylistPath, type PlaylistRouteKind } from "@/lib/mediaNavigation";
import { preloadRouteModule } from "@/lib/routePreload";

type InlineArtist = { id?: number | string; name: string; source?: "tidal" | "youtube-music" | "local" };
const LIGHTWEIGHT_CONTROL_CLASS = "bg-black/42 shadow-lg backdrop-blur-0";

export const TrackCard = memo(function TrackCard({
  track,
  tracks,
  liked,
  onToggleLike,
  isPriority,
  lightweight = false,
}: {
  track: Track;
  tracks: Track[];
  liked: boolean;
  onToggleLike: () => void;
  isPriority?: boolean;
  lightweight?: boolean;
}) {
  const { play, warmTrackPlayback } = usePlayerCommands();
  const currentTrack = usePlayerCurrentTrack();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const controlHover = lightweight ? undefined : getControlHover(motionEnabled, websiteMode);
  const controlTap = lightweight ? undefined : getControlTap(motionEnabled, websiteMode);
  const controlTransition = lightweight ? undefined : motionProfile.spring.control;
  const isCurrent = isSameTrack(currentTrack, track);
  const playbackIssue = getTrackPlaybackIssue(track);
  const playable = isTrackPlayable(track);
  const warmPlayback = () => {
    if (!playable) return;
    warmTrackPlayback(track);
  };
  const trackArtists: InlineArtist[] =
    track.artists && track.artists.length > 0
      ? track.artists.map((artist) => ({ id: artist.id, name: artist.name, source: track.source }))
      : track.artist
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name, source: track.source }));

  const cardContent = (
    <MediaCardShell
      onClick={() => {
        if (!playable) return;
        play(track, tracks);
      }}
      onMouseEnter={warmPlayback}
      onFocus={warmPlayback}
      onPointerDown={warmPlayback}
      className={playable ? "" : "cursor-not-allowed opacity-70 hover:bg-white/[0.01]"}
      aria-disabled={!playable}
      disableDepthMotion={lightweight}
      hoverProfile={lightweight ? "static" : "auto"}
    >
      <div className="relative aspect-square w-full overflow-hidden shadow-sm">
        <img
          src={track.coverUrl}
          alt={track.title}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className={MEDIA_CARD_ARTWORK_CLASS}
        />
        <motion.button
          type="button"
          className={`${MEDIA_CARD_PLAY_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!playable) return;
            play(track, tracks);
          }}
          onMouseEnter={warmPlayback}
          onFocus={warmPlayback}
          onPointerDown={warmPlayback}
          aria-label={playable ? `Play ${track.title}` : `${track.title} is unavailable`}
          disabled={!playable}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
        </motion.button>
        <motion.button
          type="button"
          className={`${MEDIA_CARD_FAVORITE_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleLike();
          }}
          aria-label={liked ? "Remove from liked songs" : "Add to liked songs"}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${liked ? "fill-current" : ""}`} />
        </motion.button>
      </div>
      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <MediaCardArtworkBackdrop artworkUrl={track.coverUrl} isPriority={isPriority} />
        <p
          className={`${MEDIA_CARD_TITLE_CLASS} truncate ${isCurrent ? "font-semibold" : ""}`}
          style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}
        >
          {track.title}
        </p>
        <div className={MEDIA_CARD_META_CLASS}>
          <ArtistsLink
            artists={trackArtists}
            source={track.source}
            className={`${MEDIA_CARD_META_CLASS} block truncate`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        {playbackIssue || track.isVideo === true ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
            {playbackIssue ? "Unavailable" : "Music Video"}
          </p>
        ) : null}
      </div>
    </MediaCardShell>
  );

  return (
    <TrackContextMenu track={track} tracks={tracks}>
      {cardContent}
    </TrackContextMenu>
  );
});

export const ArtistCardWrapper = memo(function ArtistCardWrapper({
  artist,
  isPriority,
  lightweight = false,
}: {
  artist: HomeArtist;
  isPriority?: boolean;
  lightweight?: boolean;
}) {
  return (
    <ArtistCard
      id={artist.id}
      name={artist.name}
      imageUrl={artist.imageUrl}
      source={artist.source}
      isPriority={isPriority}
      lightweight={lightweight}
    />
  );
});

export const HomeAlbumCard = memo(function HomeAlbumCard({
  album,
  saved,
  onToggleSave,
  isPriority,
  lightweight = false,
}: {
  album: HomeAlbum;
  saved: boolean;
  onToggleSave: () => void;
  isPriority?: boolean;
  lightweight?: boolean;
}) {
  const navigate = useNavigate();
  const { playAlbum } = usePlayerCommands();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const controlHover = lightweight ? undefined : getControlHover(motionEnabled, websiteMode);
  const controlTap = lightweight ? undefined : getControlTap(motionEnabled, websiteMode);
  const controlTransition = lightweight ? undefined : motionProfile.spring.control;
  const albumPath = buildAlbumPath({
    albumId: album.id,
    title: album.title,
    artistName: album.artist || "",
    source: album.source === "youtube-music" ? "youtube-music" : "tidal",
  });
  const preloadAlbumRoute = () => void preloadRouteModule(albumPath);
  const albumArtists: InlineArtist[] = album.artist
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: index === 0 ? album.artistId : undefined, name, source: album.source }));

  const cardContent = (
    <MediaCardShell
      onClick={() => {
        preloadAlbumRoute();
        navigate(albumPath);
      }}
      onMouseEnter={preloadAlbumRoute}
      onFocus={preloadAlbumRoute}
      onPointerDown={preloadAlbumRoute}
      disableDepthMotion={lightweight}
      hoverProfile={lightweight ? "static" : "auto"}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
        <img
          src={album.coverUrl || "/placeholder.svg"}
          alt={album.title}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className={MEDIA_CARD_ARTWORK_CLASS}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        <motion.button
          type="button"
          className={`${MEDIA_CARD_PLAY_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            playAlbum({
              id: album.id,
              title: album.title,
              artist: { name: album.artist || "Various Artists" },
            });
          }}
          aria-label={`Play ${album.title}`}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
        </motion.button>
        <motion.button
          type="button"
          className={`${MEDIA_CARD_FAVORITE_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSave();
          }}
          aria-label={saved ? "Remove saved album" : "Save album"}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${saved ? "fill-current" : ""}`} />
        </motion.button>
      </div>
      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <MediaCardArtworkBackdrop
          artworkUrl={album.coverUrl || "/placeholder.svg"}
          isPriority={isPriority}
        />
        <AlbumLink
          title={album.title}
          albumId={album.id}
          artistName={album.artist}
          source={album.source}
          className={`${MEDIA_CARD_TITLE_CLASS} block truncate font-medium`}
        />
        <ArtistsLink
          artists={albumArtists}
          source={album.source}
          className={`${MEDIA_CARD_META_CLASS} block truncate underline-offset-2 hover:underline`}
        />
      </div>
    </MediaCardShell>
  );

  return (
    <AlbumContextMenu
      albumId={album.id}
      title={album.title}
      artist={album.artist}
      artistId={album.artistId}
      coverUrl={album.coverUrl}
    >
      {cardContent}
    </AlbumContextMenu>
  );
});

export const PlaylistCard = memo(function PlaylistCard({
  playlistId,
  title,
  coverUrl,
  trackCount,
  kind = "tidal",
  shareToken,
  tracks,
  isPriority,
  lightweight = false,
}: {
  playlistId?: string | number;
  title: string;
  coverUrl: string;
  trackCount: number;
  kind?: PlaylistRouteKind;
  shareToken?: string;
  tracks?: Track[];
  isPriority?: boolean;
  lightweight?: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play } = usePlayerCommands();
  const { isFavoritePlaylist, toggleFavoritePlaylist } = useFavoritePlaylists();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const controlHover = lightweight ? undefined : getControlHover(motionEnabled, websiteMode);
  const controlTap = lightweight ? undefined : getControlTap(motionEnabled, websiteMode);
  const controlTransition = lightweight ? undefined : motionProfile.spring.control;
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const favoriteSource =
    kind === "user" || kind === "shared"
      ? "local"
      : kind === "tidal"
        ? "tidal"
        : null;
  const canToggleLibrary = favoriteSource !== null && playlistId !== undefined;
  const isSaved = canToggleLibrary
    ? isFavoritePlaylist(String(playlistId), favoriteSource || undefined)
    : false;
  const canPlay = (tracks?.length || 0) > 0 || (kind === "tidal" && playlistId !== undefined);
  const targetPath =
    buildPlaylistPath({ kind, playlistId, shareToken }) ?? `/search?q=${encodeURIComponent(title)}`;
  const preloadPlaylistRoute = () => void preloadRouteModule(targetPath);

  const handleOpen = () => {
    preloadPlaylistRoute();
    navigate(targetPath);
  };

  const handlePlay = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (tracks && tracks.length > 0) {
      play(tracks[0], tracks);
      return;
    }

    if (!canPlay || playlistId === undefined) return;

    setLoadingPlayback(true);
    try {
      const playlistTracks = filterAudioTracks(
        (await getPlaylistWithTracks(String(playlistId).replace(/^tidal-/, ""))).tracks.map((track, index) => ({
          ...tidalTrackToAppTrack(track),
          id: `tidal-${track.id}-${index}`,
        })),
      );

      if (playlistTracks.length === 0) {
        toast.error("No playable tracks found in this playlist");
        return;
      }

      play(playlistTracks[0], playlistTracks);
    } catch (error) {
      console.error("Failed to load playlist playback", error);
      toast.error("Failed to load playlist");
    } finally {
      setLoadingPlayback(false);
    }
  };

  const handleToggleSave = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canToggleLibrary || isSaving || playlistId === undefined) return;
    const source = favoriteSource;
    if (!source) return;

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    setIsSaving(true);
    const success = await toggleFavoritePlaylist({
      source,
      playlistId: String(playlistId),
      playlistTitle: title,
      playlistCoverUrl: coverUrl || null,
    });
    setIsSaving(false);

    if (!success) {
      toast.error("Failed to update playlist library");
      return;
    }

    toast.success(
      isSaved
        ? `Removed ${title} from your library`
        : `Saved ${title} to your library`,
    );
  };

  const cardContent = (
    <MediaCardShell
      onClick={handleOpen}
      onMouseEnter={preloadPlaylistRoute}
      onFocus={preloadPlaylistRoute}
      onPointerDown={preloadPlaylistRoute}
      disableDepthMotion={lightweight}
      hoverProfile={lightweight ? "static" : "auto"}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
        <img
          src={coverUrl || "/placeholder.svg"}
          alt={title}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className={MEDIA_CARD_ARTWORK_CLASS}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        <motion.button
          type="button"
          className={`${MEDIA_CARD_PLAY_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          onClick={(event) => {
            void handlePlay(event);
          }}
          aria-label={canPlay ? `Play ${title}` : `Open ${title}`}
          disabled={!canPlay || loadingPlayback}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
        </motion.button>
        {canToggleLibrary ? (
          <motion.button
            type="button"
            className={`${MEDIA_CARD_FAVORITE_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
            onClick={(event) => {
              void handleToggleSave(event);
            }}
            aria-label={isSaved ? "Remove from saved playlists" : "Save playlist"}
            disabled={isSaving}
            whileHover={controlHover}
            whileTap={controlTap}
            transition={controlTransition}
          >
            <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${isSaved ? "fill-current" : ""}`} />
          </motion.button>
        ) : null}
      </div>
      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <MediaCardArtworkBackdrop artworkUrl={coverUrl || "/placeholder.svg"} isPriority={isPriority} />
        <p className={`${MEDIA_CARD_TITLE_CLASS} truncate font-medium`}>{title}</p>
        <p className={`${MEDIA_CARD_META_CLASS} truncate`}>
          Playlist · {trackCount} track{trackCount === 1 ? "" : "s"}
        </p>
      </div>
    </MediaCardShell>
  );

  return (
    <PlaylistContextMenu
      title={title}
      playlistId={playlistId}
      shareToken={shareToken}
      coverUrl={coverUrl}
      kind={kind}
      tracks={tracks}
    >
      {cardContent}
    </PlaylistContextMenu>
  );
});
