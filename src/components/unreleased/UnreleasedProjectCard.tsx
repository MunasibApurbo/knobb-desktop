import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Play, RadioTower } from "lucide-react";

import type { UnreleasedArtist, UnreleasedProject } from "@/lib/unreleasedApi";
import {
  MEDIA_CARD_ACTION_ICON_CLASS,
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_PLAY_BUTTON_CLASS,
  MEDIA_CARD_SHELL_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";

export function UnreleasedProjectCard({
  artist,
  project,
  onClick,
  onPlay,
  detailsSlot,
}: {
  artist: UnreleasedArtist;
  project: UnreleasedProject;
  onClick: () => void;
  onPlay: () => void;
  detailsSlot?: ReactNode;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
      onClick={onClick}
      className={MEDIA_CARD_SHELL_CLASS}
    >
      <div className="relative w-full overflow-hidden aspect-square shadow-sm bg-muted">
        <img
          src={project.imageUrl || artist.imageUrl}
          alt={project.name}
          loading="lazy"
          decoding="async"
          className="media-card-artwork h-full w-full object-cover object-center"
          onError={(event) => {
            (event.target as HTMLImageElement).src = artist.imageUrl || "/placeholder.svg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/24 to-transparent" />
        <div className="absolute left-3 top-3 bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/78 backdrop-blur-sm">
          {project.timeline || "Unreleased"}
        </div>
        {detailsSlot ? (
          <div
            className="absolute right-3 top-3 z-10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {detailsSlot}
          </div>
        ) : null}

        {project.availableCount > 0 ? (
          <button
            type="button"
            className={MEDIA_CARD_PLAY_BUTTON_CLASS}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPlay();
            }}
            aria-label={`Play ${project.name}`}
          >
            <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
          </button>
        ) : null}

        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/74 backdrop-blur-sm">
          <RadioTower className="h-3 w-3" />
          {project.availableCount}/{project.trackCount}
        </div>
      </div>

      <div className={MEDIA_CARD_BODY_CLASS}>
        <p className={`${MEDIA_CARD_TITLE_CLASS} line-clamp-2 font-medium`}>{project.name}</p>
        <p className={`${MEDIA_CARD_META_CLASS} truncate`}>
          {artist.name} • {project.trackCount} tracks
        </p>
      </div>
    </motion.div>
  );
}
