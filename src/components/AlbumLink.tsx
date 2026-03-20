import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { searchAlbums } from "@/lib/musicApi";
import { toast } from "sonner";
import { buildAlbumPath } from "@/lib/mediaNavigation";
import { preloadRouteModule } from "@/lib/routePreload";

interface AlbumLinkProps {
  title: string;
  albumId?: number | string;
  artistName?: string;
  source?: "tidal" | "youtube-music";
  className?: string;
  layoutId?: string;
}

/**
 * Clickable album title that navigates to the album page.
 * Includes a fallback lookup if albumId is missing.
 */
export function AlbumLink({ title, albumId, artistName, source = typeof albumId === "string" ? "youtube-music" : "tidal", className = "", layoutId }: AlbumLinkProps) {
  const navigate = useNavigate();
  const resolvedClassName = className || "text-muted-foreground hover:text-foreground";
  const albumPath = albumId
    ? buildAlbumPath({
        albumId,
        title,
        artistName,
        source,
      })
    : null;

  const handleNavigate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const params = new URLSearchParams();
    params.set("title", title);
    if (artistName) params.set("artist", artistName);

    if (albumId) {
      if (albumPath) {
        void preloadRouteModule(albumPath);
        navigate(albumPath);
      }
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
      onMouseEnter={() => albumPath && void preloadRouteModule(albumPath)}
      onFocus={() => albumPath && void preloadRouteModule(albumPath)}
      onPointerDown={() => albumPath && void preloadRouteModule(albumPath)}
    >
      {title}
    </motion.span>
  );
}
