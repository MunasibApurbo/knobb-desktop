import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Library, List, Plus, Search, Settings, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { SidebarLibraryCard } from "@/components/sidebar/SidebarLibraryCard";
import { type FilterType } from "@/components/sidebar/sidebarTypes";
import { useSidebarLibraryItems } from "@/components/sidebar/useSidebarLibraryItems";
import type { PlaylistCreateSubmitPayload } from "@/components/PlaylistCreateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useLocalFiles } from "@/contexts/LocalFilesContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { LIBRARY_SHORTCUT_COMMAND_EVENT, type LibraryShortcutCommand } from "@/lib/keyboardShortcuts";
import {
  clearActivePlaylistDrag,
  consumePlaylistDrag,
  getPlaylistDragSummary,
  hasPlaylistDragPayload,
  startDeferredPlaylistDrag,
  startPlaylistDrag,
} from "@/lib/playlistDrag";
import {
  filterAudioTracks,
  getAlbumWithTracks,
  getPlaylistWithTracks,
  tidalTrackToAppTrack,
} from "@/lib/musicApi";
import { cn } from "@/lib/utils";

const LazyPlaylistCreateDialog = lazy(async () => {
  const module = await import("@/components/PlaylistCreateDialog");
  return { default: module.PlaylistCreateDialog };
});

type LibraryCollectionProps = {
  className?: string;
  showSettingsAction?: boolean;
};

type SelectablePlaylistItem = {
  id: string;
  title: string;
  active: boolean;
  playlistId: string;
  playlistKind: "tidal" | "user";
};

const LIBRARY_TRANSPARENT_CONTROL_CLASS =
  "border-white/10 bg-[rgba(6,6,6,0.74)] supports-[backdrop-filter]:bg-[rgba(6,6,6,0.5)] supports-[backdrop-filter]:backdrop-blur-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.18),0_18px_38px_rgba(0,0,0,0.12)]";

