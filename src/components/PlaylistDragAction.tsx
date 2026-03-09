import { GripVertical } from "lucide-react";

import { DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { Button } from "@/components/ui/button";
import {
  clearActivePlaylistDrag,
  startPlaylistDrag,
  type PlaylistDragPayload,
} from "@/lib/playlistDrag";

interface PlaylistDragActionProps {
  disabled?: boolean;
  payload: PlaylistDragPayload;
}

export function PlaylistDragAction({ disabled = false, payload }: PlaylistDragActionProps) {
  return (
    <Button
      variant="secondary"
      className={DETAIL_ACTION_BUTTON_CLASS}
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(event) => {
        startPlaylistDrag(event.dataTransfer, payload);
      }}
      onDragEnd={() => {
        clearActivePlaylistDrag();
      }}
    >
      <GripVertical className="hero-action-icon mr-2 h-4 w-4" />
      <span className="hero-action-label relative z-10">Drag</span>
    </Button>
  );
}
