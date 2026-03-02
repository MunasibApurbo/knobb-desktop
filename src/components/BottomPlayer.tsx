import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, ListMusic, Heart, Mic2, Maximize2, Loader2, Radio
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { VisualizerSelector } from "@/components/visualizers/VisualizerSelector";
import { VolumeBar } from "@/components/VolumeBar";
import { PlayerSettings } from "@/components/PlayerSettings";
import { KeyboardShortcutsOverlay } from "@/components/KeyboardShortcutsOverlay";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { useNavigate } from "react-router-dom";

interface BottomPlayerProps {
  onOpenFullScreen?: () => void;
}

export function BottomPlayer({ onOpenFullScreen }: BottomPlayerProps) {
  const {
    currentTrack, isPlaying, currentTime, duration, shuffle, repeat, volume, isLoading, radioMode,
    togglePlay, next, previous, toggleShuffle, toggleRepeat, setVolume, seek, openRightPanel,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();

  if (!currentTrack) return null;

  const trackDuration = duration || currentTrack.duration;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="h-[120px] shrink-0 glass-heavy border-t border-white/[0.06] flex flex-col"
      >
        {/* Top row: track info + controls + volume */}
        <div className="flex items-center px-4 pt-2 gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-0 w-[280px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentTrack.id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25 }}
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-md object-cover shadow-lg cursor-pointer hover:brightness-110 transition"
                onClick={onOpenFullScreen}
              />
            </AnimatePresence>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-foreground">{currentTrack.title}</p>
              <p
                className={`text-xs truncate ${currentTrack.artistId ? "text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors" : "text-muted-foreground"}`}
                onClick={() => currentTrack.artistId && navigate(`/artist/${currentTrack.artistId}?name=${encodeURIComponent(currentTrack.artist)}`)}
              >
                {currentTrack.artist}
              </p>
            </div>
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 shrink-0"
              onClick={() => toggleLike(currentTrack)}
            >
              <Heart className={`w-4 h-4 transition-colors ${isLiked(currentTrack.id) ? "text-[hsl(var(--dynamic-accent))] fill-current" : "text-muted-foreground hover:text-foreground"}`} />
            </Button>
          </div>

          {/* Center: Controls */}
          <div className="flex-1 flex items-center justify-center gap-4">
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 transition-colors ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={previous}>
              <SkipBack className="w-5 h-5 fill-current" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-10 h-10 rounded-full bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/20 transition-all active:scale-95"
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
            <Button variant="ghost" size="icon" className="w-8 h-8 text-foreground" onClick={next}>
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

          {/* Right: Volume + Actions */}
          <div className="flex items-center gap-2 w-[280px] justify-end">
            {radioMode && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border" style={{ color: `hsl(var(--dynamic-accent))`, borderColor: `hsl(var(--dynamic-accent) / 0.3)` }}>
                <Radio className="w-3 h-3 inline mr-0.5" />RADIO
              </span>
            )}
            <PlayerSettings />
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => openRightPanel("queue")}>
              <ListMusic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => openRightPanel("lyrics")}>
              <Mic2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <VolumeBar
              volume={volume}
              onChange={setVolume}
              className="w-28"
            />
          </div>
        </div>

        {/* Waveform Seekbar — full width with timestamps */}
        <div className="flex-1 flex items-center gap-3 px-4 pb-2">
          <span className="text-[11px] font-mono w-10 text-right tabular-nums"
            style={{ color: `hsl(var(--dynamic-accent))` }}>
            {formatDuration(Math.floor(currentTime))}
          </span>
          <div
            className="flex-1 h-10 cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seek(pct * trackDuration);
            }}
          >
            <VisualizerSelector className="h-full" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground w-10 tabular-nums">
            {formatDuration(Math.floor(trackDuration))}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
