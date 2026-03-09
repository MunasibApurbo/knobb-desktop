import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Music2, ListMusic, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtistLink } from "@/components/ArtistLink";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { TrackOptionsMenu } from "@/components/TrackOptionsMenu";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";

const LyricsPanel = lazy(async () => {
  const module = await import("@/components/LyricsPanel");
  return { default: module.LyricsPanel };
});

export function RightPanel() {
  const { currentTrack, currentTime, toggleRightPanel, rightPanelTab, isPlaying, queue, play, reorderQueue, removeFromQueue, seek } = usePlayer();
  const { rightPanelStyle, lyricsSyncMode } = useSettings();
  const navigate = useNavigate();
  const tab = rightPanelTab;

  if (!currentTrack) return null;

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  return (
    <div className={`right-panel-shell h-full flex flex-col overflow-hidden chrome-bar relative isolate ${rightPanelStyle === "artwork" ? "right-panel-shell-artwork" : "right-panel-shell-classic"}`}>
      {rightPanelStyle === "artwork" ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <motion.img
            key={`panel-bg-${currentTrack.id}`}
            src={currentTrack.coverUrl}
            alt=""
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 0.85, scale: 1.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-[-22%] h-[144%] w-[144%] object-cover blur-[40px] saturate-[1.2] brightness-[0.6]"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "hsl(0 0% 0% / 0.4)",
            }}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[hsl(var(--sidebar-background))]" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 xl:px-6 xl:pt-5">
        <div className="flex items-center gap-2">
          <Music2 className="right-panel-compact-icon h-5 w-5 text-muted-foreground" absoluteStrokeWidth />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
        </div>
        <Button variant="ghost" size="icon" className="right-panel-control h-9 w-9 text-muted-foreground hover:text-foreground transition-colors" onClick={toggleRightPanel}>
          <X className="h-5 w-5" absoluteStrokeWidth />
        </Button>
      </div>

      {/* Artwork */}
      <div className="px-4 pb-4 xl:px-6">
        <motion.div
          key={currentTrack.id}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="right-panel-artwork relative overflow-hidden aspect-square shadow-2xl group"
        >
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className={`w-full h-full object-cover transition-transform ${isPlaying ? "scale-105" : "scale-100"}`}
            style={{ transitionDuration: "3000ms" }}
          />

          <div className="absolute inset-0 pointer-events-none opacity-10" style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 0% 0% / 0.06) 2px, hsl(0 0% 0% / 0.06) 4px)",
          }} />
        </motion.div>
      </div>

      {/* Track info */}
      <div className="flex items-end gap-3 px-4 pb-3 xl:px-6">
        <div className="flex-1 min-w-0">
          <motion.h3 key={`t-${currentTrack.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-base font-bold text-foreground truncate">
            {currentTrack.title}
          </motion.h3>
          <motion.p
            key={`a-${currentTrack.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="text-sm text-muted-foreground"
          >
            {currentTrack.artists && currentTrack.artists.length > 0 ? (
              currentTrack.artists.map((a, i) => (
                <span key={a.id}>
                  <span
                    className="hover:text-foreground hover:underline cursor-pointer transition-colors inline"
                    onClick={() => navigate(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`)}
                  >
                    {a.name}
                  </span>
                  {i < currentTrack.artists!.length - 1 && <span className="text-muted-foreground">, </span>}
                </span>
              ))
            ) : (
              <span
                className={currentTrack.artistId ? "hover:text-foreground hover:underline cursor-pointer transition-colors" : ""}
                onClick={() => currentTrack.artistId && navigate(`/artist/${currentTrack.artistId}?name=${encodeURIComponent(currentTrack.artist)}`)}
              >
                {currentTrack.artist}
              </span>
            )}
          </motion.p>
        </div>
        <TrackOptionsMenu
          track={currentTrack}
          tracks={queue}
          buttonClassName="right-panel-control right-panel-menu-button h-9 w-9 shrink-0 rounded-none bg-transparent p-0 text-white/76 shadow-none backdrop-blur-0 hover:bg-transparent hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {/* Tab Content */}
      {tab === "lyrics" ? (
        <div className="flex-1 overflow-hidden px-3 pb-5 xl:px-4 xl:pb-6">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading lyrics...
              </div>
            }
          >
            <LyricsPanel
              currentTime={lyricsSyncMode === "follow" ? currentTime : 0}
              onSeek={seek}
              track={currentTrack}
            />
          </Suspense>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 pb-5 xl:px-5 xl:pb-6">
          {/* Now Playing */}
          <div className="px-2 pt-3 pb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now Playing</span>
          </div>
          <div className="right-panel-row flex items-center gap-3 px-2 py-2.5 bg-accent/20">
            <img src={currentTrack.coverUrl} alt="" className="w-11 h-11 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: `hsl(var(--dynamic-accent))` }}>{currentTrack.title}</p>
              <p className="text-sm text-muted-foreground truncate"><ArtistLink name={currentTrack.artist} artistId={currentTrack.artistId} className="text-sm" /></p>
            </div>
            <span className="text-sm text-muted-foreground font-mono">{formatDuration(currentTrack.duration)}</span>
          </div>

          {/* Up Next */}
          {upNext.length > 0 && (
            <>
              <div className="px-2 pt-4 pb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Next Up</span>
              </div>
              {upNext.map((track, i) => {
                const queueIdx = currentIdx + 1 + i;
                return (
                  <TrackContextMenu key={`${track.id}-${i}`} track={track} tracks={queue}>
                    <div
                      className="right-panel-row flex items-center gap-2 w-full px-2 py-2.5 hover:bg-accent/15 transition-colors text-left group"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("queue-idx", String(queueIdx))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData("queue-idx"));
                        if (!isNaN(from) && from !== queueIdx) reorderQueue(from, queueIdx);
                      }}
                    >
                      <GripVertical className="w-[18px] h-[18px] text-muted-foreground opacity-0 group-hover:opacity-60 cursor-grab shrink-0" />
                      <img src={track.coverUrl} alt="" className="w-11 h-11 object-cover shrink-0 cursor-pointer" onClick={() => play(track, queue)} />
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => play(track, queue)}>
                        <p className="text-sm truncate text-foreground">{track.title}</p>
                        <p className="text-sm text-muted-foreground truncate"><ArtistLink name={track.artist} artistId={track.artistId} className="text-sm" /></p>
                      </div>
                      <AddToPlaylistMenu track={track}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground">
                          <ListMusic className="h-5 w-5" />
                        </Button>
                      </AddToPlaylistMenu>
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromQueue(queueIdx)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <span className="text-sm text-muted-foreground font-mono">{formatDuration(track.duration)}</span>
                    </div>
                  </TrackContextMenu>
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
