import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { searchAlbums } from "@/lib/musicApi";
import { toast } from "sonner";

interface AlbumLinkProps {
    title: string;
    albumId?: number;
    artistName?: string;
    className?: string;
    layoutId?: string;
}

/**
 * Clickable album title that navigates to the album page.
 * Includes a fallback lookup if albumId is missing.
 */
export function AlbumLink({ title, albumId, artistName, className = "", layoutId }: AlbumLinkProps) {
    const navigate = useNavigate();
    const resolvedClassName = className || "text-muted-foreground hover:text-foreground";

    const handleNavigate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const params = new URLSearchParams();
        params.set("title", title);
        if (artistName) params.set("artist", artistName);

        if (albumId) {
            navigate(`/album/tidal-${albumId}?${params.toString()}`);
            return;
        }

        // Fallback: search for album if ID is missing
        try {
            const query = artistName ? `${artistName} ${title}` : title;
            const matches = await searchAlbums(query, 6);
            const exact = matches.find((a) => a.title?.toLowerCase() === title.toLowerCase()) || matches[0];

            if (exact) {
                navigate(`/album/tidal-${exact.id}?${params.toString()}`);
                return;
            }
        } catch (e) {
            console.warn("Album lookup failed:", e);
        }

        toast.error("Album details not found");
    };

    return (
        <motion.span
            layoutId={layoutId}
            className={`${resolvedClassName} cursor-pointer truncate transition-colors hover:underline`}
            onClick={handleNavigate}
        >
            {title}
        </motion.span>
    );
}
