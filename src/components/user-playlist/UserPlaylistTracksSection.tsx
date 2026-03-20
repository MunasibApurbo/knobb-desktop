import type { DragEvent, MouseEvent } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";

import { TrackListRow } from "@/components/detail/TrackListRow";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { UserPlaylist } from "@/hooks/usePlaylists";
import { Track } from "@/types/music";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  formatTrackAddedAt,
  formatTrackAddedAtTooltip,
  getTrackAddedAtLocale,
} from "@/lib/trackAddedAt";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";

interface UserPlaylistTracksSectionProps {
  playlist: UserPlaylist;
  currentTrack: Track | null;
  isPlaying: boolean;
  canEdit: boolean;
  selectedTrackIds: string[];
  isLiked: (trackId: string) => boolean;
  onTrackClick: (event: MouseEvent<HTMLElement>, track: Track, index: number) => void;
  onToggleLike: (track: Track) => void;
  onMoveTrack: (fromIndex: number, toIndex: number) => void;
  onRemoveTrack: (trackIndex: number) => void;
}

export function UserPlaylistTracksSection({
  playlist,
  currentTrack,
  isPlaying,
  canEdit,
  selectedTrackIds,
  isLiked,
  onTrackClick,
  onToggleLike,
  onMoveTrack,
  onRemoveTrack,
}: UserPlaylistTracksSectionProps) {
  const { language } = useLanguage();
  const addedAtLocale = getTrackAddedAtLocale(language);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "before" | "after" } | null>(null);

  const clearReorderState = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const getDropPosition = (
    event: DragEvent<HTMLDivElement>,
  ): "before" | "after" => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const getReorderTargetIndex = (
    fromIndex: number,
    targetIndex: number,
    position: "before" | "after",
  ) => {
    let nextIndex = targetIndex + (position === "after" ? 1 : 0);
    if (nextIndex > fromIndex) nextIndex -= 1;
    return Math.max(0, Math.min(nextIndex, playlist.tracks.length - 1));
  };

  if (playlist.tracks.length === 0) {
    return (
      <section className={cn("page-panel overflow-hidden border border-white/10 border-t-0", PANEL_SURFACE_CLASS)}>
        <p className="text-muted-foreground text-sm py-10 text-center">
          No tracks yet. Add songs from search or artist pages.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("page-panel overflow-hidden border border-white/10 border-t-0", PANEL_SURFACE_CLASS)}>
      <VirtualizedTrackList
        items={playlist.tracks}
        getItemKey={(track, index) => `${track.id}-${index}`}
        rowHeight={86}
        renderRow={(track, index) => {
          const isCurrent = isSameTrack(currentTrack, track);
          const isSelected = selectedTrackIds.includes(track.id);
          const draggedTracks =
            isSelected && selectedTrackIds.length > 0
              ? playlist.tracks.filter((entry) => selectedTrackIds.includes(entry.id))
              : [track];
          return (
            <TrackContextMenu
              key={`${track.id}-${index}`}
              track={track}
              tracks={playlist.tracks}
              onRemoveFromPlaylist={canEdit ? () => onRemoveTrack(index) : undefined}
            >
              <TrackListRow
                className={!isCurrent && isSelected ? "bg-white/[0.08]" : undefined}
                dragHandleLabel={
                  draggedTracks.length > 1
                    ? `Drag ${draggedTracks.length} selected tracks to another playlist`
                    : `Drag ${track.title} to another playlist`
                }
                dropIndicator={
                  dropTarget?.index === index && draggedIndex !== null && draggedIndex !== index
                    ? dropTarget.position
                    : null
                }
                index={index}
                isCurrent={isCurrent}
                isLiked={isLiked(track.id)}
                isPlaying={isPlaying}
                isRowDragging={draggedIndex === index}
                middleContent={
                  <>
                    <span
                      className={`block truncate text-sm ${
                        isCurrent
                          ? "text-black"
                          : "text-muted-foreground transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                      }`}
                      title={formatTrackAddedAtTooltip(track.addedAt, addedAtLocale) || undefined}
                    >
                      {formatTrackAddedAt(track.addedAt, addedAtLocale) || "-"}
                    </span>
                  </>
                }
                desktopMeta={formatTrackAddedAt(track.addedAt, addedAtLocale) || "-"}
                onDragHandleEnd={() => {
                  clearReorderState();
                }}
                onDragHandleStart={(event) => {
                  setDraggedIndex(index);
                  setDropTarget(null);
                  startPlaylistDrag(event.dataTransfer, {
                    label:
                      draggedTracks.length > 1
                        ? `${playlist.name} selection`
                        : track.title,
                    source: draggedTracks.length > 1 ? "selection" : "track",
                    sourcePlaylistId: playlist.id,
                    tracks: draggedTracks,
                  });
                }}
                onDragOver={(event) => {
                  if (!canEdit || draggedIndex === null) return;
                  event.preventDefault();
                  const position = getDropPosition(event);
                  setDropTarget((previous) => (
                    previous?.index === index && previous.position === position
                      ? previous
                      : { index, position }
                  ));
                }}
                onDrop={(event) => {
                  if (!canEdit || draggedIndex === null) return;
                  event.preventDefault();
                  const position = getDropPosition(event);
                  const targetIndex = getReorderTargetIndex(draggedIndex, index, position);
                  clearReorderState();
                  if (targetIndex !== draggedIndex) {
                    onMoveTrack(draggedIndex, targetIndex);
                  }
                }}
                onPlay={(event) => onTrackClick(event, track, index)}
                onToggleLike={() => onToggleLike(track)}
                track={track}
              />
            </TrackContextMenu>
          );
        }}
      />
    </section>
  );
}
