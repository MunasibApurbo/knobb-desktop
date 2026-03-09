import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { warmArtistPageData } from "@/lib/musicApi";

interface Artist {
    id?: number;
    name: string;
}

interface ArtistsLinkProps {
    artists?: Artist[];
    name?: string; // Fallback single name
    artistId?: number; // Fallback single ID
    className?: string;
    truncate?: boolean;
    onClick?: (e: MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Handles multiple artists, joining them with commas. 
 * Each artist name is a clickable link.
 */
export function ArtistsLink({ artists, name, artistId, className = "", truncate = true, onClick }: ArtistsLinkProps) {
    const navigate = useNavigate();
    const resolvedClassName = className || "text-muted-foreground";

    // Normalize input
    const normalizedArtists: Artist[] = artists && artists.length > 0
        ? artists
        : (name ? [{ id: artistId, name }] : []);

    if (normalizedArtists.length === 0) return null;

    const handlePrefetch = (candidateArtistId?: number) => {
        if (candidateArtistId) {
            void warmArtistPageData(candidateArtistId);
        }
    };

    return (
        <span className={`${truncate ? "truncate" : ""} ${resolvedClassName}`}>
            {normalizedArtists.map((artist, idx) => (
                <span key={`${artist.id ?? artist.name}-${idx}`}>
                    <span
                        className="cursor-pointer text-inherit transition-opacity hover:underline hover:opacity-80"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClick?.(e);
                            if (artist.id) {
                                handlePrefetch(artist.id);
                                navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`);
                            } else {
                                navigate(`/search?q=${encodeURIComponent(artist.name)}`);
                            }
                        }}
                        onMouseEnter={() => handlePrefetch(artist.id)}
                        onFocus={() => handlePrefetch(artist.id)}
                        onPointerDown={() => handlePrefetch(artist.id)}
                    >
                        {artist.name}
                    </span>
                    {idx < normalizedArtists.length - 1 ? (
                        <span className="text-inherit mr-1">, </span>
                    ) : ""}
                </span>
            ))}
        </span>
    );
}
