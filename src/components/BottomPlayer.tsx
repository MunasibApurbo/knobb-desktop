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
  const progress = trackDuration > 0 ? (currentTime / trackDuration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="h-[90px] shrink-0 bg-background border-t border-border/30 flex flex-col"
      >
        {/* Progress Bar - Dribbblish style: thin bar at top of player */}
        <div
          className="w-full h-1 cursor-pointer group relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * trackDuration);
          }}
        >
          <div className="absolute inset-0 bg-muted/30" />
          <motion.div
            className="absolute inset-y-0 left-0 progress-accent"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)` }}
          />
        </div>

        {/* Main player row */}
        <div className="flex-1 flex items-center px-4 gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-0 w-[280px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentTrack.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-14 h-14 rounded object-cover shadow-lg"
              />
            </AnimatePresence>
            <div className="min-w-0">
              <motion.p
                key={`title-${currentTrack.id}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm font-semibold truncate text-foreground hover:underline cursor-pointer"
              >
                {currentTrack.title}
              </motion.p>
              <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
                {currentTrack.artist}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground shrink-0 transition-colors">
              <Heart className="w-4 h-4" />
            </Button>
          </div>

          {/* Center: Controls */}
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="icon"
                className={`w-8 h-8 transition-colors ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
                onClick={toggleShuffle}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground hover:text-foreground/80 transition-colors" onClick={previous}>
                <SkipBack className="w-5 h-5 fill-current" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="w-9 h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:scale-105 transition-all duration-200 active:scale-95"
                onClick={togglePlay}
                disabled={isLoading && !isPlaying}
              >
                {isLoading && !isPlaying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground hover:text-foreground/80 transition-colors" onClick={next}>
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

            {/* Time display */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <span className="w-10 text-right tabular-nums">{formatDuration(Math.floor(currentTime))}</span>
              <span>/</span>
              <span className="w-10 tabular-nums">{formatDuration(Math.floor(trackDuration))}</span>
            </div>
          </div>

          {/* Right: Volume + Actions */}
          <div className="flex items-center gap-2 w-[280px] justify-end">
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground transition-colors" onClick={toggleRightPanel}>
              <Mic2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground transition-colors" onClick={toggleRightPanel}>
              <ListMusic className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
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
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground transition-colors">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
