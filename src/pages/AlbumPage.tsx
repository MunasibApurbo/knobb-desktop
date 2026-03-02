import { useParams } from "react-router-dom";
import { albums, formatDuration, getTotalDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, Shuffle, Heart, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function AlbumPage() {
  const { id } = useParams();
  const album = albums.find((a) => a.id === id);
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!album) return <div className="p-8 text-foreground">Album not found.</div>;

  const isCurrentAlbum = currentTrack && album.tracks.some((t) => t.id === currentTrack.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex gap-6 mb-8"
      >
        <img
          src={album.coverUrl}
          alt={album.title}
          className="w-56 h-56 object-cover shadow-2xl shrink-0 border border-border/20"
        />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1 font-bold">Album</p>
          <h1 className="text-4xl font-black text-foreground mb-2 truncate tracking-tight">{album.title}</h1>
          <p className="text-base text-foreground/80 font-medium">{album.artist}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {album.year} · {album.tracks.length} tracks · {getTotalDuration(album.tracks)}
          </p>

          <div className="flex items-center gap-3 mt-5">
            <Button
              className="px-6 gap-2 font-bold transition-all duration-200 active:scale-95"
              style={{ background: `hsl(${album.canvasColor})` }}
              onClick={() => {
                if (isCurrentAlbum) togglePlay();
                else play(album.tracks[0], album.tracks);
              }}
            >
              {isCurrentAlbum && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isCurrentAlbum && isPlaying ? "Pause" : "Play"}
            </Button>
            {[Shuffle, Heart, Download, Share2].map((Icon, i) => (
              <Button key={i} variant="ghost" size="icon" className="w-10 h-10 text-muted-foreground hover:text-foreground transition-colors">
                <Icon className="w-5 h-5" />
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Track list */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="glass overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr_80px] gap-4 px-4 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground border-b border-border/30">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span className="text-right">Duration</span>
        </div>

        {album.tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <motion.div
              key={track.id}
              variants={fadeUp}
              className={`grid grid-cols-[40px_1fr_1fr_80px] gap-4 px-4 py-3 items-center cursor-pointer transition-all duration-200 group
                ${isCurrent ? "bg-accent/40" : "hover:bg-accent/20"}
                ${i < album.tracks.length - 1 ? "border-b border-border/10" : ""}`}
              onClick={() => play(track, album.tracks)}
            >
              <span className="text-center text-sm text-muted-foreground group-hover:hidden">
                {isCurrent && isPlaying ? (
                  <span className="inline-block w-3 h-3 animate-pulse" style={{ background: `hsl(${track.canvasColor})` }} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="text-center hidden group-hover:block">
                <Play className="w-4 h-4 mx-auto text-foreground" />
              </span>
              <span className={`text-sm truncate ${isCurrent ? "font-bold text-foreground" : "text-foreground/90"}`}>
                {track.title}
              </span>
              <span className="text-sm text-muted-foreground truncate">{track.artist}</span>
              <span className="text-sm text-muted-foreground text-right font-mono">{formatDuration(track.duration)}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
