import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, ListMusic, Heart, Disc3, Loader2
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/data/mockData";
import { VisualizerSelector } from "@/components/visualizers/VisualizerSelector";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";

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
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="h-24 shrink-0 glass-heavy mx-2 mb-2 flex items-center px-5 gap-5"
      >
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 shrink-0 min-w-0 w-[240px]">
          <motion.img
            key={currentTrack.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className="w-14 h-14 object-cover border border-border/30"
          />
          <div className="min-w-0">
            <motion.p
              key={`title-${currentTrack.id}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-bold truncate text-foreground"
            >
              {currentTrack.title}
            </motion.p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack.artist}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground shrink-0 hover:text-foreground transition-colors">
            <Heart className="w-4 h-4" />
          </Button>
        </div>

        {/* Center: Controls + Waveform */}
        <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          {/* Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 transition-colors ${shuffle ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground hover:text-foreground/80 transition-colors" onClick={previous}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-10 h-10 bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 active:scale-95"
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
            <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground hover:text-foreground/80 transition-colors" onClick={next}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 transition-colors ${repeat !== "off" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleRepeat}
            >
              {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </Button>
          </div>

          {/* Waveform Seekbar */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-right tabular-nums">
              {formatDuration(Math.floor(currentTime))}
            </span>
            <div
              className="flex-1 h-8 cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                seek(pct * trackDuration);
              }}
            >
              <VisualizerSelector className="h-full" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-10 tabular-nums">
              {formatDuration(Math.floor(trackDuration))}
            </span>
          </div>
        </div>

        {/* Right: Volume + Queue */}
        <div className="flex items-center gap-2 shrink-0 w-[180px] justify-end">
          <div className="flex items-center gap-1 shrink-0">
            <Disc3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider">HD</span>
          </div>
          <div className="w-px h-5 bg-border/40 mx-1" />
          <Button
            variant="ghost" size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => setVolume(v / 100)}
            max={100}
            step={1}
            className="w-20"
          />
          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground transition-colors" onClick={toggleRightPanel}>
            <ListMusic className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
