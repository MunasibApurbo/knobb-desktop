import { Disc3, HardDrive, Heart, Music, User } from "lucide-react";
import { forwardRef, useRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import type { LibraryItemStyle } from "@/contexts/SettingsContext";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import type { SidebarLibraryItem } from "@/components/sidebar/sidebarTypes";

const INACTIVE_LIST_CARD_SURFACE_CLASS =
  "border-white/10 bg-[rgba(6,6,6,0.78)] supports-[backdrop-filter]:bg-[rgba(6,6,6,0.58)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.18),0_18px_36px_rgba(0,0,0,0.12)]";

type SidebarLibraryCardProps = {
  itemType: SidebarLibraryItem["type"];
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  artistId?: number;
  isDropTarget?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  selected?: boolean;
  variant?: "default" | "artist";
  layout?: LibraryItemStyle;
  prioritizeImageLoading?: boolean;
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
  selected = false,
  variant = "default",
  layout = "cover",
  prioritizeImageLoading = false,
  ...props
}, ref) {
  const isArtist = variant === "artist";
  const resolvedImageUrl = useResolvedArtistImage(artistId, imageUrl, artistId ? title : undefined);
  const displayImageUrl = artistId ? resolvedImageUrl : imageUrl;
  const isHighlighted = active || selected || isDropTarget;
  const usesDarkForeground = active || isDropTarget;
  const usesTintedForeground = selected && !usesDarkForeground;
  const suppressClickRef = useRef(false);

  const PlaceholderIcon = itemType === "liked"
    ? Heart
    : itemType === "album"
      ? Disc3
      : itemType === "artist"
        ? User
        : itemType === "local"
          ? HardDrive
          : Music;

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
          onClick(event);
        }}
        aria-pressed={selected || active}
        className={`sidebar-library-card content-visibility-tile group relative flex w-full items-center gap-3 overflow-hidden rounded-[calc(var(--control-radius)+10px)] border px-3 py-2.5 text-left supports-[backdrop-filter]:backdrop-blur-2xl transition-[background-color,border-color,color,transform,box-shadow] duration-200 ${isDropTarget
            ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black ring-1 ring-[hsl(var(--player-waveform))]"
            : active
              ? "border-[hsl(var(--player-waveform)/0.78)] bg-[hsl(var(--player-waveform))] text-black ring-1 ring-[hsl(var(--player-waveform)/0.84)]"
            : selected
                ? "border-[hsl(var(--player-waveform)/0.24)] bg-[hsl(var(--player-waveform)/0.14)] text-white ring-1 ring-[hsl(var(--player-waveform)/0.18)]"
                : `menu-sweep-hover ${INACTIVE_LIST_CARD_SURFACE_CLASS} text-white/86 hover:border-white/14 hover:text-black`
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
          className={`sidebar-library-media relative h-14 w-14 shrink-0 overflow-hidden border bg-white/[0.04] ${usesDarkForeground
              ? "border-black/10"
              : usesTintedForeground
                ? "border-[hsl(var(--player-waveform)/0.18)]"
                : "border-white/10"
            } ${isArtist ? "website-avatar rounded-full" : ""
            }`}
        >
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={title}
              loading={prioritizeImageLoading ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent">
              <PlaceholderIcon className={`h-6 w-6 transition-colors duration-200 ${usesDarkForeground
                  ? "text-black/70"
                  : usesTintedForeground
                    ? "text-white/68"
                    : "text-white/50 group-hover:text-black/70"
                }`} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[1.02rem] font-semibold leading-tight tracking-tight transition-colors duration-200 ${usesDarkForeground
                ? "text-black"
                : usesTintedForeground
                  ? "text-white"
                  : "text-foreground group-hover:text-black"
              }`}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className={`mt-1 truncate text-[0.92rem] leading-tight transition-colors duration-200 ${usesDarkForeground
                  ? "text-black/70"
                  : usesTintedForeground
                    ? "text-white/64"
                    : "text-white/58 group-hover:text-black/65"
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
        onClick(event);
      }}
      aria-pressed={selected || active}
      className={`sidebar-library-card sidebar-library-banner-card content-visibility-tile website-card-hover group relative block w-full overflow-hidden text-left transition-[background-color,box-shadow,transform,opacity] duration-200 ${isArtist ? "h-[84px]" : "h-24"} ${isDropTarget
          ? "bg-[hsl(var(--player-waveform)/0.22)] ring-1 ring-[hsl(var(--player-waveform))]"
          : active
            ? "bg-[hsl(var(--player-waveform)/0.18)] shadow-[0_12px_32px_rgba(0,0,0,0.28)] ring-1 ring-[hsl(var(--player-waveform)/0.45)]"
            : selected
              ? "bg-white/[0.08] ring-1 ring-white/15"
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
          loading={prioritizeImageLoading ? "eager" : "lazy"}
          decoding="async"
          className="sidebar-library-banner-image absolute inset-0 h-full w-full object-cover"
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
      {active || selected ? (
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
