import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, ListMusic, Heart, Mic2, Maximize2, Loader2
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { VisualizerSelector } from "@/components/visualizers/VisualizerSelector";

export function BottomPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, shuffle, repeat, volume, isLoading,
    togglePlay, next, previous, toggleShuffle, toggleRepeat, setVolume, seek, toggleRightPanel,
  } = usePlayer();

  if (!currentTrack) return null;

  const trackDuration = duration || currentTrack.duration;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="h-[120px] shrink-0 bg-background/95 backdrop-blur-xl border-t border-border/20 flex flex-col"
      >
        {/* Top row: track info + controls + volume */}
        <div className="flex items-center px-4 pt-2 gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-0 w-[280px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentTrack.id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25 }}
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-md object-cover shadow-lg"
              />
            </AnimatePresence>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-foreground">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground shrink-0">
              <Heart className="w-4 h-4" />
            </Button>
          </div>

          {/* Center: Controls */}
          <div className="flex-1 flex items-center justify-center gap-4">
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 transition-colors ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={previous}>
              <SkipBack className="w-5 h-5 fill-current" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-10 h-10 rounded-full bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/20 transition-all active:scale-95"
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
              <SkipForward className="w-5 h-5 fill-current" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 transition-colors ${repeat !== "off" ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleRepeat}
            >
              {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </Button>
          </div>

          {/* Right: Volume + Actions */}
          <div className="flex items-center gap-2 w-[280px] justify-end">
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={toggleRightPanel}>
              <Mic2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={toggleRightPanel}>
              <ListMusic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              max={100}
              step={1}
              className="w-24"
            />
          </div>
        </div>

        {/* Waveform Seekbar — full width with timestamps */}
        <div className="flex-1 flex items-center gap-3 px-4 pb-2">
          <span className="text-[11px] font-mono w-10 text-right tabular-nums"
            style={{ color: `hsl(var(--dynamic-accent))` }}>
            {formatDuration(Math.floor(currentTime))}
          </span>
          <div
            className="flex-1 h-10 cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seek(pct * trackDuration);
            }}
          >
            <VisualizerSelector className="h-full" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground w-10 tabular-nums">
            {formatDuration(Math.floor(trackDuration))}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
