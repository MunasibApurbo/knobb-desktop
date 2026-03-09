import type { PlayHistoryEntry } from "@/hooks/usePlayHistory";

function toTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function collapseHistoryToLatestUniqueTrack(entries: PlayHistoryEntry[]) {
  const latestByTrackKey = new Map<string, PlayHistoryEntry>();

  for (const entry of entries) {
    const existing = latestByTrackKey.get(entry.trackKey);
    if (!existing || toTimestamp(entry.playedAt) > toTimestamp(existing.playedAt)) {
      latestByTrackKey.set(entry.trackKey, entry);
    }
  }

  return [...latestByTrackKey.values()].sort(
    (left, right) => toTimestamp(right.playedAt) - toTimestamp(left.playedAt),
  );
}
