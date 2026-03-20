import { useMemo, useState } from "react";
import { MoreHorizontal, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  getHeroScrollStyles,
  getHeroAuraBackground,
  getHeroSplitOverlayBackground,
  getHeroSurfaceBackground,
  HERO_SPLIT_MASK_IMAGE,
} from "@/lib/heroVisuals";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { motion } from "framer-motion";

type ProfileHeroProps = {
  displayName: string;
  email: string | undefined;
  createdAt: string;
  heroImage: string | null;
  scrollY?: number;
  onEditDisplayName: () => void;
  onChangeCoverImage: () => void;
};

export function ProfileHero({
  displayName,
  email,
  createdAt,
  heroImage,
  scrollY,
  onEditDisplayName,
  onChangeCoverImage,
}: ProfileHeroProps) {
  const internalScrollY = useMainScrollY(true, 24);
  const resolvedScrollY = scrollY || internalScrollY;
  const { scrollOpacity } = getHeroScrollStyles(resolvedScrollY);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasHeroImage = Boolean(heroImage);

  const handleMenuAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const heroBackground = hasHeroImage
    ? getHeroSurfaceBackground()
    : "linear-gradient(180deg, hsl(0 0% 100% / 0.06) 0%, hsl(0 0% 4%) 44%, hsl(0 0% 0%) 100%)";
  const heroOverlayBackground = hasHeroImage
    ? getHeroSplitOverlayBackground()
    : "radial-gradient(circle at 14% 18%, hsl(0 0% 100% / 0.14), transparent 24%), radial-gradient(circle at 82% 14%, hsl(0 0% 100% / 0.08), transparent 22%)";
  const heroAuraBackground = hasHeroImage ? getHeroAuraBackground() : null;
  const profileInitial = useMemo(() => {
    const trimmedName = displayName.trim();
    if (!trimmedName) return "K";
    return trimmedName.charAt(0).toUpperCase();
  }, [displayName]);

  return (
    <section
      className={`detail-hero relative overflow-hidden border border-white/10 border-b-0 ${hasHeroImage ? "" : "detail-hero--compact"}`}
      style={{ background: heroBackground }}
    >
      <div className="absolute right-4 top-4 z-[30] sm:right-5 sm:top-5 md:right-6 md:top-6">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open profile options"
              className="menu-sweep-hover flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white transition-colors hover:bg-black/72"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => handleMenuAction(onEditDisplayName)}>
              Edit Display Name
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleMenuAction(onChangeCoverImage)}>
              Change Banner Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {heroOverlayBackground && (
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: heroOverlayBackground }}
        />
      )}
      {heroAuraBackground && (
        <div
          className="detail-hero-aura absolute inset-0 z-[1]"
          style={{ background: heroAuraBackground }}
        />
      )}

      {hasHeroImage ? (
        <img
          src={heroImage ?? undefined}
          alt=""
          className="absolute inset-0 h-full w-full object-cover mix-blend-overlay will-change-transform"
          style={{
            opacity: 0.52,
            transform: "scale(1.14)",
          }}
        />
      ) : null}

      <div className="relative z-[2] flex h-full items-end">
        {hasHeroImage ? (
          <div className="detail-hero-cover-bleed absolute inset-y-0 right-0 hidden w-[58%] shrink-0 md:block">
            <motion.img
              src={heroImage ?? undefined}
              alt=""
              className="h-full w-full object-cover object-top mix-blend-overlay will-change-transform"
              style={{
                opacity: 0.58,
                transform: "scale(1.01)",
                maskImage: HERO_SPLIT_MASK_IMAGE,
                WebkitMaskImage: HERO_SPLIT_MASK_IMAGE,
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
          </div>
        ) : null}

        <div className={`detail-hero-content relative z-10 flex w-full min-w-0 flex-col justify-end px-4 pb-5 pt-6 sm:px-5 md:px-8 md:pb-8 md:pt-10 lg:px-10 ${hasHeroImage ? "md:w-[58%]" : "md:w-full"}`}>
          {hasHeroImage ? (
            <div className="detail-hero-cover-card mb-5 md:hidden">
              <img
                src={heroImage ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:h-20 sm:w-20">
              {displayName.trim() ? (
                <span className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">{profileInitial}</span>
              ) : (
                <User className="h-7 w-7 sm:h-8 sm:w-8" />
              )}
            </div>
          )}

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
            Profile
          </p>
          <motion.div
            className={`font-black leading-[0.94] tracking-[-0.04em] text-white ${hasHeroImage ? "text-4xl sm:text-5xl md:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl md:text-6xl"}`}
            style={{
              opacity: scrollOpacity,
              textShadow: "0 8px 32px rgba(0,0,0,0.42)",
            }}
          >
            {displayName}
          </motion.div>
          {email && (
            <div className="detail-hero-body mt-4">
              <p className="max-w-[34rem] truncate text-xs font-semibold text-white/76 sm:text-sm">{email}</p>
            </div>
          )}
          {!hasHeroImage ? (
            <div className="detail-hero-body mt-4">
              <p className="max-w-[34rem] text-sm text-white/62">
                Add a banner image to personalize your profile. Your listening highlights will appear here as you build up some history.
              </p>
            </div>
          ) : null}
          <div className="detail-hero-meta mt-4">
            <p className="text-[10px] text-white/54 sm:text-xs">
              Member since {new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
