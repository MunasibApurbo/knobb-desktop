import { supabase } from "@/integrations/supabase/client";

export type VisibilitySetting = "private" | "shared";

export type AdminSummary = {
  totalUsers: number;
  sharedProfiles: number;
  sharedLiveStatuses: number;
  publicPlaylists: number;
};

export type AdminSearchUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  profile_visibility: VisibilitySetting;
  live_status_visibility: VisibilitySetting;
};

export type AdminAuditCounts = {
  playlists: number;
  playHistory: number;
  likedSongs: number;
  savedAlbums: number;
  favoriteArtists: number;
  notifications: number;
};

export type AdminAuditPayload = {
  user: AdminSearchUser;
  currentStatus: {
    track_title: string | null;
    artist_name: string | null;
    cover_url: string | null;
    track_id: string | null;
    started_at: string | null;
    updated_at: string | null;
  } | null;
  counts: AdminAuditCounts;
  recent: {
    playlists: Array<{
      id: string;
      name: string;
      visibility: string;
      created_at: string;
      updated_at: string;
    }>;
    playHistory: Array<{
      id: string;
      played_at: string;
      event_type: string;
      listened_seconds: number;
      duration_seconds: number;
      track_data: Record<string, unknown> | null;
    }>;
    likedSongs: Array<{
      id: string;
      liked_at: string;
      track_data: Record<string, unknown> | null;
    }>;
    savedAlbums: Array<{
      id: string;
      album_title: string;
      album_artist: string;
      created_at: string;
    }>;
    favoriteArtists: Array<{
      id: string;
      artist_name: string;
      created_at: string;
    }>;
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      is_read: boolean;
      created_at: string;
    }>;
  };
};

type SearchUsersResponse = {
  summary: AdminSummary;
  users: AdminSearchUser[];
  page: number;
  has_more: boolean;
};

type GetUserAuditResponse = {
  audit: AdminAuditPayload;
};

async function invokeAdminAudit<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>("admin-audit", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Admin request failed");
  }

  if (!data) {
    throw new Error("Admin request returned no data");
  }

  return data;
}

export async function searchUsers(query: string, page: number) {
  return invokeAdminAudit<SearchUsersResponse>({
    action: "searchUsers",
    query,
    page,
  });
}

export async function getUserAudit(userId: string) {
  const response = await invokeAdminAudit<GetUserAuditResponse>({
    action: "getUserAudit",
    userId,
  });
  return response.audit;
}
