import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { warmArtistPageData } from "@/lib/musicApi";
import { buildArtistPath } from "@/lib/mediaNavigation";
import { preloadRouteModule } from "@/lib/routePreload";

interface Artist {
  id?: number | string;
  name: string;
  source?: "tidal" | "youtube-music" | "local";
}

interface ArtistsLinkProps {
  artists?: Artist[];
  name?: string; // Fallback single name
  artistId?: number | string; // Fallback single ID
  source?: "tidal" | "youtube-music" | "local";
  className?: string;
  truncate?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Handles multiple artists, joining them with commas. 
 * Each artist name is a clickable link.
 */
export function ArtistsLink({ artists, name, artistId, source = typeof artistId === "string" ? "youtube-music" : "tidal", className = "", truncate = true, onClick }: ArtistsLinkProps) {
  const navigate = useNavigate();
  const resolvedClassName = className || "text-muted-foreground";

  // Normalize input
  const normalizedArtists: Artist[] = artists && artists.length > 0
    ? artists
    : (name ? [{ id: artistId, name, source }] : []);

  if (normalizedArtists.length === 0) return null;

  const buildTargetPath = (artist: Artist) => artist.id
    ? buildArtistPath(artist.id, artist.name, artist.source || "tidal")
    : `/search?q=${encodeURIComponent(artist.name)}`;

  const handlePrefetch = (artist: Artist) => {
    void preloadRouteModule(buildTargetPath(artist));

    const candidateArtistId = artist.id;
    const candidateSource = artist.source || "tidal";
    if (typeof candidateArtistId === "number" && candidateSource === "tidal") {
      void warmArtistPageData(candidateArtistId);
    }
  };

  return (
      <span className={`${truncate ? "truncate" : ""} ${resolvedClassName}`}>
        {normalizedArtists.map((artist, idx) => (
          <span key={`${artist.id ?? artist.name}-${idx}`}>
            <button
              type="button"
              className="cursor-pointer text-inherit transition-opacity hover:underline hover:opacity-80"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick?.(e);
                const targetPath = buildTargetPath(artist);
                handlePrefetch(artist);
                navigate(targetPath);
              }}
              onMouseEnter={() => handlePrefetch(artist)}
              onFocus={() => handlePrefetch(artist)}
              onPointerDown={() => handlePrefetch(artist)}
            >
              {artist.name}
            </button>
          {idx < normalizedArtists.length - 1 ? (
            <span className="text-inherit mr-1">, </span>
          ) : ""}
        </span>
      ))}
    </span>
  );
}
