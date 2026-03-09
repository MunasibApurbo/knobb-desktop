import { DetailHero } from "@/components/detail/DetailHero";
import { getTotalDuration } from "@/lib/utils";
import { UserPlaylist } from "@/hooks/usePlaylists";
import { formatRoleLabel } from "@/components/user-playlist/userPlaylistUtils";
import { PlaylistLink } from "@/components/PlaylistLink";
import type { ReactNode } from "react";

interface UserPlaylistHeroProps {
  cornerAction?: ReactNode;
  playlist: UserPlaylist;
  coverUrl: string;
  scrollY: number;
}

export function UserPlaylistHero({
  cornerAction,
  playlist,
  coverUrl,
  scrollY,
}: UserPlaylistHeroProps) {
  return (
    <DetailHero
      artworkUrl={coverUrl}
      cornerAction={cornerAction}
      dragPayload={playlist.tracks.length > 0 ? {
        label: playlist.name,
        source: "playlist",
        sourcePlaylistId: playlist.id,
        tracks: playlist.tracks,
      } : undefined}
      label="Playlist"
      scrollY={scrollY}
      title={<PlaylistLink title={playlist.name} playlistId={playlist.id} kind="user" className="text-inherit" />}
      body={
        playlist.description ? (
          <p>{playlist.description}</p>
        ) : undefined
      }
      meta={
        <>
          <span className="detail-chip">
            <span>Tracks</span>
            <strong>{playlist.tracks.length}</strong>
          </span>
          {playlist.tracks.length > 0 ? (
            <span className="detail-chip">
              <span>Runtime</span>
              <strong>{getTotalDuration(playlist.tracks)}</strong>
            </span>
          ) : null}
          <span className="detail-chip">
            <span>Access</span>
            <strong>{formatRoleLabel(playlist.access_role)}</strong>
          </span>
        </>
      }
    />
  );
}
