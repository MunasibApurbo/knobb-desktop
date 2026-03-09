import { PageTransition } from "@/components/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingSkeletonProps = {
  variant?: "feed" | "grid" | "detail";
};

function FeedSectionSkeleton({
  titleWidth,
  cardCount = 5,
}: {
  titleWidth: string;
  cardCount?: number;
}) {
  return (
    <section className="space-y-0">
      <div className="home-section-header flex items-center justify-between border border-white/10 border-b-0 px-4 py-3">
        <Skeleton className={`h-6 ${titleWidth} max-w-[70vw]`} />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className="media-card-grid gap-0 border-l border-t border-white/10">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="border-r border-b border-white/10 bg-white/[0.02]">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeedLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="hover-desaturate-page space-y-0 animate-fade-in">
        <div className="border-b border-white/10 px-4 py-4">
          <Skeleton className="h-8 w-56 max-w-[68vw]" />
        </div>
        <div className="grid grid-cols-1 gap-0 border-l border-t border-white/10 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex min-h-[72px] items-center gap-4 border-r border-b border-white/10 bg-white/[0.02] px-4 py-4">
              <Skeleton className="h-10 w-10 shrink-0" />
              <Skeleton className="h-4 w-32 max-w-full" />
            </div>
          ))}
        </div>
        <FeedSectionSkeleton titleWidth="w-36" />
        <FeedSectionSkeleton titleWidth="w-40" />
        <FeedSectionSkeleton titleWidth="w-44" />
      </div>
    </PageTransition>
  );
}

function GridLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="hover-desaturate-page animate-fade-in space-y-8 px-4 py-8 md:px-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-11 w-[24rem] max-w-full" />
          <Skeleton className="h-4 w-[12rem]" />
        </div>
        <div className="media-card-grid gap-3 md:gap-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

function DetailLoadingSkeleton() {
  return (
    <PageTransition>
      <div className="animate-fade-in space-y-0">
        <div className="relative overflow-hidden border border-b-0 border-white/10" style={{ height: "400px" }}>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]" />
          <div className="relative z-10 flex h-full items-end">
            <div className="pointer-events-auto flex w-full min-w-0 flex-col justify-end px-8 pb-8 md:px-10">
              <div className="flex flex-col gap-3 sm:w-[60%]">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-12 w-[26rem] max-w-full md:h-16" />
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <div className="mt-3 flex flex-wrap gap-0 border border-white/10 border-b-0 border-r-0">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-36 max-w-full border-r border-b border-white/10 bg-white/[0.02]" />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 hidden w-[40%] min-w-[18rem] sm:block">
              <Skeleton className="h-full w-full" />
            </div>
          </div>
        </div>
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
    <div className="space-y-1">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border/30">
        <Skeleton className="w-6 h-4" />
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-24 h-4 ml-auto hidden md:block" />
        <Skeleton className="w-12 h-4 hidden md:block" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
          <Skeleton className="w-6 h-4" />
          <Skeleton className="w-10 h-10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="w-16 h-4 hidden md:block" />
          <Skeleton className="w-10 h-4" />
        </div>
      ))}
    </div>
  );
}
