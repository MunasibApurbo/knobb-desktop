import { useCallback } from "react";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { safeStorageGetItem, safeStorageSetItem } from "@/lib/safeStorage";
import { Track } from "@/types/music";
import { buildTrackKey } from "@/lib/librarySources";
import { normalizeTrackRecord } from "@/lib/trackNormalization";

export type PlayEventType = "start" | "progress" | "complete" | "skip" | "repeat";

export type PlayHistoryEntry = Track & {
  playedAt: string;
  listenedSeconds: number;
  durationSeconds: number;
  eventType: PlayEventType;
  trackKey: string;
};

const LEGACY_LISTENED_SECONDS_FALLBACK = 30;

const VALID_EVENT_TYPES: PlayEventType[] = [
  "start",
  "progress",
  "complete",
  "skip",
  "repeat",
];

const clampScrobblePercent = (value?: number) =>
  Math.min(95, Math.max(5, Math.round(value ?? 50)));

function normalizeDurationSeconds(track: Track, rawDuration?: number) {
  if (typeof rawDuration === "number" && Number.isFinite(rawDuration)) {
    return Math.max(0, Math.round(rawDuration));
  }
  if (typeof track.duration === "number" && Number.isFinite(track.duration)) {
    return Math.max(0, Math.round(track.duration));
  }
  return 0;
}

function normalizeListenedSeconds(track: Track, rawSeconds: unknown, durationSeconds: number) {
  const fallback = durationSeconds > 0
    ? Math.max(0, Math.min(durationSeconds, LEGACY_LISTENED_SECONDS_FALLBACK))
    : LEGACY_LISTENED_SECONDS_FALLBACK;

  if (typeof rawSeconds !== "number" || !Number.isFinite(rawSeconds)) return fallback;

  const rounded = Math.max(0, Math.round(rawSeconds));
  if (durationSeconds > 0) return Math.min(rounded, durationSeconds);
  if (track.duration > 0) return Math.min(rounded, Math.round(track.duration));
  return rounded;
}

function getTrackKey(track: Track) {
  return buildTrackKey(track);
}

function getCompletionThreshold(durationSeconds: number, scrobblePercent: number) {
  if (durationSeconds <= 0) return 30;
  return Math.min(durationSeconds, Math.max(30, Math.ceil(durationSeconds * (scrobblePercent / 100))));
}

function inferEventType(
  listenedSeconds: number,
  durationSeconds: number,
  scrobblePercent = 50
): PlayEventType {
  const threshold = getCompletionThreshold(durationSeconds, clampScrobblePercent(scrobblePercent));
  if (listenedSeconds >= threshold) return "complete";
  if (listenedSeconds <= 5) return "skip";
  return "progress";
}

function normalizeEventType(raw: unknown): PlayEventType | null {
  if (typeof raw !== "string") return null;
  return VALID_EVENT_TYPES.includes(raw as PlayEventType) ? (raw as PlayEventType) : null;
}

export type RecordPlayOptions = {
  scrobblePercent?: number;
  contextType?: string;
  contextId?: string;
};

export type GetHistoryOptions = {
  limit?: number;
  since?: string;
};

const PLAY_HISTORY_STORAGE_KEY_PREFIX = "knobb-play-history:v1";
const PLAY_HISTORY_REQUEST_TIMEOUT_MS = 8000;

type PlayHistoryRow = Pick<
  Tables<"play_history">,
  "track_data" | "played_at" | "listened_seconds" | "duration_seconds" | "event_type" | "track_key"
>;

