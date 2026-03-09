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
  profileCompleteness: number;
  profileCompletenessLabel: string;
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
  profileCompleteness,
  profileCompletenessLabel,
  scrollY,
  onEditDisplayName,
  onChangeCoverImage,
  onSignOut,
}: ProfileHeroProps) {
  const { scrollScale, scrollBlur, scrollOpacity } = getHeroScrollStyles(scrollY.get());

  return (
    <div className="relative overflow-hidden mb-0 border-b border-white/5 bg-[#121212]" style={{ height: "320px" }}>
      <div className="absolute top-6 right-6 z-30 pointer-events-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors text-white border border-white/10">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEditDisplayName}>
              Edit Display Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onChangeCoverImage}>
              Change Cover Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="text-red-500">
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

        <div className="relative z-10 w-full flex flex-row items-center md:items-end px-6 sm:px-10 pb-6 sm:pb-10 min-w-0 pointer-events-none">
          <div className="flex-1 min-w-0 pb-1 pointer-events-auto">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 mb-1">Profile</p>
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-black text-white truncate leading-none mb-2 tracking-tight"
              style={{ opacity: scrollOpacity, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
            >
              {displayName}
            </h1>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72 backdrop-blur-md">
              <span>{profileCompleteness}% complete</span>
              <span className="text-white/38">•</span>
              <span>{profileCompletenessLabel}</span>
            </div>
            <p className="text-xs sm:text-sm text-white/70 truncate">{email}</p>
            <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">
              Member since {new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
