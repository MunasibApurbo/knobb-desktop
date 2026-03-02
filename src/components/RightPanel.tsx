import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { mockLyrics, formatDuration } from "@/data/mockData";
import { getLyrics, TidalLyricLine } from "@/lib/monochromeApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Music2, Mic2, ListMusic, Heart, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

type TabType = "lyrics" | "queue";

export function RightPanel() {
  const { currentTrack, currentTime, showRightPanel, toggleRightPanel, isPlaying, queue, play } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [tab, setTab] = useState<TabType>("lyrics");
  const [lyrics, setLyrics] = useState<TidalLyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lastLyricsTrackRef = useRef<string | null>(null);

  // Fetch lyrics when track changes
  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    if (lastLyricsTrackRef.current === currentTrack.id) return;
    lastLyricsTrackRef.current = currentTrack.id;
    
    setLyricsLoading(true);
    setLyrics([]);
    
    if (currentTrack.tidalId) {
      const fetched = await getLyrics(currentTrack.tidalId);
      if (fetched.length > 0) {
        setLyrics(fetched);
        setLyricsLoading(false);
        return;
      }
    }
    
    // Fallback to mock lyrics
    setLyrics(mockLyrics);
    setLyricsLoading(false);
  }, [currentTrack]);

  useEffect(() => {
    fetchLyrics();
  }, [fetchLyrics]);

  const activeLyricIdx = currentTrack && lyrics.length > 0
    ? lyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0)
    : 0;

  // Auto-scroll to active lyric
  useEffect(() => {
    if (!showRightPanel || !currentTrack || tab !== "lyrics") return;
    const el = lyricRefs.current[activeLyricIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLyricIdx, showRightPanel, currentTrack, tab]);

  if (!currentTrack) return null;

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

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
              <div className="absolute inset-0 pointer-events-none opacity-10" style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.06) 2px, hsl(0 0% 0% / 0.06) 4px)",
              }} />
            </motion.div>
          </div>

          {/* Track info */}
          <div className="px-5 pb-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <motion.h3 key={`t-${currentTrack.id}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-base font-bold text-foreground truncate">
                {currentTrack.title}
              </motion.h3>
              <motion.p
                key={`a-${currentTrack.id}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className={`text-sm ${currentTrack.artistId ? "text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors" : "text-muted-foreground"}`}
                onClick={() => currentTrack.artistId && navigate(`/artist/${currentTrack.artistId}?name=${encodeURIComponent(currentTrack.artist)}`)}
              >
                {currentTrack.artist}
              </motion.p>
            </div>
            <button onClick={() => toggleLike(currentTrack)}>
              <Heart className={`w-5 h-5 transition-colors ${isLiked(currentTrack.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 pb-2">
            <button
              onClick={() => setTab("lyrics")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === "lyrics" ? "bg-foreground text-background" : "bg-accent text-muted-foreground hover:bg-accent/80"
              }`}
            >
              <Mic2 className="w-3 h-3" />
              Lyrics
            </button>
            <button
              onClick={() => setTab("queue")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === "queue" ? "bg-foreground text-background" : "bg-accent text-muted-foreground hover:bg-accent/80"
              }`}
            >
              <ListMusic className="w-3 h-3" />
              Queue ({upNext.length})
            </button>
          </div>

          {/* Tab Content */}
          {tab === "lyrics" ? (
            <ScrollArea className="flex-1 px-5 pb-6">
              {lyricsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : lyrics.length === 0 ? (
                <div className="text-center py-12">
                  <Mic2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No lyrics available</p>
                </div>
              ) : (
                <div className="space-y-6 py-6">
                  {lyrics.map((line, i) => {
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
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className={`text-lg leading-relaxed origin-left cursor-default select-none font-medium transition-colors duration-500 ${
                          isActive ? "text-foreground font-bold lyric-active" : "text-muted-foreground"
                        }`}
                      >
                        {line.text}
                      </motion.p>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          ) : (
            <ScrollArea className="flex-1 px-3 pb-6">
              {/* Now Playing */}
              <div className="px-2 pt-3 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
              </div>
              <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-accent/20">
                <img src={currentTrack.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: `hsl(var(--dynamic-accent))` }}>{currentTrack.title}</p>
                  <p className="text-xs text-muted-foreground truncate"><ArtistLink name={currentTrack.artist} artistId={currentTrack.artistId} className="text-xs" /></p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{formatDuration(currentTrack.duration)}</span>
              </div>

              {/* Up Next */}
              {upNext.length > 0 && (
                <>
                  <div className="px-2 pt-4 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Up</span>
                  </div>
                  {upNext.map((track, i) => (
                    <button
                      key={`${track.id}-${i}`}
                      className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-accent/15 transition-colors text-left group"
                      onClick={() => play(track, queue)}
                    >
                      <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate text-foreground">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /></p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                    </button>
                  ))}
                </>
              )}
              {upNext.length === 0 && (
                <div className="text-center py-8">
                  <ListMusic className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Queue is empty</p>
                </div>
              )}
            </ScrollArea>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
