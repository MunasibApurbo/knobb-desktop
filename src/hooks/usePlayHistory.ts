import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/types/music";

export type PlayHistoryEntry = Track & {
  playedAt: string;
  listenedSeconds: number;
};

const LEGACY_LISTENED_SECONDS_FALLBACK = 30;

function normalizeListenedSeconds(track: Track, rawSeconds?: number) {
  const fallback = Math.max(
    0,
    Math.min(Math.round(track.duration || 0), LEGACY_LISTENED_SECONDS_FALLBACK)
  );
  if (typeof rawSeconds !== "number" || !Number.isFinite(rawSeconds)) return fallback;

  const rounded = Math.max(0, Math.round(rawSeconds));
  if (track.duration > 0) return Math.min(rounded, Math.round(track.duration));
  return rounded;
}

export function usePlayHistory() {
  const { user } = useAuth();

  const recordPlay = useCallback(async (track: Track, listenedSeconds?: number) => {
    if (!user) return;

    try {
      const normalizedSeconds = normalizeListenedSeconds(track, listenedSeconds);
      await supabase.from("play_history").insert({
        user_id: user.id,
        track_data: {
          ...track,
          listenedSeconds: normalizedSeconds,
        } as any,
      });
    } catch (e) {
      console.error("Failed to record play history", e);
    }
  }, [user]);

  const getHistory = useCallback(async (limit = 50) => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from("play_history")
        .select("*")
        .order("played_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((row: any) => {
        const trackData = (row.track_data || {}) as Track & { listenedSeconds?: number };
        const listenedSeconds = normalizeListenedSeconds(trackData, trackData.listenedSeconds);
        return {
          ...trackData as Track,
          playedAt: row.played_at,
          listenedSeconds,
        } satisfies PlayHistoryEntry;
      });
    } catch (e) {
      console.error("Failed to read history", e);
      return [];
    }
  }, [user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    await supabase.from("play_history").delete().eq("user_id", user.id);
  }, [user]);

  return { recordPlay, getHistory, clearHistory };
}
