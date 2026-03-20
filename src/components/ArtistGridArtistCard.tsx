import { motion } from "framer-motion";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";

import { MediaCardShell } from "@/components/MediaCardShell";
import {
  MediaCardArtworkBackdrop,
  MEDIA_CARD_ACTION_ICON_CLASS,
  MEDIA_CARD_ARTWORK_CLASS,
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_FAVORITE_BUTTON_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_PLAY_BUTTON_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/media-card";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getControlHover, getControlTap, getMotionProfile } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ArtistGridArtist } from "@/lib/unreleasedArchiveApi";

type ArtistGridArtistCardProps = {
  artist: ArtistGridArtist;
  isPriority?: boolean;
  onOpenPrimary: () => void;
  onOpenSheet?: () => void;
};

export function ArtistGridArtistCard({
  artist,
  isPriority,
  onOpenPrimary,
  onOpenSheet,
}: ArtistGridArtistCardProps) {
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const trackerLabel = artist.credit || "ArtistGrid archive";
  const trackerMeta = [
    artist.isAlt ? "Alternate tracker" : "Primary tracker",
    artist.isLinkWorking ? "Working" : "External open",
  ].join(" • ");

  return (
    <MediaCardShell onClick={onOpenPrimary}>
      <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
        <img
          src={artist.imageUrl}
          alt={artist.cleanName}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          width="512"
          height="512"
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 20vw"
          className={MEDIA_CARD_ARTWORK_CLASS}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />

        <motion.button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenPrimary();
          }}
          className={MEDIA_CARD_PLAY_BUTTON_CLASS}
          aria-label={`Open ${artist.cleanName} archive`}
          whileHover={getControlHover(motionEnabled, websiteMode)}
          whileTap={getControlTap(motionEnabled, websiteMode)}
          transition={motionProfile.spring.control}
        >
          <ArrowUpRight className={MEDIA_CARD_ACTION_ICON_CLASS} />
        </motion.button>

        {onOpenSheet ? (
          <motion.button
            type="button"
            aria-label={`Open ${artist.cleanName} sheet`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenSheet();
            }}
            className={MEDIA_CARD_FAVORITE_BUTTON_CLASS}
            whileHover={getControlHover(motionEnabled, websiteMode)}
            whileTap={getControlTap(motionEnabled, websiteMode)}
            transition={motionProfile.spring.control}
          >
            <FileSpreadsheet className={MEDIA_CARD_ACTION_ICON_CLASS} />
          </motion.button>
        ) : null}
      </div>

      <div className={cn(MEDIA_CARD_BODY_CLASS, "relative")}>
        <MediaCardArtworkBackdrop artworkUrl={artist.imageUrl} isPriority={isPriority} />
        <p className={cn(MEDIA_CARD_TITLE_CLASS, "truncate font-medium")}>
          {artist.cleanName}
        </p>
        <p className={cn(MEDIA_CARD_META_CLASS, "truncate")}>{trackerLabel}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
          {trackerMeta}
        </p>
      </div>
    </MediaCardShell>
  );
}
