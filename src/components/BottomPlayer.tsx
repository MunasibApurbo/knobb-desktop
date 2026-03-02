import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Download, Volume2, ListMusic, Heart, Disc3, Loader2
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/data/mockData";
import { VisualizerSelector } from "@/components/visualizers/VisualizerSelector";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function BottomPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, shuffle, repeat, volume, isLoading,
    togglePlay, next, previous, toggleShuffle, toggleRepeat, setVolume, seek, toggleRightPanel,
  } = usePlayer();

  if (!currentTrack) return null;

  const trackDuration = duration || currentTrack.duration;

  return (
    <div className="h-24 shrink-0 glass-heavy mx-2 mb-2 rounded-xl flex items-center px-4 gap-4">
      {/* Left: Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon"
          className={`w-8 h-8 ${shuffle ? "text-foreground" : "text-muted-foreground"}`}
          onClick={toggleShuffle}
        >
          <Shuffle className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={previous}>
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="w-10 h-10 rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={togglePlay}
          disabled={isLoading && !isPlaying}
        >
          {isLoading && !isPlaying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={next}>
          <SkipForward className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className={`w-8 h-8 ${repeat !== "off" ? "text-foreground" : "text-muted-foreground"}`}
          onClick={toggleRepeat}
        >
          {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
        </Button>

        <div className="w-px h-6 bg-border/50 mx-2" />
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground">
          <Download className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1 w-28">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => setVolume(v / 100)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={toggleRightPanel}>
          <ListMusic className="w-4 h-4" />
        </Button>
      </div>

      {/* Center: Visualizer + Waveform */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        <div
          className="w-full h-10 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(Math.floor(pct * trackDuration));
          }}
        >
          <VisualizerSelector />
        </div>
        <div className="flex justify-between w-full text-xs text-muted-foreground px-0.5">
          <span>{formatDuration(Math.floor(currentTime))}</span>
          <span>{formatDuration(Math.floor(trackDuration))}</span>
        </div>
      </div>

      {/* Right: Track Info */}
      <div className="flex items-center gap-3 shrink-0 min-w-0 max-w-[220px]">
        <img
          src={currentTrack.coverUrl}
          alt={currentTrack.title}
          className="w-12 h-12 rounded-lg object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-foreground">{currentTrack.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {currentTrack.artist} · {currentTrack.year}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground shrink-0">
          <Heart className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1 shrink-0">
          <Disc3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground">HD</span>
        </div>
      </div>
    </div>
  );
}
