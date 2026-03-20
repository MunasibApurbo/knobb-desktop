import type { Track } from "@/types/music";
import { getTrackShareIdentifier, toAbsoluteUrl } from "@/lib/mediaNavigation";
import { inferTidalIdFromTrackId } from "@/lib/trackIdentity";

export type TrackEmbedSize = "compact" | "normal";
export type TrackEmbedTheme = "graphite" | "ocean";

type TrackShareable = Pick<
  Track,
  "album" | "artist" | "coverUrl" | "id" | "localFileId" | "mixes" | "source" | "sourceId" | "tidalId" | "title"
>;

function appendTrackEmbedMetadata(params: URLSearchParams, track: TrackShareable) {
  if (track.title) params.set("title", track.title);
  if (track.artist) params.set("artist", track.artist);
  if (track.album) params.set("album", track.album);
  if (track.coverUrl) params.set("cover", track.coverUrl);
}

export const TRACK_EMBED_SIZES: Record<TrackEmbedSize, { label: string; height: number; previewClassName: string }> = {
  compact: {
    label: "Compact",
    height: 232,
    previewClassName: "h-[232px]",
  },
  normal: {
    label: "Normal",
    height: 352,
    previewClassName: "h-[352px]",
  },
};

export function canEmbedTrack(track: TrackShareable) {
  const trackId = getTrackShareIdentifier(track);
  if (!trackId) {
    return {
      allowed: false,
      reason: "This track does not expose a stable public identifier yet.",
    };
  }

  if (!inferTidalIdFromTrackId(trackId)) {
    return {
      allowed: false,
      reason: "Embedding is currently available for tracks with a TIDAL source ID.",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

export function buildTrackEmbedPath(
  track: TrackShareable,
  options?: {
    size?: TrackEmbedSize;
    theme?: TrackEmbedTheme;
  },
) {
  const trackId = getTrackShareIdentifier(track);
  if (!trackId || !inferTidalIdFromTrackId(trackId)) return null;

  const params = new URLSearchParams();
  appendTrackEmbedMetadata(params, track);
  if (options?.theme && options.theme !== "ocean") {
    params.set("theme", options.theme);
  }
  if (options?.size && options.size !== "normal") {
    params.set("size", options.size);
  }

  const query = params.toString();
  return `/embed/track/${encodeURIComponent(trackId)}${query ? `?${query}` : ""}`;
}

export function buildTrackEmbedUrl(
  track: TrackShareable,
  options?: {
    size?: TrackEmbedSize;
    theme?: TrackEmbedTheme;
  },
) {
  const path = buildTrackEmbedPath(track, options);
  return path ? toAbsoluteUrl(path) : null;
}

export function buildTrackEmbedCode(
  embedUrl: string,
  options?: {
    title?: string;
    height?: number;
  },
) {
  const title = options?.title?.trim() || "Knobb track";
  const height = options?.height ?? TRACK_EMBED_SIZES.normal.height;

  return `<iframe style="border-radius:12px" src="${embedUrl}" title="${title}" width="100%" height="${height}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}
