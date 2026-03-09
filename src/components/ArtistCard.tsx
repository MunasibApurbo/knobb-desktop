import { type MouseEvent } from "react";
import { motion } from "framer-motion";
import { Play, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useAuth } from "@/contexts/AuthContext";
import { warmArtistPageData } from "@/lib/musicApi";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { toast } from "sonner";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { MediaCardShell } from "@/components/MediaCardShell";
import {
    MEDIA_CARD_ARTWORK_CLASS,
    MEDIA_CARD_BODY_CLASS,
    MEDIA_CARD_FAVORITE_BUTTON_CLASS,
    MEDIA_CARD_PLAY_BUTTON_CLASS,
    MEDIA_CARD_TITLE_CLASS,
    MEDIA_CARD_META_CLASS,
    MEDIA_CARD_ACTION_ICON_CLASS,
} from "@/components/mediaCardStyles";
import {
    getControlHover,
    getControlTap,
    getMotionProfile,
} from "@/lib/motion";

export interface ArtistCardProps {
    id: number;
    name: string;
    imageUrl: string;
    className?: string;
}

export function ArtistCard({ id, name, imageUrl, className = "" }: ArtistCardProps) {
    const navigate = useNavigate();
    const { playArtist } = usePlayer();
    const { motionEnabled, websiteMode } = useMotionPreferences();
    const motionProfile = getMotionProfile(websiteMode);
    const { isFavorite, toggleFavorite } = useFavoriteArtists();
    const { user } = useAuth();
    const favorite = isFavorite(id);
    const resolvedImageUrl = useResolvedArtistImage(id, imageUrl, name);

    const handleToggleFavorite = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
            navigate("/auth", { state: { from: window.location.pathname } });
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
        void playArtist(id, name);
    };

    return (
        <ArtistContextMenu artistId={id} artistName={name} artistImageUrl={resolvedImageUrl}>
            <MediaCardShell
                onClick={() => navigate(`/artist/${id}?name=${encodeURIComponent(name)}`)}
                onMouseEnter={() => void warmArtistPageData(id)}
                onPointerDown={() => void warmArtistPageData(id)}
                className={className}
            >
                <div className="relative aspect-square w-full overflow-hidden bg-muted shadow-sm">
                    <img
                        src={resolvedImageUrl}
                        alt={name}
                        loading="lazy"
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
                        className={MEDIA_CARD_PLAY_BUTTON_CLASS}
                        aria-label={`Play ${name}`}
                        whileHover={getControlHover(motionEnabled, websiteMode)}
                        whileTap={getControlTap(motionEnabled, websiteMode)}
                        transition={motionProfile.spring.control}
                    >
                        <Play className={`${MEDIA_CARD_ACTION_ICON_CLASS} fill-current ml-0.5`} />
                    </motion.button>

                    <motion.button
                        type="button"
                        onClick={handleToggleFavorite}
                        className={MEDIA_CARD_FAVORITE_BUTTON_CLASS}
                        aria-label={favorite ? "Remove from favorite artists" : "Add to favorite artists"}
                        whileHover={getControlHover(motionEnabled, websiteMode)}
                        whileTap={getControlTap(motionEnabled, websiteMode)}
                        transition={motionProfile.spring.control}
                    >
                        <Heart className={`${MEDIA_CARD_ACTION_ICON_CLASS} ${favorite ? "fill-current" : ""}`} />
                    </motion.button>
                </div>

                <div className={MEDIA_CARD_BODY_CLASS}>
                    <p className={`${MEDIA_CARD_TITLE_CLASS} font-medium truncate`}>
                        {name}
                    </p>
                    <p className={`${MEDIA_CARD_META_CLASS} truncate`}>Artist</p>
                </div>
            </MediaCardShell>
        </ArtistContextMenu>
    );
}