function getPlayHistoryStorageKey(userId: string) {
  return `${PLAY_HISTORY_STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeGetHistoryOptions(limitOrOptions: number | GetHistoryOptions): GetHistoryOptions {
  return typeof limitOrOptions === "number"
    ? { limit: limitOrOptions }
    : limitOrOptions;
}

function applyHistoryOptions(entries: PlayHistoryEntry[], options: GetHistoryOptions) {
  const filtered = options.since
    ? entries.filter((entry) => entry.playedAt >= options.since!)
    : entries;

  if (typeof options.limit === "number") {
    return filtered.slice(0, options.limit);
  }

  return filtered;
}

function getHistoryCacheEntryKey(entry: PlayHistoryEntry) {
  return [
    entry.trackKey,
    entry.playedAt,
    entry.eventType,
    entry.listenedSeconds,
    entry.durationSeconds,
  ].join("::");
}

function mergeCachedHistoryEntries(current: PlayHistoryEntry[], incoming: PlayHistoryEntry[]) {
  const merged = new Map<string, PlayHistoryEntry>();

  for (const entry of current) {
    merged.set(getHistoryCacheEntryKey(entry), entry);
  }

  for (const entry of incoming) {
    merged.set(getHistoryCacheEntryKey(entry), entry);
  }

  return [...merged.values()].sort((left, right) => (
    Date.parse(right.playedAt) - Date.parse(left.playedAt)
  ));
}

function normalizeCachedHistoryEntry(value: unknown): PlayHistoryEntry | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Partial<PlayHistoryEntry>;
  if (typeof row.playedAt !== "string" || !row.playedAt) return null;

  const trackData = normalizeTrackRecord(row as unknown as Json, {
    trackKey: typeof row.trackKey === "string" ? row.trackKey : undefined,
  }) as Track & {
    listenedSeconds?: number;
    eventType?: PlayEventType;
    duration?: number;
  };

  const durationSeconds = normalizeDurationSeconds(trackData, row.durationSeconds ?? trackData.duration);
  const listenedSeconds = normalizeListenedSeconds(
    trackData,
    row.listenedSeconds ?? trackData.listenedSeconds,
    durationSeconds,
  );
  const eventType =
    normalizeEventType(row.eventType) ??
    normalizeEventType(trackData.eventType) ??
    inferEventType(listenedSeconds, durationSeconds);

  return {
    ...trackData,
    playedAt: row.playedAt,
    listenedSeconds,
    durationSeconds,
    eventType,
    trackKey: typeof row.trackKey === "string" && row.trackKey.trim()
      ? row.trackKey
      : getTrackKey(trackData),
  };
}

function readStoredHistory(userId: string | null) {
  if (!userId) return [];

  const raw = safeStorageGetItem(getPlayHistoryStorageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => normalizeCachedHistoryEntry(entry))
      .filter((entry): entry is PlayHistoryEntry => entry !== null)
      .sort((left, right) => Date.parse(right.playedAt) - Date.parse(left.playedAt));
  } catch {
    return [];
  }
}

export function usePlayHistory() {
  const { user } = useAuth();

  const recordPlay = useCallback(
    async (track: Track, listenedSeconds?: number, options?: RecordPlayOptions) => {
      if (!user) return;

      const scrobblePercent = clampScrobblePercent(options?.scrobblePercent);
      const durationSeconds = normalizeDurationSeconds(track, track.duration);
      const normalizedSeconds = normalizeListenedSeconds(track, listenedSeconds, durationSeconds);

      const payload = {
        ...track,
        listenedSeconds: normalizedSeconds,
        duration: durationSeconds,
      };

      try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.rpc("record_play_event", {
          target_track_data: payload as unknown as Json,
          listened_seconds_input: normalizedSeconds,
          scrobble_percent_input: scrobblePercent,
          context_type_input: options?.contextType ?? null,
          context_id_input: options?.contextId ?? null,
        });
        if (!error) return;
        throw error;
      } catch (e) {
        // Fallback for environments where migration is not yet applied.
        try {
          const supabase = await getSupabaseClient();
          const fallbackInsert: TablesInsert<"play_history"> = {
            user_id: user.id,
            track_data: {
              ...payload,
              eventType: inferEventType(normalizedSeconds, durationSeconds, scrobblePercent),
            } as unknown as Json,
            track_key: getTrackKey(track),
            listened_seconds: normalizedSeconds,
            duration_seconds: durationSeconds,
            event_type: inferEventType(normalizedSeconds, durationSeconds, scrobblePercent),
            context_type: options?.contextType ?? null,
            context_id: options?.contextId ?? null,
          };
          await supabase.from("play_history").insert(fallbackInsert);
        } catch (fallbackError) {
          console.error("Failed to record play history", fallbackError);
          console.error("Original RPC error", e);
        }
      }
    },
    [user]
  );

  const readCachedHistory = useCallback((limitOrOptions: number | GetHistoryOptions = 50) => {
    const options = normalizeGetHistoryOptions(limitOrOptions);
    return applyHistoryOptions(readStoredHistory(user?.id ?? null), options);
  }, [user]);

  const getHistory = useCallback(async (limitOrOptions: number | GetHistoryOptions = 50) => {
    if (!user) return [];

    try {
      const supabase = await getSupabaseClient();
      const options = normalizeGetHistoryOptions(limitOrOptions);

      let query = supabase
        .from("play_history")
        .select("track_data, played_at, listened_seconds, duration_seconds, event_type, track_key")
        .order("played_at", { ascending: false });

      if (options.since) {
        query = query.gte("played_at", options.since);
      }

      if (typeof options.limit === "number") {
        query = query.limit(options.limit);
      }

      const requestPromise = (async () => await query)();
      void requestPromise.catch(() => undefined);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error(`Timed out reading play history after ${PLAY_HISTORY_REQUEST_TIMEOUT_MS}ms`));
        }, PLAY_HISTORY_REQUEST_TIMEOUT_MS);

        // Ensure the timer can be reclaimed once the query settles.
        void requestPromise.finally(() => window.clearTimeout(timeoutId));
      });

      const { data, error } = await Promise.race([requestPromise, timeoutPromise]);

      if (error) throw error;

      const rows = (data || []) as PlayHistoryRow[];

      const history = rows.map((row) => {
        const trackData = normalizeTrackRecord(row.track_data, {
          trackKey: row.track_key,
        }) as Track & {
          listenedSeconds?: number;
          eventType?: PlayEventType;
          duration?: number;
        };
        const durationSeconds = normalizeDurationSeconds(trackData, row.duration_seconds ?? trackData.duration);
        const listenedSeconds = normalizeListenedSeconds(
          trackData,
          row.listened_seconds ?? trackData.listenedSeconds,
          durationSeconds
        );
        const eventType =
          normalizeEventType(row.event_type) ??
          normalizeEventType(trackData.eventType) ??
          inferEventType(listenedSeconds, durationSeconds);

        return {
          ...trackData,
          playedAt: row.played_at,
          listenedSeconds,
          durationSeconds,
          eventType,
          trackKey: typeof row.track_key === "string" && row.track_key.trim()
            ? row.track_key
            : getTrackKey(trackData),
        } satisfies PlayHistoryEntry;
      });

      const mergedHistory = mergeCachedHistoryEntries(readStoredHistory(user.id), history);
      safeStorageSetItem(getPlayHistoryStorageKey(user.id), JSON.stringify(mergedHistory));

      return history;
    } catch (e) {
      console.error("Failed to read history", e);
      return readCachedHistory(limitOrOptions);
    }
  }, [readCachedHistory, user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    const supabase = await getSupabaseClient();
    await supabase.from("play_history").delete().eq("user_id", user.id);
    safeStorageSetItem(getPlayHistoryStorageKey(user.id), JSON.stringify([]));
  }, [user]);

  return { recordPlay, readCachedHistory, getHistory, clearHistory };
}
