import { ListMusic, Pause, Play } from "lucide-react";

import { usePlayer } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";

interface MobileMiniPlayerProps {
  onOpenPlayer: () => void;
  onOpenTab: (tab: "lyrics" | "queue") => void;
}

export function MobileMiniPlayer({
  onOpenPlayer,
  onOpenTab,
}: MobileMiniPlayerProps) {
  const { currentTrack, isPlaying, isLoading, togglePlay } = usePlayer();
  const { titleLineMode } = useSettings();

  if (!currentTrack) return null;

  return (
    <div className="mobile-mini-player fixed inset-x-0 z-50 px-3">
      <div className="mobile-mini-player-shell mx-auto flex max-w-[40rem] items-center gap-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
          onClick={onOpenPlayer}
        >
          <img
            src={currentTrack.coverUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-[calc(var(--mobile-control-radius)-4px)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className={`${titleLineMode === "double" ? "line-clamp-2" : "truncate"} text-[13px] font-semibold uppercase tracking-[0.06em] text-white`}>
              {currentTrack.title}
            </p>
            <p className="truncate text-[10px] font-medium text-white/54">{currentTrack.artist}</p>
          </div>
        </button>

        <button
          type="button"
          className="mobile-mini-player-action"
          aria-label="Open queue"
          onClick={() => onOpenTab("queue")}
        >
          <ListMusic className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="mobile-mini-player-action mobile-mini-player-play"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={(event) => {
            event.stopPropagation();
            togglePlay();
          }}
          disabled={isLoading && !isPlaying}
        >
          {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
      </div>
    </div>
  );
}
