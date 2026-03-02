import { Play, Heart } from "lucide-react";
import { formatDuration, Track } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { ArtistLink } from "@/components/ArtistLink";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface TrackListRowProps {
  track: Track;
  index: number;
  tracks: Track[];
  showCover?: boolean;
  showAlbum?: boolean;
}

export function TrackListRow({ track, index, tracks, showCover = false, showAlbum = false }: TrackListRowProps) {
  const { play, currentTrack, isPlaying } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const isCurrent = currentTrack?.id === track.id;

  const cols = showAlbum
    ? "grid-cols-[32px_1fr_40px_60px] md:grid-cols-[40px_1fr_1fr_1fr_40px_60px]"
    : "grid-cols-[32px_1fr_40px_60px] md:grid-cols-[40px_1fr_1fr_40px_60px]";

  return (
    <TrackContextMenu track={track} tracks={tracks}>
      <motion.div
        variants={fadeUp}
        className={`grid ${cols} gap-2 md:gap-4 px-2 md:px-4 py-2.5 items-center cursor-pointer rounded-md transition-all duration-200 group
          ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
        onClick={() => play(track, tracks)}
      >
      {/* Number / Playing indicator */}
      <span className="text-center text-sm text-muted-foreground relative">
        {isCurrent && isPlaying ? (
          <div className="playing-bars flex items-end gap-[2px] justify-center"><span /><span /><span /></div>
        ) : (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <Play className="w-4 h-4 mx-auto text-foreground hidden group-hover:block" />
          </>
        )}
      </span>

      {/* Title + optional cover */}
      <div className="flex items-center gap-3 min-w-0">
        {showCover && (
          <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
        )}
        <span
          className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
          style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}
        >
          {track.title}
        </span>
      </div>

      {/* Artist - hidden on mobile */}
      <span className="text-sm truncate hidden md:block">
        <ArtistLink name={track.artist} artistId={track.artistId} className="text-sm" />
      </span>

      {/* Album (optional) - hidden on mobile */}
      {showAlbum && (
        <span className="text-sm text-muted-foreground truncate hidden md:block">{track.album}</span>
      )}

      {/* Like */}
      <button
        className="flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
      >
        <Heart className={`w-4 h-4 transition-colors ${isLiked(track.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"}`} />
      </button>

      {/* Duration */}
      <span className="text-sm text-muted-foreground text-right font-mono tabular-nums">
        {formatDuration(track.duration)}
      </span>
      </motion.div>
    </TrackContextMenu>
  );
}
