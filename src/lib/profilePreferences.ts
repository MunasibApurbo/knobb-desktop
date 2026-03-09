import { getSupabaseClient } from "@/lib/runtimeModules";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type ProfilePreferencePatch = Pick<
  TablesUpdate<"profiles">,
  "language_preference" | "player_preferences" | "ui_preferences"
>;

export async function loadProfilePreferences(userId: string) {
  const supabase = await getSupabaseClient();
  return supabase
    .from("profiles")
    .select("language_preference, player_preferences, ui_preferences")
    .eq("user_id", userId)
    .maybeSingle();
}

export async function persistProfilePreferences(userId: string, patch: ProfilePreferencePatch) {
  const supabase = await getSupabaseClient();
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError };
  }

  if (updatedProfile) {
    return { error: null };
  }

  const insertPatch: TablesInsert<"profiles"> = {
    user_id: userId,
    ...patch,
  };
  const { error: insertError } = await supabase
    .from("profiles")
    .insert(insertPatch as never);

  return { error: insertError };
}
