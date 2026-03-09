import type { Track } from "@/types/music";
import { getTrackShareIdentifier, toAbsoluteUrl } from "@/lib/mediaNavigation";
import { inferTidalIdFromTrackId } from "@/lib/trackIdentity";

type TrackEmbedTarget = Pick<Track, "id" | "localFileId" | "tidalId">;
type TrackEmbedMetadata = Pick<Track, "album" | "artist" | "coverUrl" | "title">;

export function canEmbedTrack(track: TrackEmbedTarget) {
  if (track.localFileId) {
    return {
      allowed: false,
      reason: "Local files cannot be embedded outside Knobb.",
    };
  }

  if (!inferTidalIdFromTrackId(getTrackShareIdentifier(track))) {
    return {
      allowed: false,
      reason: "Only streaming tracks with a resolvable Knobb ID can be embedded.",
    };
  }

  return { allowed: true, reason: null };
}

export function buildTrackEmbedPath(track: TrackEmbedTarget & Partial<TrackEmbedMetadata>) {
  const embedState = canEmbedTrack(track);
  if (!embedState.allowed) return null;

  const identifier = getTrackShareIdentifier(track);
  if (!identifier) return null;

  const params = new URLSearchParams();
  if (track.title) params.set("title", track.title);
  if (track.artist) params.set("artist", track.artist);
  if (track.album) params.set("album", track.album);
  if (track.coverUrl) params.set("cover", track.coverUrl);

  const query = params.toString();
  return `/embed/track/${encodeURIComponent(identifier)}${query ? `?${query}` : ""}`;
}

export function buildTrackEmbedUrl(track: TrackEmbedTarget & Partial<TrackEmbedMetadata>) {
  const path = buildTrackEmbedPath(track);
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
  const height = options?.height ?? 352;

  return `<iframe style="border-radius:12px" src="${embedUrl}" title="${title}" width="100%" height="${height}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}
