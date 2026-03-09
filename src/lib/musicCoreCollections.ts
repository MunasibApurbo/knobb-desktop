import type { APICache } from "@/lib/musicCoreCache";
import type {
  FetchWithRetryOptions,
  SourceAlbum,
  SourcePlaylist,
  SourceTrack,
} from "@/lib/musicCoreShared";
import {
  prepareAlbum,
  preparePlaylist,
  prepareTrack,
} from "@/lib/musicCoreTransforms";
import {
  extractPayload,
  getArrayProp,
  getObjectProp,
  isRecord,
  unwrapItem,
} from "@/lib/musicCorePayload";

export type AlbumTracksResult = {
  album: SourceAlbum | null;
  tracks: SourceTrack[];
};

export type PlaylistTracksResult = {
  playlist: SourcePlaylist | null;
  tracks: SourceTrack[];
};

type CollectionDeps = {
  cache: APICache;
  requestJson: (relativePath: string, options?: FetchWithRetryOptions) => Promise<unknown>;
};

export async function getAlbum(
  { cache, requestJson }: CollectionDeps,
  albumId: number,
) {
  const cached = await cache.get<AlbumTracksResult>("album", albumId);
  if (cached) return cached;

  const json = await requestJson(`/album/?id=${albumId}`);
  const payload = extractPayload(json);

  let album: SourceAlbum | null = null;
  let tracksSection: unknown[] = [];

  if (isRecord(payload)) {
    if ("numberOfTracks" in payload || "title" in payload) {
      album = prepareAlbum(payload as SourceAlbum);
    }
    if (Array.isArray(payload.items)) {
      tracksSection = payload.items;
      if (!album && payload.items.length > 0) {
        const firstTrack = unwrapItem(payload.items[0]);
        if (isRecord(firstTrack) && "album" in firstTrack && isRecord(firstTrack.album)) {
          album = prepareAlbum(firstTrack.album as SourceAlbum);
        }
      }
    }
  }

  if (!album) {
    throw new Error("Album not found");
  }

  let tracks = tracksSection.map((item) => prepareTrack(unwrapItem(item) as SourceTrack));

  if (album.numberOfTracks && album.numberOfTracks > tracks.length) {
    let offset = tracks.length;
    const safeMaxTracks = 1000;

    while (tracks.length < album.numberOfTracks && tracks.length < safeMaxTracks) {
      try {
        const page = await requestJson(`/album/?id=${albumId}&offset=${offset}&limit=100`);
        const pagePayload = extractPayload(page);
        const nextItems = getArrayProp(pagePayload, "items");
        if (nextItems.length === 0) break;

        const prepared = nextItems.map((item) => prepareTrack(unwrapItem(item) as SourceTrack));
        if (tracks.length > 0 && prepared[0]?.id === tracks[0]?.id) break;

        tracks = tracks.concat(prepared);
        offset += prepared.length;
      } catch {
        break;
      }
    }
  }

  const result = { album, tracks };
  await cache.set("album", albumId, result);
  return result;
}

export async function getPlaylist(
  { cache, requestJson }: CollectionDeps,
  playlistId: string,
) {
  const cached = await cache.get<PlaylistTracksResult>("playlist", playlistId);
  if (cached) return cached;

  const json = await requestJson(`/playlist/?id=${playlistId}`);
  const payload = extractPayload(json);

  let playlist = getObjectProp<SourcePlaylist>(payload, "playlist");
  let tracksSection = getArrayProp(payload, "items");

  if ((!playlist || tracksSection.length === 0) && Array.isArray(payload)) {
    for (const entry of payload) {
      if (!playlist && isRecord(entry) && ("uuid" in entry || "numberOfTracks" in entry)) {
        playlist = entry as SourcePlaylist;
      }
      if (tracksSection.length === 0 && isRecord(entry) && Array.isArray(entry.items)) {
        tracksSection = entry.items;
      }
    }
  }

  if (!playlist && isRecord(payload) && ("uuid" in payload || "numberOfTracks" in payload)) {
    playlist = payload as SourcePlaylist;
  }

  if (!playlist) {
    throw new Error("Playlist not found");
  }

  let tracks = tracksSection.map((item) => prepareTrack(unwrapItem(item) as SourceTrack));

  if (playlist.numberOfTracks > tracks.length) {
    let offset = tracks.length;
    const safeMaxTracks = 1000;

    while (tracks.length < playlist.numberOfTracks && tracks.length < safeMaxTracks) {
      try {
        const page = await requestJson(`/playlist/?id=${playlistId}&offset=${offset}&limit=100`);
        const pagePayload = extractPayload(page);
        const nextItems =
          getArrayProp(pagePayload, "items").length > 0
            ? getArrayProp(pagePayload, "items")
            : getArrayProp(page, "items");
        if (nextItems.length === 0) break;

        const prepared = nextItems.map((item) => prepareTrack(unwrapItem(item) as SourceTrack));
        if (tracks.length > 0 && prepared[0]?.id === tracks[0]?.id) break;

        tracks = tracks.concat(prepared);
        offset += prepared.length;
      } catch {
        break;
      }
    }
  }

  const result = {
    playlist: preparePlaylist(playlist),
    tracks,
  };
  await cache.set("playlist", playlistId, result);
  return result;
}

export async function getSimilarAlbums(
  { cache, requestJson }: CollectionDeps,
  albumId: number,
) {
  const cached = await cache.get<SourceAlbum[]>("similar_albums", albumId);
  if (cached) return cached;

  try {
    const json = await requestJson(`/album/similar/?id=${albumId}`, {
      minVersion: "2.3",
    });
    const payload = extractPayload(json);
    const items =
      getArrayProp(payload, "items").length > 0
        ? getArrayProp(payload, "items")
        : getArrayProp(payload, "albums").length > 0
          ? getArrayProp(payload, "albums")
          : getArrayProp(json, "albums");
    const result = items.map((album) => prepareAlbum(album as SourceAlbum));
    await cache.set("similar_albums", albumId, result);
    return result;
  } catch {
    return [];
  }
}
