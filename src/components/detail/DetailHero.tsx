import type { DragEvent, ReactNode } from "react";
import { motion } from "framer-motion";

import {
  getHeroScrollStyles,
  getHeroAuraBackground,
  getHeroSplitOverlayBackground,
  getHeroSurfaceBackground,
  HERO_SPLIT_MASK_IMAGE,
} from "@/lib/heroVisuals";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import {
  clearActivePlaylistDrag,
  startPlaylistDrag,
  type PlaylistDragPayload,
} from "@/lib/playlistDrag";
import { cn } from "@/lib/utils";

interface DetailHeroProps {
  accentColor?: string;
  artworkUrl: string;
  artworkLayoutId?: string;
  artworkWrapper?: (artwork: ReactNode) => ReactNode;
  body?: ReactNode;
  backgroundVariant?: "rich" | "plain-black";
  className?: string;
  cornerAction?: ReactNode;
  dragPayload?: PlaylistDragPayload;
  label: string;
  meta?: ReactNode;
  scrollY?: number;
  title: ReactNode;
  titleLayoutId?: string;
  titleClassName?: string;
}

export function DetailHero({
  accentColor,
  artworkUrl,
  artworkWrapper,
  body,
  backgroundVariant = "rich",
  className,
  cornerAction,
  dragPayload,
  label,
  meta,
  scrollY = 0,
  title,
  titleLayoutId,
  titleClassName,
}: DetailHeroProps) {
  const internalScrollY = useMainScrollY(true, 24);
  const resolvedScrollY = scrollY || internalScrollY;
  const { scrollScale, scrollBlur, scrollOpacity } = getHeroScrollStyles(resolvedScrollY);
  const safeArtworkUrl = artworkUrl || "/placeholder.svg";
  const hasArtworkSource = safeArtworkUrl !== "/placeholder.svg";
  const hasRichBackground = backgroundVariant === "rich";
  const showArtworkTreatment = hasRichBackground && hasArtworkSource;
  const heroBackground = hasRichBackground ? getHeroSurfaceBackground(accentColor) : "#000";
  const heroOverlayBackground = showArtworkTreatment ? getHeroSplitOverlayBackground(accentColor) : null;
  const heroAuraBackground = showArtworkTreatment ? getHeroAuraBackground(accentColor) : null;
  const canDragArtwork = !!dragPayload && dragPayload.tracks.length > 0;
  const backdropTranslateY = Math.min(resolvedScrollY * 0.08, 22);
  const backdropScale = 1.14 + (scrollScale - 1) * 0.55;
  const bleedScale = 1.01 + (scrollScale - 1) * 0.75;

  const handleArtworkDragStart = (event: DragEvent<HTMLElement>) => {
    if (!dragPayload || dragPayload.tracks.length === 0) {
      event.preventDefault();
      return;
    }

    startPlaylistDrag(event.dataTransfer, dragPayload);
  };

  const wrapArtwork = (artwork: ReactNode) => (
    artworkWrapper ? artworkWrapper(artwork) : artwork
  );

  return (
    <section
      className={cn(
        "detail-hero relative overflow-hidden border border-white/10 border-b-0",
        !hasRichBackground && "detail-hero--plain",
        className,
      )}
      style={{ background: heroBackground }}
    >
      {cornerAction ? (
        <div className="absolute right-4 top-4 z-[3] sm:right-5 sm:top-5 md:right-6 md:top-6">
          {cornerAction}
        </div>
      ) : null}
      {heroOverlayBackground ? (
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: heroOverlayBackground }}
        />
      ) : null}
      {heroAuraBackground ? (
        <div
          className="detail-hero-aura absolute inset-0 z-[1]"
          style={{
            background: heroAuraBackground,
            opacity: Math.max(0.72 - resolvedScrollY * 0.00045, 0.46),
            transform: `scale(${1 + (scrollScale - 1) * 0.35}) translate3d(0, ${backdropTranslateY * -0.1}px, 0)`,
            filter: `blur(${34 + scrollBlur * 0.65}px)`,
            transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
          }}
        />
      ) : null}
      {showArtworkTreatment ? (
        <img
          src={safeArtworkUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover mix-blend-overlay will-change-[transform,filter,opacity]"
          style={{
            opacity: Math.max(0.52 - resolvedScrollY * 0.00032, 0.34),
            transform: `translate3d(0, ${backdropTranslateY * -0.4}px, 0) scale(${backdropScale})`,
            filter: `blur(${scrollBlur}px) saturate(${1 + Math.min(scrollBlur / 80, 0.16)})`,
            transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
          }}
        />
      ) : null}

      <div className="relative z-[2] flex h-full items-end">
        {showArtworkTreatment ? (
          wrapArtwork(
            <div
              className={cn(
                "detail-hero-cover-bleed absolute inset-y-0 right-0 hidden w-[58%] shrink-0 md:block",
                canDragArtwork ? "cursor-grab active:cursor-grabbing" : "",
              )}
              draggable={canDragArtwork}
              onDragEnd={canDragArtwork ? clearActivePlaylistDrag : undefined}
              onDragStart={canDragArtwork ? handleArtworkDragStart : undefined}
              title={canDragArtwork ? `Drag ${label.toLowerCase()} artwork to a playlist` : undefined}
            >
              <img
                src={safeArtworkUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-cover object-top mix-blend-overlay will-change-[transform,filter,opacity]"
                style={{
                  opacity: Math.max(0.58 - resolvedScrollY * 0.0003, 0.38),
                  transform: `translate3d(0, ${backdropTranslateY * -0.2}px, 0) scale(${bleedScale})`,
                  filter: `blur(${scrollBlur * 0.35}px) saturate(${1 + Math.min(scrollBlur / 90, 0.12)})`,
                  transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
                  maskImage: HERO_SPLIT_MASK_IMAGE,
                  WebkitMaskImage: HERO_SPLIT_MASK_IMAGE,
                  maskComposite: "intersect",
                  WebkitMaskComposite: "source-in",
                }}
              />
            </div>,
          )
        ) : null}

        <div
          className={cn(
            "detail-hero-content relative z-10 flex w-full min-w-0 flex-col justify-end px-4 pb-5 pt-6 sm:px-5 md:px-8 md:pb-8 md:pt-10 lg:px-10",
            showArtworkTreatment ? "md:w-[58%]" : "md:w-full",
          )}
        >
          {showArtworkTreatment ? (
            wrapArtwork(
              <div
                className={cn(
                  "detail-hero-cover-card mb-5 md:hidden",
                  canDragArtwork ? "cursor-grab active:cursor-grabbing" : "",
                )}
                draggable={canDragArtwork}
                onDragEnd={canDragArtwork ? clearActivePlaylistDrag : undefined}
                onDragStart={canDragArtwork ? handleArtworkDragStart : undefined}
                title={canDragArtwork ? `Drag ${label.toLowerCase()} artwork to a playlist` : undefined}
              >
                <img
                  src={safeArtworkUrl}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </div>,
            )
          ) : null}

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
            {label}
          </p>
          <motion.div
            className={cn(
              "detail-hero-title text-[clamp(2.85rem,4vw+1.3rem,5.8rem)] font-black leading-[0.94] tracking-[-0.04em] text-white",
              titleClassName,
            )}
            layoutId={titleLayoutId}
            style={{
              opacity: scrollOpacity,
              textShadow: "0 8px 32px rgba(0,0,0,0.42)",
            }}
          >
            {title}
          </motion.div>
          {body ? <div className="detail-hero-body mt-4">{body}</div> : null}
          {meta ? <div className="detail-hero-meta mt-4">{meta}</div> : null}
        </div>
      </div>
    </section>
  );
}
