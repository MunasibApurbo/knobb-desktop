import { useParams } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { formatDuration, Track } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2, Music, Loader2 } from "lucide-react";
import { ArtistLink } from "@/components/ArtistLink";

export default function UserPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { user } = useAuth();
  const { playlists, loading, removeTrack } = usePlaylists();

  const playlist = playlists.find((p) => p.id === id);

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  );

  if (!playlist) return (
    <div className="text-center py-20">
      <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">Playlist not found</p>
    </div>
  );

  const handlePlayAll = () => {
    if (playlist.tracks.length > 0) {
      play(playlist.tracks[0], playlist.tracks);
    }
  };

  const isCurrentPlaylist = playlist.tracks.some((t) => t.id === currentTrack?.id);

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-end gap-6">
        <div className="w-48 h-48 rounded-lg overflow-hidden bg-card shadow-xl shrink-0">
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-accent">
              <Music className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Playlist</p>
          <h1 className="text-4xl font-black text-foreground">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-muted-foreground">{playlist.description}</p>}
          <p className="text-sm text-muted-foreground">{playlist.tracks.length} tracks</p>
        </div>
      </div>

      {/* Play button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={isCurrentPlaylist ? togglePlay : handlePlayAll}
          className="w-14 h-14 rounded-full"
          style={{ backgroundColor: `hsl(var(--dynamic-accent))` }}
          disabled={playlist.tracks.length === 0}
        >
          {isCurrentPlaylist && isPlaying ? <Pause className="w-6 h-6 text-background" /> : <Play className="w-6 h-6 ml-0.5 text-background" />}
        </Button>
      </div>

      {/* Track list */}
      {playlist.tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No tracks yet. Add songs from search or artist pages.</p>
      ) : (
        <div className="space-y-1">
          {playlist.tracks.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}-${i}`}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-accent/15 transition-colors group ${isCurrent ? "bg-accent/10" : ""}`}
              >
                <span className="w-6 text-center text-xs text-muted-foreground font-mono">{i + 1}</span>
                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => play(track, playlist.tracks)}>
                  <p className={`text-sm font-semibold truncate ${isCurrent ? "" : "text-foreground"}`}
                    style={isCurrent ? { color: `hsl(var(--dynamic-accent))` } : {}}>
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    <ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" />
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                <Button
                  variant="ghost" size="icon"
                  className="w-7 h-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeTrack(playlist.id, i)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
