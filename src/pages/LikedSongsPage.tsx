import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration, getTotalDuration } from "@/data/mockData";
import { Play, Pause, Shuffle, Heart, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { motion } from "framer-motion";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function LikedSongsPage() {
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { likedSongs, toggleLike } = useLikedSongs();

  const isCurrentLiked = currentTrack && likedSongs.some((t) => t.id === currentTrack.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Hero */}
      <div
        className="flex items-end gap-6 pb-8 -mx-6 -mt-16 px-6 pt-20"
        style={{ background: "linear-gradient(180deg, hsl(250 80% 60% / 0.5) 0%, transparent 100%)" }}
      >
        <div className="w-56 h-56 rounded-md shrink-0 flex items-center justify-center shadow-2xl"
          style={{ background: "linear-gradient(135deg, hsl(250 80% 60%), hsl(200 80% 50%))" }}>
          <Heart className="w-20 h-20 text-white fill-white" />
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Playlist</p>
          <h1 className="text-5xl font-black text-foreground mt-2 mb-4 tracking-tight">Liked Songs</h1>
          <div className="flex items-center gap-1 text-sm text-foreground/80">
            <span>{likedSongs.length} songs</span>
            {likedSongs.length > 0 && (
              <>
                <span className="text-foreground/50">·</span>
                <span>{getTotalDuration(likedSongs)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 mb-6 mt-4">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentLiked && isPlaying) togglePlay();
            else if (likedSongs.length) play(likedSongs[0], likedSongs);
          }}
          disabled={likedSongs.length === 0}
        >
          {isCurrentLiked && isPlaying ? (
            <Pause className="w-6 h-6 text-foreground fill-current" />
          ) : (
            <Play className="w-6 h-6 text-foreground fill-current ml-1" />
          )}
        </button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Shuffle className="w-5 h-5" />
        </Button>
      </div>

      {likedSongs.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Songs you like will appear here</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Save songs by tapping the heart icon</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show">
          <div className="grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 uppercase tracking-wider mb-1">
            <span className="text-center">#</span>
            <span>Title</span>
            <span>Album</span>
            <span></span>
            <span className="text-right"><Clock className="w-4 h-4 inline" /></span>
          </div>
          {likedSongs.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <motion.div
                key={track.id}
                variants={fadeUp}
                className={`grid grid-cols-[40px_1fr_1fr_40px_60px] gap-4 px-4 py-2.5 items-center cursor-pointer rounded-md transition-all group
                  ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
                onClick={() => play(track, likedSongs)}
              >
                <span className="text-center text-sm text-muted-foreground">
                  {isCurrent && isPlaying ? (
                    <div className="playing-bars flex items-end gap-[2px] justify-center"><span /><span /><span /></div>
                  ) : (
                    <span className="group-hover:hidden">{i + 1}</span>
                  )}
                  <Play className="w-4 h-4 mx-auto text-foreground hidden group-hover:block" />
                </span>
                <div className="flex items-center gap-3 min-w-0">
                  <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                      style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                      {track.title}
                    </p>
                    <p className="text-xs truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /></p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground truncate">{track.album}</span>
                <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
                  <Heart className="w-4 h-4 text-[hsl(var(--dynamic-accent))] fill-current" />
                </button>
                <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
