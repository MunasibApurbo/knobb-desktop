import { type CSSProperties } from "react";

import { PageTransition } from "@/components/PageTransition";
import { MEDIA_CARD_BODY_CLASS } from "@/components/mediaCardStyles";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  variant?: "feed" | "grid" | "detail";
};

const SKELETON_MEDIA_CARD_CLASS =
  `content-visibility-card relative flex h-full flex-col overflow-hidden border-r border-b ${PANEL_SURFACE_CLASS.replace("border ", "")}`;

function HomeHeroSkeleton() {
  return (
    <section className="mobile-page-panel home-hero-panel relative isolate overflow-hidden border border-white/10 px-4 py-5 sm:px-5 sm:py-6 md:px-7 md:py-7">
      <div aria-hidden="true" className="home-hero-ambient pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl min-w-0">
          <Skeleton className="h-3 w-20 rounded-full" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-12 w-full max-w-[42rem] md:h-14" />
            <Skeleton className="h-12 w-[88%] max-w-[34rem] md:h-14" />
          </div>
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-4 w-full max-w-[38rem]" />
            <Skeleton className="h-4 w-[78%] max-w-[30rem]" />
          </div>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:min-w-[22rem] xl:w-auto">
          <Skeleton className="h-14 w-full rounded-[var(--surface-radius-lg)]" />
          <Skeleton className="h-14 w-full rounded-[var(--surface-radius-lg)]" />
        </div>
      </div>
    </section>
  );
}

export function MediaCardSkeleton({
  artwork = "square",
  className,
}: {
  artwork?: "square" | "circle";
  className?: string;
}) {
  const circleArtwork = artwork === "circle";

  return (
    <div className={cn(SKELETON_MEDIA_CARD_CLASS, className)}>
      <div className="relative aspect-square w-full overflow-hidden bg-black/10">
        {circleArtwork ? (
          <div className="flex h-full items-center justify-center p-5">
            <Skeleton className="aspect-square w-full max-w-[78%] rounded-full" />
          </div>
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
      </div>
      <div className={cn(MEDIA_CARD_BODY_CLASS, "relative")}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[72%] max-w-full" />
          <Skeleton className="h-3 w-[52%] max-w-[70%]" />
        </div>
      </div>
    </div>
  );
}

function CarouselSectionSkeleton({
  titleWidth,
  cardCount = 5,
  artwork = "square",
}: {
  titleWidth: string;
  cardCount?: number;
  artwork?: "square" | "circle";
}) {
  return (
    <section className="mobile-page-panel home-motion-section relative overflow-hidden">

      <div className="relative z-10 home-section-header flex items-center justify-between px-4 py-3">
        <Skeleton className={`h-6 ${titleWidth} max-w-[72vw]`} />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div
        className="relative z-10 website-mode-grid-frame home-section-grid hover-desaturate-grid home-section-carousel-frame"
        style={{ "--home-row-columns": Math.max(1, cardCount) } as CSSProperties}
      >
        <div className="home-section-carousel-track">
          <div className="home-section-carousel-page">
            {Array.from({ length: cardCount }).map((_, index) => (
              <MediaCardSkeleton key={index} artwork={artwork} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="mobile-page-shell mobile-stream-blend-shell home-page-surface hover-desaturate-page animate-fade-in">
        <HomeHeroSkeleton />
        <CarouselSectionSkeleton titleWidth="w-40" />
        <CarouselSectionSkeleton titleWidth="w-44" />
        <CarouselSectionSkeleton titleWidth="w-36" artwork="circle" />
      </div>
    </PageTransition>
  );
}

function GridLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="hover-desaturate-page animate-fade-in space-y-6 px-4 py-8 md:px-6">
        <section className="mobile-page-panel px-4 py-5 md:px-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-[24rem] max-w-full md:h-14" />
            <Skeleton className="h-4 w-[14rem] max-w-[70%]" />
          </div>
        </section>

        <section className="mobile-page-panel overflow-hidden">
          <div className="home-section-header flex items-center justify-between px-4 py-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="media-card-grid hover-desaturate-grid gap-0">
            {Array.from({ length: 10 }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function DetailHeroSkeleton({ title }: { title?: string }) {
  const hasTitle = Boolean(title?.trim());

  return (
    <section className="detail-hero relative overflow-hidden border border-white/10 border-b-0">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, hsl(var(--dynamic-accent) / 0.2), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        }}
      />
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="relative z-[2] flex min-h-[24rem] items-end">
        <div className="detail-hero-content relative z-10 flex w-full min-w-0 flex-col justify-end px-4 pb-5 pt-6 sm:px-5 md:w-[58%] md:px-8 md:pb-8 md:pt-10 lg:px-10">
          <div className="mb-5 w-full max-w-[14rem] md:hidden">
            <Skeleton className="aspect-square w-full rounded-[28px]" />
          </div>
          <Skeleton className="h-3 w-16 rounded-full" />
          <div className="mt-3 space-y-3">
            {hasTitle ? (
              <div className="text-4xl font-black leading-[0.94] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                {title}
              </div>
            ) : (
              <>
                <Skeleton className="h-12 w-full max-w-[24rem] md:h-16" />
                <Skeleton className="h-12 w-[72%] max-w-[18rem] md:h-16" />
              </>
            )}
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="mt-5 grid max-w-[30rem] grid-cols-2 border border-white/10 border-r-0 border-b-0 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex h-14 items-center border-r border-b border-white/10 px-4 md:px-5">
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="animate-fade-in space-y-0">
        <DetailHeroSkeleton />
        <div className="border border-white/10 border-t-0">
          <TrackListSkeleton count={10} />
        </div>
      </div>
    </PageTransition>
  );
}

export function LoadingSkeleton({ variant = "feed" }: LoadingSkeletonProps) {
  if (variant === "detail") {
    return <DetailLoadingSkeleton />;
  }

  if (variant === "grid") {
    return <GridLoadingSkeleton />;
  }

  return <FeedLoadingSkeleton />;
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="ml-auto hidden h-4 w-24 md:block" />
        <Skeleton className="hidden h-4 w-10 md:block" />
      </div>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={index % 3 === 0 ? "h-4 w-48 max-w-full" : index % 3 === 1 ? "h-4 w-40 max-w-full" : "h-4 w-44 max-w-full"} />
            <Skeleton className={index % 2 === 0 ? "h-3 w-28 max-w-[60%]" : "h-3 w-24 max-w-[55%]"} />
          </div>
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export function ArtistDetailSkeleton({ artistName }: { artistName?: string }) {
  return (
    <div className="artist-page-shell mobile-page-shell hover-desaturate-page animate-fade-in">
      <DetailHeroSkeleton title={artistName} />
      <div className="grid grid-cols-2 border border-white/10 border-t-0 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex h-14 items-center border-r border-b border-white/10 px-4 last:border-r-0 md:px-6">
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <section className="artist-page-section mobile-page-panel overflow-hidden bg-white/[0.02]">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <h2 className="text-lg font-bold text-foreground">Popular</h2>
          <Skeleton className="h-4 w-16" />
        </div>
        <TrackListSkeleton count={5} />
      </section>
    </div>
  );
}
