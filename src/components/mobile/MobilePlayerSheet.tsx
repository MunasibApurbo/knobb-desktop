import { Drawer } from "vaul";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useMemo, useRef } from "react";

import { PlayerSeekRow } from "@/components/player/PlayerSeekRow";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatAudioQualityLabel } from "@/lib/audioQuality";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getMotionProfile } from "@/lib/motion";
import { formatDuration } from "@/lib/utils";
import { triggerImpactHaptic, triggerSelectionHaptic } from "@/lib/haptics";
import {
  Heart,
  ListMusic,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";

const LyricsPanel = lazy(async () => {
  const module = await import("@/components/LyricsPanel");
  return { default: module.LyricsPanel };
});

interface MobilePlayerSheetProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function MobilePlayerSheet({
  onOpenChange,
  open,
}: MobilePlayerSheetProps) {
  const {
    currentTrack,
    isLoading,
    isPlaying,
    next,
    playbackSpeed,
    play,
    previous,
    queue,
    removeFromQueue,
    repeat,
    rightPanelTab,
    seek,
    setRightPanelTab,
    shuffle,
    togglePlay,
    toggleRepeat,
    toggleShuffle,
  } = usePlayer();
  const { currentTime, duration } = usePlayerTimeline();
  const { isLiked, toggleLike } = useLikedSongs();
  const { lyricsSyncMode } = useSettings();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentIndex = useMemo(
    () => (currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1),
    [currentTrack, queue],
  );
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const activeDuration = duration || currentTrack?.duration || 0;

  const switchPanel = (tab: "lyrics" | "queue") => {
    if (rightPanelTab === tab) return;
    triggerSelectionHaptic();
    setRightPanelTab(tab);
  };

  const handlePanelTouchStart = (clientX: number, clientY = 0) => {
    swipeStartRef.current = { x: clientX, y: clientY };
  };

  const handlePanelTouchEnd = (clientX: number) => {
    if (!swipeStartRef.current) return;

    const delta = clientX - swipeStartRef.current.x;
    swipeStartRef.current = null;

    if (Math.abs(delta) < 44) return;

    if (delta < 0) {
      switchPanel("queue");
      return;
    }

    switchPanel("lyrics");
  };

  const handleArtworkTouchEnd = (clientX: number, clientY: number) => {
    if (!swipeStartRef.current) return;

    const deltaX = clientX - swipeStartRef.current.x;
    const deltaY = clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(deltaY) <= Math.abs(deltaX)) return;

    if (deltaY < -46) {
      switchPanel("lyrics");
      return;
    }

    if (deltaY > 62) {
      triggerImpactHaptic("light");
      onOpenChange(false);
    }
  };

  if (!currentTrack) return null;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[90] backdrop-blur-[2px]" />
        <Drawer.Content className="mobile-player-sheet-dialog fixed inset-x-0 bottom-0 z-[91] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden rounded-t-[calc(var(--surface-radius-lg)*1.5)] border-0 bg-black outline-none text-foreground">
          <Drawer.Title className="sr-only">Now playing</Drawer.Title>
          <Drawer.Description className="sr-only">
            Full-screen player controls, queue, and lyrics.
          </Drawer.Description>
          <div className="mobile-player-sheet relative flex h-full flex-col overflow-hidden w-full">
            <div className="mobile-player-sheet-backdrop absolute inset-0 overflow-hidden bg-black/80 pointer-events-none">
              <img
                src={currentTrack.coverUrl}
                alt=""
                className="h-full w-full object-cover blur-3xl opacity-50 scale-125 saturate-150"
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            <div className="relative z-10 flex flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(calc(1rem+env(safe-area-inset-top)),2rem)] sm:px-6 min-h-0">
              <div className="mb-2 shrink-0 flex items-center justify-center">
                <div className="h-1.5 w-12 rounded-full bg-white/30" />
              </div>

              {/* Responsive Artwork Container */}
              <div
                className="flex min-h-[0px] shrink flex-1 items-center justify-center py-2 sm:py-4"
                onTouchStart={(event) =>
                  handlePanelTouchStart(
                    event.changedTouches[0]?.clientX ?? 0,
                    event.changedTouches[0]?.clientY ?? 0,
                  )
                }
                onTouchEnd={(event) =>
                  handleArtworkTouchEnd(
                    event.changedTouches[0]?.clientX ?? 0,
                    event.changedTouches[0]?.clientY ?? 0,
                  )
                }
              >
                <div className="mobile-player-artwork-panel flex w-full max-w-[min(80vw,24rem)] items-center justify-center">
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="h-auto max-h-full w-full aspect-square object-cover"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center">
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                  Swipe up for lyrics
                </div>
              </div>

              <div className="shrink-0">
                <div className="mx-auto mt-2 flex w-full max-w-sm items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-2xl font-black tracking-tight text-white/95">{currentTrack.title}</p>
                    <p className="mt-1 truncate text-base font-medium text-white/70">{currentTrack.artist}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {currentTrack.audioQuality ? (
                      <span className="player-quality-badge shrink-0" style={{
                        color: currentTrack.audioQuality === "MAX" ? "hsl(var(--dynamic-accent))" : "hsl(var(--player-waveform))",
                        borderColor:
                          currentTrack.audioQuality === "MAX"
                            ? "hsl(var(--dynamic-accent) / 0.2)"
                            : "hsl(var(--player-waveform) / 0.2)",
                        backgroundColor:
                          currentTrack.audioQuality === "MAX"
                            ? "hsl(var(--dynamic-accent) / 0.1)"
                            : "hsl(var(--player-waveform) / 0.1)",
                      }}>
                        {formatAudioQualityLabel(currentTrack.audioQuality)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-2 transition-colors text-white/70 hover:text-white"
                      onClick={() => {
                        triggerImpactHaptic("light");
                        void toggleLike(currentTrack);
                      }}
                    >
                      <Heart className={`h-6 w-6 transition-colors ${isLiked(currentTrack.id) ? "fill-current text-white" : ""}`} />
                    </button>
                  </div>
                </div>
                <div className="mx-auto mt-0 flex w-full max-w-sm shrink-0">
                  <PlayerSeekRow
                    fallbackDuration={activeDuration}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    currentTrackId={currentTrack.id}
                    motionEnabled={motionEnabled}
                    motionProfile={motionProfile}
                    onSeek={seek}
                    variant="mobile"
                  />
                </div>

                <div className="mx-auto mt-6 flex w-full max-w-sm items-center justify-between shrink-0">
                  <Button
                    allowGlobalShortcuts
                    variant="ghost"
                    size="icon"
                    className={`h-11 w-11 rounded-full text-white/68 ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                    onClick={() => {
                      triggerImpactHaptic("light");
                      toggleShuffle();
                    }}
                  >
                    <Shuffle className="h-5 w-5" />
                  </Button>
                  <Button
                    allowGlobalShortcuts
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full text-white"
                    onClick={() => {
                      triggerImpactHaptic("light");
                      previous();
                    }}
                  >
                    <SkipBack className="h-6 w-6 [&_line]:stroke-current [&_polygon]:fill-current [&_polygon]:stroke-current" />
                  </Button>
                  <Button
                    allowGlobalShortcuts
                    variant="ghost"
                    size="icon"
                    className="h-16 w-16 rounded-full bg-white text-black hover:bg-white"
                    onClick={() => {
                      triggerImpactHaptic("medium");
                      togglePlay();
                    }}
                    disabled={isLoading && !isPlaying}
                  >
                    {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
                  </Button>
                  <Button
                    allowGlobalShortcuts
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full text-white"
                    onClick={() => {
                      triggerImpactHaptic("light");
                      next();
                    }}
                  >
                    <SkipForward className="h-6 w-6 [&_line]:stroke-current [&_polygon]:fill-current [&_polygon]:stroke-current" />
                  </Button>
                  <Button
                    allowGlobalShortcuts
                    variant="ghost"
                    size="icon"
                    className={`h-11 w-11 rounded-full text-white/68 ${repeat !== "off" ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                    onClick={() => {
                      triggerImpactHaptic("light");
                      toggleRepeat();
                    }}
                  >
                    {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                  </Button>
                </div>

                <div
                  className="mt-4 min-h-[0px] shrink flex-1 max-h-[35vh] overflow-hidden"
                  data-testid="mobile-player-pane"
                  onTouchStart={(event) =>
                    handlePanelTouchStart(
                      event.changedTouches[0]?.clientX ?? 0,
                      event.changedTouches[0]?.clientY ?? 0,
                    )
                  }
                  onTouchEnd={(event) => handlePanelTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {rightPanelTab === "lyrics" ? (
                      <motion.div
                        key="lyrics-panel"
                        className="mobile-player-panel h-full overflow-hidden"
                        initial={motionEnabled ? { opacity: 0, x: -32 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={motionEnabled ? { opacity: 0, x: 32 } : undefined}
                        transition={{
                          duration: motionEnabled ? motionProfile.duration.base : 0,
                          ease: motionProfile.ease.smooth,
                        }}
                      >
                        <Suspense
                          fallback={
                            <div className="flex h-full items-center justify-center text-sm text-white/58">
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
                      </motion.div>
                    ) : (
                      <motion.div
                        key="queue-panel"
                        className="h-full"
                        initial={motionEnabled ? { opacity: 0, x: 32 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={motionEnabled ? { opacity: 0, x: -32 } : undefined}
                        transition={{
                          duration: motionEnabled ? motionProfile.duration.base : 0,
                          ease: motionProfile.ease.smooth,
                        }}
                      >
                        <ScrollArea className="mobile-player-panel h-full">
                          <div className="space-y-2 p-3">
                            <div className="mobile-player-queue-row is-current">
                              <img
                                src={currentTrack.coverUrl}
                                alt=""
                                className="h-11 w-11 rounded-[calc(var(--cover-radius)-4px)] object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{currentTrack.title}</p>
                                <p className="truncate text-xs text-white/54">{currentTrack.artist}</p>
                              </div>
                              <span className="text-xs font-mono text-white/42">
                                {formatDuration(currentTrack.duration)}
                              </span>
                            </div>

                            {upNext.length > 0 ? (
                              upNext.map((track, index) => {
                                const queueIndex = currentIndex >= 0 ? currentIndex + 1 + index : index;
                                return (
                                  <div key={`${track.id}-${queueIndex}`} className="mobile-player-queue-row">
                                    <button
                                      type="button"
                                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                      aria-label={`${track.title} ${track.artist}`}
                                      onClick={() => {
                                        triggerImpactHaptic("light");
                                        play(track, queue);
                                      }}
                                    >
                                      <img
                                        src={track.coverUrl}
                                        alt=""
                                        className="h-11 w-11 rounded-[calc(var(--cover-radius)-4px)] object-cover"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">{track.title}</p>
                                        <p className="truncate text-xs text-white/52">{track.artist}</p>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/52 transition-colors hover:bg-white/8 hover:text-white"
                                      aria-label="Remove from queue"
                                      onClick={() => {
                                        triggerImpactHaptic("light");
                                        removeFromQueue(queueIndex);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex h-32 items-center justify-center text-sm text-white/52">
                                Queue is empty.
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4 pb-2 flex w-full items-center justify-center gap-3 shrink-0">
                  <button
                    type="button"
                    className={`mobile-player-tab !px-3 !py-3 ${rightPanelTab === "queue" ? "is-active" : "text-white/50"}`}
                    onClick={() => switchPanel("queue")}
                    aria-label="Queue"
                  >
                    <span className="mobile-player-tab-copy">Queue</span>
                    <ListMusic className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    className={`mobile-player-tab !px-3 !py-3 ${rightPanelTab === "lyrics" ? "is-active" : "text-white/50"}`}
                    onClick={() => switchPanel("lyrics")}
                    aria-label="Lyrics"
                  >
                    <span className="mobile-player-tab-copy">Lyrics</span>
                    <Mic2 className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
