import type { Track } from "@/types/music";

export type PlaylistAccessRole = "owner" | "editor" | "viewer";
export type PlaylistVisibility = "private" | "shared" | "public";
export type PlaylistCollaboratorRole = Exclude<PlaylistAccessRole, "owner">;

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  cover_url: string | null;
  created_at: string;
  owner_user_id: string;
  access_role: PlaylistAccessRole;
  visibility: PlaylistVisibility;
  share_token: string;
  track_count: number;
  tracks_loaded: boolean;
  tracks: Track[];
}

export interface PlaylistCollaborator {
  user_id: string;
  role: PlaylistAccessRole;
  display_name: string | null;
  avatar_url: string | null;
}

export interface AddTrackResult {
  added: boolean;
  reason?: "duplicate" | "error";
}

export type PlaylistDetailsUpdate = {
  name?: string;
  description?: string;
  cover_url?: string | null;
  visibility?: PlaylistVisibility;
  share_token?: string;
};

export type PlaylistRecord = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  created_at: string;
  user_id: string;
  visibility: string | null;
  share_token: string;
  access_role?: string | null;
  track_count?: number | null;
};

export type PlaylistMembershipRecord = {
  playlist_id: string;
  role: string | null;
};

export type PlaylistTrackRecord = {
  added_at: string;
  id: string;
  playlist_id: string;
  position: number;
  track_key: string;
  track_data: Track;
};

export type PlaylistTrackRpcRecord = {
  added_at: string;
  position: number;
  track_data: Track;
};
