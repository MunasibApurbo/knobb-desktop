import { useParams } from "react-router-dom";
import { albums, formatDuration, getTotalDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, Shuffle, Heart, MoreHorizontal, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AlbumPage() {
  const { id } = useParams();
  const album = albums.find((a) => a.id === id);
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!album) return <div className="p-8 text-foreground">Album not found.</div>;

  const isCurrentAlbum = currentTrack && album.tracks.some((t) => t.id === currentTrack.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Hero Header — Dribbblish gradient style */}
      <div
        className="flex gap-6 pb-8 -mx-6 -mt-16 px-6 pt-20"
        style={{
          background: `linear-gradient(180deg, hsl(${album.canvasColor} / 0.5) 0%, transparent 100%)`,
        }}
      >
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={album.coverUrl}
          alt={album.title}
          className="w-56 h-56 object-cover rounded-md shadow-2xl shrink-0"
        />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs font-bold text-foreground/70 uppercase">Album</p>
          <h1 className="text-5xl font-black text-foreground mt-2 mb-4 truncate tracking-tight">{album.title}</h1>
          <div className="flex items-center gap-1 text-sm text-foreground/80">
            <span className="font-semibold hover:underline cursor-pointer">{album.artist}</span>
            <span className="text-foreground/50">·</span>
            <span>{album.year}</span>
            <span className="text-foreground/50">·</span>
            <span>{album.tracks.length} songs, {getTotalDuration(album.tracks)}</span>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-6 mb-6 mt-4">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentAlbum) togglePlay();
            else play(album.tracks[0], album.tracks);
          }}
        >
          {isCurrentAlbum && isPlaying ? (
            <Pause className="w-6 h-6 text-foreground fill-current" />
          ) : (
            <Play className="w-6 h-6 text-foreground fill-current ml-1" />
          )}
        </button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Shuffle className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <Heart className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Track list — Spotify/Dribbblish table style */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 uppercase tracking-wider mb-1">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span className="text-right"><Clock className="w-4 h-4 inline" /></span>
        </div>

        {album.tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <motion.div
              key={track.id}
              variants={fadeUp}
              className={`grid grid-cols-[40px_1fr_1fr_60px] gap-4 px-4 py-2.5 items-center cursor-pointer rounded-md transition-all duration-200 group
                ${isCurrent ? "bg-accent/30" : "hover:bg-accent/15"}`}
              onClick={() => play(track, album.tracks)}
            >
              <span className="text-center text-sm text-muted-foreground">
                {isCurrent && isPlaying ? (
                  <div className="playing-bars flex items-end gap-[2px] justify-center">
                    <span /><span /><span />
                  </div>
                ) : (
                  <span className="group-hover:hidden">{i + 1}</span>
                )}
                <Play className="w-4 h-4 mx-auto text-foreground hidden group-hover:block" />
              </span>
              <span className={`text-sm truncate ${isCurrent ? "font-semibold" : ""}`}
                style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                {track.title}
              </span>
              <span className="text-sm truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-sm" /></span>
              <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
