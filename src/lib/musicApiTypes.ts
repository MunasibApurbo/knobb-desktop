export interface TidalTrack {
  id: number;
  title: string;
  duration: number;
  mixes?: Record<string, string | number | null> | null;
  artist: { id: number; name: string; picture: string | null };
  artists: { id: number; name: string; type: string }[];
  album: {
    id: number;
    title: string;
    cover: string;
    vibrantColor: string | null;
    releaseDate?: string;
  };
  version: string | null;
  popularity: number;
  explicit: boolean;
  audioQuality: string;
  replayGain: number;
  peak: number;
  imageId?: string | null;
  type?: string;
  isUnavailable?: boolean;
  isVideo?: boolean;
}

export interface TidalArtist {
  id: number;
  name: string;
  picture: string | null;
  popularity: number;
  url: string;
  bio?: string;
  type?: string;
  artistTypes?: string[];
  mixes?: Record<string, string | number | null> | null;
}

export interface TidalAlbum {
  id: number;
  title: string;
  cover: string;
  vibrantColor: string | null;
  releaseDate?: string;
  numberOfTracks?: number;
  type?: string;
  artist?: { id: number; name: string };
  artists?: { id: number; name: string }[];
}

export interface TidalPlaylist {
  uuid: string;
  title: string;
  description?: string;
  image?: string | null;
  squareImage?: string | null;
  numberOfTracks: number;
  duration?: number;
  type?: string;
  publicPlaylist?: boolean;
  popularity?: number;
  url?: string;
}

export interface TidalMix {
  id: string;
  title: string;
  subTitle?: string | null;
  description?: string | null;
  mixType?: string | null;
  image?: string | null;
}

export interface TidalSearchResult {
  version: string;
  data: {
    limit: number;
    offset: number;
    totalNumberOfItems: number;
    items: TidalTrack[];
  };
}

export interface TidalTrackInfo {
  version: string;
  data: TidalTrack;
}

export interface TidalStreamResult {
  version: string;
  data: {
    trackId: number;
    audioQuality: string;
    manifestMimeType: string;
    manifest: string;
    decodedManifest?: {
      mimeType?: string;
      urls?: string[];
      type?: string;
      xml?: string;
    };
    trackReplayGain: number;
    trackPeakAmplitude: number;
    bitDepth?: number;
    sampleRate?: number;
  };
}

export interface ArtistCredit {
  name: string;
  role: string;
  id?: number;
}

export interface AlbumResult {
  album: TidalAlbum | null;
  tracks: TidalTrack[];
}

export interface PlaylistResult {
  playlist: TidalPlaylist | null;
  tracks: TidalTrack[];
}

export interface MixResult {
  mix: TidalMix | null;
  tracks: TidalTrack[];
}

export type CoverAsset = {
  id: number;
  name: string;
  "1280": string;
  "640": string;
  "80": string;
};

export interface TidalLyricLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  lines: TidalLyricLine[];
  provider: string | null;
  sourceLabel: string;
  sourceHost: string | null;
  isSynced: boolean;
  isRightToLeft: boolean;
  rawLyrics: string | null;
  rawSubtitles: string | null;
}
