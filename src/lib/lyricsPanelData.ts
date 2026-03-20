import type { ComponentType } from "react";

import { getLyrics, type LyricsResult } from "@/lib/musicApi";
import { cleanTrackTitle, normalizeLyricsLookupText } from "@/lib/musicLyricsVariants";
import { getTrackSource, getTrackSourceId } from "@/lib/librarySources";
import { getYoutubeMusicLyrics } from "@/lib/youtubeMusicApi";
import type { Track } from "@/types/music";

export type SyncedLyricsPayload = {
  lines: Array<{
    timeMs: number;
    text: string;
  }>;
  lyricsProvider: string;
  isSynced: boolean;
};

const lyricsResultCache = new Map<string, SyncedLyricsPayload | null>();
const lyricsRequestCache = new Map<string, Promise<SyncedLyricsPayload | null>>();
let amLyricsComponentPromise: Promise<{ default: ComponentType<Record<string, unknown>> }> | null = null;

export function loadAmLyricsComponent() {
  if (!amLyricsComponentPromise) {
    amLyricsComponentPromise = (async () => {
      await import("@uimaxbai/am-lyrics/am-lyrics.js");
      const module = await import("@uimaxbai/am-lyrics/react");
      return { default: module.AmLyrics as ComponentType<Record<string, unknown>> };
    })();
  }

  return amLyricsComponentPromise;
}

export function resolveLyricsArtistLabel(track: Track) {
  if (track.artists && track.artists.length > 0) {
    return track.artists.map((artist) => artist.name).join(", ");
  }

  return track.artist;
}

function resolveLyricsTrackId(track: Track) {
  return typeof track.tidalId === "number" ? track.tidalId : null;
}

function getLyricsRequestKey(track: Track, artistLabel: string, albumLabel: string) {
  const source = getTrackSource(track) || "unknown";
  const sourceId = getTrackSourceId(track) || "";
  const trackId = resolveLyricsTrackId(track) ?? "";
  return [
    source,
    sourceId,
    trackId,
    track.id,
    track.title.trim().toLowerCase(),
    artistLabel.trim().toLowerCase(),
    albumLabel.trim().toLowerCase(),
  ].join("::");
}

function normalizeLyricsResult(lyrics: LyricsResult | null): SyncedLyricsPayload | null {
  if (!lyrics || lyrics.lines.length === 0) return null;

  const lines = lyrics.lines
    .map((line) => ({
      timeMs: Math.max(0, Math.round(line.time * 1000)),
      text: line.text.trim(),
    }))
    .filter((line) => Number.isFinite(line.timeMs) && line.text.length > 0)
    .sort((left, right) => left.timeMs - right.timeMs)
    .filter((line, index, allLines) => (
      index === 0 ||
      line.timeMs !== allLines[index - 1].timeMs ||
      line.text !== allLines[index - 1].text
    ));

  if (lines.length === 0) return null;

  return {
    lines,
    lyricsProvider: lyrics.provider || lyrics.sourceLabel || "Knobb API",
    isSynced: lyrics.isSynced,
  };
}

function parseSyncedLyrics(subtitles: string) {
  return subtitles
    .split("\n")
    .flatMap((line) => {
      const matches = Array.from(line.matchAll(/\[(\d+):(\d{1,2}(?:[.,]\d{1,3})?)\]/g));
      if (matches.length === 0) return [];

      const text = line.replace(/\[(\d+):(\d{1,2}(?:[.,]\d{1,3})?)\]/g, "").trim();
      if (!text) return [];

      return matches
        .map((match) => {
          const minutes = Number.parseInt(match[1], 10);
          const seconds = Number.parseFloat(match[2].replace(",", "."));
          if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
            return null;
          }

          return {
            timeMs: Math.max(0, Math.round((minutes * 60 + seconds) * 1000)),
            text,
          };
        })
        .filter((entry): entry is { timeMs: number; text: string } => (
          Boolean(entry) && Number.isFinite(entry.timeMs) && entry.text.length > 0
        ));
    })
    .sort((left, right) => left.timeMs - right.timeMs)
    .filter((line, index, allLines) => (
      index === 0 ||
      line.timeMs !== allLines[index - 1].timeMs ||
      line.text !== allLines[index - 1].text
    ));
}

function scoreLyricsSearchCandidate(
  candidate: {
    artistName?: unknown;
    trackName?: unknown;
    albumName?: unknown;
    duration?: unknown;
    syncedLyrics?: unknown;
  },
  expected: {
    artist: string;
    title: string;
    album: string;
    duration: number | null;
  },
) {
  const candidateTitle = normalizeLyricsLookupText(typeof candidate.trackName === "string" ? candidate.trackName : "");
  const candidateArtist = normalizeLyricsLookupText(typeof candidate.artistName === "string" ? candidate.artistName : "");
  const candidateAlbum = normalizeLyricsLookupText(typeof candidate.albumName === "string" ? candidate.albumName : "");
  const expectedTitle = normalizeLyricsLookupText(expected.title);
  const expectedArtist = normalizeLyricsLookupText(expected.artist);
  const expectedAlbum = normalizeLyricsLookupText(expected.album);
  const candidateDuration = typeof candidate.duration === "number" && Number.isFinite(candidate.duration)
    ? candidate.duration
    : null;

  let score = 0;

  if (candidateTitle && expectedTitle) {
    if (candidateTitle === expectedTitle) score += 160;
    else if (candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)) score += 120;
  }

  if (candidateArtist && expectedArtist) {
    if (candidateArtist === expectedArtist) score += 120;
    else if (candidateArtist.includes(expectedArtist) || expectedArtist.includes(candidateArtist)) score += 80;
  }

  if (candidateAlbum && expectedAlbum) {
    if (candidateAlbum === expectedAlbum) score += 40;
    else if (candidateAlbum.includes(expectedAlbum) || expectedAlbum.includes(candidateAlbum)) score += 20;
  }

  if (expected.duration && candidateDuration) {
    const delta = Math.abs(candidateDuration - expected.duration);
    if (delta <= 2) score += 80;
    else if (delta <= 5) score += 50;
    else if (delta <= 10) score += 25;
    else score -= Math.min(delta, 45);
  }

  if (typeof candidate.syncedLyrics === "string" && candidate.syncedLyrics.trim()) {
    score += 25;
  }

  return score;
}

