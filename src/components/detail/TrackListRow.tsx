import { forwardRef, memo, useRef } from "react";
import type { ComponentPropsWithoutRef, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { AlbumLink } from "@/components/AlbumLink";
import { ArtistsLink } from "@/components/ArtistsLink";
import { PlayingIndicator } from "@/components/PlayingIndicator";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/utils";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearActivePlaylistDrag } from "@/lib/playlistDrag";
import { getTrackArtworkUrl } from "@/lib/trackArtwork";
import { useOptionalPlayerWarmTrackPlayback } from "@/contexts/PlayerContext";

interface TrackListRowProps extends Omit<ComponentPropsWithoutRef<"div">, "onPlay" | "title"> {
  actionSlot?: ReactNode;
  actionSlotLayout?: "single" | "double";
  artworkClassName?: string;
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
  onDragHandleEnd?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragHandleStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onPlay: (event: MouseEvent<HTMLDivElement>) => void;
  onToggleLike?: () => void | Promise<void>;
  subtitle?: ReactNode;
  title?: ReactNode;
  track: Track;
  trailingContent?: ReactNode;
}

export const TrackListRow = memo(forwardRef<HTMLDivElement, TrackListRowProps>(function TrackListRow({
  actionSlot,
  actionSlotLayout = "single",
  artworkClassName,
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
  onDragHandleEnd,
  onDragHandleStart,
  onPlay,
  onToggleLike,
  subtitle,
  title,
  track,
  trailingContent,
  onFocus,
  onMouseEnter,
  onPointerDown,
  ...props
}, ref) {
  const warmTrackPlayback = useOptionalPlayerWarmTrackPlayback();
  const isVideoTrack = track.isVideo === true;
  const artworkUrl = getTrackArtworkUrl(track);
  const resolvedSubtitle = subtitle ?? (
    <ArtistsLink
      name={track.artist}
      artists={track.artists}
      artistId={track.artistId}
      className={cn(
        "block truncate text-xs",
        isCurrent ? "text-black" : "text-white/62 transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.84)]",
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
        isCurrent ? "text-black hover:text-black" : "text-white/54 transition-colors duration-300 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
      )}
    />
  );

  const resolvedTrailing = trailingContent ?? (disabled ? (disabledLabel ?? "Unavailable") : formatDuration(track.duration));
  const hasDesktopMeta = desktopMeta !== undefined && desktopMeta !== null;
  const hasMiddleContent = middleContent !== null;
  const hasRowDrag = Boolean(onDragHandleStart);
  const hasDoubleActionSlot = actionSlotLayout === "double";
  const suppressClickRef = useRef(false);
  const warmPlayback = () => {
    if (disabled) return;
    warmTrackPlayback?.(track);
  };

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
        "detail-track-row content-visibility-list group relative grid w-full items-center gap-x-3 overflow-hidden px-4 py-3 text-left lg:gap-x-4",
        "menu-sweep-row",
        isVideoTrack
          ? hasDesktopMeta
            ? hasDoubleActionSlot
              ? "grid-cols-[2rem_4.5rem_minmax(0,1fr)_5.25rem_4rem] md:grid-cols-[2rem_4.5rem_minmax(0,1.6fr)_minmax(0,1fr)_6.5rem_5.25rem_4rem] xl:grid-cols-[2rem_4.5rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_5.25rem_4rem] 2xl:grid-cols-[2rem_4.5rem_minmax(18rem,1.45fr)_minmax(14rem,1fr)_8rem_5.25rem_4rem]"
              : "grid-cols-[2rem_4.5rem_minmax(0,1fr)_2.75rem_4rem] md:grid-cols-[2rem_4.5rem_minmax(0,1.6fr)_minmax(0,1fr)_6.5rem_2.75rem_4rem] xl:grid-cols-[2rem_4.5rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_2.75rem_4rem] 2xl:grid-cols-[2rem_4.5rem_minmax(18rem,1.45fr)_minmax(14rem,1fr)_8rem_2.75rem_4rem]"
            : hasDoubleActionSlot
              ? "grid-cols-[2rem_4.5rem_minmax(0,1fr)_5.25rem_4rem] md:grid-cols-[2rem_4.5rem_minmax(0,1.7fr)_minmax(0,1fr)_5.25rem_4rem] xl:grid-cols-[2rem_4.5rem_minmax(14rem,1.55fr)_minmax(11rem,1fr)_5.25rem_4rem] 2xl:grid-cols-[2rem_4.5rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_5.25rem_4rem]"
              : "grid-cols-[2rem_4.5rem_minmax(0,1fr)_2.75rem_4rem] md:grid-cols-[2rem_4.5rem_minmax(0,1.7fr)_minmax(0,1fr)_2.75rem_4rem] xl:grid-cols-[2rem_4.5rem_minmax(14rem,1.55fr)_minmax(11rem,1fr)_2.75rem_4rem] 2xl:grid-cols-[2rem_4.5rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_2.75rem_4rem]"
          : hasDesktopMeta
            ? hasDoubleActionSlot
              ? "grid-cols-[2rem_3rem_minmax(0,1fr)_5.25rem_4rem] md:grid-cols-[2rem_3rem_minmax(0,1.6fr)_minmax(0,1fr)_6.5rem_5.25rem_4rem] xl:grid-cols-[2rem_3rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_5.25rem_4rem] 2xl:grid-cols-[2rem_3rem_minmax(18rem,1.45fr)_minmax(14rem,1fr)_8rem_5.25rem_4rem]"
              : "grid-cols-[2rem_3rem_minmax(0,1fr)_2.75rem_4rem] md:grid-cols-[2rem_3rem_minmax(0,1.6fr)_minmax(0,1fr)_6.5rem_2.75rem_4rem] xl:grid-cols-[2rem_3rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_2.75rem_4rem] 2xl:grid-cols-[2rem_3rem_minmax(18rem,1.45fr)_minmax(14rem,1fr)_8rem_2.75rem_4rem]"
            : hasDoubleActionSlot
              ? "grid-cols-[2rem_3rem_minmax(0,1fr)_5.25rem_4rem] md:grid-cols-[2rem_3rem_minmax(0,1.7fr)_minmax(0,1fr)_5.25rem_4rem] xl:grid-cols-[2rem_3rem_minmax(14rem,1.55fr)_minmax(11rem,1fr)_5.25rem_4rem] 2xl:grid-cols-[2rem_3rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_5.25rem_4rem]"
              : "grid-cols-[2rem_3rem_minmax(0,1fr)_2.75rem_4rem] md:grid-cols-[2rem_3rem_minmax(0,1.7fr)_minmax(0,1fr)_2.75rem_4rem] xl:grid-cols-[2rem_3rem_minmax(14rem,1.55fr)_minmax(11rem,1fr)_2.75rem_4rem] 2xl:grid-cols-[2rem_3rem_minmax(22rem,1.45fr)_minmax(16rem,1fr)_2.75rem_4rem]",
        isCurrent ? "is-current" : undefined,
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
      onFocus={(event) => {
        warmPlayback();
        onFocus?.(event);
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={(event) => {
        warmPlayback();
        onMouseEnter?.(event);
      }}
      onPointerDown={(event) => {
        warmPlayback();
        onPointerDown?.(event);
      }}
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


      <div className="relative z-10 flex items-center justify-center self-center">
        {leadingSlot ?? (
          <span
            className={cn(
              "flex w-[20px] items-center justify-center text-center text-sm tabular-nums",
              isCurrent ? "h-4 text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
            )}
          >
            {isCurrent ? <PlayingIndicator isPaused={!isPlaying} /> : `${index + 1}.`}
          </span>
        )}
      </div>

      <img
        src={artworkUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          "relative z-10 object-cover",
          isVideoTrack
            ? "h-10 w-[4.5rem] rounded-md border border-white/10"
            : "force-round-artwork h-12 w-12 rounded-full",
          artworkClassName,
        )}
      />

      <div className="relative z-10 flex min-w-0 flex-col justify-center pr-2 md:pr-4">
        <p
          className={cn(
            "truncate text-sm leading-tight",
            isCurrent ? "font-semibold text-black" : "font-medium text-white group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
          )}
        >
          {resolvedTitle}
        </p>
        {resolvedSubtitle}
      </div>

      {hasMiddleContent ? (
        <div className="relative z-10 hidden min-w-0 items-center pr-2 md:flex md:pr-4">
          {resolvedMiddle}
        </div>
      ) : null}

      {hasDesktopMeta ? (
        <div className="relative z-10 hidden min-w-0 items-center md:flex">
          {desktopMeta}
        </div>
      ) : null}

      {onToggleLike || actionSlot ? (
        <div className={cn(
          "relative z-10 flex h-full items-center justify-center justify-self-center gap-0.5 self-center",
          hasDoubleActionSlot ? "min-w-[5.25rem]" : "min-w-[2.75rem]",
        )}>
          {onToggleLike ? (
            <button
              type="button"
              draggable={false}
              aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
              className="menu-sweep-hover inline-flex h-8 w-8 items-center justify-center rounded-[var(--control-radius)] text-white/68 transition-colors hover:bg-white/10 hover:text-white"
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
                      : "fill-current text-white drop-shadow-md transition-colors duration-300 group-hover:text-black"
                    : isCurrent
                      ? "text-black"
                      : "text-white/66 transition-colors duration-300 group-hover:text-black",
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
            "relative z-10 inline-flex h-full w-16 items-center justify-end self-center text-right font-mono text-sm tabular-nums",
            isCurrent ? "text-black" : "text-white/52 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
          )}
      >
        {resolvedTrailing}
      </span>
      ) : null}
    </div>
  );
}));
