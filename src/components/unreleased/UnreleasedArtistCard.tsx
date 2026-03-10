import { motion } from "framer-motion";
import { RadioTower } from "lucide-react";

import type { UnreleasedArtist } from "@/lib/unreleasedApi";
import {
  MEDIA_CARD_ARTWORK_CLASS,
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_SHELL_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";

export function UnreleasedArtistCard({
  artist,
  onClick,
}: {
  artist: UnreleasedArtist;
  onClick: () => void;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
      onClick={onClick}
      className={MEDIA_CARD_SHELL_CLASS}
    >
      <div className="relative w-full overflow-hidden aspect-square shadow-sm bg-muted">
        <img
          src={artist.imageUrl}
          alt={artist.name}
          loading="lazy"
          decoding="async"
          className={MEDIA_CARD_ARTWORK_CLASS}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2 bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/78 backdrop-blur-sm">
          <RadioTower className="h-3 w-3" />
          Unreleased
        </div>
      </div>

      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="shell-artwork-wash">
            <img src={artist.imageUrl} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
        <p className={`${MEDIA_CARD_TITLE_CLASS} truncate font-medium`}>{artist.name}</p>
        <p className={`${MEDIA_CARD_META_CLASS} truncate`}>ArtistGrid archive</p>
      </div>
    </motion.div>
  );
}
