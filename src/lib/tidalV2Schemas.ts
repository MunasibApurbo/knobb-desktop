export type TidalReferenceResourceType =
  | "albums"
  | "artistRoles"
  | "artists"
  | "artworks"
  | "playlists"
  | "providers"
  | "searchResults"
  | "searchSuggestions"
  | "trackManifests"
  | "tracks"
  | "usageRules"
  | "userCollectionAlbums"
  | "userCollectionArtists"
  | "userCollectionPlaylists"
  | "userCollectionTracks"
  | "userCollectionVideos"
  | "userCollections"
  | "userRecommendations"
  | "videos"
  | string;

export interface TidalV2ResourceIdentifier {
  id: string;
  type: TidalReferenceResourceType;
}

export interface TidalV2Relationship {
  data?: TidalV2ResourceIdentifier | TidalV2ResourceIdentifier[] | null;
  links?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface TidalV2ResourceObject<
  TAttributes = Record<string, unknown>,
  TRelationships extends Record<string, TidalV2Relationship> = Record<string, TidalV2Relationship>,
> extends TidalV2ResourceIdentifier {
  attributes?: TAttributes;
  relationships?: TRelationships;
  links?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface TidalV2ErrorObject {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface TidalV2DocumentBase {
  jsonapi?: { version?: string };
  links?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  errors?: TidalV2ErrorObject[];
}

export interface TidalV2SingleResourceDocument<
  TResource extends TidalV2ResourceObject = TidalV2ResourceObject,
> extends TidalV2DocumentBase {
  data: TResource | null;
  included?: TidalV2ResourceObject[];
}

export interface TidalV2MultiResourceDocument<
  TResource extends TidalV2ResourceObject = TidalV2ResourceObject,
> extends TidalV2DocumentBase {
  data: TResource[];
  included?: TidalV2ResourceObject[];
}

export type TidalV2AnyDocument =
  | TidalV2SingleResourceDocument
  | TidalV2MultiResourceDocument;

export interface TidalAlbumAttributes {
  title?: string;
  version?: string;
  releaseDate?: string;
  popularity?: number;
  numberOfItems?: number;
  duration?: string;
  explicit?: boolean;
  albumType?: "ALBUM" | "EP" | "SINGLE";
  mediaTags?: string[];
}

export interface TidalArtistAttributes {
  name?: string;
  popularity?: number;
  [key: string]: unknown;
}

export interface TidalArtworkAttributes {
  width?: number;
  height?: number;
  url?: string;
  [key: string]: unknown;
}

export interface TidalPlaylistAttributes {
  name?: string;
  description?: string;
  numberOfItems?: number;
  popularity?: number;
  publicPlaylist?: boolean;
  [key: string]: unknown;
}

export interface TidalProviderAttributes {
  name?: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface TidalTrackAttributes {
  title?: string;
  version?: string;
  duration?: string;
  explicit?: boolean;
  popularity?: number;
  mediaTags?: string[];
  [key: string]: unknown;
}

export interface TidalTrackManifestAttributes {
  manifestType?: "HLS" | "MPEG_DASH";
  mimeType?: string;
  manifest?: string;
  urls?: string[];
  [key: string]: unknown;
}

export interface TidalUsageRulesAttributes {
  availability?: string[];
  streamable?: boolean;
  downloadable?: boolean;
  [key: string]: unknown;
}

export interface TidalVideoAttributes {
  title?: string;
  duration?: string;
  explicit?: boolean;
  popularity?: number;
  [key: string]: unknown;
}

export interface TidalUserCollectionAttributes {
  name?: string;
  [key: string]: unknown;
}

export interface TidalSearchResultAttributes {
  query?: string;
  [key: string]: unknown;
}

export interface TidalSearchSuggestionAttributes {
  query?: string;
  [key: string]: unknown;
}

export interface TidalUserRecommendationAttributes {
  [key: string]: unknown;
}

export type TidalAlbumResource = TidalV2ResourceObject<TidalAlbumAttributes>;
export type TidalArtistResource = TidalV2ResourceObject<TidalArtistAttributes>;
export type TidalArtworkResource = TidalV2ResourceObject<TidalArtworkAttributes>;
export type TidalPlaylistResource = TidalV2ResourceObject<TidalPlaylistAttributes>;
export type TidalProviderResource = TidalV2ResourceObject<TidalProviderAttributes>;
export type TidalTrackResource = TidalV2ResourceObject<TidalTrackAttributes>;
export type TidalTrackManifestResource = TidalV2ResourceObject<TidalTrackManifestAttributes>;
export type TidalUsageRulesResource = TidalV2ResourceObject<TidalUsageRulesAttributes>;
export type TidalVideoResource = TidalV2ResourceObject<TidalVideoAttributes>;
export type TidalUserCollectionResource = TidalV2ResourceObject<TidalUserCollectionAttributes>;
export type TidalSearchResultResource = TidalV2ResourceObject<TidalSearchResultAttributes>;
export type TidalSearchSuggestionResource = TidalV2ResourceObject<TidalSearchSuggestionAttributes>;
export type TidalUserRecommendationResource = TidalV2ResourceObject<TidalUserRecommendationAttributes>;

export interface TidalReferenceSchemas {
  albums: TidalAlbumResource;
  artistRoles: TidalV2ResourceObject;
  artists: TidalArtistResource;
  artworks: TidalArtworkResource;
  playlists: TidalPlaylistResource;
  providers: TidalProviderResource;
  searchResults: TidalSearchResultResource;
  searchSuggestions: TidalSearchSuggestionResource;
  trackManifests: TidalTrackManifestResource;
  tracks: TidalTrackResource;
  usageRules: TidalUsageRulesResource;
  userCollectionAlbums: TidalV2ResourceObject;
  userCollectionArtists: TidalV2ResourceObject;
  userCollectionPlaylists: TidalV2ResourceObject;
  userCollectionTracks: TidalV2ResourceObject;
  userCollectionVideos: TidalV2ResourceObject;
  userCollections: TidalUserCollectionResource;
  userRecommendations: TidalUserRecommendationResource;
  videos: TidalVideoResource;
}
