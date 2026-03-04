import { Play, Heart } from "lucide-react";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/utils";
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
    ? "grid-cols-[36px_1fr_40px_60px] md:grid-cols-[44px_1fr_1fr_1fr_40px_60px]"
    : "grid-cols-[36px_1fr_40px_60px] md:grid-cols-[44px_1fr_1fr_40px_60px]";

  return (
    <TrackContextMenu track={track} tracks={tracks}>
      <motion.div
        variants={fadeUp}
        className={`grid ${cols} gap-2 md:gap-4 px-2 md:px-4 py-3 items-center cursor-pointer  transition-all duration-200 group
          ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
        onClick={() => play(track, tracks)}
      >
        {/* Number / Playing indicator */}
        <span className="text-center text-sm font-medium relative" style={{ color: `hsl(var(--dynamic-accent))` }}>
          {isCurrent && isPlaying ? (
            <div className="playing-bars flex items-end gap-[2px] justify-center"><span /><span /><span /></div>
          ) : (
            <>
              <span className="group-hover:hidden">{index + 1}</span>
              <Play className="w-[18px] h-[18px] mx-auto text-foreground hidden group-hover:block" />
            </>
          )}
        </span>

        {/* Title + optional cover */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-sm truncate ${isCurrent ? "font-semibold" : "font-medium"}`}
              style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}
            >
              {track.title}
            </span>
            {track.explicit && (
              <span className="flex-shrink-0 px-1 py-0.5 text-[10px] font-bold bg-muted-foreground/20 rounded-[2px] leading-none uppercase" style={{ color: `hsl(var(--dynamic-accent))` }}>
                E
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:hidden">
            {track.audioQuality && (track.audioQuality === "LOSSLESS" || track.audioQuality === "MAX") && (
              <span className="text-[10px] font-black px-1 py-0.5 rounded-[1px] leading-none tracking-tighter border" style={{ color: `hsl(var(--dynamic-accent))`, borderColor: `hsl(var(--dynamic-accent) / 0.2)`, backgroundColor: `hsl(var(--dynamic-accent) / 0.1)` }}>
                {track.audioQuality}
              </span>
            )}
            <span className="text-sm text-muted-foreground truncate">{track.artist}</span>
          </div>
          {!showAlbum && track.audioQuality && (track.audioQuality === "LOSSLESS" || track.audioQuality === "MAX") && (
            <span className="hidden md:inline-flex items-center w-fit text-[10px] font-black px-1 py-0.5 rounded-[1px] leading-none tracking-tighter mt-1 border" style={{ color: `hsl(var(--dynamic-accent))`, borderColor: `hsl(var(--dynamic-accent) / 0.2)`, backgroundColor: `hsl(var(--dynamic-accent) / 0.1)` }}>
              {track.audioQuality}
            </span>
          )}
        </div>

        {/* Artist - hidden on mobile */}
        <div className="flex items-center gap-2 hidden md:flex min-w-0">
          <ArtistLink name={track.artist} artistId={track.artistId} className="text-sm truncate" />
          {showAlbum && track.audioQuality && (track.audioQuality === "LOSSLESS" || track.audioQuality === "MAX") && (
            <span className="text-[10px] font-black px-1 py-0.5 rounded-[1px] leading-none tracking-tighter shrink-0 border" style={{ color: `hsl(var(--dynamic-accent))`, borderColor: `hsl(var(--dynamic-accent) / 0.2)`, backgroundColor: `hsl(var(--dynamic-accent) / 0.1)` }}>
              {track.audioQuality}
            </span>
          )}
        </div>

        {/* Album (optional) - hidden on mobile */}
        {showAlbum && (
          <span className="text-sm text-muted-foreground truncate hidden md:block">{track.album}</span>
        )}

        {/* Like */}
        <button
          className="flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
        >
          <Heart className={`w-[18px] h-[18px] transition-colors ${isLiked(track.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"}`} />
        </button>

        {/* Duration */}
        <span className="text-sm text-muted-foreground text-right font-mono tabular-nums">
          {formatDuration(track.duration)}
        </span>
      </motion.div>
    </TrackContextMenu>
  );
}
