import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { mockLyrics, formatDuration } from "@/data/mockData";
import { getLyrics, TidalLyricLine } from "@/lib/monochromeApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Music2, Mic2, ListMusic, Heart, Play, Loader2, GripVertical, Trash2 } from "lucide-react";
import { FilterPill } from "@/components/ui/filter-pill";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { BeautifulLyrics } from "@/components/BeautifulLyrics";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

type TabType = "lyrics" | "queue";

export function RightPanel() {
  const { currentTrack, currentTime, showRightPanel, toggleRightPanel, rightPanelTab, isPlaying, queue, play, reorderQueue, removeFromQueue, seek } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const tab = rightPanelTab;
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


  if (!currentTrack) return null;

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  if (!showRightPanel) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg glass-heavy">
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
          </div>

          {/* Tab Content */}
          {tab === "lyrics" ? (
            <div className="flex-1 overflow-hidden px-3 pb-6">
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
                <BeautifulLyrics
                  lyrics={lyrics}
                  currentTime={currentTime}
                  onSeek={seek}
                  isPlaying={isPlaying}
                />
              )}
            </div>
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
                  {upNext.map((track, i) => {
                    const queueIdx = currentIdx + 1 + i;
                    return (
                      <div
                        key={`${track.id}-${i}`}
                        className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-accent/15 transition-colors text-left group"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("queue-idx", String(queueIdx))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = parseInt(e.dataTransfer.getData("queue-idx"));
                          if (!isNaN(from) && from !== queueIdx) reorderQueue(from, queueIdx);
                        }}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 cursor-grab shrink-0" />
                        <img src={track.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0 cursor-pointer" onClick={() => play(track, queue)} />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => play(track, queue)}>
                          <p className="text-sm truncate text-foreground">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-xs" /></p>
                        </div>
                        <AddToPlaylistMenu track={track}>
                          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-muted-foreground">
                            <ListMusic className="w-3.5 h-3.5" />
                          </Button>
                        </AddToPlaylistMenu>
                        <Button
                          variant="ghost" size="icon"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromQueue(queueIdx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                      </div>
                    );
                  })}
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
    </div>
  );
}
