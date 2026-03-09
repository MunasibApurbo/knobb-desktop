import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Play } from "lucide-react";

import { usePlayer } from "@/contexts/PlayerContext";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { ArtistsLink } from "@/components/ArtistsLink";
import { AlbumLink } from "@/components/AlbumLink";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistCard } from "@/components/ArtistCard";
import { MediaCardShell } from "@/components/MediaCardShell";
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
import { getTrackPlaybackIssue, isTrackPlayable } from "@/lib/trackPlayback";
import { isSameTrack } from "@/lib/trackIdentity";

type InlineArtist = { id?: number; name: string };

export function TrackCard({
  track,
  tracks,
  liked,
  onToggleLike,
}: {
  track: Track;
  tracks: Track[];
  liked: boolean;
  onToggleLike: () => void;
}) {
  const { play, currentTrack } = usePlayer();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const isCurrent = isSameTrack(currentTrack, track);
  const playbackIssue = getTrackPlaybackIssue(track);
  const playable = isTrackPlayable(track);
  const trackArtists: InlineArtist[] =
    track.artists && track.artists.length > 0
      ? track.artists.map((artist) => ({ id: artist.id, name: artist.name }))
      : track.artist
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name }));

  return (
    <TrackContextMenu track={track} tracks={tracks}>
      <MediaCardShell
        onClick={() => {
          if (!playable) return;
          play(track, tracks);
        }}
        className={playable ? "" : "cursor-not-allowed opacity-70 hover:bg-white/[0.01]"}
        aria-disabled={!playable}
      >
        <div className="relative aspect-square w-full overflow-hidden shadow-sm">
          <img
            src={track.coverUrl}
            alt={track.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={MEDIA_CARD_ARTWORK_CLASS}
          />
          <motion.button
            type="button"
            className={MEDIA_CARD_PLAY_BUTTON_CLASS}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!playable) return;
              play(track, tracks);
            }}
            aria-label={playable ? `Play ${track.title}` : `${track.title} is unavailable`}
            disabled={!playable}
            whileHover={getControlHover(motionEnabled, websiteMode)}
            whileTap={getControlTap(motionEnabled, websiteMode)}
            transition={motionProfile.spring.control}
          >
            <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
          </motion.button>
          <motion.button
            type="button"
            className={MEDIA_CARD_FAVORITE_BUTTON_CLASS}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleLike();
            }}
            aria-label={liked ? "Remove from liked songs" : "Add to liked songs"}
            whileHover={getControlHover(motionEnabled, websiteMode)}
            whileTap={getControlTap(motionEnabled, websiteMode)}
            transition={motionProfile.spring.control}
          >
            <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${liked ? "fill-current" : ""}`} />
          </motion.button>
        </div>
        <div className={MEDIA_CARD_BODY_CLASS}>
          <p
            className={`${MEDIA_CARD_TITLE_CLASS} truncate ${isCurrent ? "font-semibold" : ""}`}
            style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}
          >
            {track.title}
          </p>
          <p className={`${MEDIA_CARD_META_CLASS} truncate`}>
            <ArtistsLink
              artists={trackArtists}
              className={`${MEDIA_CARD_META_CLASS} block truncate`}
              onClick={(event) => event.stopPropagation()}
            />
          </p>
          {playbackIssue ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              {playbackIssue === "video" ? "Video only" : "Unavailable"}
            </p>
          ) : null}
        </div>
      </MediaCardShell>
    </TrackContextMenu>
  );
}

export function ArtistCardWrapper({ artist }: { artist: HomeArtist }) {
  return (
    <ArtistCard
      id={artist.id}
      name={artist.name}
      imageUrl={artist.imageUrl}
    />
  );
}

export function HomeAlbumCard({
  album,
  saved,
  onToggleSave,
}: {
  album: HomeAlbum;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const navigate = useNavigate();
  const { playAlbum } = usePlayer();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const albumArtists: InlineArtist[] = album.artist
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: index === 0 ? album.artistId : undefined, name }));

  return (
    <AlbumContextMenu
      albumId={album.id}
      title={album.title}
      artist={album.artist}
      artistId={album.artistId}
      coverUrl={album.coverUrl}
    >
      <MediaCardShell
        onClick={() => {
          const artistName = album.artist || "";
          const params = new URLSearchParams();
          if (album.title) params.set("title", album.title);
          if (artistName) params.set("artist", artistName);
          navigate(`/album/tidal-${album.id}?${params.toString()}`);
        }}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
          <img
            src={album.coverUrl || "/placeholder.svg"}
            alt={album.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={MEDIA_CARD_ARTWORK_CLASS}
            onError={(event) => {
              (event.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          <motion.button
            type="button"
            className={MEDIA_CARD_PLAY_BUTTON_CLASS}
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
            whileHover={getControlHover(motionEnabled, websiteMode)}
            whileTap={getControlTap(motionEnabled, websiteMode)}
            transition={motionProfile.spring.control}
          >
            <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
          </motion.button>
          <motion.button
            type="button"
            className={MEDIA_CARD_FAVORITE_BUTTON_CLASS}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleSave();
            }}
            aria-label={saved ? "Remove saved album" : "Save album"}
            whileHover={getControlHover(motionEnabled, websiteMode)}
            whileTap={getControlTap(motionEnabled, websiteMode)}
            transition={motionProfile.spring.control}
          >
            <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${saved ? "fill-current" : ""}`} />
          </motion.button>
        </div>
        <div className={MEDIA_CARD_BODY_CLASS}>
          <AlbumLink
            title={album.title}
            albumId={album.id}
            artistName={album.artist}
            className={`${MEDIA_CARD_TITLE_CLASS} block truncate font-medium`}
          />
          <ArtistsLink
            artists={albumArtists}
            className={`${MEDIA_CARD_META_CLASS} block truncate underline-offset-2 hover:underline`}
          />
        </div>
      </MediaCardShell>
    </AlbumContextMenu>
  );
}
