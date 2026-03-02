import { useNavigate } from "react-router-dom";

interface ArtistLinkProps {
  name: string;
  artistId?: number;
  className?: string;
}

/**
 * Clickable artist name that navigates to the artist page.
 * Works for both Tidal tracks (with artistId) and local tracks (plain text).
 */
export function ArtistLink({ name, artistId, className = "" }: ArtistLinkProps) {
  const navigate = useNavigate();

  if (!artistId) {
    return <span className={`text-muted-foreground ${className}`}>{name}</span>;
  }

  return (
    <span
      className={`text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/artist/${artistId}?name=${encodeURIComponent(name)}`);
      }}
    >
      {name}
    </span>
  );
}