async function fetchLyricsFallback(track: Track, artistLabel: string, albumLabel: string): Promise<SyncedLyricsPayload | null> {
  const title = cleanTrackTitle(track.title);
  const album = albumLabel.trim();
  const duration = track.duration ? Math.round(track.duration) : null;

  const artistParts = artistLabel.split(",").map((part) => part.trim());
  const artistVariations = [
    artistParts[0],
    artistParts.join(" & "),
    artistParts.join(", "),
    artistLabel.trim(),
  ].filter((value, index, allValues) => value && allValues.indexOf(value) === index);

  const fetchForArtist = async (artist: string): Promise<SyncedLyricsPayload> => {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });

    if (album) params.append("album_name", album);
    if (duration) params.append("duration", String(duration));

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (response.ok) {
      const data = (await response.json()) as { syncedLyrics?: unknown };
      if (typeof data.syncedLyrics === "string" && data.syncedLyrics.trim()) {
        return {
          lines: parseSyncedLyrics(data.syncedLyrics),
          lyricsProvider: "LRCLIB",
          isSynced: true,
        } satisfies SyncedLyricsPayload;
      }
    }

    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const bestMatch = [...results]
          .sort((left, right) => (
            scoreLyricsSearchCandidate(right, {
              artist,
              title,
              album,
              duration,
            }) - scoreLyricsSearchCandidate(left, {
              artist,
              title,
              album,
              duration,
            })
          ))[0];

        if (bestMatch && typeof bestMatch.syncedLyrics === "string" && bestMatch.syncedLyrics.trim()) {
          return {
            lines: parseSyncedLyrics(bestMatch.syncedLyrics),
            lyricsProvider: "LRCLIB",
            isSynced: true,
          } satisfies SyncedLyricsPayload;
        }
      }
    }

    throw new Error("No lyrics found for this artist variation");
  };

  try {
    return await Promise.any(artistVariations.map(fetchForArtist));
  } catch {
    return null;
  }
}

export async function loadLyricsForTrack(track: Track, artistLabel: string, albumLabel: string) {
  const requestKey = getLyricsRequestKey(track, artistLabel, albumLabel);
  if (lyricsResultCache.has(requestKey)) {
    return lyricsResultCache.get(requestKey) ?? null;
  }

  const inflightRequest = lyricsRequestCache.get(requestKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = (async () => {
    const source = getTrackSource(track);
    const sourceId = getTrackSourceId(track);
    let bestUnsyncedLyrics: SyncedLyricsPayload | null = null;

    if (source === "youtube-music" && sourceId) {
      try {
        const lyrics = await getYoutubeMusicLyrics({
          id: sourceId,
          title: cleanTrackTitle(track.title),
          artist: artistLabel,
          album: albumLabel,
          duration: track.duration ? Math.round(track.duration) : null,
        });
        const normalized = normalizeLyricsResult(lyrics);
        if (normalized && normalized.lines.length > 0) {
          if (normalized.isSynced) {
            return normalized;
          }
          bestUnsyncedLyrics = normalized;
        }
      } catch {
        // Ignore provider failures and continue to LRCLIB fallback.
      }
    }

    const trackId = resolveLyricsTrackId(track);
    if (trackId) {
      try {
        const lyrics = await getLyrics(trackId);
        const normalized = normalizeLyricsResult(lyrics);
        if (normalized && normalized.lines.length > 0) {
          if (normalized.isSynced) {
            return normalized;
          }
          if (!bestUnsyncedLyrics || normalized.lines.length > bestUnsyncedLyrics.lines.length) {
            bestUnsyncedLyrics = normalized;
          }
        }
      } catch {
        // Ignore provider failures and continue to LRCLIB fallback.
      }
    }

    const fallbackLyrics = await fetchLyricsFallback(track, artistLabel, albumLabel);
    return fallbackLyrics ?? bestUnsyncedLyrics;
  })();

  lyricsRequestCache.set(requestKey, request);

  try {
    const result = await request;
    lyricsResultCache.set(requestKey, result);
    return result;
  } finally {
    lyricsRequestCache.delete(requestKey);
  }
}

export function preloadLyricsForTrack(track: Track) {
  const artistLabel = resolveLyricsArtistLabel(track);
  const albumLabel = track.album;
  void loadAmLyricsComponent();
  void loadLyricsForTrack(track, artistLabel, albumLabel);
}

export function resetLyricsPreloadCacheForTests() {
  lyricsResultCache.clear();
  lyricsRequestCache.clear();
  amLyricsComponentPromise = null;
}