export function LibraryCollection({
  className,
  showSettingsAction = false,
}: LibraryCollectionProps) {
  const { setActiveScope } = useTrackSelectionShortcutsContext();
  const [filter, setFilter] = useState<FilterType>("all");
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);
  const [isLibraryScopeActive, setIsLibraryScopeActive] = useState(false);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [lastSelectedPlaylistIndex, setLastSelectedPlaylistIndex] = useState<number | null>(null);
  const { libraryItemStyle, librarySortDefault } = useSettings();
  const [librarySort, setLibrarySort] = useState<"recents" | "alphabetical">(() => librarySortDefault);
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { likedSongs, addLikedSong } = useLikedSongs();
  const { localFiles } = useLocalFiles();
  const { savedAlbums } = useSavedAlbums();
  const { favoriteArtists } = useFavoriteArtists();
  const { favoritePlaylists, removeFavoritePlaylist } = useFavoritePlaylists();
  const {
    playlists: userPlaylists,
    createPlaylist,
    importTracksToPlaylist,
    deletePlaylist,
    getLastPlaylistError,
  } = usePlaylists();
  const { motionEnabled } = useMotionPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const collectionRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const libraryFilters: Array<{ value: Exclude<FilterType, "all">; label: string }> = [
    { value: "playlists", label: t("sidebar.playlists") },
    { value: "albums", label: t("sidebar.albums") },
    { value: "artists", label: t("sidebar.artists") },
  ];

  useEffect(() => {
    const resetDropTarget = () => {
      setDropTargetItemId(null);
      clearActivePlaylistDrag();
    };

    window.addEventListener("dragend", resetDropTarget);
    window.addEventListener("drop", resetDropTarget);

    return () => {
      window.removeEventListener("dragend", resetDropTarget);
      window.removeEventListener("drop", resetDropTarget);
    };
  }, []);

  useEffect(() => {
    setLibrarySort(librarySortDefault);
  }, [librarySortDefault]);

  const handleCreatePlaylistAction = useCallback(() => {
    if (user) {
      setShowCreate(true);
      return;
    }

    navigate("/auth", {
      state: {
        from: `${location.pathname}${location.search}`,
        prompt: "Sign in to create playlists and import playlist transfers.",
      },
    });
  }, [location.pathname, location.search, navigate, user]);

  const handleCreate = useCallback(
    async (payload: PlaylistCreateSubmitPayload) => {
      if (!payload.importRequest) {
        const id = await createPlaylist(payload.name, payload.description, {
          cover_url: payload.coverUrl || null,
          visibility: payload.visibility,
        });
        if (id) {
          toast.success(t("sidebar.playlistCreated", { name: payload.name }));
          setNewName("");
          setShowCreate(false);
          navigate(`/my-playlist/${id}`);
          return;
        }

        toast.error(getLastPlaylistError() || t("sidebar.playlistCreateFailed"));
        return;
      }

      try {
        const playlistId = await createPlaylist(payload.name, payload.description, {
          cover_url: payload.coverUrl || null,
          visibility: payload.visibility,
        });

        if (!playlistId) {
          toast.error(getLastPlaylistError() || t("sidebar.playlistCreateFailed"));
          return;
        }

        setNewName("");
        setShowCreate(false);
        navigate(`/my-playlist/${playlistId}`);

        const progressToastId = toast.loading(`Preparing import for "${payload.name}"...`);

        void (async () => {
          try {
            const { importPlaylist } = await import("@/lib/playlistImport");
            const importResult = await importPlaylist(payload.importRequest, (progress) => {
              if (progress.stage === "fetching") {
                toast.loading("Fetching playlist source...", { id: progressToastId });
                return;
              }

              toast.loading(
                `Matching tracks ${progress.current}/${progress.total}${progress.currentTrack ? ` · ${progress.currentTrack}` : ""}`,
                { id: progressToastId },
              );
            });

            if (importResult.tracks.length === 0) {
              toast.error("Import finished, but no matching tracks were found", { id: progressToastId });
              return;
            }

            const result = await importTracksToPlaylist(playlistId, importResult.tracks, (progress) => {
              toast.loading(`Adding tracks ${progress.current}/${progress.total} to "${payload.name}"...`, {
                id: progressToastId,
              });
            });

            toast.success(
              result.addedCount > 0
                ? `Imported ${result.addedCount} track${result.addedCount === 1 ? "" : "s"} into "${payload.name}"`
                : `Finished importing "${payload.name}"`,
              { id: progressToastId },
            );

            if (importResult.missingTracks.length > 0) {
              toast.info(
                `${importResult.missingTracks.length} track${importResult.missingTracks.length === 1 ? "" : "s"} could not be matched`,
              );
            }

            if (result.duplicateCount > 0) {
              toast.info(
                `${result.duplicateCount} duplicate track${result.duplicateCount === 1 ? "" : "s"} skipped`,
              );
            }

            if (result.failedCount > 0) {
              toast.error(
                `${result.failedCount} track${result.failedCount === 1 ? "" : "s"} failed to save`,
              );
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Playlist import failed", {
              id: progressToastId,
            });
          }
        })();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Playlist import failed");
      }
    },
    [createPlaylist, getLastPlaylistError, importTracksToPlaylist, navigate, t],
  );

  const openSavedAlbum = useCallback(
    (album: { album_id: number; album_title: string; album_artist: string; album_cover_url: string | null }) => {
      const params = new URLSearchParams({
        title: album.album_title,
        artist: album.album_artist,
      });
      if (album.album_cover_url) params.set("cover", album.album_cover_url);
      navigate(`/album/tidal-${album.album_id}?${params.toString()}`);
    },
    [navigate],
  );

  const handleDeleteLibraryPlaylist = useCallback(
    async (playlistId: string, playlistName: string, isActive: boolean) => {
      const confirmed = window.confirm(t("sidebar.deletePlaylistConfirm", { name: playlistName }));
      if (!confirmed) return;

      await deletePlaylist(playlistId);
      toast.success(t("sidebar.playlistDeleted"));

      if (isActive) {
        navigate("/app");
      }
    },
    [deletePlaylist, navigate, t],
  );

  const handleLikedSongsDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      if (!hasPlaylistDragPayload(event.dataTransfer)) return;
      event.preventDefault();
      setDropTargetItemId(null);

      const payload = await consumePlaylistDrag(event.dataTransfer);
      if (!payload) return;

      const progressToastId = toast.loading("Adding tracks to Liked Songs...");
      let addedCount = 0;

      for (const track of payload.tracks) {
        try {
          const wasAdded = await addLikedSong(track);
          if (wasAdded) addedCount += 1;
        } catch {
          // Ignore individual track add failures and continue through the payload.
        }
      }

      if (addedCount > 0) {
        toast.success(
          `Added ${addedCount} track${addedCount === 1 ? "" : "s"} to Liked Songs`,
          { id: progressToastId },
        );
      } else {
        toast.info("All tracks are already in Liked Songs", { id: progressToastId });
      }
    },
    [addLikedSong],
  );

  const handlePlaylistCardDragOver = useCallback((event: DragEvent<HTMLButtonElement>, itemId: string) => {
    if (!hasPlaylistDragPayload(event.dataTransfer)) return;
    event.preventDefault();
    if (dropTargetItemId !== itemId) {
      setDropTargetItemId(itemId);
    }
  }, [dropTargetItemId]);

  const handlePlaylistCardDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>, playlistId: string, playlistName: string) => {
      if (!hasPlaylistDragPayload(event.dataTransfer)) return;
      event.preventDefault();
      setDropTargetItemId(null);

      const progressToastId = toast.loading(`Preparing transfer to "${playlistName}"...`);
      const payload = await consumePlaylistDrag(event.dataTransfer);
      if (!payload) {
        toast.error("Nothing to transfer", { id: progressToastId });
        return;
      }

      if (payload.sourcePlaylistId === playlistId) {
        toast.info(`"${playlistName}" is already the source playlist`, { id: progressToastId });
        return;
      }

      toast.loading(`Adding ${getPlaylistDragSummary(payload)} to "${playlistName}"...`, { id: progressToastId });
      const result = await importTracksToPlaylist(playlistId, payload.tracks, (progress) => {
        toast.loading(`Adding tracks ${progress.current}/${progress.total} to "${playlistName}"...`, {
          id: progressToastId,
        });
      });

      if (result.addedCount > 0) {
        toast.success(
          `Added ${result.addedCount} track${result.addedCount === 1 ? "" : "s"} to "${playlistName}"`,
          { id: progressToastId },
        );
      } else if (result.duplicateCount > 0 && result.failedCount === 0) {
        toast.info(`Everything from ${payload.label} is already in "${playlistName}"`, { id: progressToastId });
      } else {
        toast.error(`No tracks were added to "${playlistName}"`, { id: progressToastId });
      }

      if (result.duplicateCount > 0) {
        toast.info(
          `${result.duplicateCount} duplicate track${result.duplicateCount === 1 ? "" : "s"} skipped`,
        );
      }

      if (result.failedCount > 0) {
        toast.error(
          `${result.failedCount} track${result.failedCount === 1 ? "" : "s"} failed to save`,
        );
      }
    },
    [importTracksToPlaylist],
  );

  const libraryItems = useSidebarLibraryItems({
    favoriteArtists,
    favoritePlaylists,
    filter,
    librarySearch,
    librarySort,
    likedSongs,
    navigate,
    openSavedAlbum,
    pathname: location.pathname,
    search: location.search,
    savedAlbums,
    userPlaylists,
  });

  const selectablePlaylistItems = useMemo<SelectablePlaylistItem[]>(
    () =>
      libraryItems
        .filter((item): item is (typeof libraryItems)[number] & { type: "playlist"; playlistId: string; playlistKind: "tidal" | "user" } =>
          item.type === "playlist" && Boolean(item.playlistId) && (item.playlistKind === "tidal" || item.playlistKind === "user"))
        .map((item) => ({
          id: item.id,
          title: item.title,
          active: item.active,
          playlistId: item.playlistId,
          playlistKind: item.playlistKind,
        })),
    [libraryItems],
  );

  const selectablePlaylistIndexMap = useMemo(
    () => new Map(selectablePlaylistItems.map((item, index) => [item.id, index])),
    [selectablePlaylistItems],
  );

  useEffect(() => {
    const selectableIds = new Set(selectablePlaylistItems.map((item) => item.id));
    setSelectedPlaylistIds((previous) => previous.filter((id) => selectableIds.has(id)));
    setLastSelectedPlaylistIndex((previous) => (
      selectablePlaylistItems.length === 0
        ? null
        : previous === null || previous < selectablePlaylistItems.length
          ? previous
          : selectablePlaylistItems.length - 1
    ));
  }, [selectablePlaylistItems]);

  const clearPlaylistSelection = useCallback(() => {
    setSelectedPlaylistIds([]);
    setLastSelectedPlaylistIndex(null);
  }, []);

  const selectAllPlaylists = useCallback(() => {
    setSelectedPlaylistIds(selectablePlaylistItems.map((item) => item.id));
    setLastSelectedPlaylistIndex(selectablePlaylistItems.length > 0 ? selectablePlaylistItems.length - 1 : null);
  }, [selectablePlaylistItems]);

  const deleteSelectedPlaylists = useCallback(async () => {
    if (selectedPlaylistIds.length === 0) return;

    const selectedItems = selectablePlaylistItems.filter((item) => selectedPlaylistIds.includes(item.id));
    if (selectedItems.length === 0) return;

    const ownedPlaylists = selectedItems.filter((item) => item.playlistKind === "user");
    const savedPlaylists = selectedItems.filter((item) => item.playlistKind === "tidal");

    const confirmationParts: string[] = [];
    if (ownedPlaylists.length > 0) {
      confirmationParts.push(
        ownedPlaylists.length === 1
          ? `delete "${ownedPlaylists[0].title}"`
          : `delete ${ownedPlaylists.length} playlists`,
      );
    }
    if (savedPlaylists.length > 0) {
      confirmationParts.push(
        savedPlaylists.length === 1
          ? `remove "${savedPlaylists[0].title}" from Your Library`
          : `remove ${savedPlaylists.length} saved playlists from Your Library`,
      );
    }

    const confirmed = window.confirm(
      confirmationParts.length === 1
        ? `Are you sure you want to ${confirmationParts[0]}?`
        : `Are you sure you want to ${confirmationParts.join(" and ")}?`,
    );

    if (!confirmed) return;

    let deletedCount = 0;
    let removedCount = 0;
    const failedIds = new Set<string>();
    let shouldNavigateHome = false;

    for (const item of ownedPlaylists) {
      try {
        await deletePlaylist(item.playlistId);
        deletedCount += 1;
        if (item.active) shouldNavigateHome = true;
      } catch {
        failedIds.add(item.id);
      }
    }

    for (const item of savedPlaylists) {
      try {
        const removed = await removeFavoritePlaylist(item.playlistId, item.playlistKind);
        if (removed) {
          removedCount += 1;
        } else {
          failedIds.add(item.id);
        }
      } catch {
        failedIds.add(item.id);
      }
    }

    if (shouldNavigateHome) {
      navigate("/app");
    }

    setSelectedPlaylistIds(Array.from(failedIds));
    if (failedIds.size === 0) {
      setLastSelectedPlaylistIndex(null);
    }

    if (deletedCount > 0 && removedCount > 0) {
      toast.success(`Deleted ${deletedCount} playlist${deletedCount === 1 ? "" : "s"} and removed ${removedCount} saved playlist${removedCount === 1 ? "" : "s"}`);
    } else if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} playlist${deletedCount === 1 ? "" : "s"}`);
    } else if (removedCount > 0) {
      toast.success(`Removed ${removedCount} saved playlist${removedCount === 1 ? "" : "s"} from Your Library`);
    }

    if (failedIds.size > 0) {
      toast.error(`Couldn't remove ${failedIds.size} selected playlist${failedIds.size === 1 ? "" : "s"}`);
    }
  }, [deletePlaylist, navigate, removeFavoritePlaylist, selectablePlaylistItems, selectedPlaylistIds]);

  const focusLibrarySearch = useCallback(() => {
    setIsLibraryScopeActive(true);
    setLibrarySearchOpen(true);

    const focusInput = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    if (typeof window === "undefined") {
      focusInput();
      return;
    }

    window.requestAnimationFrame(focusInput);
  }, []);

  const closeLibrarySearch = useCallback(() => {
    setLibrarySearchOpen(false);
    setLibrarySearch("");
  }, []);

  const libraryShortcutScope = useMemo(
    () => ({
      id: "library-playlists",
      selectedCount: selectedPlaylistIds.length,
      selectAll: selectAllPlaylists,
      clearSelection: clearPlaylistSelection,
      deleteSelection: deleteSelectedPlaylists,
      libraryActions: {
        closeSearch: closeLibrarySearch,
        createPlaylist: handleCreatePlaylistAction,
        focusSearch: focusLibrarySearch,
        setFilter,
        setSort: setLibrarySort,
      },
    }),
    [
      clearPlaylistSelection,
      closeLibrarySearch,
      deleteSelectedPlaylists,
      focusLibrarySearch,
      handleCreatePlaylistAction,
      selectAllPlaylists,
      selectedPlaylistIds.length,
      setFilter,
      setLibrarySort,
    ],
  );

  useEffect(() => {
    if (!isLibraryScopeActive) return;

    setActiveScope(libraryShortcutScope);

    return () => {
      setActiveScope(null);
    };
  }, [isLibraryScopeActive, libraryShortcutScope, setActiveScope]);

  useEffect(() => {
    if (!isLibraryScopeActive) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (collectionRef.current?.contains(target)) return;
      setIsLibraryScopeActive(false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (collectionRef.current?.contains(target)) return;
      setIsLibraryScopeActive(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [isLibraryScopeActive]);

  useEffect(() => {
    const handleLibraryShortcutCommand = (event: Event) => {
      const shortcutEvent = event as CustomEvent<LibraryShortcutCommand>;
      const command = shortcutEvent.detail;
      if (!command) return;

      setIsLibraryScopeActive(true);

      if (command.type === "focus-search") {
        focusLibrarySearch();
        return;
      }

      if (command.type === "set-filter") {
        setLibrarySearchOpen(false);
        setLibrarySearch("");
        setFilter(command.filter);
      }
    };

    window.addEventListener(LIBRARY_SHORTCUT_COMMAND_EVENT, handleLibraryShortcutCommand as EventListener);
    return () => {
      window.removeEventListener(LIBRARY_SHORTCUT_COMMAND_EVENT, handleLibraryShortcutCommand as EventListener);
    };
  }, [focusLibrarySearch]);

  const activateLibraryScope = useCallback(() => {
    setIsLibraryScopeActive(true);
    setActiveScope(libraryShortcutScope);
  }, [libraryShortcutScope, setActiveScope]);

  const handleSelectablePlaylistClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, item: SelectablePlaylistItem, onOpen: () => void) => {
    const itemIndex = selectablePlaylistIndexMap.get(item.id);
    if (itemIndex === undefined) {
      onOpen();
      return;
    }

    if (event.shiftKey && lastSelectedPlaylistIndex !== null) {
      event.preventDefault();
      activateLibraryScope();
      const [start, end] = [lastSelectedPlaylistIndex, itemIndex].sort((left, right) => left - right);
      const rangeIds = selectablePlaylistItems.slice(start, end + 1).map((entry) => entry.id);
      setSelectedPlaylistIds((previous) => Array.from(new Set([...previous, ...rangeIds])));
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      activateLibraryScope();
      setSelectedPlaylistIds((previous) =>
        previous.includes(item.id)
          ? previous.filter((id) => id !== item.id)
          : [...previous, item.id],
      );
      setLastSelectedPlaylistIndex(itemIndex);
      return;
    }

    setIsLibraryScopeActive(false);
    clearPlaylistSelection();
    setLastSelectedPlaylistIndex(itemIndex);
    onOpen();
  }, [
    activateLibraryScope,
    clearPlaylistSelection,
    lastSelectedPlaylistIndex,
    selectablePlaylistIndexMap,
    selectablePlaylistItems,
  ]);

  const renderLibraryItem = useCallback((item: (typeof libraryItems)[number], index: number) => {
    const canAcceptPlaylistDrop = item.type === "liked" || (item.type === "playlist" && item.playlistKind === "user");
    const canDragLibraryItem = item.type !== "artist";
    const isSelectablePlaylist = item.type === "playlist" && Boolean(item.playlistId) && (item.playlistKind === "tidal" || item.playlistKind === "user");
    const isSelected = isSelectablePlaylist && selectedPlaylistIds.includes(item.id);

    const card = (
      <SidebarLibraryCard
        key={item.id}
        itemType={item.type}
        title={item.title}
        subtitle={item.subtitle}
        imageUrl={item.imageUrl}
        artistId={item.artistId}
        active={item.active}
        isDropTarget={dropTargetItemId === item.id}
        variant={item.variant}
        layout={libraryItemStyle}
        prioritizeImageLoading={index < (libraryItemStyle === "list" ? 8 : 6)}
        selected={isSelected}
        data-library-selectable-playlist={isSelectablePlaylist ? "true" : undefined}
        onFocus={() => {
          activateLibraryScope();
        }}
        onClick={(event) => {
          if (isSelectablePlaylist && item.playlistId && (item.playlistKind === "tidal" || item.playlistKind === "user")) {
            handleSelectablePlaylistClick(event, {
              id: item.id,
              title: item.title,
              active: item.active,
              playlistId: item.playlistId,
              playlistKind: item.playlistKind,
            }, item.onClick);
            return;
          }

          setIsLibraryScopeActive(false);
          clearPlaylistSelection();
          item.onClick();
        }}
        onDragLeave={() => {
          if (dropTargetItemId === item.id) {
            setDropTargetItemId(null);
          }
        }}
        onDragOver={(event) => {
          if (!canAcceptPlaylistDrop) return;
          handlePlaylistCardDragOver(event, item.id);
        }}
        onDrop={(event) => {
          if (item.type === "liked") {
            void handleLikedSongsDrop(event);
            return;
          }
          if (!item.playlistId || item.playlistKind !== "user") return;
          void handlePlaylistCardDrop(event, item.playlistId, item.title);
        }}
        draggable={canDragLibraryItem}
        onDragStart={(event) => {
          if (item.type === "liked") {
            startPlaylistDrag(event.dataTransfer, {
              label: item.title,
              source: "playlist",
              tracks: likedSongs,
            });
            return;
          }

          if (item.type === "local") {
            startPlaylistDrag(event.dataTransfer, {
              label: item.title,
              source: "playlist",
              tracks: localFiles,
            });
            return;
          }

          if (item.type === "album" && item.albumId) {
            startDeferredPlaylistDrag(event.dataTransfer, `${item.title} album`, async () => {
              const { tracks } = await getAlbumWithTracks(item.albumId!);
              const appTracks = filterAudioTracks(tracks.map((track) => tidalTrackToAppTrack(track)));
              if (appTracks.length === 0) return null;
              return {
                label: item.title,
                source: "album",
                tracks: appTracks,
              };
            });
            return;
          }

          if (item.type !== "playlist" || !item.playlistId) return;

          if (item.playlistKind === "tidal") {
            startDeferredPlaylistDrag(event.dataTransfer, `${item.title} playlist`, async () => {
              const { tracks } = await getPlaylistWithTracks(item.playlistId!);
              const appTracks = filterAudioTracks(tracks.map((track) => tidalTrackToAppTrack(track)));
              if (appTracks.length === 0) return null;
              return {
                label: item.title,
                source: "playlist",
                tracks: appTracks,
              };
            });
            return;
          }

          if (item.playlistKind !== "user") return;
          const sourcePlaylist = userPlaylists.find((entry) => entry.id === item.playlistId);
          if (!sourcePlaylist) return;
          startPlaylistDrag(event.dataTransfer, {
            label: sourcePlaylist.name,
            source: "playlist",
            sourcePlaylistId: sourcePlaylist.id,
            tracks: sourcePlaylist.tracks,
          });
        }}
        onDragEnd={() => {
          clearActivePlaylistDrag();
        }}
      />
    );

    if (item.type === "liked") {
      return (
        <PlaylistContextMenu
          key={item.id}
          title={item.title}
          kind="liked"
          tracks={likedSongs}
          coverUrl={item.imageUrl}
        >
          {card}
        </PlaylistContextMenu>
      );
    }

    if (item.type === "playlist" && item.playlistId) {
      const playlist = userPlaylists.find((entry) => entry.id === item.playlistId);
      return (
        <PlaylistContextMenu
          key={item.id}
          title={item.title}
          playlistId={item.playlistId}
          shareToken={item.playlistShareToken}
          coverUrl={item.imageUrl}
          kind={item.playlistKind === "tidal" ? "tidal" : "user"}
          visibility={playlist?.visibility}
          tracks={playlist?.tracks}
          onDelete={item.playlistKind === "user"
            ? () => void handleDeleteLibraryPlaylist(item.playlistId!, item.title, item.active)
            : undefined}
        >
          {card}
        </PlaylistContextMenu>
      );
    }

    if (item.type === "album" && item.albumId) {
      return (
        <AlbumContextMenu
          key={item.id}
          albumId={item.albumId}
          title={item.title}
          artist={item.albumArtist || item.subtitle || "Unknown Artist"}
          coverUrl={item.imageUrl}
        >
          {card}
        </AlbumContextMenu>
      );
    }

    if (item.type === "artist" && item.artistId) {
      return (
        <ArtistContextMenu
          key={item.id}
          artistId={item.artistId}
          artistName={item.title}
          artistImageUrl={item.imageUrl}
        >
          {card}
        </ArtistContextMenu>
      );
    }

    return card;
  }, [
    activateLibraryScope,
    clearPlaylistSelection,
    dropTargetItemId,
    handleDeleteLibraryPlaylist,
    handleLikedSongsDrop,
    handlePlaylistCardDragOver,
    handlePlaylistCardDrop,
    handleSelectablePlaylistClick,
    libraryItemStyle,
    likedSongs,
    localFiles,
    selectedPlaylistIds,
    userPlaylists,
  ]);

  const actionButtonClassName = "menu-sweep-hover relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-white/78 transition-[background-color,border-color,color,transform] hover:text-white";

  return (
    <div
      ref={collectionRef}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      onFocusCapture={() => setIsLibraryScopeActive(true)}
      onPointerDownCapture={() => setIsLibraryScopeActive(true)}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-3 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Library className="h-5 w-5" />
          </span>
          <span className="truncate text-sm font-semibold leading-none">{t("sidebar.yourLibrary")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={actionButtonClassName}
            onClick={handleCreatePlaylistAction}
            title={user ? t("sidebar.newPlaylist") : "Sign in to create playlist"}
            aria-label={user ? t("sidebar.newPlaylist") : "Sign in to create playlist"}
          >
            <Plus className="h-5 w-5" />
          </button>
          {showSettingsAction ? (
            <button
              type="button"
              className={actionButtonClassName}
              onClick={() => navigate("/settings")}
              title={t("nav.settings")}
              aria-label={t("nav.settings")}
            >
              <Settings className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="library-filter-row flex w-full items-center gap-2 border-b border-white/10 px-4 py-3 select-none">
        {libraryFilters.map((libraryFilter) => {
          const active = filter === libraryFilter.value;

          return (
            <button
              key={libraryFilter.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? "all" : libraryFilter.value)}
              className={`library-filter-button menu-sweep-hover group relative flex h-11 min-w-0 flex-1 overflow-hidden rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,color,box-shadow] ${active
                  ? "border-[hsl(var(--player-waveform)/0.82)] bg-[hsl(var(--player-waveform))] text-black shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
                  : `${LIBRARY_TRANSPARENT_CONTROL_CLASS} text-white/72 hover:border-white/16 hover:text-black`
                }`}
            >
              {active ? (
                <motion.span
                  layoutId={motionEnabled ? "library-filter" : undefined}
                  className="absolute inset-0 bg-[hsl(var(--player-waveform))]"
                />
              ) : null}
              <span className="library-filter-label relative z-10 flex h-full min-w-0 w-full items-center justify-center truncate px-2">
                {libraryFilter.label}
                {active ? <X className="ml-1.5 h-3 w-3 opacity-60 transition-opacity hover:opacity-100" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex w-full shrink-0 items-center gap-2 border-b border-white/5 px-4 py-3">
        {librarySearchOpen ? (
          <div className={`flex h-11 w-full items-center gap-3 rounded-full border px-4 ${LIBRARY_TRANSPARENT_CONTROL_CLASS}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/78">
              <Search className="h-4 w-4" />
            </span>
            <input
              ref={searchInputRef}
              autoFocus
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder={t("sidebar.searchLibraryPlaceholder")}
              className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => {
                closeLibrarySearch();
              }}
              className="menu-sweep-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/78 hover:text-white"
              aria-label="Close library search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLibrarySearchOpen(true)}
              className={`menu-sweep-hover flex h-11 w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-full border text-white/78 transition-[background-color,border-color,color] hover:border-white/16 hover:text-black ${LIBRARY_TRANSPARENT_CONTROL_CLASS}`}
              aria-label={t("sidebar.searchLibraryPlaceholder")}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                <Search className="h-4 w-4" />
              </span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`menu-sweep-hover flex h-11 min-w-0 flex-1 items-center justify-end gap-2.5 overflow-hidden rounded-full border px-4 text-sm font-semibold text-white/78 transition-[background-color,border-color,color] outline-none hover:border-white/16 hover:text-black ${LIBRARY_TRANSPARENT_CONTROL_CLASS}`}
                  aria-label="Sort library"
                >
                  <span className="truncate">{librarySort === "recents" ? t("sidebar.recents") : t("sidebar.alphabetical")}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <List className="h-4 w-4" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => setLibrarySort("recents")}
                  className={librarySort === "recents" ? "font-medium text-[hsl(var(--player-waveform))]" : "text-white"}
                >
                  {t("sidebar.recents")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLibrarySort("alphabetical")}
                  className={librarySort === "alphabetical" ? "font-medium text-[hsl(var(--player-waveform))]" : "text-white"}
                >
                  {t("sidebar.alphabetical")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <ScrollArea forceVisibleScrollbar className="sidebar-scroll-area flex-1 px-0 pb-0 shadow-inner">
        <div className={libraryItemStyle === "list" ? "space-y-1 px-2 py-2" : "space-y-0 pb-0"}>
          {libraryItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("sidebar.noMatchesFound")}
            </div>
          ) : (
            libraryItems.map((item, index) => renderLibraryItem(item, index))
          )}
        </div>
      </ScrollArea>

      {showCreate ? (
        <Suspense fallback={null}>
          <LazyPlaylistCreateDialog
            open={showCreate}
            onOpenChange={setShowCreate}
            title={t("sidebar.newPlaylist")}
            placeholder={t("sidebar.playlistNamePlaceholder")}
            value={newName}
            onValueChange={setNewName}
            onSubmit={handleCreate}
            allowImports
            disabled={authLoading || !user}
            submitLabel={t("sidebar.createPlaylist")}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
