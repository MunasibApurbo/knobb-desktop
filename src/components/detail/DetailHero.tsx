import type { DragEvent, ReactNode } from "react";
import { motion } from "framer-motion";

import {
  getHeroScrollStyles,
  getHeroAuraBackground,
  getHeroSplitOverlayBackground,
  getHeroSurfaceBackground,
  HERO_SPLIT_MASK_IMAGE,
} from "@/lib/heroVisuals";
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
  body?: ReactNode;
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
  artworkLayoutId,
  body,
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
  const { scrollScale, scrollBlur, scrollOpacity } = getHeroScrollStyles(scrollY);
  const safeArtworkUrl = artworkUrl || "/placeholder.svg";
  const heroBackground = getHeroSurfaceBackground(accentColor);
  const heroOverlayBackground = getHeroSplitOverlayBackground(accentColor);
  const heroAuraBackground = getHeroAuraBackground(accentColor);
  const canDragArtwork = !!dragPayload && dragPayload.tracks.length > 0;

  const handleArtworkDragStart = (event: DragEvent<HTMLElement>) => {
    if (!dragPayload || dragPayload.tracks.length === 0) {
      event.preventDefault();
      return;
    }

    startPlaylistDrag(event.dataTransfer, dragPayload);
  };

  return (
    <section
      className={cn("detail-hero relative overflow-hidden border border-white/10 border-b-0", className)}
      style={{ background: heroBackground }}
    >
      {cornerAction ? (
        <div className="absolute right-4 top-4 z-[3] sm:right-5 sm:top-5 md:right-6 md:top-6">
          {cornerAction}
        </div>
      ) : null}
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: heroOverlayBackground }}
      />
      <div
        className="detail-hero-aura absolute inset-0 z-[1]"
        style={{ background: heroAuraBackground }}
      />
      <img
        src={safeArtworkUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-100 mix-blend-overlay"
        style={{
          opacity: 0.6,
          transform: `scale(${scrollScale + 0.44})`,
          filter: `blur(${34 + scrollBlur}px) saturate(1.06)`,
        }}
      />

      <div className="relative z-[2] flex h-full items-end">
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
          <motion.img
            src={safeArtworkUrl}
            alt=""
            layoutId={artworkLayoutId}
            draggable={false}
            className="h-full w-full object-cover object-top transition-[filter,transform] duration-100 mix-blend-overlay"
            style={{
              opacity: 0.6,
              transform: `scale(${scrollScale})`,
              filter: `blur(${scrollBlur}px)`,
              maskImage: HERO_SPLIT_MASK_IMAGE,
              WebkitMaskImage: HERO_SPLIT_MASK_IMAGE,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>

        <div className="detail-hero-content relative z-10 flex w-full min-w-0 flex-col justify-end px-4 pb-5 pt-6 sm:px-5 md:w-[58%] md:px-8 md:pb-8 md:pt-10 lg:px-10">
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
            <motion.img
              src={safeArtworkUrl}
              alt=""
              layoutId={artworkLayoutId}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
            {label}
          </p>
          <motion.div
            className={cn(
              "text-4xl font-black leading-[0.94] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl lg:text-7xl",
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
