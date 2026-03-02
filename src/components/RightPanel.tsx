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

  const activeLyricIdx = currentTrack
    ? mockLyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0)
    : 0;

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
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 h-full ml-2 bg-card rounded-t-lg flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground transition-colors" onClick={toggleRightPanel}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Artwork */}
          <div className="px-5 pb-4">
            <motion.div
              key={currentTrack.id}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-lg aspect-square shadow-2xl"
            >
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-[3000ms] ${isPlaying ? "scale-105" : "scale-100"}`}
              />
              {/* Subtle scan-line overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-10" style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.06) 2px, hsl(0 0% 0% / 0.06) 4px)",
              }} />
            </motion.div>
          </div>

          {/* Track info */}
          <div className="px-5 pb-3">
            <motion.h3
              key={`t-${currentTrack.id}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-base font-bold text-foreground truncate"
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

          {/* Lyrics divider */}
          <div className="px-5 py-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Lyrics</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          {/* Lyrics — Monochrome style: large text, active line scales up with glow, smooth transitions */}
          <ScrollArea className="flex-1 px-5 pb-6">
            <div className="space-y-6 py-6">
              {mockLyrics.map((line, i) => {
                const isActive = i === activeLyricIdx;
                const isPast = i < activeLyricIdx;
                const distance = Math.abs(i - activeLyricIdx);

                return (
                  <motion.p
                    key={i}
                    ref={(el) => { lyricRefs.current[i] = el; }}
                    animate={{
                      scale: isActive ? 1.08 : 1,
                      opacity: isActive ? 1 : isPast ? 0.2 : Math.max(0.15, 0.5 - distance * 0.08),
                      y: isActive ? -2 : 0,
                    }}
                    transition={{
                      duration: 0.6,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`text-lg leading-relaxed origin-left cursor-default select-none font-medium transition-colors duration-500 ${
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
