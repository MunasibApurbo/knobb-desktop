import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { UserPlaylistCollaboratorsSection } from "@/components/user-playlist/UserPlaylistCollaboratorsSection";
import { UserPlaylistMetadataSection } from "@/components/user-playlist/UserPlaylistMetadataSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DESTRUCTIVE_MENU_ITEM_CLASS } from "@/components/ui/surfaceStyles";
import { PlaylistAccessRole, PlaylistCollaborator, PlaylistVisibility } from "@/hooks/usePlaylists";

const MANAGE_DIALOG_CONTENT_CLASS =
  "w-[min(960px,calc(100vw-32px))] max-w-[960px] gap-0 overflow-hidden border border-white/10 bg-black/95 p-0 text-white shadow-[0_28px_100px_rgba(0,0,0,0.78)] backdrop-blur-2xl sm:max-h-[88vh]";
const MANAGE_DIALOG_HEADER_CLASS =
  "border-b border-white/10 bg-black/30 px-6 py-5 text-left";
const MANAGE_DIALOG_KICKER_CLASS =
  "mb-1.5 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/42";

interface UserPlaylistManageMenuProps {
  canEdit: boolean;
  collaborators: PlaylistCollaborator[];
  inviteEmail: string;
  inviteRole: Exclude<PlaylistAccessRole, "owner">;
  isInviting: boolean;
  isLoadingCollaborators: boolean;
  isOwner: boolean;
  isSavingMetadata: boolean;
  metadataCover: string;
  metadataDescription: string;
  metadataName: string;
  metadataVisibility: PlaylistVisibility;
  onCopyShareLink: () => void;
  onInvite: () => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: Exclude<PlaylistAccessRole, "owner">) => void;
  onMetadataCoverChange: (value: string) => void;
  onMetadataDescriptionChange: (value: string) => void;
  onMetadataNameChange: (value: string) => void;
  onMetadataVisibilityChange: (value: PlaylistVisibility) => void;
  onDeletePlaylist: () => void;
  onRefreshCollaborators: () => void;
  onRegenerateShareLink: () => void;
  onRemoveCollaborator: (collaboratorUserId: string) => void;
  onRoleChange: (
    collaboratorUserId: string,
    nextRole: Exclude<PlaylistAccessRole, "owner">
  ) => void;
  onSaveMetadata: () => void;
}

export function UserPlaylistManageMenu({
  canEdit,
  collaborators,
  inviteEmail,
  inviteRole,
  isInviting,
  isLoadingCollaborators,
  isOwner,
  isSavingMetadata,
  metadataCover,
  metadataDescription,
  metadataName,
  metadataVisibility,
  onCopyShareLink,
  onInvite,
  onInviteEmailChange,
  onInviteRoleChange,
  onMetadataCoverChange,
  onMetadataDescriptionChange,
  onMetadataNameChange,
  onMetadataVisibilityChange,
  onDeletePlaylist,
  onRefreshCollaborators,
  onRegenerateShareLink,
  onRemoveCollaborator,
  onRoleChange,
  onSaveMetadata,
}: UserPlaylistManageMenuProps) {
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const showCollaboratorsEntry = canEdit || isOwner || isLoadingCollaborators || collaborators.length > 0;

  if (!canEdit && !showCollaboratorsEntry) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open playlist options"
            className="menu-sweep-hover flex h-10 w-10 items-center justify-center border border-white/12 bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/35"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setIsMetadataOpen(true)}>
              Playlist details
            </DropdownMenuItem>
          ) : null}
          {showCollaboratorsEntry ? (
            <DropdownMenuItem onSelect={() => setIsCollaboratorsOpen(true)}>
              Collaborators
            </DropdownMenuItem>
          ) : null}
          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={DESTRUCTIVE_MENU_ITEM_CLASS}
                onSelect={onDeletePlaylist}
              >
                Delete playlist
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
        <DialogContent className={MANAGE_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={MANAGE_DIALOG_HEADER_CLASS}>
            <div className={MANAGE_DIALOG_KICKER_CLASS}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--player-waveform))" }} />
              Playlist management
            </div>
            <DialogTitle className="text-[1.65rem] font-bold tracking-tight text-white">
              Playlist details
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-white/58">
              Update the playlist metadata and share settings from one place.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(88vh-88px)] overflow-y-auto px-6 py-6">
            <UserPlaylistMetadataSection
              className="border-0 bg-transparent p-0"
              isOwner={isOwner}
              metadataName={metadataName}
              metadataDescription={metadataDescription}
              metadataCover={metadataCover}
              metadataVisibility={metadataVisibility}
              isSavingMetadata={isSavingMetadata}
              showHeading={false}
              onMetadataNameChange={onMetadataNameChange}
              onMetadataDescriptionChange={onMetadataDescriptionChange}
              onMetadataCoverChange={onMetadataCoverChange}
              onMetadataVisibilityChange={onMetadataVisibilityChange}
              onSave={onSaveMetadata}
              onCopyShareLink={onCopyShareLink}
              onRegenerateShareLink={onRegenerateShareLink}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCollaboratorsOpen} onOpenChange={setIsCollaboratorsOpen}>
        <DialogContent className="w-[min(1200px,calc(100vw-32px))] max-w-[1200px] gap-0 overflow-hidden border border-white/10 bg-black/95 p-0 text-white shadow-[0_28px_100px_rgba(0,0,0,0.78)] backdrop-blur-2xl sm:max-h-[90vh]">
          <DialogHeader className="border-b border-white/10 bg-black/30 px-6 py-7 text-left sm:px-8">
            <div className={MANAGE_DIALOG_KICKER_CLASS}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--player-waveform))" }} />
              Playlist management
            </div>
            <DialogTitle className="text-[2.6rem] font-black tracking-tight text-white sm:text-[3.25rem]">
              Collaborators
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
              Review access, invite people, and manage collaborator roles.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-132px)] overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
            <UserPlaylistCollaboratorsSection
              className="border-0 bg-transparent p-0"
              collaborators={collaborators}
              isOwner={isOwner}
              isLoadingCollaborators={isLoadingCollaborators}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              isInviting={isInviting}
              showHeading={false}
              onRefresh={onRefreshCollaborators}
              onInviteEmailChange={onInviteEmailChange}
              onInviteRoleChange={onInviteRoleChange}
              onInvite={onInvite}
              onRoleChange={onRoleChange}
              onRemoveCollaborator={onRemoveCollaborator}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
