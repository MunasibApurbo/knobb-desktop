import type { AudioQuality } from "@/contexts/player/playerTypes";
import type { LyricsResult } from "@/lib/musicApiTypes";
import type { LibrarySource } from "@/lib/librarySources";
import type { VideoQualityPreference } from "@/lib/videoPlaybackPreferences";
import type { Track } from "@/types/music";

const YOUTUBE_MUSIC_PROXY_URLS = [
  "/api/youtube-music",
] as const;
const YOUTUBE_MUSIC_REQUEST_TIMEOUT_MS = 15000;

export type YoutubeMusicSearchBundle = {
  topResult: YoutubeMusicSearchRankedResult | null;
  rankedResults: YoutubeMusicSearchRankedResult[];
  tracks: Track[];
  videos: Track[];
  artists: Array<{ id: string; name: string; imageUrl: string; source: LibrarySource }>;
  albums: Array<{ id: string; title: string; artist: string; coverUrl: string; releaseDate?: string; source: LibrarySource }>;
  playlists: Array<{ id: string; title: string; description: string; trackCount: number; coverUrl: string; source: LibrarySource }>;
};

export type YoutubeMusicSearchRankedResult =
  | { kind: "track" | "video"; track: Track }
  | { kind: "artist"; artist: { id: string; name: string; imageUrl: string; source: LibrarySource } }
  | { kind: "album"; album: { id: string; title: string; artist: string; coverUrl: string; releaseDate?: string; source: LibrarySource } }
  | { kind: "playlist"; playlist: { id: string; title: string; description: string; trackCount: number; coverUrl: string; source: LibrarySource } };

type YoutubeMusicLyricsRequest = {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number | null;
};

type YoutubeMusicProxyPlaybackSource = {
  availableAudioQualityLabels?: string[];
  audioUrl?: string;
  audioQualityLabel?: string;
  fallbackUrl?: string;
  fallbackVideoHeight?: number;
  videoHeight?: number;
  url: string;
  type: "direct" | "dash" | "hls";
};

type YoutubeMusicProxyResponse<T> = {
  data: T;
};

const ytmRequestCache = new Map<string, Promise<unknown>>();

function looksLikeHtmlDocument(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function buildUnexpectedResponseError(endpoint: string, responseText: string, responseType: string | null) {
  if (looksLikeHtmlDocument(responseText)) {
    return new Error(`YouTube Music proxy returned HTML instead of JSON from ${endpoint}`);
  }

  const preview = responseText.trim().slice(0, 160);
  return new Error(
    preview
      ? `YouTube Music proxy returned invalid JSON from ${endpoint}: ${preview}`
      : `YouTube Music proxy returned an empty response from ${endpoint}${responseType ? ` (${responseType})` : ""}`,
  );
}

async function requestYoutubeMusic<T>(action: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  const searchParams = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const requestKey = searchParams.toString();
  const cached = ytmRequestCache.get(requestKey);
  if (cached) {
    return cached as Promise<T>;
  }

  const requestPromise = (async () => {
    let lastError: Error | null = null;

    for (const endpoint of YOUTUBE_MUSIC_PROXY_URLS) {
      let response: Response;
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      let timedOut = false;
      const timeoutId = controller
        ? globalThis.setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, YOUTUBE_MUSIC_REQUEST_TIMEOUT_MS)
        : null;

      try {
        response = await fetch(`${endpoint}?${searchParams.toString()}`, {
          headers: {
            Accept: "application/json",
          },
          ...(controller ? { signal: controller.signal } : {}),
        });
      } catch (error) {
        lastError = timedOut
          ? new Error(`YouTube Music request timed out for ${endpoint}`)
          : error instanceof Error
            ? error
            : new Error(`YouTube Music request failed for ${endpoint}`);
        continue;
      } finally {
        if (timeoutId !== null) {
          globalThis.clearTimeout(timeoutId);
        }
      }

      const responseText = await response.text();
      const responseType = response.headers.get("content-type");

      if (!response.ok) {
        lastError = new Error(responseText || `YouTube Music request failed: ${response.status}`);
        continue;
      }

      try {
        const payload = JSON.parse(responseText) as YoutubeMusicProxyResponse<T>;
        if (!("data" in payload)) {
          throw buildUnexpectedResponseError(endpoint, responseText, responseType);
        }
        return payload.data;
      } catch (error) {
        lastError = error instanceof SyntaxError
          ? buildUnexpectedResponseError(endpoint, responseText, responseType)
          : error instanceof Error
            ? error
            : buildUnexpectedResponseError(endpoint, responseText, responseType);
      }
    }

    throw lastError || new Error("YouTube Music request failed");
  })();

  ytmRequestCache.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    ytmRequestCache.delete(requestKey);
  }
}

export function clearYoutubeMusicCache() {
  ytmRequestCache.clear();
}

export function searchYoutubeMusicReference(query: string) {
  return requestYoutubeMusic<YoutubeMusicSearchBundle>("search", { q: query });
}

export function getYoutubeMusicLyrics({ id, title, artist, album, duration }: YoutubeMusicLyricsRequest) {
  return requestYoutubeMusic<LyricsResult | null>("lyrics", {
    id,
    title,
    artist,
    album,
    duration,
  });
}

export function getYoutubeMusicPlaybackSource(id: string, quality?: AudioQuality) {
  return requestYoutubeMusic<YoutubeMusicProxyPlaybackSource | null>("playback", { id, quality });
}

export function getYoutubeMusicVideoPlaybackSource(id: string, quality?: VideoQualityPreference) {
  return requestYoutubeMusic<YoutubeMusicProxyPlaybackSource | null>("video-playback", { id, quality });
}
