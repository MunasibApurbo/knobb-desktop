import type { LibraryShortcutFilter } from "@/contexts/TrackSelectionShortcutsContext";

export const LIBRARY_SHORTCUT_COMMAND_EVENT = "knobb:library-shortcut-command";

export type LibraryShortcutCommand =
  | { type: "focus-search" }
  | { type: "set-filter"; filter: LibraryShortcutFilter };

export function dispatchLibraryShortcutCommand(command: LibraryShortcutCommand) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<LibraryShortcutCommand>(LIBRARY_SHORTCUT_COMMAND_EVENT, {
      detail: command,
    }),
  );
}
