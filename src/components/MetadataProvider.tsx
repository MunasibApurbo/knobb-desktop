import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MetadataContext, type MetadataContextValue } from "@/components/metadataContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { applyMetadata, getRouteMetadata, normalizeTitle, type PageMetadata } from "@/lib/metadata";

function getNowPlayingDocumentTitle(
  track: {
    title?: string;
    artist?: string;
    artists?: Array<{ name?: string | null }>;
  } | null,
) {
  if (!track) return null;

  const title = track.title?.trim() || "Unknown Title";
  const artistNames = track.artists
    ?.map((artist) => artist.name?.trim())
    .filter((artist): artist is string => Boolean(artist));
  const artist = artistNames?.length ? artistNames.join(", ") : track.artist?.trim();

  return artist ? `${title} - ${artist}` : title;
}

export function MetadataProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { currentTrack, isPlaying } = usePlayer();
  const [pageMetadata, setPageMetadata] = useState<PageMetadata | null>(null);

  const routeMetadata = useMemo(
    () => getRouteMetadata(location.pathname, location.search),
    [location.pathname, location.search],
  );

  useEffect(() => {
    setPageMetadata(null);
  }, [location.hash, location.pathname, location.search]);

  const mergedMetadata = useMemo<PageMetadata>(() => {
    if (!pageMetadata) return routeMetadata;

    return {
      ...routeMetadata,
      ...pageMetadata,
      canonicalPath: pageMetadata.canonicalPath || routeMetadata.canonicalPath,
      image: pageMetadata.image || routeMetadata.image,
      keywords: pageMetadata.keywords || routeMetadata.keywords,
      robots: pageMetadata.robots || routeMetadata.robots,
      structuredData: pageMetadata.structuredData || routeMetadata.structuredData,
      themeColor: pageMetadata.themeColor || routeMetadata.themeColor,
      type: pageMetadata.type || routeMetadata.type,
      url: pageMetadata.url || routeMetadata.url,
    };
  }, [pageMetadata, routeMetadata]);

  useEffect(() => {
    applyMetadata(mergedMetadata);
    if (!isPlaying || !currentTrack || typeof document === "undefined") return;

    document.title = normalizeTitle(getNowPlayingDocumentTitle(currentTrack));
  }, [currentTrack, isPlaying, mergedMetadata]);

  const value = useMemo<MetadataContextValue>(() => ({
    setPageMetadata,
  }), []);

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
}
