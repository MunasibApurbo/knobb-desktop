import { createContext, useContext, useMemo, useState } from "react";

export type LibraryShortcutFilter = "all" | "playlists" | "albums" | "artists";
export type LibraryShortcutSort = "recents" | "alphabetical";

export type LibraryShortcutActions = {
  closeSearch?: () => void;
  createPlaylist?: () => void;
  focusSearch?: () => void;
  setFilter?: (filter: LibraryShortcutFilter) => void;
  setSort?: (sort: LibraryShortcutSort) => void;
};

export type CollectionShortcutActions = {
  download?: () => void;
  play?: () => void;
  share?: () => void;
  shuffle?: () => void;
  toggleSaved?: () => void;
};

export type TrackSelectionShortcutScope = {
  id: string;
  selectedCount: number;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelection: () => void | Promise<void>;
  collectionActions?: CollectionShortcutActions;
  libraryActions?: LibraryShortcutActions;
};

type TrackSelectionShortcutsContextValue = {
  activeScope: TrackSelectionShortcutScope | null;
  setActiveScope: (scope: TrackSelectionShortcutScope | null) => void;
};

const TrackSelectionShortcutsContext = createContext<TrackSelectionShortcutsContextValue | null>(null);

export function TrackSelectionShortcutsProvider({ children }: React.PropsWithChildren) {
  const [activeScope, setActiveScope] = useState<TrackSelectionShortcutScope | null>(null);
  const value = useMemo(
    () => ({
      activeScope,
      setActiveScope,
    }),
    [activeScope],
  );

  return (
    <TrackSelectionShortcutsContext.Provider value={value}>
      {children}
    </TrackSelectionShortcutsContext.Provider>
  );
}

export function useTrackSelectionShortcutsContext() {
  const context = useContext(TrackSelectionShortcutsContext);
  if (!context) {
    throw new Error("useTrackSelectionShortcutsContext must be used inside TrackSelectionShortcutsProvider");
  }
  return context;
}
