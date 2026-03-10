import { Disc3, HardDrive, Heart, Music2, UserRound } from "lucide-react";
import { forwardRef, useRef, type ButtonHTMLAttributes } from "react";
import type { LibraryItemStyle } from "@/contexts/SettingsContext";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import type { SidebarLibraryItem } from "@/components/sidebar/sidebarTypes";

type SidebarLibraryCardProps = {
  itemType: SidebarLibraryItem["type"];
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  artistId?: number;
  isDropTarget?: boolean;
  onClick: () => void;
  active?: boolean;
  variant?: "default" | "artist";
  layout?: LibraryItemStyle;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

export const SidebarLibraryCard = forwardRef<HTMLButtonElement, SidebarLibraryCardProps>(function SidebarLibraryCard({
  itemType,
  title,
  subtitle,
  imageUrl,
  artistId,
  isDropTarget = false,
  onClick,
  active = false,
  variant = "default",
  layout = "cover",
  ...props
}, ref) {
  const isArtist = variant === "artist";
  const resolvedImageUrl = useResolvedArtistImage(artistId, imageUrl, artistId ? title : undefined);
  const displayImageUrl = artistId ? resolvedImageUrl : imageUrl;
  const isHighlighted = active || isDropTarget;
  const suppressClickRef = useRef(false);

  const PlaceholderIcon = itemType === "liked"
    ? Heart
    : itemType === "album"
      ? Disc3
      : itemType === "artist"
        ? UserRound
        : itemType === "local"
          ? HardDrive
          : Music2;

  if (layout === "list") {
    return (
      <button
        ref={ref}
        type="button"
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            suppressClickRef.current = false;
            return;
          }
          onClick();
        }}
        className={`sidebar-library-card content-visibility-tile group relative flex w-full items-center gap-3 overflow-hidden px-3 py-2.5 text-left transition-colors duration-200 ${isDropTarget
            ? "bg-[hsl(var(--player-waveform))] text-black ring-1 ring-[hsl(var(--player-waveform))]"
            : active
              ? "bg-[hsl(var(--player-waveform))]"
              : "menu-sweep-hover bg-transparent"
          } ${props.draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        onDragStart={(event) => {
          suppressClickRef.current = true;
          props.onDragStart?.(event);
        }}
        onDragEnd={(event) => {
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
          props.onDragEnd?.(event);
        }}
        {...props}
      >
        <div
          className={`sidebar-library-media relative h-14 w-14 shrink-0 overflow-hidden border border-white/10 bg-white/[0.04] ${isArtist ? "website-avatar rounded-full" : ""
            }`}
        >
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={(event) => {
                (event.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent">
              <PlaceholderIcon className={`h-6 w-6 transition-colors duration-200 ${isHighlighted ? "text-black/70" : "text-white/50 group-hover:text-black/70"}`} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[1.02rem] font-semibold leading-tight tracking-tight transition-colors duration-200 ${isHighlighted ? "text-black" : "text-foreground group-hover:text-black"
              }`}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className={`mt-1 truncate text-[0.92rem] leading-tight transition-colors duration-200 ${isHighlighted ? "text-black/70" : "text-white/58 group-hover:text-black/65"
                }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          suppressClickRef.current = false;
          return;
        }
        onClick();
      }}
      className={`sidebar-library-card content-visibility-tile group relative block w-full overflow-hidden text-left transition-all duration-200 ${isArtist ? "h-[84px]" : "h-24"} ${isDropTarget
          ? "bg-[hsl(var(--player-waveform)/0.22)] ring-1 ring-[hsl(var(--player-waveform))]"
          : active
            ? "bg-[hsl(var(--player-waveform)/0.18)] shadow-[0_12px_32px_rgba(0,0,0,0.28)] ring-1 ring-[hsl(var(--player-waveform)/0.45)]"
            : "bg-black/25 hover:bg-white/[0.05]"
        } ${props.draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      onDragStart={(event) => {
        suppressClickRef.current = true;
        props.onDragStart?.(event);
      }}
      onDragEnd={(event) => {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        props.onDragEnd?.(event);
      }}
      {...props}
    >
      {displayImageUrl ? (
        <img
          src={displayImageUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/[0.02]" />
      )}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${isHighlighted
            ? "bg-gradient-to-r from-black/72 via-black/35 to-black/18"
            : "bg-gradient-to-r from-black/80 via-black/45 to-black/20"
          }`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r to-transparent transition-opacity duration-200 ${isHighlighted
            ? "from-[hsl(var(--player-waveform)/0.28)] via-black/22"
            : "from-black/50 via-black/20"
          }`}
      />
      {active ? (
        <div className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-[hsl(var(--player-waveform))]" />
      ) : null}
      <div className={`absolute left-4 right-4 ${isArtist ? "bottom-2" : "bottom-2.5"}`}>
        <p
          className={`truncate text-foreground/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isArtist ? "text-[1.45rem]" : "text-[1.2rem]"
            } font-black leading-[1.08] tracking-tight`}
        >
          {title}
        </p>
        {!isArtist && subtitle ? (
          <p className="mt-0.5 truncate text-[10px] text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </button>
  );
});
