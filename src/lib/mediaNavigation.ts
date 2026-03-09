import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { searchAlbums } from "@/lib/musicApi";
import { getResolvableTidalId, inferTidalIdFromTrackId } from "@/lib/trackIdentity";
import { getTrackMixId } from "@/lib/trackMix";
import type { Track } from "@/types/music";

export type PlaylistRouteKind = "tidal" | "user" | "shared" | "liked";

const DEFAULT_PUBLIC_SITE_ORIGIN = "https://knobb.netlify.app";

type ShareOrCopyOptions = {
  title: string;
  text?: string;
  url?: string;
  fallbackText?: string;
  successMessage: string;
};

export async function copyPlainTextToClipboard(text: string) {
  if (typeof navigator === "undefined" || typeof document === "undefined" || !text) return;

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch {
    // Fall through to the next clipboard strategy.
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the DOM copy fallback.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  const previousSelection = document.getSelection();
  const selectedRange =
    previousSelection && previousSelection.rangeCount > 0
      ? previousSelection.getRangeAt(0)
      : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (previousSelection) {
      previousSelection.removeAllRanges();
      if (selectedRange) previousSelection.addRange(selectedRange);
    }
  }
}

export function buildArtistPath(artistId: number, artistName: string) {
  const params = new URLSearchParams({ name: artistName });
  return `/artist/${artistId}?${params.toString()}`;
}

export function buildArtistMixPath(artistId: number, artistName: string) {
  const params = new URLSearchParams({ name: artistName });
  return `/artist/${artistId}/mix?${params.toString()}`;
}

export function buildTrackMixPath(track: Pick<Track, "mixes" | "title" | "artist" | "coverUrl">) {
  const mixId = getTrackMixId(track);
  if (!mixId) return null;

  const params = new URLSearchParams();
  if (track.title) params.set("title", track.title);
  if (track.artist) params.set("artist", track.artist);
  if (track.coverUrl) params.set("cover", track.coverUrl);

  const query = params.toString();
  return `/mix/${encodeURIComponent(mixId)}${query ? `?${query}` : ""}`;
}

export function buildArtistSearchPath(artistName: string) {
  return `/search?q=${encodeURIComponent(artistName)}`;
}

export function buildAlbumPath({
  albumId,
  title,
  artistName,
}: {
  albumId: number | string;
  title?: string;
  artistName?: string;
}) {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (artistName) params.set("artist", artistName);

  const normalizedAlbumId =
    typeof albumId === "string" && albumId.startsWith("tidal-")
      ? albumId
      : `tidal-${albumId}`;

  const query = params.toString();
  return `/album/${normalizedAlbumId}${query ? `?${query}` : ""}`;
}

export function getTrackShareIdentifier(track: Pick<Track, "id" | "localFileId" | "tidalId">) {
  if (track.localFileId) return `local-${track.localFileId}`;

  const tidalId = getResolvableTidalId(track);
  if (tidalId) return `tidal-${tidalId}`;

  return track.id ? `app-${track.id}` : null;
}

function buildTrackSharePathWithRedirect(
  track: Pick<Track, "album" | "albumId" | "artist" | "coverUrl" | "id" | "localFileId" | "mixes" | "tidalId" | "title">,
  redirectPathOverride?: string | null,
) {
  const trackId = getTrackShareIdentifier(track);
  if (!trackId) {
    return buildTrackMixPath(track);
  }

  const redirectPath = redirectPathOverride ?? buildTrackDestinationPath(track, trackId);
  const params = new URLSearchParams();
  if (track.title) params.set("title", track.title);
  if (track.artist) params.set("artist", track.artist);
  if (track.album) params.set("album", track.album);
  if (track.coverUrl) params.set("cover", track.coverUrl);
  if (redirectPath) params.set("redirect", redirectPath);

  const query = params.toString();
  return `/track/${encodeURIComponent(trackId)}${query ? `?${query}` : ""}`;
}

export function buildTrackSharePath(
  track: Pick<Track, "album" | "albumId" | "artist" | "coverUrl" | "id" | "localFileId" | "mixes" | "tidalId" | "title">,
) {
  return buildTrackSharePathWithRedirect(track);
}

