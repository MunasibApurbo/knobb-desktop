import {
  PlaylistAccessRole,
  PlaylistCollaborator,
  UserPlaylist,
} from "@/hooks/usePlaylists";
import { DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";

export const userPlaylistActionBtnClass = DETAIL_ACTION_BUTTON_CLASS;

export const formatRoleLabel = (role: PlaylistAccessRole) => {
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  return "Viewer";
};

export const getCollaboratorDisplay = (collaborator: PlaylistCollaborator) => {
  if (collaborator.display_name?.trim()) return collaborator.display_name.trim();
  return `${collaborator.user_id.slice(0, 8)}…`;
};

export const getUserPlaylistCoverUrl = (playlist: UserPlaylist | null) =>
  playlist?.cover_url || playlist?.tracks[0]?.coverUrl || "/placeholder.svg";
