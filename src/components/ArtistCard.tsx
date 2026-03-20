import { type MouseEvent, memo } from "react";
import { motion } from "framer-motion";
import { Heart, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { MediaCardShell } from "@/components/MediaCardShell";
import { MediaCardArtworkBackdrop } from "@/components/media-card";
import { usePlayerCommands } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  MEDIA_CARD_ACTION_ICON_CLASS,
  MEDIA_CARD_ARTWORK_CLASS,
  MEDIA_CARD_BODY_CLASS,
  MEDIA_CARD_FAVORITE_BUTTON_CLASS,
  MEDIA_CARD_META_CLASS,
  MEDIA_CARD_PLAY_BUTTON_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/components/mediaCardStyles";
import { getControlHover, getControlTap, getMotionProfile } from "@/lib/motion";
import { buildArtistPath } from "@/lib/mediaNavigation";
import { warmArtistPageData } from "@/lib/musicApi";
import { preloadRouteModule } from "@/lib/routePreload";
import { toast } from "sonner";

const LIGHTWEIGHT_CONTROL_CLASS = "bg-black/42 shadow-lg backdrop-blur-0";

export interface ArtistCardProps {
  id: number | string;
  name: string;
  imageUrl: string;
  source?: "tidal" | "youtube-music";
  className?: string;
  isPriority?: boolean;
  lightweight?: boolean;
}

export const ArtistCard = memo(function ArtistCard({
  id,
  name,
  imageUrl,
  source = typeof id === "string" ? "youtube-music" : "tidal",
  className = "",
  isPriority,
  lightweight = false,
}: ArtistCardProps) {
  const navigate = useNavigate();
  const { playArtist } = usePlayerCommands();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const controlHover = lightweight ? undefined : getControlHover(motionEnabled, websiteMode);
  const controlTap = lightweight ? undefined : getControlTap(motionEnabled, websiteMode);
  const controlTransition = lightweight ? undefined : motionProfile.spring.control;
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const { user } = useAuth();
  const favorite = typeof id === "number" && source === "tidal" ? isFavorite(id) : false;
  const resolvedImageUrl = useResolvedArtistImage(
    typeof id === "number" ? id : undefined,
    imageUrl,
    name,
  );
  const artistPath = buildArtistPath(id, name, source);
  const preloadArtistRoute = () => {
    void preloadRouteModule(artistPath);
    if (typeof id === "number" && source === "tidal") {
      void warmArtistPageData(id);
    }
  };

  const handleToggleFavorite = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      navigate("/auth", { state: { from: window.location.pathname } });
      return;
    }

    if (typeof id !== "number" || source !== "tidal") {
      toast.error("Saving favorite artists is currently available for TIDAL artists only");
      return;
    }

    const success = await toggleFavorite({
      artistId: id,
      artistName: name,
      artistImageUrl: resolvedImageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite");
    }
  };

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void playArtist(id, name, source);
  };

  const cardContent = (
    <MediaCardShell
      onClick={() => {
        preloadArtistRoute();
        navigate(artistPath);
      }}
      onMouseEnter={preloadArtistRoute}
      onFocus={preloadArtistRoute}
      onPointerDown={preloadArtistRoute}
      className={className}
      disableDepthMotion={lightweight}
      hoverProfile={lightweight ? "static" : "auto"}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
        <img
          src={resolvedImageUrl}
          alt={name}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className={MEDIA_CARD_ARTWORK_CLASS}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />

        <motion.button
          type="button"
          onClick={handlePlay}
          className={`${MEDIA_CARD_PLAY_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          aria-label={`Play ${name}`}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
        </motion.button>

        <motion.button
          type="button"
          onClick={handleToggleFavorite}
          className={`${MEDIA_CARD_FAVORITE_BUTTON_CLASS} ${lightweight ? LIGHTWEIGHT_CONTROL_CLASS : ""}`}
          aria-label={favorite ? "Remove from favorite artists" : "Add to favorite artists"}
          whileHover={controlHover}
          whileTap={controlTap}
          transition={controlTransition}
        >
          <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${favorite ? "fill-current" : ""}`} />
        </motion.button>
      </div>

      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <MediaCardArtworkBackdrop artworkUrl={resolvedImageUrl} isPriority={isPriority} />
        <p className={`${MEDIA_CARD_TITLE_CLASS} font-medium truncate`}>
          {name}
        </p>
        <p className={`${MEDIA_CARD_META_CLASS} truncate`}>Artist</p>
      </div>
    </MediaCardShell>
  );

  return (
    <ArtistContextMenu artistId={id} artistName={name} artistImageUrl={resolvedImageUrl} source={source}>
      {cardContent}
    </ArtistContextMenu>
  );
});
