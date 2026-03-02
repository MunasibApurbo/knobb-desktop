import { usePlayer } from "@/contexts/PlayerContext";
import { mockLyrics } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect } from "react";

export function RightPanel() {
  const { currentTrack, currentTime, showRightPanel, toggleRightPanel, isPlaying } = usePlayer();
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const activeLyricIdx = mockLyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0);

  // Auto-scroll to active lyric
  useEffect(() => {
    if (!showRightPanel || !currentTrack) return;
    const el = lyricRefs.current[activeLyricIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLyricIdx, showRightPanel, currentTrack]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence mode="wait">
      {showRightPanel && (
        <motion.aside
          key="right-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="shrink-0 h-full glass-heavy m-2 ml-0 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Now Playing</span>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-accent/50 transition-colors" onClick={toggleRightPanel}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Artwork */}
          <div className="px-4">
            <motion.div
              key={currentTrack.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative overflow-hidden aspect-square"
            >
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-[2000ms] ${isPlaying ? "scale-105" : "scale-100"}`}
              />
              <div
                className="absolute inset-0 opacity-20 mix-blend-overlay"
                style={{
                  background: `linear-gradient(135deg, hsl(${currentTrack.canvasColor} / 0.4), transparent 60%)`,
                }}
              />
              <div className="absolute inset-0 pointer-events-none" style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.03) 2px, hsl(0 0% 0% / 0.03) 4px)",
              }} />
            </motion.div>
          </div>

          {/* Track info */}
          <div className="px-4 pt-4 pb-2">
            <motion.h3
              key={`t-${currentTrack.id}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-base font-black text-foreground truncate tracking-tight"
            >
              {currentTrack.title}
            </motion.h3>
            <motion.p
              key={`a-${currentTrack.id}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="text-sm text-muted-foreground"
            >
              {currentTrack.artist}
            </motion.p>
          </div>

          {/* Lyrics */}
          <div className="px-4 pt-2 pb-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Lyrics</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-4 py-4">
              {mockLyrics.map((line, i) => {
                const isActive = i === activeLyricIdx;
                const isPast = i < activeLyricIdx;
                return (
                  <motion.p
                    key={i}
                    ref={(el) => { lyricRefs.current[i] = el; }}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      opacity: isActive ? 1 : isPast ? 0.3 : 0.5,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`text-sm origin-left cursor-default select-none transition-colors duration-300 ${
                      isActive
                        ? "text-foreground font-bold lyric-active"
                        : "text-muted-foreground"
                    }`}
                  >
                    {line.text}
                  </motion.p>
                );
              })}
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
