import { lazy, Suspense, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { formatAudioQualityLabel } from "@/lib/audioQuality";
import { useSmoothedPlaybackTime } from "@/hooks/useSmoothedPlaybackTime";
import { formatDuration } from "@/lib/utils";
import {
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

type MobilePlayerProgressProps = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onSeek: (time: number) => void;
};

function MobilePlayerProgress({
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  onSeek,
}: MobilePlayerProgressProps) {
  const smoothedCurrentTime = useSmoothedPlaybackTime({
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
  });

  return (
    <div className="mx-auto mt-6 w-full max-w-sm">
      <Slider
        aria-label="Seek track"
        max={Math.max(duration, 1)}
        min={0}
        value={[Math.min(smoothedCurrentTime, Math.max(duration, 1))]}
        onValueChange={(values) => {
          onSeek(values[0] ?? 0);
        }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-white/52">
        <span>{formatDuration(Math.floor(smoothedCurrentTime))}</span>
        <span>{formatDuration(Math.floor(duration))}</span>
      </div>
    </div>
  );
}

export function MobilePlayerSheet({
  onOpenChange,
  open,
}: MobilePlayerSheetProps) {
  const {
    currentTime,
    currentTrack,
    duration,
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
  const { lyricsSyncMode } = useSettings();

  const currentIndex = useMemo(
    () => (currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1),
    [currentTrack, queue],
  );
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const activeDuration = duration || currentTrack?.duration || 0;

  if (!currentTrack) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mobile-player-sheet-dialog left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 shadow-none">
        <DialogTitle className="sr-only">Now playing</DialogTitle>
        <DialogDescription className="sr-only">
          Full-screen player controls, queue, and lyrics.
        </DialogDescription>
        <div className="mobile-player-sheet relative flex h-full flex-col overflow-hidden">
          <div className="mobile-player-sheet-backdrop absolute inset-0 bg-black" />

          <div className="relative z-10 flex flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
            <div className="mb-3 flex items-center justify-center">
              <div className="h-1.5 w-12 rounded-full bg-white/18" />
            </div>

            <div className="mobile-player-artwork-panel mx-auto mt-2 w-full max-w-sm overflow-hidden">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="aspect-square w-full object-cover"
              />
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-sm items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-2xl font-black tracking-tight text-white">{currentTrack.title}</p>
                <p className="mt-1 truncate text-sm text-white/58">{currentTrack.artist}</p>
              </div>
              {currentTrack.audioQuality ? (
                <span className="player-quality-badge shrink-0 text-white/62">
                  {formatAudioQualityLabel(currentTrack.audioQuality)}
                </span>
              ) : null}
            </div>

            <MobilePlayerProgress
              currentTime={currentTime}
              duration={activeDuration}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              onSeek={seek}
            />

            <div className="mx-auto mt-6 flex w-full max-w-sm items-center justify-between">
              <Button
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={`h-11 w-11 rounded-full text-white/68 ${shuffle ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                onClick={toggleShuffle}
              >
                <Shuffle className="h-5 w-5" />
              </Button>
              <Button
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full text-white"
                onClick={previous}
              >
                <SkipBack className="h-6 w-6 fill-current" />
              </Button>
              <Button
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className="h-16 w-16 rounded-full bg-white text-black hover:bg-white"
                onClick={togglePlay}
                disabled={isLoading && !isPlaying}
              >
                {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
              </Button>
              <Button
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full text-white"
                onClick={next}
              >
                <SkipForward className="h-6 w-6 fill-current" />
              </Button>
              <Button
                allowGlobalShortcuts
                variant="ghost"
                size="icon"
                className={`h-11 w-11 rounded-full text-white/68 ${repeat !== "off" ? "text-[hsl(var(--dynamic-accent))]" : ""}`}
                onClick={toggleRepeat}
              >
                {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </Button>
            </div>

            <div className="mx-auto mt-8 flex w-full max-w-sm gap-2">
              <button
                type="button"
                className={`mobile-player-tab ${rightPanelTab === "queue" ? "is-active" : ""}`}
                onClick={() => setRightPanelTab("queue")}
              >
                <ListMusic className="h-4 w-4" />
                Queue
              </button>
              <button
                type="button"
                className={`mobile-player-tab ${rightPanelTab === "lyrics" ? "is-active" : ""}`}
                onClick={() => setRightPanelTab("lyrics")}
              >
                <Mic2 className="h-4 w-4" />
                Lyrics
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1">
              {rightPanelTab === "lyrics" ? (
                <div className="mobile-player-panel h-full overflow-hidden">
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
                </div>
              ) : (
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
                              onClick={() => play(track, queue)}
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
                              onClick={() => removeFromQueue(queueIndex)}
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
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
