import { useEffect, useState } from "react";
import { getCachedArtistImageUrl, resolveArtistImageUrl } from "@/lib/musicApi";

export function useResolvedArtistImage(artistId?: number, imageUrl?: string | null, artistName?: string | null) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState(() =>
    getCachedArtistImageUrl(artistId || 0, imageUrl, artistName),
  );

  useEffect(() => {
    let cancelled = false;
    const nextInitialImage = getCachedArtistImageUrl(artistId || 0, imageUrl, artistName);
    setResolvedImageUrl((currentImage) => currentImage === nextInitialImage ? currentImage : nextInitialImage);

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
