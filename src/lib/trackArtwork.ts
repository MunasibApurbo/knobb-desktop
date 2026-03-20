import type { Track } from "@/types/music";

const TIDAL_SIZED_IMAGE_PATTERN = /^(https?:\/\/[^/]*tidal[^/]*\/images\/.+\/)(\d+x\d+)(\.[a-z0-9]+)$/i;
const VIDEO_ARTWORK_SIZE = "1280x720";
const MEDIA_SESSION_ARTWORK_SIZE = "750x750";
const YOUTUBE_PROXY_ARTWORK_HOST_PATTERN = /(?:googleusercontent\.com|ggpht\.com)/i;

function buildYoutubeMusicTrackArtworkUrl(sourceId?: string, isVideo?: boolean) {
  const normalizedSourceId = typeof sourceId === "string" ? sourceId.trim() : "";
  if (!normalizedSourceId) return null;

  const thumbnailName = isVideo ? "sddefault.jpg" : "hqdefault.jpg";
  return `https://i.ytimg.com/vi/${encodeURIComponent(normalizedSourceId)}/${thumbnailName}`;
}

function shouldProxyArtworkForColorSampling(artworkUrl: string) {
  try {
    const parsedUrl = new URL(artworkUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsedUrl.origin === (typeof window !== "undefined" ? window.location.origin : "http://localhost")) {
      return false;
    }
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getTrackArtworkUrl(track: Pick<Track, "coverUrl" | "isVideo" | "source" | "sourceId">): string {
  const coverUrl = track.coverUrl || "/placeholder.svg";

  if (track.source === "youtube-music") {
    const youtubeFallbackArtworkUrl = buildYoutubeMusicTrackArtworkUrl(track.sourceId, track.isVideo);
    if (
      youtubeFallbackArtworkUrl &&
      (coverUrl === "/placeholder.svg" || YOUTUBE_PROXY_ARTWORK_HOST_PATTERN.test(coverUrl))
    ) {
      return youtubeFallbackArtworkUrl;
    }
  }

  if (track.isVideo !== true) {
    return coverUrl;
  }

  const tidalImageMatch = coverUrl.match(TIDAL_SIZED_IMAGE_PATTERN);
  if (!tidalImageMatch) {
    return coverUrl;
  }

  const [, baseUrl, , extension] = tidalImageMatch;
  return `${baseUrl}${VIDEO_ARTWORK_SIZE}${extension}`;
}

export function getMediaSessionTrackArtworkUrl(
  track: Pick<Track, "coverUrl" | "isVideo" | "source" | "sourceId">,
): string {
  const coverUrl = track.coverUrl || "/placeholder.svg";

  if (track.source === "youtube-music") {
    if (coverUrl && coverUrl !== "/placeholder.svg") {
      return coverUrl;
    }

    return buildYoutubeMusicTrackArtworkUrl(track.sourceId, track.isVideo) || coverUrl;
  }

  if (track.isVideo !== true) {
    return coverUrl;
  }

  const tidalImageMatch = coverUrl.match(TIDAL_SIZED_IMAGE_PATTERN);
  if (!tidalImageMatch) {
    return coverUrl;
  }

  const [, baseUrl, , extension] = tidalImageMatch;
  return `${baseUrl}${MEDIA_SESSION_ARTWORK_SIZE}${extension}`;
}

export function getArtworkColorSampleUrl(artworkUrl: string): string {
  if (!artworkUrl || artworkUrl === "/placeholder.svg") {
    return artworkUrl || "/placeholder.svg";
  }

  if (!shouldProxyArtworkForColorSampling(artworkUrl)) {
    return artworkUrl;
  }

  return `/api/image-proxy?url=${encodeURIComponent(artworkUrl)}`;
}
