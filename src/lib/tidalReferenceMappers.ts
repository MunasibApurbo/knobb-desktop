import { Track } from "@/types/music";
import { TidalV2AnyDocument, TidalV2Relationship, TidalV2ResourceIdentifier, TidalV2ResourceObject } from "@/lib/tidalV2Schemas";
import { hexToHsl } from "@/lib/musicApiTransforms";
import { getReleaseYear } from "@/lib/releaseDates";

export interface TidalReferenceArtistResult {
  id: number;
  name: string;
  imageUrl: string;
}

export interface TidalReferenceAlbumResult {
  id: number;
  title: string;
  artist: string;
  coverUrl: string;
  releaseDate?: string;
}

export interface TidalReferencePlaylistResult {
  id: string;
  title: string;
  description: string;
  trackCount: number;
  coverUrl: string;
}

type ResourceIndex = Map<string, TidalV2ResourceObject>;

function indexKey(type: string | undefined, id: string | undefined) {
  if (!type || !id) return "";
  return `${type}:${id}`;
}

function asArray(value: unknown): TidalV2ResourceObject[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as TidalV2ResourceObject[]) : [value as TidalV2ResourceObject];
}

function relationshipArray(relationship?: TidalV2Relationship): TidalV2ResourceIdentifier[] {
  const value = relationship?.data;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getRelationshipItems(resource: TidalV2ResourceObject, relationshipName: string) {
  return relationshipArray(resource.relationships?.[relationshipName]);
}

function getIncludedResources(document?: TidalV2AnyDocument | null): TidalV2ResourceObject[] {
  if (!document) return [];
  const dataResources = asArray(document.data);
  const includedResources = asArray(document.included);
  return [...dataResources, ...includedResources].filter((resource) => !!resource?.id && !!resource?.type);
}

function buildIndex(...documents: (TidalV2AnyDocument | null | undefined)[]): ResourceIndex {
  const index: ResourceIndex = new Map();
  for (const document of documents) {
    for (const resource of getIncludedResources(document || undefined)) {
      index.set(indexKey(resource.type, resource.id), resource);
    }
  }
  return index;
}

function resolveResource(index: ResourceIndex, identifier?: TidalV2ResourceIdentifier | null) {
  if (!identifier) return null;
  return index.get(indexKey(identifier.type, identifier.id)) || null;
}

function resolveResources(index: ResourceIndex, identifiers: TidalV2ResourceIdentifier[]) {
  const resources: TidalV2ResourceObject[] = [];
  for (const identifier of identifiers) {
    const resource = resolveResource(index, identifier);
    if (resource) resources.push(resource);
  }
  return resources;
}

function pickString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function pickNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseNumericId(id: string | undefined): number | null {
  if (!id) return null;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIsoDurationToSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== "string") return 0;

  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function getArtworkUrlFromResource(resource: TidalV2ResourceObject | null): string {
  if (!resource?.attributes || typeof resource.attributes !== "object") return "";
  const attributes = resource.attributes as Record<string, unknown>;
  const files = Array.isArray(attributes.files) ? attributes.files : [];
  let bestHref = "";
  let bestArea = -1;

  for (const entry of files) {
    if (!entry || typeof entry !== "object") continue;
    const href = pickString((entry as Record<string, unknown>).href);
    if (!href) continue;
    const meta = (entry as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    const width = pickNumber(meta?.width) || 0;
    const height = pickNumber(meta?.height) || 0;
    const area = width * height;
    if (area >= bestArea) {
      bestArea = area;
      bestHref = href;
    }
  }

  return bestHref;
}

function getResourceImageUrl(
  resource: TidalV2ResourceObject,
  index: ResourceIndex,
  relationshipNames: string[],
) {
  for (const relationshipName of relationshipNames) {
    const artworkIds = getRelationshipItems(resource, relationshipName).filter((item) => item.type === "artworks");
    const artworks = resolveResources(index, artworkIds);
    for (const artwork of artworks) {
      const href = getArtworkUrlFromResource(artwork);
      if (href) return href;
    }
  }
  return "";
}

function getArtistNames(track: TidalV2ResourceObject, index: ResourceIndex) {
  const artistIds = getRelationshipItems(track, "artists").filter((item) => item.type === "artists");
  const artists = resolveResources(index, artistIds);
  const names = artists
    .map((artist) => pickString((artist.attributes as Record<string, unknown>)?.name))
    .filter(Boolean);

  return names.length > 0 ? names : ["Unknown Artist"];
}

function getPrimaryAlbum(track: TidalV2ResourceObject, index: ResourceIndex) {
  const albumId = getRelationshipItems(track, "albums").find((item) => item.type === "albums");
  const album = resolveResource(index, albumId);
  if (!album) return null;

  const attributes = (album.attributes || {}) as Record<string, unknown>;
  return {
    id: parseNumericId(album.id),
    title: pickString(attributes.title, "Unknown Album"),
    releaseDate: pickString(attributes.releaseDate, ""),
    coverUrl: getResourceImageUrl(album, index, ["coverArt", "suggestedCoverArts"]),
    canvasColor: pickString(
      ((resolveResource(index, getRelationshipItems(album, "coverArt")[0])?.attributes as Record<string, unknown> | undefined)?.visualMetadata as Record<string, unknown> | undefined)?.selectedPaletteColor,
      "",
    ),
    artistNames: resolveResources(index, getRelationshipItems(album, "artists"))
      .map((artist) => pickString((artist.attributes as Record<string, unknown>)?.name))
      .filter(Boolean),
  };
}

function toTrack(resource: TidalV2ResourceObject, index: ResourceIndex): Track {
  const attributes = (resource.attributes || {}) as Record<string, unknown>;
  const numericTrackId = parseNumericId(resource.id);
  const version = pickString(attributes.version);
  const title = pickString(attributes.title, "Unknown Title");
  const trackTitle = version ? `${title} (${version})` : title;
  const artistNames = getArtistNames(resource, index);
  const primaryAlbum = getPrimaryAlbum(resource, index);
  const explicit = Boolean(attributes.explicit);
  const duration = parseIsoDurationToSeconds(attributes.duration);
  const releaseDate = primaryAlbum?.releaseDate;
  const year = getReleaseYear(releaseDate);
  const artistId = parseNumericId(getRelationshipItems(resource, "artists")[0]?.id);
  const coverUrl = primaryAlbum?.coverUrl || "/placeholder.svg";
  const paletteHex = primaryAlbum?.canvasColor;
  const canvasColor = paletteHex ? hexToHsl(paletteHex) : "220 70% 55%";

  return {
    id: `tidal-${resource.id}`,
    tidalId: numericTrackId || undefined,
    albumId: primaryAlbum?.id || undefined,
    artistId: artistId || undefined,
    artists: resolveResources(index, getRelationshipItems(resource, "artists"))
      .map((artist) => ({
        id: parseNumericId(artist.id) || 0,
        name: pickString((artist.attributes as Record<string, unknown>)?.name, "Unknown Artist"),
      }))
      .filter((artist) => artist.id > 0),
    title: trackTitle,
    artist: artistNames.join(", "),
    album: primaryAlbum?.title || "Unknown Album",
    duration,
    year,
    releaseDate,
    coverUrl,
    canvasColor,
    explicit,
  };
}

export function extractTracksFromDocument(document?: TidalV2AnyDocument | null): Track[] {
  if (!document) return [];
  const index = buildIndex(document);
  return asArray(document.data)
    .filter((resource) => resource.type === "tracks")
    .map((resource) => toTrack(resource, index));
}

export function extractArtistsFromDocument(document?: TidalV2AnyDocument | null): TidalReferenceArtistResult[] {
  if (!document) return [];
  const index = buildIndex(document);
  const artists = asArray(document.data).filter((resource) => resource.type === "artists");

  return artists.map((artist) => {
    const attributes = (artist.attributes || {}) as Record<string, unknown>;
    return {
      id: parseNumericId(artist.id) || 0,
      name: pickString(attributes.name, "Unknown Artist"),
      imageUrl: getResourceImageUrl(artist, index, ["profileArt"]),
    };
  }).filter((artist) => artist.id > 0);
}

export function extractAlbumsFromDocument(document?: TidalV2AnyDocument | null): TidalReferenceAlbumResult[] {
  if (!document) return [];
  const index = buildIndex(document);
  const albums = asArray(document.data).filter((resource) => resource.type === "albums");

  return albums.map((album) => {
    const attributes = (album.attributes || {}) as Record<string, unknown>;
    const artists = resolveResources(index, getRelationshipItems(album, "artists"))
      .map((artist) => pickString((artist.attributes as Record<string, unknown>)?.name))
      .filter(Boolean);

    return {
      id: parseNumericId(album.id) || 0,
      title: pickString(attributes.title, "Unknown Album"),
      artist: artists.join(", ") || "Unknown Artist",
      coverUrl: getResourceImageUrl(album, index, ["coverArt", "suggestedCoverArts"]) || "/placeholder.svg",
      releaseDate: pickString(attributes.releaseDate),
    };
  }).filter((album) => album.id > 0);
}

export function extractPlaylistsFromDocument(document?: TidalV2AnyDocument | null): TidalReferencePlaylistResult[] {
  if (!document) return [];
  const index = buildIndex(document);
  const playlists = asArray(document.data).filter((resource) => resource.type === "playlists");

  return playlists.map((playlist) => {
    const attributes = (playlist.attributes || {}) as Record<string, unknown>;
    const numberOfItems = pickNumber(attributes.numberOfItems) || 0;
    return {
      id: playlist.id,
      title: pickString(attributes.name, "Untitled Playlist"),
      description: pickString(attributes.description, ""),
      trackCount: numberOfItems,
      coverUrl: getResourceImageUrl(playlist, index, ["coverArt"]) || "/placeholder.svg",
    };
  });
}

function dedupeById<T extends { id: number | string }>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export function extractSearchResults(document?: TidalV2AnyDocument | null) {
  if (!document) {
    return { tracks: [], artists: [], albums: [], playlists: [] };
  }

  const resources = getIncludedResources(document);
  const tracksDoc: TidalV2AnyDocument = { data: resources.filter((resource) => resource.type === "tracks"), included: resources };
  const artistsDoc: TidalV2AnyDocument = { data: resources.filter((resource) => resource.type === "artists"), included: resources };
  const albumsDoc: TidalV2AnyDocument = { data: resources.filter((resource) => resource.type === "albums"), included: resources };
  const playlistsDoc: TidalV2AnyDocument = { data: resources.filter((resource) => resource.type === "playlists"), included: resources };

  return {
    tracks: dedupeById(extractTracksFromDocument(tracksDoc)),
    artists: dedupeById(extractArtistsFromDocument(artistsDoc)),
    albums: dedupeById(extractAlbumsFromDocument(albumsDoc)),
    playlists: dedupeById(extractPlaylistsFromDocument(playlistsDoc)),
  };
}
