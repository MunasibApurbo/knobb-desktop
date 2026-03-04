import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Loader2, ChevronDown, Volume2, VolumeX, Volume1, Share2
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration } from "@/lib/utils";
import { getLyrics, TidalLyricLine } from "@/lib/monochromeApi";
import { Button } from "@/components/ui/button";
import { VolumeBar } from "@/components/VolumeBar";
import { CircularVisualizer } from "@/components/visualizers/CircularVisualizer";
import { BeautifulLyrics } from "@/components/BeautifulLyrics";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

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
  const [lyrics, setLyrics] = useState<TidalLyricLine[]>([]);
  const lastTrackRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

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

  // Swipe gestures for mobile
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-200, 0, 200], [0.3, 1, 0.3]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 80) {
      if (info.offset.x > 0) previous();
      else next();
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleShare = useCallback(() => {
    const text = `${currentTrack?.title} — ${currentTrack?.artist}`;
    if (navigator.share) {
      navigator.share({ title: currentTrack?.title, text }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[100] flex bg-background overflow-hidden"
        >
          {/* Background blur with album art */}
          <motion.div className="absolute inset-0" style={{ opacity: bgOpacity }}>
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="w-full h-full object-cover blur-[80px] scale-125 opacity-30"
            />
            <div className="absolute inset-0 bg-background/70" />
          </motion.div>

          {/* Close button */}
          <Button
            variant="ghost" size="icon"
            className="absolute top-4 left-4 z-10 w-10 h-10  text-muted-foreground hover:text-foreground bg-background/30 backdrop-blur-md"
            onClick={onClose}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>

          {/* Share button */}
          <Button
            variant="ghost" size="icon"
            className="absolute top-4 right-4 z-10 w-10 h-10  text-muted-foreground hover:text-foreground bg-background/30 backdrop-blur-md"
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
          </Button>

          {/* Main content */}
          <div className={`relative flex flex-1 items-center justify-center ${isMobile ? "flex-col px-6 py-16" : "gap-12 px-12 py-8"}`}>
            {/* Left: Album art + controls */}
            <motion.div
              className={`flex flex-col items-center gap-4 ${isMobile ? "w-full" : "gap-6 w-[420px]"} shrink-0`}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={handleDragEnd}
              style={{ x }}
            >
              <motion.div
                key={currentTrack.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`relative ${isMobile ? "w-[280px] h-[280px]" : "w-[380px] h-[380px]"}  overflow-hidden shadow-2xl`}
              >
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover transition-transform duration-[5000ms] ${isPlaying ? "scale-110" : "scale-100"}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </motion.div>

              {/* Track info */}
              <div className="text-center w-full px-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h2 className={`${isMobile ? "text-lg" : "text-xl"} font-bold text-foreground truncate`}>{currentTrack.title}</h2>
                  {currentTrack.explicit && (
                    <span className="flex-shrink-0 px-1 py-0.5 text-[10px] font-bold bg-muted-foreground/20 text-muted-foreground rounded-[2px] leading-none uppercase">
                      E
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
                  {currentTrack.audioQuality && (currentTrack.audioQuality === "LOSSLESS" || currentTrack.audioQuality === "MAX") && (
                    <span className={`text-[10px] font-black px-2 py-1 rounded-[2px] leading-none tracking-tighter ${currentTrack.audioQuality === "MAX" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                      }`}>
                      {currentTrack.audioQuality}
                    </span>
                  )}
                </div>
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
                  className="w-16 h-16  bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-95"
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

              {/* Volume - desktop only */}
              {!isMobile && (
                <div className="flex items-center gap-3 w-full px-6 justify-end">
                  <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-muted-foreground"
                    onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
                  >
                    {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <VolumeBar volume={volume} onChange={setVolume} className="w-28" />
                </div>
              )}
            </motion.div>

            {/* Right: Lyrics - desktop only */}
            {!isMobile && (
              <div className="flex-1 h-[70vh] max-w-[520px]">
                {lyrics.length > 0 ? (
                  <BeautifulLyrics
                    lyrics={lyrics}
                    currentTime={currentTime}
                    onSeek={seek}
                    isPlaying={isPlaying}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <CircularVisualizer className="w-[300px] h-[300px]" />
                  </div>
                )}
              </div>
            )}
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
