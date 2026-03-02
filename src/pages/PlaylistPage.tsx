import { useParams } from "react-router-dom";
import { playlists, getTotalDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, Shuffle, Heart, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackListRow } from "@/components/TrackListRow";
import { TrackListHeader } from "@/components/TrackListHeader";
import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

export default function PlaylistPage() {
  const { id } = useParams();
  const playlist = playlists.find((p) => p.id === id);
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!playlist) return <div className="p-8 text-foreground">Playlist not found.</div>;

  const isCurrentPlaylist = currentTrack && playlist.tracks.some((t) => t.id === currentTrack.id);

  return (
    <PageTransition>
      {/* Hero Header */}
      <div
        className="flex flex-col md:flex-row gap-4 md:gap-6 pb-6 md:pb-8 -mx-4 md:-mx-6 -mt-14 md:-mt-16 px-4 md:px-6 pt-16 md:pt-20"
        style={{
          background: `linear-gradient(180deg, hsl(${playlist.canvasColor} / 0.5) 0%, transparent 100%)`,
        }}
      >
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={playlist.coverUrl}
          alt={playlist.title}
          className="w-40 h-40 md:w-56 md:h-56 object-cover rounded-md shadow-2xl shrink-0 mx-auto md:mx-0"
        />
        <div className="flex flex-col justify-end min-w-0 text-center md:text-left">
          <p className="text-xs font-bold text-foreground/70 uppercase">Playlist</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2 mb-3 truncate tracking-tight">{playlist.title}</h1>
          <p className="text-sm text-foreground/60 mb-2">{playlist.description}</p>
          <p className="text-sm text-foreground/70">{playlist.tracks.length} songs · {getTotalDuration(playlist.tracks)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 md:gap-6 mb-6 mt-4 justify-center md:justify-start">
        <button
          className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform active:scale-95"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={() => {
            if (isCurrentPlaylist) togglePlay();
            else play(playlist.tracks[0], playlist.tracks);
          }}
        >
          {isCurrentPlaylist && isPlaying ? (
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

      {/* Track list */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <TrackListHeader showAlbum />
        {playlist.tracks.map((track, i) => (
          <TrackListRow key={track.id} track={track} index={i} tracks={playlist.tracks} showCover showAlbum />
        ))}
      </motion.div>
    </PageTransition>
  );
}
