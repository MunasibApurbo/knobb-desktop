import {
  X, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1,
  Loader2, ChevronDown, Volume2, VolumeX, Volume1
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration } from "@/data/mockData";
import { getLyrics, TidalLyricLine } from "@/lib/monochromeApi";
import { Button } from "@/components/ui/button";
import { VolumeBar } from "@/components/VolumeBar";
import { CircularVisualizer } from "@/components/visualizers/CircularVisualizer";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";

interface FullScreenPlayerProps {
  open: boolean;
  onClose: () => void;
}

export function FullScreenPlayer({ open, onClose }: FullScreenPlayerProps) {
  const {
    currentTrack, isPlaying, currentTime, duration, shuffle, repeat, volume, isLoading,
    togglePlay, next, previous, toggleShuffle, toggleRepeat, setVolume, seek,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [lyrics, setLyrics] = useState<TidalLyricLine[]>([]);
  const lastTrackRef = useRef<string | null>(null);

  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    if (lastTrackRef.current === currentTrack.id) return;
    lastTrackRef.current = currentTrack.id;
    setLyrics([]);
    if (currentTrack.tidalId) {
      const fetched = await getLyrics(currentTrack.tidalId);
      if (fetched.length > 0) { setLyrics(fetched); return; }
    }
  }, [currentTrack]);

  useEffect(() => { fetchLyrics(); }, [fetchLyrics]);

  const trackDuration = duration || currentTrack?.duration || 0;
  const progress = trackDuration > 0 ? currentTime / trackDuration : 0;

  const activeLyricIdx = lyrics.length > 0
    ? lyrics.reduce((acc, l, i) => (currentTime >= l.time ? i : acc), 0)
    : -1;

  useEffect(() => {
    if (!open || activeLyricIdx < 0) return;
    const el = lyricRefs.current[activeLyricIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLyricIdx, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex bg-background overflow-hidden"
        >
          {/* Background blur with album art */}
          <div className="absolute inset-0">
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="w-full h-full object-cover blur-[80px] scale-125 opacity-30"
            />
            <div className="absolute inset-0 bg-background/70" />
          </div>

          {/* Close button */}
          <Button
            variant="ghost" size="icon"
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full text-muted-foreground hover:text-foreground bg-background/30 backdrop-blur-md"
            onClick={onClose}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>

          {/* Main content */}
          <div className="relative flex flex-1 items-center justify-center gap-12 px-12 py-8">
            {/* Left: Album art + controls */}
            <div className="flex flex-col items-center gap-6 w-[420px] shrink-0">
              <motion.div
                key={currentTrack.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-[380px] h-[380px] rounded-2xl overflow-hidden shadow-2xl"
              >
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover transition-transform duration-[5000ms] ${isPlaying ? "scale-110" : "scale-100"}`}
                />
                {/* Subtle overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </motion.div>

              {/* Track info */}
              <div className="text-center w-full px-4">
                <h2 className="text-2xl font-bold text-foreground truncate">{currentTrack.title}</h2>
                <p className="text-base text-muted-foreground mt-1">{currentTrack.artist}</p>
              </div>

              {/* Progress */}
              <div className="w-full px-2">
                <Slider
                  value={[progress * 100]}
                  onValueChange={([v]) => seek((v / 100) * trackDuration)}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatDuration(Math.floor(currentTime))}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatDuration(Math.floor(trackDuration))}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon"
                  className={`w-10 h-10 ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={toggleShuffle}
                >
                  <Shuffle className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-12 h-12 text-foreground" onClick={previous}>
                  <SkipBack className="w-6 h-6 fill-current" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="w-16 h-16 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95"
                  onClick={togglePlay}
                  disabled={isLoading && !isPlaying}
                >
                  {isLoading && !isPlaying ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 ml-1" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="w-12 h-12 text-foreground" onClick={next}>
                  <SkipForward className="w-6 h-6 fill-current" />
                </Button>
                <Button variant="ghost" size="icon"
                  className={`w-10 h-10 ${repeat !== "off" ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={toggleRepeat}
                >
                  {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </Button>
              </div>

              {/* Volume + Like */}
              <div className="flex items-center gap-3 w-full px-6">
                <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => toggleLike(currentTrack)}>
                  <Heart className={`w-5 h-5 transition-colors ${isLiked(currentTrack.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground"}`} />
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-muted-foreground"
                  onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
                >
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <VolumeBar volume={volume} onChange={setVolume} className="w-28" />
              </div>
            </div>

            {/* Right: Lyrics */}
            <div className="flex-1 h-[70vh] overflow-y-auto scrollbar-thin max-w-[500px]">
              {lyrics.length > 0 ? (
                <div className="space-y-8 py-[30vh]">
                  {lyrics.map((line, i) => {
                    const isActive = i === activeLyricIdx;
                    const isPast = i < activeLyricIdx;
                    return (
                      <motion.p
                        key={i}
                        ref={(el) => { lyricRefs.current[i] = el; }}
                        animate={{
                          scale: isActive ? 1.05 : 1,
                          opacity: isActive ? 1 : isPast ? 0.15 : 0.3,
                        }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className={`text-2xl leading-relaxed origin-left cursor-default select-none font-semibold transition-colors duration-500 ${
                          isActive ? "text-foreground lyric-active" : "text-muted-foreground"
                        }`}
                        onClick={() => seek(line.time)}
                      >
                        {line.text}
                      </motion.p>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <CircularVisualizer className="w-[300px] h-[300px]" />
                </div>
              )}
            </div>
          </div>

          {/* Bottom visualizer strip */}
          <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none">
            <div className="w-full h-full opacity-40">
              <CircularVisualizer />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
