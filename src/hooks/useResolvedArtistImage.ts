import { useEffect, useState } from "react";
import { resolveArtistImageUrl } from "@/lib/musicApi";

function normalizeInitialArtistImage(imageUrl?: string | null) {
  return imageUrl || "/placeholder.svg";
}

export function useResolvedArtistImage(artistId?: number, imageUrl?: string | null, artistName?: string | null) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState(() => normalizeInitialArtistImage(imageUrl));

  useEffect(() => {
    let cancelled = false;
    const nextInitialImage = normalizeInitialArtistImage(imageUrl);
    setResolvedImageUrl(nextInitialImage);

    if ((!artistId && !artistName) || (imageUrl && imageUrl !== "/placeholder.svg")) {
      return () => {
        cancelled = true;
      };
    }

    void resolveArtistImageUrl(artistId || 0, imageUrl, artistName).then((nextImageUrl) => {
      if (!cancelled) {
        setResolvedImageUrl(nextImageUrl || "/placeholder.svg");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [artistId, artistName, imageUrl]);

  return resolvedImageUrl;
}
