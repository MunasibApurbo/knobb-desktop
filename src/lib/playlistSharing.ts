import type { PlaylistVisibility } from "@/hooks/usePlaylists";
import { buildPlaylistPath, toAbsoluteUrl, type PlaylistRouteKind } from "@/lib/mediaNavigation";

type PlaylistShareTarget = {
  kind: PlaylistRouteKind;
  playlistId?: string | number;
  shareToken?: string;
  visibility?: PlaylistVisibility;
};

export function buildPlaylistSharePath({
  kind,
  playlistId,
  shareToken,
}: PlaylistShareTarget) {
  if (kind === "user") {
    return shareToken ? `/shared-playlist/${shareToken}` : buildPlaylistPath({ kind, playlistId, shareToken });
  }

  return buildPlaylistPath({ kind, playlistId, shareToken });
}

export function buildPlaylistShareUrl(target: PlaylistShareTarget) {
  const path = buildPlaylistSharePath(target);
  return path ? toAbsoluteUrl(path) : null;
}

export function buildPlaylistUri({
  kind,
  playlistId,
  shareToken,
}: PlaylistShareTarget) {
  if (kind === "liked") return "knobb:playlist:liked";

  const identifier =
    kind === "user" || kind === "shared"
      ? shareToken || (playlistId !== undefined ? String(playlistId) : "")
      : playlistId !== undefined
        ? String(playlistId)
        : "";

  return identifier ? `knobb:playlist:${kind}:${identifier}` : null;
}

export function canEmbedPlaylist({
  kind,
  visibility,
}: Pick<PlaylistShareTarget, "kind" | "visibility">) {
  if (kind === "liked") {
    return {
      allowed: false,
      reason: "Liked Songs stay private to your account.",
    };
  }

  if (kind === "user" || kind === "shared") {
    if (visibility === "public") {
      return { allowed: true, reason: null };
    }

    return {
      allowed: false,
      reason: "Set this playlist to Public before embedding it on another site.",
    };
  }

  return { allowed: true, reason: null };
}

export function buildPlaylistEmbedUrl(target: PlaylistShareTarget) {
  const shareUrl = buildPlaylistShareUrl(target);
  if (!shareUrl) return null;

  const url = new URL(shareUrl);
  url.searchParams.set("embed", "1");
  return url.toString();
}

export function buildPlaylistEmbedCode(
  embedUrl: string,
  options?: {
    title?: string;
    height?: number;
  },
) {
  const title = options?.title?.trim() || "Knobb playlist";
  const height = options?.height ?? 480;

  return `<iframe style="border-radius:12px" src="${embedUrl}" title="${title}" width="100%" height="${height}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}
