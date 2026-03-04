import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting skeleton */}
      <Skeleton className="h-8 w-48 " />

      {/* Quick access grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center bg-secondary/50  overflow-hidden">
            <Skeleton className="w-12 h-12 shrink-0 rounded-none" />
            <Skeleton className="h-4 w-24 mx-3" />
          </div>
        ))}
      </div>

      {/* Section skeleton */}
      <div>
        <Skeleton className="h-6 w-40 mb-5 " />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full " />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Another section */}
      <div>
        <Skeleton className="h-6 w-32 mb-5 " />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full " />
              <Skeleton className="h-4 w-2/3 mx-auto rounded" />
              <Skeleton className="h-3 w-1/3 mx-auto rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border/30">
        <Skeleton className="w-6 h-4 rounded" />
        <Skeleton className="w-32 h-4 rounded" />
        <Skeleton className="w-24 h-4 ml-auto hidden md:block" />
        <Skeleton className="w-12 h-4 hidden md:block" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
          <Skeleton className="w-6 h-4 rounded" />
          <Skeleton className="w-10 h-10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="w-16 h-4 hidden md:block" />
          <Skeleton className="w-10 h-4 rounded" />
        </div>
      ))}
    </div>
  );
}
