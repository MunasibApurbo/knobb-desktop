import { usePlayer } from "@/contexts/PlayerContext";
import { mockLyrics } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function RightPanel() {
  const { currentTrack, currentTime, showRightPanel, toggleRightPanel } = usePlayer();

  if (!showRightPanel || !currentTrack) return null;

  const activeLyricIdx = mockLyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0);

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-80 shrink-0 h-full glass-heavy rounded-xl m-2 ml-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-semibold text-foreground">Now Playing</span>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={toggleRightPanel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Canvas / Artwork */}
        <div className="px-4">
          <div className="relative rounded-xl overflow-hidden aspect-square">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at center, hsl(${currentTrack.canvasColor} / 0.6), transparent)`,
              }}
            />
          </div>
        </div>

        {/* Track info */}
        <div className="px-4 pt-3 pb-1">
          <h3 className="text-base font-bold text-foreground truncate">{currentTrack.title}</h3>
          <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
        </div>

        {/* Lyrics */}
        <div className="px-4 pt-2 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lyrics</span>
        </div>
        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-3 py-2">
            {mockLyrics.map((line, i) => (
              <p
                key={i}
                className={`text-sm transition-all duration-300 ${
                  i === activeLyricIdx
                    ? "text-foreground font-semibold scale-105 origin-left"
                    : i < activeLyricIdx
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground"
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
        </ScrollArea>
      </motion.aside>
    </AnimatePresence>
  );
}
