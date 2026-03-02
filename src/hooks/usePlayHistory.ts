import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Track } from "@/data/mockData";

export function usePlayHistory() {
  const { user } = useAuth();

  const recordPlay = useCallback(async (track: Track) => {
    if (!user) return;
    await supabase.from("play_history").insert({
      user_id: user.id,
      track_data: track as any,
    });
  }, [user]);

  const getHistory = useCallback(async (limit = 50) => {
    if (!user) return [];
    const { data } = await supabase
      .from("play_history")
      .select("*")
      .order("played_at", { ascending: false })
      .limit(limit);
    return (data || []).map((row: any) => ({
      ...row.track_data as Track,
      playedAt: row.played_at,
    }));
  }, [user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    await supabase.from("play_history").delete().eq("user_id", user.id);
  }, [user]);

  return { recordPlay, getHistory, clearHistory };
}
