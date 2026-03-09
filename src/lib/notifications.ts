import type { TablesInsert } from "@/integrations/supabase/types";
import { getSupabaseClient } from "@/lib/runtimeModules";

export interface NewReleaseNotificationParams {
    userId: string;
    albumId: number;
    albumTitle: string;
    artistName: string;
}

export async function createNewReleaseNotification({
    userId,
    albumId,
    albumTitle,
    artistName,
}: NewReleaseNotificationParams) {
    try {
        const supabase = await getSupabaseClient();
        // Check if a notification for this album and user already exists
        const { data: existing, error: checkError } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "new_release")
            .contains("data", { album_id: albumId })
            .maybeSingle();

        if (checkError) {
            console.error("Error checking for existing notification:", checkError);
            return;
        }

        if (existing) {
            return; // Already notified
        }

        // Create the notification
        const notificationInsert: TablesInsert<"notifications"> = {
            user_id: userId,
            type: "new_release",
            title: "New Release",
            body: `${artistName} just released a new album: ${albumTitle}`,
            data: {
                album_id: albumId,
                album_title: albumTitle,
                artist_name: artistName,
            },
        };

        const { error: insertError } = await supabase
            .from("notifications")
            .insert(notificationInsert);

        if (insertError) {
            console.error("Error creating new release notification:", insertError);
        }
    } catch (e) {
        console.error("Failed to handle new release notification:", e);
    }
}
