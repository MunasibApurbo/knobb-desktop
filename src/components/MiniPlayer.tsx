import { Play, Pause, SkipForward, X, Loader2, Maximize2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface MiniPlayerProps {
  visible: boolean;
  onExpand: () => void;
  onClose: () => void;
}

export function MiniPlayer({ visible, onExpand, onClose }: MiniPlayerProps) {
  const { currentTrack, isPlaying, isLoading, togglePlay, next, currentTime, duration } = usePlayer();

  if (!currentTrack || !visible) return null;

  const trackDuration = duration || currentTrack.duration;
  const progress = trackDuration > 0 ? (currentTime / trackDuration) * 100 : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-4 right-4 z-[90] w-[320px]  overflow-hidden shadow-2xl border border-border/30 bg-card/95 backdrop-blur-xl"
        >
          {/* Progress bar at top */}
          <div className="h-0.5 w-full bg-muted">
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: `hsl(var(--dynamic-accent))`,
              }}
            />
          </div>

          <div className="flex items-center gap-3 p-3">
            {/* Album art */}
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-11 h-11  object-cover shadow-md cursor-pointer hover:brightness-110 transition"
              onClick={onExpand}
            />

            {/* Track info */}
            <div className="flex-1 min-w-0" onClick={onExpand} role="button" tabIndex={0}>
              <p className="text-sm font-semibold truncate text-foreground">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon"
                className="w-9 h-9  text-foreground hover:bg-foreground/10"
                onClick={togglePlay}
                disabled={isLoading && !isPlaying}
              >
                {isLoading && !isPlaying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={next}>
                <SkipForward className="w-4 h-4 fill-current" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={onExpand}>
                <Maximize2 className="w-[18px] h-[18px]" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="w-[18px] h-[18px]" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
