import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { warmArtistPageData } from "@/lib/musicApi";

interface ArtistLinkProps {
  name: string;
  artistId?: number;
  className?: string;
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Clickable artist name that navigates to the artist page.
 * Works for both Tidal tracks (with artistId) and local tracks (plain text).
 */
export function ArtistLink({ name, artistId, className = "", onClick }: ArtistLinkProps) {
  const navigate = useNavigate();
  const resolvedClassName = className || "text-muted-foreground";

  const handleNavigate = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);

    if (artistId) {
      void warmArtistPageData(artistId);
      navigate(`/artist/${artistId}?name=${encodeURIComponent(name)}`);
      return;
    }

    navigate(`/search?q=${encodeURIComponent(name)}`);
  };

  return (
    <span
      className={`${resolvedClassName} hover:text-foreground hover:underline cursor-pointer transition-colors`}
      onClick={handleNavigate}
      onMouseEnter={() => artistId && void warmArtistPageData(artistId)}
      onFocus={() => artistId && void warmArtistPageData(artistId)}
      onPointerDown={() => artistId && void warmArtistPageData(artistId)}
    >
      {name}
    </span>
  );
}
