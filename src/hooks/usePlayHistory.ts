import { useCallback } from "react";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/runtimeModules";
import { Track } from "@/types/music";

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
  if (typeof track.tidalId === "number" && Number.isFinite(track.tidalId)) {
    return `tidal:${track.tidalId}`;
  }
  if (track.id && String(track.id).trim()) {
    return `id:${String(track.id).trim().toLowerCase()}`;
  }
  return `fallback:${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
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

type PlayHistoryRow = Pick<
  Tables<"play_history">,
  "track_data" | "played_at" | "listened_seconds" | "duration_seconds" | "event_type" | "track_key"
>;

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

  const getHistory = useCallback(async (limitOrOptions: number | GetHistoryOptions = 50) => {
    if (!user) return [];

    try {
      const supabase = await getSupabaseClient();
      const options =
        typeof limitOrOptions === "number"
          ? { limit: limitOrOptions }
          : limitOrOptions;

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

      const { data, error } = await query;

      if (error) throw error;

      const rows = (data || []) as PlayHistoryRow[];

      return rows.map((row) => {
        const trackData = (row.track_data || {}) as unknown as Track & {
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
    } catch (e) {
      console.error("Failed to read history", e);
      return [];
    }
  }, [user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    const supabase = await getSupabaseClient();
    await supabase.from("play_history").delete().eq("user_id", user.id);
  }, [user]);

  return { recordPlay, getHistory, clearHistory };
}
