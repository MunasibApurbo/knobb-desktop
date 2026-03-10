import { ListMusic, Pause, Play } from "lucide-react";

import { SeekSurface } from "@/components/player/SeekSurface";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerImpactHaptic, triggerSelectionHaptic } from "@/lib/haptics";

interface MobileMiniPlayerProps {
  onOpenPlayer: () => void;
  onOpenTab: (tab: "lyrics" | "queue") => void;
}

export function MobileMiniPlayer({
  onOpenPlayer,
  onOpenTab,
}: MobileMiniPlayerProps) {
  const { currentTrack, isPlaying, isLoading, seek, togglePlay } = usePlayer();
  const { currentTime, duration } = usePlayerTimeline();
  const { bottomPlayerStyle } = useSettings();

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const shellVariantClassName = bottomPlayerStyle === "black"
    ? "mobile-mini-player-shell-black"
    : "mobile-mini-player-shell-current";
  const actionVariantClassName = bottomPlayerStyle === "black"
    ? "mobile-mini-player-action-black"
    : "mobile-mini-player-action-current";
  const playVariantClassName = bottomPlayerStyle === "black"
    ? "mobile-mini-player-play-black"
    : "";

  return (
    <div className="mobile-mini-player fixed inset-x-0 z-50">
      <div className="mx-auto w-full max-w-[42rem]">
        <div className={`mobile-mini-player-shell relative flex items-center overflow-hidden ${shellVariantClassName}`}>
          <SeekSurface
            ariaLabel="Seek playback position"
            className="absolute inset-x-0 top-0 z-30 h-4 cursor-pointer"
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
          >
            <div className="mobile-mini-player-progress pointer-events-none bg-white/10">
              <div
                className="h-full bg-[hsl(var(--dynamic-accent))] transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </SeekSurface>

          <button
            type="button"
            className="absolute inset-0 z-10 focus-visible:outline-none"
            aria-label={`Open now playing for ${currentTrack.title}`}
            onClick={() => {
              triggerSelectionHaptic();
              onOpenPlayer();
            }}
          />

          <div className="mobile-mini-player-content pointer-events-none relative z-20 flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="mobile-mini-player-artwork h-10 w-10 shrink-0 rounded-sm object-cover shadow-md shadow-black/40"
            />
            <div className="mobile-mini-player-meta min-w-0 flex-1 flex flex-col justify-center">
              <span className="mobile-mini-player-kicker text-[9px] font-semibold tracking-[0.24em] text-white/38">
                Now Playing
              </span>
              <p className="mobile-mini-player-title truncate text-[13px] font-semibold text-white">
                {currentTrack.title}
              </p>
              <p className="mobile-mini-player-subtitle truncate text-[11px] font-medium text-white/60">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          <div className="relative z-20 flex items-center gap-1 pr-2">
            <button
              type="button"
              className={`mobile-mini-player-action ${actionVariantClassName}`}
              aria-label="Open queue"
              onClick={(event) => {
                event.stopPropagation();
                triggerSelectionHaptic();
                onOpenTab("queue");
              }}
            >
              <ListMusic className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`mobile-mini-player-action mobile-mini-player-play ${actionVariantClassName} ${playVariantClassName}`}
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={(event) => {
                event.stopPropagation();
                triggerImpactHaptic("medium");
                togglePlay();
              }}
              disabled={isLoading && !isPlaying}
            >
              {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
