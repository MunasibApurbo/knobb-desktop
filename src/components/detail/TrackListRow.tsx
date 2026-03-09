import { forwardRef, useRef } from "react";
import type { ComponentPropsWithoutRef, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { AlbumLink } from "@/components/AlbumLink";
import { ArtistsLink } from "@/components/ArtistsLink";
import { PlayingIndicator } from "@/components/PlayingIndicator";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/utils";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearActivePlaylistDrag } from "@/lib/playlistDrag";

interface TrackListRowProps extends Omit<ComponentPropsWithoutRef<"div">, "onPlay" | "title"> {
  actionSlot?: ReactNode;
  className?: string;
  desktopMeta?: ReactNode;
  disabled?: boolean;
  disabledLabel?: ReactNode;
  dropIndicator?: "before" | "after" | null;
  index: number;
  isCurrent: boolean;
  isLiked?: boolean;
  isPlaying: boolean;
  isRowDragging?: boolean;
  dragHandleLabel?: string;
  leadingSlot?: ReactNode;
  middleContent?: ReactNode;
  mobileMeta?: ReactNode;
  onDragHandleEnd?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragHandleStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onPlay: (event: MouseEvent<HTMLDivElement>) => void;
  onToggleLike?: () => void | Promise<void>;
  subtitle?: ReactNode;
  title?: ReactNode;
  track: Track;
  trailingContent?: ReactNode;
}

export const TrackListRow = forwardRef<HTMLDivElement, TrackListRowProps>(function TrackListRow({
  actionSlot,
  className,
  desktopMeta,
  disabled = false,
  disabledLabel,
  dropIndicator = null,
  index,
  isCurrent,
  isLiked = false,
  isPlaying,
  isRowDragging = false,
  dragHandleLabel,
  leadingSlot,
  middleContent,
  mobileMeta,
  onDragHandleEnd,
  onDragHandleStart,
  onPlay,
  onToggleLike,
  subtitle,
  title,
  track,
  trailingContent,
  ...props
}, ref) {
  const resolvedSubtitle = subtitle ?? (
    <ArtistsLink
      name={track.artist}
      artists={track.artists}
      artistId={track.artistId}
      className={cn(
        "block truncate text-xs",
        isCurrent ? "text-black" : "text-white/62 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.84)]",
      )}
      onClick={(event) => event.stopPropagation()}
    />
  );

  const resolvedTitle = title ?? track.title;
  const resolvedMiddle = middleContent ?? (
    <AlbumLink
      title={track.album}
      albumId={track.albumId}
      artistName={track.artist}
      className={cn(
        "block truncate text-sm",
        isCurrent ? "text-black hover:text-black" : "text-white/54 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
      )}
    />
  );

  const resolvedTrailing = trailingContent ?? (disabled ? (disabledLabel ?? "Unavailable") : formatDuration(track.duration));
  const hasDesktopMeta = desktopMeta !== undefined && desktopMeta !== null;
  const hasMiddleContent = middleContent !== null;
  const hasRowDrag = Boolean(onDragHandleStart);
  const suppressClickRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (disabled) return;
    onPlay(event as unknown as MouseEvent<HTMLDivElement>);
  };

  return (
    <div
      {...props}
      ref={ref}
      className={cn(
        "detail-track-row content-visibility-list group relative grid w-full grid-cols-[2rem_3rem_minmax(0,1fr)_2.75rem_4rem] items-center gap-x-4 overflow-hidden border-b border-white/10 px-4 py-3 text-left",
        hasDesktopMeta
          ? "md:grid-cols-[2rem_3rem_minmax(18rem,1.35fr)_minmax(14rem,1fr)_8rem_2.75rem_4rem] xl:grid-cols-[2rem_3rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_9rem_2.75rem_4rem]"
          : "md:grid-cols-[2rem_3rem_minmax(18rem,1.35fr)_minmax(14rem,1fr)_2.75rem_4rem] xl:grid-cols-[2rem_3rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_2.75rem_4rem]",
        isCurrent ? "is-current" : "transition-colors duration-200",
        isRowDragging ? "opacity-55" : undefined,
        hasRowDrag && !disabled ? "cursor-grab active:cursor-grabbing" : undefined,
        disabled ? "cursor-not-allowed opacity-65" : undefined,
        className,
      )}
      role="button"
      aria-disabled={disabled}
      aria-label={hasRowDrag ? dragHandleLabel || `Drag ${track.title} to a playlist` : undefined}
      data-allow-global-shortcuts="true"
      draggable={hasRowDrag && !disabled}
      style={isCurrent ? { backgroundColor: "hsl(var(--dynamic-accent) / 0.94)" } : undefined}
      tabIndex={0}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          suppressClickRef.current = false;
          return;
        }
        if (disabled) {
          event.preventDefault();
          return;
        }
        onPlay(event);
      }}
      onDragStart={(event) => {
        if (!onDragHandleStart || disabled) {
          event.preventDefault();
          return;
        }
        suppressClickRef.current = true;
        onDragHandleStart(event as unknown as DragEvent<HTMLButtonElement>);
      }}
      onDragEnd={(event) => {
        clearActivePlaylistDrag();
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        onDragHandleEnd?.(event as unknown as DragEvent<HTMLButtonElement>);
      }}
      onKeyDown={handleKeyDown}
    >
      {dropIndicator ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.18)]",
            dropIndicator === "before" ? "top-0" : "bottom-0",
          )}
        />
      ) : null}

      {!isCurrent && !disabled ? (
        <span
          className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
          style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
        />
      ) : null}

      <div className="relative z-10 flex items-center justify-center">
        {leadingSlot ?? (
          <span
            className={cn(
              "flex w-[20px] items-center justify-center text-center text-sm tabular-nums",
              isCurrent ? "h-4 text-black" : "text-muted-foreground transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
            )}
          >
            {isCurrent ? <PlayingIndicator isPaused={!isPlaying} /> : `${index + 1}.`}
          </span>
        )}
      </div>

      <img
        src={track.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="relative z-10 h-12 w-12 rounded-[var(--cover-radius)] object-cover"
      />

      <div className="relative z-10 min-w-0 pr-2 md:pr-4">
        <p
          className={cn(
            "truncate text-sm",
            isCurrent ? "font-semibold text-black" : "font-medium text-white transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
          )}
        >
          {resolvedTitle}
        </p>
        {resolvedSubtitle}
        {mobileMeta ? (
          <div
            className={cn(
              "mt-1 truncate text-[11px] md:hidden",
              isCurrent ? "text-black/78" : "text-white/46 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.7)]",
            )}
          >
            {mobileMeta}
          </div>
        ) : null}
      </div>

      {hasMiddleContent ? (
        <div className="relative z-10 hidden min-w-0 pr-2 md:block md:pr-4">
          {resolvedMiddle}
        </div>
      ) : null}

      {hasDesktopMeta ? (
        <div className="relative z-10 hidden min-w-0 md:block">
          {desktopMeta}
        </div>
      ) : null}

      {onToggleLike || actionSlot ? (
        <div className="relative z-10 flex min-w-[2.75rem] items-center justify-center justify-self-center gap-0.5">
          {onToggleLike ? (
            <button
              type="button"
              draggable={false}
              aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--control-radius)] text-white/68 transition-colors hover:bg-white/10 hover:text-white"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onToggleLike();
              }}
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  isLiked
                    ? isCurrent
                      ? "fill-current text-black"
                      : "fill-current text-white drop-shadow-md transition-colors duration-200 group-hover:text-black"
                    : isCurrent
                      ? "text-black"
                      : "text-white/66 transition-colors duration-200 group-hover:text-black",
                )}
              />
            </button>
          ) : null}
          {actionSlot}
        </div>
      ) : null}

      {resolvedTrailing ? (
        <span
          className={cn(
            "relative z-10 w-16 justify-self-end text-right font-mono text-sm tabular-nums",
            isCurrent ? "text-black" : "text-white/52 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
          )}
      >
        {resolvedTrailing}
      </span>
      ) : null}
    </div>
  );
});
