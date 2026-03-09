import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from "lucide-react";
import { PlaylistVisibility } from "@/hooks/usePlaylists";
import { cn } from "@/lib/utils";

interface UserPlaylistMetadataSectionProps {
  className?: string;
  isOwner: boolean;
  metadataName: string;
  metadataDescription: string;
  metadataCover: string;
  metadataVisibility: PlaylistVisibility;
  isSavingMetadata: boolean;
  showHeading?: boolean;
  onMetadataNameChange: (value: string) => void;
  onMetadataDescriptionChange: (value: string) => void;
  onMetadataCoverChange: (value: string) => void;
  onMetadataVisibilityChange: (value: PlaylistVisibility) => void;
  onSave: () => void;
  onCopyShareLink: () => void;
  onRegenerateShareLink: () => void;
}

export function UserPlaylistMetadataSection({
  className,
  isOwner,
  metadataName,
  metadataDescription,
  metadataCover,
  metadataVisibility,
  isSavingMetadata,
  showHeading = true,
  onMetadataNameChange,
  onMetadataDescriptionChange,
  onMetadataCoverChange,
  onMetadataVisibilityChange,
  onSave,
  onCopyShareLink,
  onRegenerateShareLink,
}: UserPlaylistMetadataSectionProps) {
  return (
    <section className={cn("user-playlist-manage-section border border-t-0 border-white/10 bg-white/[0.02] p-4 space-y-3", className)}>
      {showHeading ? (
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Playlist Details
        </div>
      ) : null}
      <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <input
          value={metadataName}
          onChange={(event) => onMetadataNameChange(event.target.value)}
          placeholder="Playlist name"
          className="user-playlist-manage-control website-form-control h-10 border border-white/10 bg-white/5 px-3 text-sm text-foreground focus:outline-none"
        />
        <input
          value={metadataDescription}
          onChange={(event) => onMetadataDescriptionChange(event.target.value)}
          placeholder="Description"
          className="user-playlist-manage-control website-form-control h-10 border border-white/10 bg-white/5 px-3 text-sm text-foreground focus:outline-none"
        />
        <input
          value={metadataCover}
          onChange={(event) => onMetadataCoverChange(event.target.value)}
          placeholder="Cover image URL"
          className="user-playlist-manage-control website-form-control h-10 border border-white/10 bg-white/5 px-3 text-sm text-foreground focus:outline-none"
        />
        {isOwner && (
          <select
            value={metadataVisibility}
            onChange={(event) =>
              onMetadataVisibilityChange(event.target.value as PlaylistVisibility)
            }
            className="user-playlist-manage-control user-playlist-manage-select website-form-control h-10 border border-white/10 bg-white/5 px-3 text-sm text-foreground focus:outline-none"
          >
            <option value="private">Private</option>
            <option value="shared">Shared (signed-in users)</option>
            <option value="public">Public</option>
          </select>
        )}
        <Button
          variant="outline"
          className="user-playlist-manage-control user-playlist-manage-button website-form-control h-10 px-4 text-xs"
          onClick={onSave}
          disabled={isSavingMetadata}
        >
          {isSavingMetadata ? "Saving..." : "Save"}
        </Button>
      </div>
      {isOwner && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="user-playlist-manage-control user-playlist-manage-button website-form-control h-9 px-3 text-xs"
            onClick={onCopyShareLink}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Share Link
          </Button>
          <Button
            variant="outline"
            className="user-playlist-manage-control user-playlist-manage-button website-form-control h-9 px-3 text-xs"
            onClick={onRegenerateShareLink}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Regenerate Link
          </Button>
        </div>
      )}
    </section>
  );
}
