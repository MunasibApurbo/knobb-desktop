import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlaylistAccessRole,
  PlaylistCollaborator,
} from "@/hooks/usePlaylists";
import {
  formatRoleLabel,
  getCollaboratorDisplay,
} from "@/components/user-playlist/userPlaylistUtils";
import {
  Crown,
  Eye,
  Loader2,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPlaylistCollaboratorsSectionProps {
  className?: string;
  collaborators: PlaylistCollaborator[];
  isOwner: boolean;
  isLoadingCollaborators: boolean;
  inviteEmail: string;
  inviteRole: Exclude<PlaylistAccessRole, "owner">;
  isInviting: boolean;
  showHeading?: boolean;
  onRefresh: () => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: Exclude<PlaylistAccessRole, "owner">) => void;
  onInvite: () => void;
  onRoleChange: (
    collaboratorUserId: string,
    nextRole: Exclude<PlaylistAccessRole, "owner">
  ) => void;
  onRemoveCollaborator: (collaboratorUserId: string) => void;
}

export function UserPlaylistCollaboratorsSection({
  className,
  collaborators,
  isOwner,
  isLoadingCollaborators,
  inviteEmail,
  inviteRole,
  isInviting,
  showHeading = true,
  onRefresh,
  onInviteEmailChange,
  onInviteRoleChange,
  onInvite,
  onRoleChange,
  onRemoveCollaborator,
}: UserPlaylistCollaboratorsSectionProps) {
  const editorCount = collaborators.filter((collaborator) => collaborator.role === "editor").length;
  const viewerCount = collaborators.filter((collaborator) => collaborator.role === "viewer").length;
  const collaboratorCountLabel =
    collaborators.length === 1 ? "1 person has access." : `${collaborators.length} people have access.`;
  const isInviteDisabled = isInviting || !inviteEmail.trim();
  const inviteRoleDescription =
    inviteRole === "editor"
      ? "Editors can update playlist details, manage tracks, and collaborate on changes."
      : "Viewers can open the playlist and listen, but they cannot change it.";

  const getInitials = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <section
      className={cn(
        "user-playlist-manage-section border border-t-0 border-white/10 bg-white/[0.02] p-4 space-y-6",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02)),rgba(255,255,255,0.02)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
        <div
          className={cn(
            "flex flex-col gap-4 lg:flex-row lg:items-end",
            showHeading ? "lg:justify-between" : "lg:justify-between",
          )}
        >
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/42">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--player-waveform))" }} />
              Access overview
            </div>
            {showHeading ? (
              <h3 className="text-[1.9rem] font-black tracking-tight text-white sm:text-[2.3rem]">
                Collaborators
              </h3>
            ) : (
              <h3 className="text-[1.45rem] font-bold tracking-tight text-white sm:text-[1.75rem]">
                Manage playlist access
              </h3>
            )}
            <p className="mt-2 text-sm leading-6 text-white/60">
              Invite people, adjust roles, and keep ownership controls in one place without leaving the playlist workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-11 items-center rounded-full border border-white/10 bg-black/20 px-4 text-sm font-medium text-white/72">
              {collaboratorCountLabel}
            </div>
            <Button
              variant="outline"
              className="user-playlist-manage-control user-playlist-manage-button website-form-control menu-sweep-hover h-11 rounded-full border-white/12 bg-white/[0.03] px-5 text-sm font-semibold text-foreground hover:bg-white/[0.05] focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
              <ShieldCheck className="h-3.5 w-3.5" />
              Total access
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight text-white">{collaborators.length}</p>
            <p className="mt-1 text-sm text-white/52">People with active playlist access.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
              <PencilLine className="h-3.5 w-3.5" />
              Editors
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight text-white">{editorCount}</p>
            <p className="mt-1 text-sm text-white/52">Can update details and collaborate on tracks.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
              <Eye className="h-3.5 w-3.5" />
              Viewers
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight text-white">{viewerCount}</p>
            <p className="mt-1 text-sm text-white/52">Can listen and view without making changes.</p>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-6", isOwner ? "xl:grid-cols-[360px_minmax(0,1fr)]" : "grid-cols-1")}>
        {isOwner ? (
          <div className="website-panel-surface overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight text-white">Add a collaborator</p>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Invite by Knobb account email and choose whether they should view or edit this playlist.
              </p>
            </div>
            <form
              className="space-y-4 px-5 py-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (isInviteDisabled) return;
                onInvite();
              }}
            >
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/52">
                  Account email
                </label>
                <Input
                  value={inviteEmail}
                  onChange={(event) => onInviteEmailChange(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  className="user-playlist-manage-control h-12 rounded-[20px] border-white/10 bg-white/[0.04] px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/52">
                  Access
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["viewer", "editor"] as const).map((role) => {
                    const isActive = inviteRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={cn(
                          "menu-sweep-hover rounded-[20px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform)/0.16)] text-white"
                            : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06] hover:text-black",
                        )}
                        onClick={() => onInviteRoleChange(role)}
                      >
                        <span className="block text-sm font-semibold">
                          {role === "viewer" ? "Viewer" : "Editor"}
                        </span>
                        <span className="mt-1 block text-xs text-white/45">
                          {role === "viewer" ? "Read-only access" : "Can make updates"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                variant="outline"
                type="submit"
                className="user-playlist-manage-control user-playlist-manage-button website-form-control h-12 w-full rounded-full border-0 bg-[#1ed760] px-6 text-sm font-semibold text-black hover:bg-[#28e06c] focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isInviteDisabled}
              >
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {isInviting ? "Inviting..." : "Send invite"}
              </Button>
              <div className="space-y-2">
                <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/58">
                  <span className="font-semibold text-white">Selected role</span>
                  <p className="mt-1.5 leading-5">{inviteRoleDescription}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/58">
                  <span className="font-semibold text-white">Owner access</span>
                  <p className="mt-1.5 leading-5">
                    Owners keep full control of invites, permissions, and playlist visibility.
                  </p>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        <div className="website-panel-surface overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
              <Crown className="h-3.5 w-3.5" />
              Active access
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-white">People with access</p>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Review who can open or edit this playlist and keep permissions aligned with how you want it shared.
            </p>
          </div>

          {isLoadingCollaborators ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-white/58">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading collaborators...
            </div>
          ) : collaborators.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-lg font-semibold text-white">No collaborators yet</p>
              <p className="mt-2 text-sm leading-6 text-white/56">
                {isOwner
                  ? "Invite a viewer or editor to start sharing access to this playlist."
                  : "Only the playlist owner can invite collaborators."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-4 sm:p-5">
              {collaborators.map((collaborator) => {
                const isOwnerRow = collaborator.role === "owner";
                const displayName = getCollaboratorDisplay(collaborator);

                return (
                  <div
                    key={`${collaborator.user_id}-${collaborator.role}`}
                    className="user-playlist-manage-row rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {collaborator.avatar_url ? (
                          <img
                            src={collaborator.avatar_url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-[18px] border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-xs font-semibold tracking-[0.14em] text-foreground">
                            {displayName === `${collaborator.user_id.slice(0, 8)}…` ? (
                              <UserRound className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              getInitials(displayName)
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{displayName}</p>
                          <p className="truncate text-xs text-white/45">{collaborator.user_id}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">
                            {isOwnerRow
                              ? "Full control"
                              : collaborator.role === "editor"
                                ? "Can edit playlist"
                                : "View only"}
                          </p>
                        </div>
                      </div>

                      {isOwner && !isOwnerRow ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Select
                            value={collaborator.role}
                            onValueChange={(value) =>
                              onRoleChange(
                                collaborator.user_id,
                                value as Exclude<PlaylistAccessRole, "owner">,
                              )
                            }
                          >
                            <SelectTrigger className="user-playlist-manage-control user-playlist-manage-select menu-sweep-hover h-11 min-w-[160px] rounded-full border-white/10 bg-white/[0.04] px-4 text-sm text-foreground focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="text-foreground">
                              <SelectItem value="viewer" className="text-sm text-foreground focus:bg-white/[0.12] focus:text-foreground">
                                Viewer
                              </SelectItem>
                              <SelectItem value="editor" className="text-sm text-foreground focus:bg-white/[0.12] focus:text-foreground">
                                Editor
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            className="user-playlist-manage-control user-playlist-manage-button website-form-control h-11 rounded-full border border-white/10 px-4 text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                            onClick={() => onRemoveCollaborator(collaborator.user_id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                          {formatRoleLabel(collaborator.role)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
