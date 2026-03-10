import {
  MoreHorizontal,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MotionValue } from "framer-motion";
import { getHeroScrollStyles, HERO_SPLIT_MASK_IMAGE, HERO_SPLIT_OVERLAY_BACKGROUND } from "@/lib/heroVisuals";

type ProfileHeroProps = {
  displayName: string;
  email: string | undefined;
  createdAt: string;
  heroImage: string | null;
  scrollY: MotionValue<number>;
  onEditDisplayName: () => void;
  onChangeCoverImage: () => void;
  onSignOut: () => void;
};

export function ProfileHero({
  displayName,
  email,
  createdAt,
  heroImage,
  scrollY,
  onEditDisplayName,
  onChangeCoverImage,
  onSignOut,
}: ProfileHeroProps) {
  const { scrollScale, scrollBlur, scrollOpacity } = getHeroScrollStyles(scrollY.get());
  const runAfterMenuClose = (action: () => void) => {
    window.setTimeout(action, 0);
  };

  return (
    <div className="relative mb-0 h-[280px] overflow-hidden border-b border-white/5 bg-[#121212] sm:h-[320px]">
      <div className="absolute right-4 top-4 z-30 pointer-events-auto sm:right-6 sm:top-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open profile options"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--mobile-control-radius)] border border-white/10 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => runAfterMenuClose(onEditDisplayName)}>
              Edit Display Name
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runAfterMenuClose(onChangeCoverImage)}>
              Change Banner Image
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onSignOut}
              className="text-red-300 focus:bg-red-500/14 focus:text-red-100 data-[highlighted]:bg-red-500/14 data-[highlighted]:text-red-100"
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="absolute inset-0 z-[1]"
        style={{ background: HERO_SPLIT_OVERLAY_BACKGROUND }}
      />

      {heroImage ? (
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-100 mix-blend-overlay"
          style={{
            opacity: 0.6,
            transform: `scale(${scrollScale + 0.5})`,
            filter: `blur(${40 + scrollBlur}px)`,
          }}
        />
      ) : (
        <div
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ background: "linear-gradient(135deg, hsl(var(--dynamic-accent) / 0.9), hsl(var(--dynamic-accent) / 0.35))" }}
        />
      )}

      <div className="relative h-full z-[2] flex items-end">
        {heroImage && (
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[65%] shrink-0 z-0">
            <img
              src={heroImage}
              alt=""
              className="h-full w-full object-cover object-top transition-[filter,transform] duration-100 opacity-60 mix-blend-overlay"
              style={{
                transform: `scale(${scrollScale})`,
                filter: `blur(${scrollBlur}px)`,
                maskImage: HERO_SPLIT_MASK_IMAGE,
                WebkitMaskImage: HERO_SPLIT_MASK_IMAGE,
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
          </div>
        )}

        <div className="pointer-events-none relative z-10 flex w-full min-w-0 flex-row items-end px-4 pb-4 sm:px-10 sm:pb-10">
          <div className="flex-1 min-w-0 pb-1 pointer-events-auto">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 sm:text-[11px]">Profile</p>
            <h1
              className="mb-2 truncate text-[2rem] font-black leading-none tracking-tight text-white sm:text-5xl md:text-6xl"
              style={{ opacity: scrollOpacity, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
            >
              {displayName}
            </h1>
            <p className="truncate text-xs text-white/70 sm:text-sm">{email}</p>
            <p className="mt-0.5 text-[10px] text-white/50 sm:text-xs">
              Member since {new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
