import { PlayHistoryEntry } from "@/hooks/usePlayHistory";
import { Track } from "@/types/music";

export type StatsRange = "7d" | "30d" | "all";

export type ListeningStats = {
  totalMinutes: number;
  totalCountedPlays: number;
  topArtists: { artist: string; listenedSeconds: number }[];
  topTracks: { track: Track; listenedSeconds: number; playCount: number }[];
  peakHour: number;
  hourCounts: number[];
};

const COUNTED_EVENT_TYPES = new Set(["complete", "repeat"]);

const clampScrobblePercent = (scrobblePercent = 50) =>
  Math.min(95, Math.max(5, Math.round(scrobblePercent)));

const getCompletionThreshold = (durationSeconds: number, scrobblePercent: number) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 30;
  return Math.min(
    Math.round(durationSeconds),
    Math.max(30, Math.ceil(durationSeconds * (clampScrobblePercent(scrobblePercent) / 100)))
  );
};

export const isCountedPlay = (entry: PlayHistoryEntry, scrobblePercent = 50) => {
  if (COUNTED_EVENT_TYPES.has(entry.eventType)) return true;
  const threshold = getCompletionThreshold(entry.durationSeconds || entry.duration || 0, scrobblePercent);
  return entry.listenedSeconds >= threshold;
};

export const filterHistoryByRange = (
  history: PlayHistoryEntry[],
  range: StatsRange
) => {
  if (range === "all") return history;
  const cutoffDays = range === "7d" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cutoffDays);
  return history.filter((entry) => new Date(entry.playedAt) >= cutoff);
};

export const computeListeningStats = (
  history: PlayHistoryEntry[],
  scrobblePercent = 50
): ListeningStats => {
  const totalListenedSeconds = history.reduce((sum, entry) => sum + Math.max(0, entry.listenedSeconds || 0), 0);
  const counted = history.filter((entry) => isCountedPlay(entry, scrobblePercent));
  const artistCounts: Record<string, number> = {};
  const trackCounts: Record<string, { track: Track; listenedSeconds: number; playCount: number }> = {};
  const hourCounts = new Array(24).fill(0);

  for (const entry of history) {
    const listenedSeconds = Math.max(0, entry.listenedSeconds || 0);
    if (listenedSeconds <= 0) continue;

    const rawArtist = entry.artist?.trim() || "Unknown Artist";
    // Split by comma or ampersand to handle collaborations
    const individualArtists = rawArtist.split(/[,&]+/).map(a => a.trim()).filter(Boolean);

    for (const artistName of individualArtists) {
      artistCounts[artistName] = (artistCounts[artistName] || 0) + listenedSeconds;
    }

    const trackCountKey = entry.trackKey || entry.id || `${entry.title}::${entry.artist}`;
    if (!trackCounts[trackCountKey]) {
      trackCounts[trackCountKey] = {
        track: entry,
        listenedSeconds: 0,
        playCount: 0,
      };
    }
    trackCounts[trackCountKey].listenedSeconds += listenedSeconds;
    trackCounts[trackCountKey].playCount += 1;

    const hour = new Date(entry.playedAt).getHours();
    hourCounts[hour] += listenedSeconds;
  }

  const topArtists = Object.entries(artistCounts)
    .map(([artist, listenedSeconds]) => ({ artist, listenedSeconds }))
    .sort((a, b) => b.listenedSeconds - a.listenedSeconds)
    .slice(0, 5);

  const topTracks = Object.values(trackCounts)
    .sort((a, b) => b.listenedSeconds - a.listenedSeconds || b.playCount - a.playCount)
    .slice(0, 5);

  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  return {
    totalMinutes: Math.round(totalListenedSeconds / 60),
    totalCountedPlays: counted.length,
    topArtists,
    topTracks,
    peakHour,
    hourCounts,
  };
};
