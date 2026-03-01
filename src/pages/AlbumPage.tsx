import { useParams } from "react-router-dom";
import { albums, formatDuration, getTotalDuration } from "@/data/mockData";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Shuffle, Heart, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AlbumPage() {
  const { id } = useParams();
  const album = albums.find((a) => a.id === id);
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();

  if (!album) return <div className="p-8 text-foreground">Album not found.</div>;

  const isCurrentAlbum = currentTrack && album.tracks.some((t) => t.id === currentTrack.id);

  return (
    <div>
      {/* Header - Deezer style */}
      <div className="flex gap-6 mb-8">
        <img
          src={album.coverUrl}
          alt={album.title}
          className="w-56 h-56 rounded-xl object-cover shadow-2xl shrink-0"
        />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Album</p>
          <h1 className="text-4xl font-bold text-foreground mb-2 truncate">{album.title}</h1>
          <p className="text-base text-foreground/80">{album.artist}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {album.year} · {album.tracks.length} tracks · {getTotalDuration(album.tracks)}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <Button
              className="rounded-full px-6 gap-2"
              style={{ background: `hsl(${album.canvasColor})` }}
              onClick={() => {
                if (isCurrentAlbum) togglePlay();
                else play(album.tracks[0], album.tracks);
              }}
            >
              {isCurrentAlbum && isPlaying ? <Play className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isCurrentAlbum && isPlaying ? "Pause" : "Play"}
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

      {/* Track list - Deezer style */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_1fr_80px] gap-4 px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/30">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span className="text-right">Duration</span>
        </div>

        {/* Rows */}
        {album.tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className={`grid grid-cols-[40px_1fr_1fr_80px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors group
                ${isCurrent ? "bg-accent/40" : "hover:bg-accent/20"}
                ${i < album.tracks.length - 1 ? "border-b border-border/10" : ""}`}
              onClick={() => play(track, album.tracks)}
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
              <span className="text-sm text-muted-foreground text-right">{formatDuration(track.duration)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
