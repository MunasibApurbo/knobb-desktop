import { useParams } from "react-router-dom";
import { playlists, formatDuration, getTotalDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Shuffle, Heart, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlaylistPage() {
  const { id } = useParams();
  const playlist = playlists.find((p) => p.id === id);
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!playlist) return <div className="p-8 text-foreground">Playlist not found.</div>;

  const isCurrentPlaylist = currentTrack && playlist.tracks.some((t) => t.id === currentTrack.id);

  return (
    <div>
      {/* Header */}
      <div className="flex gap-6 mb-8">
        <img src={playlist.coverUrl} alt={playlist.title} className="w-56 h-56 rounded-xl object-cover shadow-2xl shrink-0" />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Playlist</p>
          <h1 className="text-4xl font-bold text-foreground mb-2 truncate">{playlist.title}</h1>
          <p className="text-base text-muted-foreground">{playlist.description}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {playlist.tracks.length} tracks · {getTotalDuration(playlist.tracks)}
          </p>
          <div className="flex items-center gap-3 mt-5">
            <Button
              className="rounded-full px-6 gap-2"
              style={{ background: `hsl(${playlist.canvasColor})` }}
              onClick={() => {
                if (isCurrentPlaylist) togglePlay();
                else play(playlist.tracks[0], playlist.tracks);
              }}
            >
              <Play className="w-4 h-4" />
              {isCurrentPlaylist && isPlaying ? "Pause" : "Play"}
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground">
              <Shuffle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground">
              <Heart className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground">
              <Download className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr_1fr_80px] gap-4 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/30">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span>Album</span>
          <span className="text-right">Duration</span>
        </div>
        {playlist.tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className={`grid grid-cols-[40px_1fr_1fr_1fr_80px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors group
                ${isCurrent ? "bg-accent/40" : "hover:bg-accent/20"}
                ${i < playlist.tracks.length - 1 ? "border-b border-border/10" : ""}`}
              onClick={() => play(track, playlist.tracks)}
            >
              <span className="text-center text-sm text-muted-foreground group-hover:hidden">
                {isCurrent && isPlaying ? (
                  <span className="inline-block w-3 h-3 rounded-full animate-pulse" style={{ background: `hsl(${track.canvasColor})` }} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="text-center hidden group-hover:block">
                <Play className="w-4 h-4 mx-auto text-foreground" />
              </span>
              <span className={`text-sm truncate ${isCurrent ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                {track.title}
              </span>
              <span className="text-sm text-muted-foreground truncate">{track.artist}</span>
              <span className="text-sm text-muted-foreground truncate">{track.album}</span>
              <span className="text-sm text-muted-foreground text-right">{formatDuration(track.duration)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
