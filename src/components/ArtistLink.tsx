import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { warmArtistPageData } from "@/lib/musicApi";
import { buildArtistPath } from "@/lib/mediaNavigation";
import { preloadRouteModule } from "@/lib/routePreload";

interface ArtistLinkProps {
  name: string;
  artistId?: number | string;
  source?: "tidal" | "youtube-music";
  className?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Clickable artist name that navigates to the artist page.
 * Works for both Tidal tracks (with artistId) and local tracks (plain text).
 */
export function ArtistLink({ name, artistId, source = typeof artistId === "string" ? "youtube-music" : "tidal", className = "", onClick }: ArtistLinkProps) {
  const navigate = useNavigate();
  const resolvedClassName = className || "text-muted-foreground";
  const targetPath = artistId ? buildArtistPath(artistId, name, source) : `/search?q=${encodeURIComponent(name)}`;

  const preloadNavigation = () => {
    void preloadRouteModule(targetPath);
    if (typeof artistId === "number" && source === "tidal") {
      void warmArtistPageData(artistId);
    }
  };

  const handleNavigate = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
    preloadNavigation();
    navigate(targetPath);
  };

  return (
    <button
      type="button"
      className={`${resolvedClassName} hover:text-foreground hover:underline cursor-pointer transition-colors`}
      onClick={handleNavigate}
      onMouseEnter={preloadNavigation}
      onFocus={preloadNavigation}
      onPointerDown={preloadNavigation}
    >
      {name}
    </button>
  );
}
