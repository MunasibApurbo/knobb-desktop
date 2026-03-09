export interface Track {
    id: string;
    tidalId?: number;
    albumId?: number;
    artistId?: number;
    localFileId?: string;
    isLocal?: boolean;
    localFileSize?: number;
    localImportedAt?: string;
    mixes?: Record<string, string | number | null> | null;
    artists?: { id: number; name: string }[];
    title: string;
    artist: string;
    album: string;
    duration: number; // seconds
    year: number;
    releaseDate?: string;
    coverUrl: string;
    canvasColor: string; // HSL dominant color e.g. "0 70% 55%"
    replayGain?: number;
    peak?: number;
    streamUrl?: string; // cached stream URL
    streamUrls?: Partial<Record<string, string>>;
    streamTypes?: Partial<Record<string, "direct" | "dash">>;
    addedAt?: string;
    audioQuality?: "LOW" | "MEDIUM" | "HIGH" | "LOSSLESS" | "MAX";
    explicit?: boolean;
    isVideo?: boolean;
    isUnavailable?: boolean;
}

export interface Album {
    id: string;
    title: string;
    artist: string;
    year: number;
    coverUrl: string;
    tracks: Track[];
    canvasColor: string;
}

export interface Playlist {
    id: string;
    title: string;
    description: string;
    coverUrl: string;
    tracks: Track[];
    canvasColor: string;
}