export function buildTrackShareUrl(
  track: Pick<Track, "album" | "albumId" | "artist" | "coverUrl" | "id" | "localFileId" | "mixes" | "tidalId" | "title">,
) {
  const trackId = getTrackShareIdentifier(track);
  if (trackId && inferTidalIdFromTrackId(trackId)) {
    const path = buildTrackSharePathWithRedirect(track, `/embed/track/${encodeURIComponent(trackId)}`);
    return path ? toAbsoluteUrl(path) : null;
  }

  const path = buildTrackSharePath(track);
  return path ? toAbsoluteUrl(path) : null;
}

export function buildTrackSourceUrl(
  track: Pick<Track, "album" | "albumId" | "artist" | "coverUrl" | "id" | "localFileId" | "mixes" | "tidalId" | "title">,
) {
  const path = buildTrackSharePath(track);
  return path ? toAbsoluteUrl(path) : null;
}

export function buildTrackUri(track: Pick<Track, "id" | "localFileId" | "tidalId">) {
  if (track.localFileId) {
    return `knobb:track:local:${encodeURIComponent(track.localFileId)}`;
  }

  const tidalId = getResolvableTidalId(track);
  if (tidalId) {
    return `knobb:track:tidal:${tidalId}`;
  }

  return track.id ? `knobb:track:app:${encodeURIComponent(track.id)}` : null;
}

function buildTrackDestinationPath(
  track: Pick<Track, "album" | "albumId" | "artist" | "coverUrl" | "mixes" | "title">,
  trackId: string,
) {
  if (track.albumId) {
    const basePath = buildAlbumPath({
      albumId: track.albumId,
      title: track.album,
      artistName: track.artist,
    });
    const url = new URL(basePath, "https://knobb.local");
    url.searchParams.set("trackId", trackId);
    return `${url.pathname}${url.search}`;
  }

  return buildTrackMixPath(track) || "/";
}

export function buildPlaylistPath({
  kind,
  playlistId,
  shareToken,
}: {
  kind: PlaylistRouteKind;
  playlistId?: string | number;
  shareToken?: string;
}) {
  if (kind === "liked") return "/liked";
  if (kind === "shared") {
    const token = shareToken || (playlistId !== undefined ? String(playlistId) : "");
    return token ? `/shared-playlist/${token}` : null;
  }
  if (kind === "user") {
    return playlistId !== undefined ? `/my-playlist/${playlistId}` : null;
  }
  return playlistId !== undefined ? `/playlist/${playlistId}` : null;
}

export function toAbsoluteUrl(path: string) {
  const configuredOrigin = getConfiguredSiteOrigin();
  if (configuredOrigin) {
    return new URL(path, configuredOrigin).toString();
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.trim().toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    ) {
      return new URL(path, DEFAULT_PUBLIC_SITE_ORIGIN).toString();
    }

    return new URL(path, window.location.origin).toString();
  }

  return new URL(path, DEFAULT_PUBLIC_SITE_ORIGIN).toString();
}

function getConfiguredSiteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (!configured) return "";

  try {
    return new URL(configured).origin;
  } catch {
    return "";
  }
}

export async function shareOrCopy({
  title,
  text,
  url,
  fallbackText,
  successMessage,
}: ShareOrCopyOptions) {
  const clipboardText = url || fallbackText || text || title;
  if (!clipboardText) {
    return;
  }

  await copyPlainTextToClipboard(clipboardText);
  toast.success(successMessage);
}

export async function navigateToTrackAlbum(track: Track, navigate: NavigateFunction) {
  if (track.albumId) {
    navigate(
      buildAlbumPath({
        albumId: track.albumId,
        title: track.album,
        artistName: track.artist,
      }),
    );
    return true;
  }

  try {
    const matches = await searchAlbums(`${track.album} ${track.artist}`, 6);
    const exactMatch =
      matches.find((album) => album.title?.toLowerCase() === track.album?.toLowerCase()) ||
      matches[0];

    if (exactMatch) {
      navigate(
        buildAlbumPath({
          albumId: exactMatch.id,
          title: track.album,
          artistName: track.artist,
        }),
      );
      return true;
    }
  } catch (error) {
    console.warn("Album lookup failed:", error);
  }

  return false;
}
