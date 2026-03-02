import { usePlayer } from "@/contexts/PlayerContext";
import { mockLyrics } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export function RightPanel() {
  const { currentTrack, currentTime, showRightPanel, toggleRightPanel, isPlaying, queue } = usePlayer();
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [tab, setTab] = useState<"now" | "lyrics" | "queue">("now");

  const activeLyricIdx = currentTrack ? mockLyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0) : 0;

  // Auto-scroll to active lyric
  useEffect(() => {
    if (!showRightPanel || !currentTrack || tab !== "lyrics") return;
    const el = lyricRefs.current[activeLyricIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLyricIdx, showRightPanel, currentTrack, tab]);

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
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-foreground">
              {tab === "now" ? currentTrack.title : tab === "lyrics" ? "Lyrics" : "Queue"}
            </h3>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground rounded-full transition-colors" onClick={toggleRightPanel}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pb-3">
            {(["now", "lyrics", "queue"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {t === "now" ? "Now Playing" : t === "lyrics" ? "Lyrics" : "Queue"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <ScrollArea className="flex-1">
            {tab === "now" && (
              <div className="px-4 pb-6">
                {/* Large Artwork — Dribbblish style */}
                <motion.div
                  key={currentTrack.id}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative overflow-hidden rounded-lg aspect-square mb-5 shadow-2xl"
                >
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className={`w-full h-full object-cover transition-transform duration-[3000ms] ${isPlaying ? "scale-105" : "scale-100"}`}
                  />
                </motion.div>

                {/* Track info */}
                <motion.div
                  key={`info-${currentTrack.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h3 className="text-lg font-bold text-foreground truncate">{currentTrack.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{currentTrack.artist}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{currentTrack.album}</p>
                </motion.div>
              </div>
            )}

            {tab === "lyrics" && (
              <div className="px-4 pb-6 space-y-5 py-6">
                {mockLyrics.map((line, i) => {
                  const isActive = i === activeLyricIdx;
                  const isPast = i < activeLyricIdx;
                  return (
                    <motion.p
                      key={i}
                      ref={(el) => { lyricRefs.current[i] = el; }}
                      animate={{
                        opacity: isActive ? 1 : isPast ? 0.25 : 0.4,
                      }}
                      transition={{ duration: 0.4 }}
                      className={`text-base leading-relaxed cursor-default transition-all duration-300 ${
                        isActive
                          ? "text-foreground font-bold text-lg lyric-active"
                          : "text-muted-foreground"
                      }`}
                    >
                      {line.text}
                    </motion.p>
                  );
                })}
              </div>
            )}

            {tab === "queue" && (
              <div className="pb-4">
                <div className="px-4 py-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Now Playing</p>
                </div>
                <div className="px-2">
                  <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-accent/40">
                    <img src={currentTrack.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{currentTrack.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Next Up</p>
                </div>
                <div className="px-2 space-y-0.5">
                  {queue.filter((t) => t.id !== currentTrack.id).slice(0, 15).map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer"
                    >
                      <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
