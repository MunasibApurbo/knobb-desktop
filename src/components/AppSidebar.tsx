import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsLeft,
  Compass,
  Library,
  List,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSidebarCollapsed } from "@/components/Layout";
import { SidebarCollapsedRail } from "@/components/sidebar/SidebarCollapsedRail";
import { SidebarLibraryCard } from "@/components/sidebar/SidebarLibraryCard";
import { SidebarOverflowMenu } from "@/components/sidebar/SidebarOverflowMenu";
import { type FilterType } from "@/components/sidebar/sidebarTypes";
import { useSidebarLibraryItems } from "@/components/sidebar/useSidebarLibraryItems";
import { AlbumContextMenu } from "@/components/AlbumContextMenu";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { BrandLogo } from "@/components/BrandLogo";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlaylistCreateSubmitPayload } from "@/components/PlaylistCreateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useLocalFiles } from "@/contexts/LocalFilesContext";
import { useSearch } from "@/contexts/SearchContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  clearActivePlaylistDrag,
  consumePlaylistDrag,
  getPlaylistDragSummary,
  hasPlaylistDragPayload,
  startDeferredPlaylistDrag,
  startPlaylistDrag,
} from "@/lib/playlistDrag";
import { filterAudioTracks, getAlbumWithTracks, getPlaylistWithTracks, tidalTrackToAppTrack } from "@/lib/musicApi";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";

const LazySidebarSearchResults = lazy(async () => {
  const module = await import("@/components/sidebar/SidebarSearchResults");
  return { default: module.SidebarSearchResults };
});

const LazyPlaylistCreateDialog = lazy(async () => {
  const module = await import("@/components/PlaylistCreateDialog");
  return { default: module.PlaylistCreateDialog };
});

export function AppSidebar() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const { libraryItemStyle, librarySortDefault, sidebarStyle } = useSettings();
  const [librarySort, setLibrarySort] = useState<"recents" | "alphabetical">(() => librarySortDefault);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { likedSongs, addLikedSong } = useLikedSongs();
  const { localFiles } = useLocalFiles();
  const { savedAlbums } = useSavedAlbums();
  const { favoriteArtists } = useFavoriteArtists();
  const { favoritePlaylists } = useFavoritePlaylists();
  const {
    playlists: userPlaylists,
    createPlaylist,
    importTracksToPlaylist,
    deletePlaylist,
    getLastPlaylistError,
  } = usePlaylists();
  const { searchOpen, setSearchOpen, query, onQueryChange, isSearching, closeSearch, handleSearch } = useSearch();
  const { collapsed, expandPanel, setCollapsed } = useSidebarCollapsed();
  const { motionEnabled: sidebarMotionEnabled } = useMotionPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigateHome = useCallback(() => {
    try {
      window.localStorage.setItem("last-route", "/");
    } catch {
      // Ignore storage failures.
    }
    navigate("/");
  }, [navigate]);
  const isFullSearchPage = location.pathname === "/search";
  const libraryFilters: Array<{ value: Exclude<FilterType, "all">; label: string }> = [
    { value: "playlists", label: t("sidebar.playlists") },
    { value: "albums", label: t("sidebar.albums") },
    { value: "artists", label: t("sidebar.artists") },
  ];

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

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
          startTransition(() => {
            navigate(`/my-playlist/${id}`);
          });
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
        startTransition(() => {
          navigate(`/my-playlist/${playlistId}`);
        });

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

  const handleDeleteLibraryPlaylist = useCallback(
    async (playlistId: string, playlistName: string, isActive: boolean) => {
      const confirmed = window.confirm(t("sidebar.deletePlaylistConfirm", { name: playlistName }));
      if (!confirmed) return;

      await deletePlaylist(playlistId);
      toast.success(t("sidebar.playlistDeleted"));

      if (isActive) {
        navigate("/");
      }
    },
    [deletePlaylist, navigate, t],
  );

  const handlePlaylistCardDragOver = useCallback(
    (event: DragEvent<HTMLButtonElement>, itemId: string) => {
      if (!hasPlaylistDragPayload(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (dropTargetItemId !== itemId) {
        setDropTargetItemId(itemId);
      }
    },
    [dropTargetItemId],
  );

  const handlePlaylistCardDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>, playlistId: string, playlistName: string) => {
      event.preventDefault();
      setDropTargetItemId(null);
      const progressToastId = toast.loading(`Preparing transfer to "${playlistName}"...`);

      const payload = await consumePlaylistDrag(event.dataTransfer);
      if (!payload || payload.tracks.length === 0) {
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

  const handleLikedSongsDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDropTargetItemId(null);
      const progressToastId = toast.loading("Preparing transfer to Liked Songs...");

      const payload = await consumePlaylistDrag(event.dataTransfer);
      if (!payload || payload.tracks.length === 0) {
        toast.error("Nothing to transfer", { id: progressToastId });
        return;
      }

      toast.loading(`Adding ${getPlaylistDragSummary(payload)} to Liked Songs...`, { id: progressToastId });
      let addedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (const track of payload.tracks) {
        const result = await addLikedSong(track);
        if (result === "added") {
          addedCount += 1;
        } else if (result === "duplicate") {
          duplicateCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (addedCount > 0) {
        toast.success(
          `Added ${addedCount} track${addedCount === 1 ? "" : "s"} to Liked Songs`,
          { id: progressToastId },
        );
      } else if (duplicateCount > 0 && failedCount === 0) {
        toast.info(`Everything from ${payload.label} is already in Liked Songs`, { id: progressToastId });
      } else {
        toast.error("No tracks were added to Liked Songs", { id: progressToastId });
      }

      if (duplicateCount > 0) {
        toast.info(
          `${duplicateCount} duplicate track${duplicateCount === 1 ? "" : "s"} skipped`,
        );
      }

      if (failedCount > 0) {
        toast.error(
          `${failedCount} track${failedCount === 1 ? "" : "s"} failed to save`,
        );
      }
    },
    [addLikedSong],
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

  const compactLibraryItems = useSidebarLibraryItems({
    favoriteArtists,
    favoritePlaylists,
    filter: "all",
    librarySearch: "",
    librarySort: "recents",
    likedSongs,
    navigate,
    openSavedAlbum,
    pathname: location.pathname,
    search: location.search,
    savedAlbums,
    userPlaylists,
  });

  useEffect(() => {
    setLibrarySort(librarySortDefault);
  }, [librarySortDefault]);

  if (collapsed) {
    return (
      <SidebarCollapsedRail
        expandPanel={expandPanel}
        items={compactLibraryItems}
        navigate={navigate}
        onOpenSearch={() => setSearchOpen(true)}
      />
    );
  }

  return (
    <div className={`desktop-shell-sidebar sidebar-shell sidebar-shell-${sidebarStyle} relative isolate flex h-full w-full flex-col overflow-hidden border-r border-white/5 chrome-bar transition-colors duration-1000`}>
      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ${searchOpen ? "flex-1 min-h-0" : ""}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <button
            type="button"
            onClick={navigateHome}
            className="flex items-center"
            aria-label={t("nav.home")}
          >
            <BrandLogo showLabel markClassName="h-7 w-7" />
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/78 hover:bg-white/10 hover:text-white"
              title={t("sidebar.yourLibrary")}
              onClick={() => setCollapsed(true)}
            >
              <ChevronsLeft className="h-5 w-5" absoluteStrokeWidth />
            </Button>
            <SidebarOverflowMenu
              align="end"
              buttonClassName="h-9 w-9 text-white/78 hover:bg-white/10 hover:text-white"
            />
          </div>
        </div>

        {!isFullSearchPage && (
          <div
            className="relative h-14 cursor-text overflow-hidden border-b border-white/10"
            onClick={() => setSearchOpen(true)}
          >
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundColor: "hsl(var(--player-waveform))",
                transform: searchOpen ? "translateX(0%)" : "translateX(-100%)",
                transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)",
              }}
            />

            <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                  <Search className={`h-5 w-5 ${searchOpen ? "text-black" : "text-white/78"}`} />
                </span>
                {searchOpen ? (
                  <>
                    <Input
                      ref={inputRef}
                      placeholder={t("sidebar.searchPlaceholder")}
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          const nextQuery = query.trim();
                          if (nextQuery) {
                            navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
                            setSearchOpen(false);
                          } else {
                            handleSearch(query);
                          }
                        }
                        if (event.key === "Escape") closeSearch();
                      }}
                      className="h-auto min-w-0 border-0 bg-transparent p-0 text-[0.95rem] font-medium leading-none text-black placeholder:text-black/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black" />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-black"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeSearch();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="flex-1 text-[0.92rem] text-white/70">{t("nav.search")}</span>
                )}
              </div>

              <button
                type="button"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent transition-colors ${
                  location.pathname === "/browse"
                    ? searchOpen
                      ? "text-black"
                      : "text-white"
                    : searchOpen
                      ? "text-black/70 hover:text-black"
                      : "text-white/70 hover:text-white"
                }`}
                title={t("nav.browse")}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate("/browse");
                  setSearchOpen(false);
                }}
              >
                <div
                  style={{
                    transform: searchOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  <Compass className="h-5 w-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {sidebarMotionEnabled ? (
          <AnimatePresence mode="wait">
            {searchOpen && (
              <motion.div
                key="search-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <ScrollArea className="sidebar-scroll-area flex-1">
                  <Suspense fallback={<div className="px-4 py-4 text-xs text-white/45">{t("sidebar.loadingSearch")}</div>}>
                    <LazySidebarSearchResults />
                  </Suspense>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        ) : searchOpen ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="sidebar-scroll-area flex-1">
              <Suspense fallback={<div className="px-4 py-4 text-xs text-white/45">{t("sidebar.loadingSearch")}</div>}>
                <LazySidebarSearchResults />
              </Suspense>
            </ScrollArea>
          </div>
        ) : null}
      </div>

      <div className={`relative min-h-0 ${searchOpen ? "h-0 flex-0 overflow-hidden" : "flex flex-1 flex-col"}`}>
        <AnimatePresence mode="wait">
          {!searchOpen && (
            <motion.div
              key="library-section"
              initial={sidebarMotionEnabled ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={sidebarMotionEnabled ? { opacity: 0 } : undefined}
              transition={{ duration: sidebarMotionEnabled ? 0.15 : 0 }}
              className="absolute inset-0 flex flex-col"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex min-w-0 items-center gap-3 text-white">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <Library className="h-[22px] w-[22px]" />
                  </span>
                  <span className="truncate text-sm font-bold">{t("sidebar.yourLibrary")}</span>
                </div>
                {user && (
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/78 transition-all hover:bg-white/10 hover:text-white"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="flex w-full items-center border-b border-white/10 select-none">
                {libraryFilters.map((libraryFilter, index) => {
                  const active = filter === libraryFilter.value;

                  return (
                    <button
                      key={libraryFilter.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(active ? "all" : libraryFilter.value)}
                      className={`menu-sweep-hover group relative flex h-10 min-w-0 flex-1 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                        index > 0 ? "border-l border-white/5" : ""
                      } ${active ? "bg-[hsl(var(--player-waveform))] text-black" : "text-white/70 hover:text-black"}`}
                    >
                      {active ? (
                        <motion.span
                          layoutId={sidebarMotionEnabled ? "sidebar-library-filter" : undefined}
                          className="absolute inset-0 bg-[hsl(var(--player-waveform))]"
                        />
                      ) : null}
                      <span className="relative z-10 flex h-full min-w-0 w-full items-center justify-center truncate px-2">
                        {libraryFilter.label}
                        {active ? <X className="ml-1.5 h-3 w-3 opacity-60 transition-opacity hover:opacity-100" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex h-10 w-full shrink-0 items-center border-b border-white/5">
                {librarySearchOpen ? (
                  <div className="flex h-full w-full items-center gap-2 px-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center text-white/78">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      autoFocus
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                      placeholder={t("sidebar.searchLibraryPlaceholder")}
                      className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={() => {
                        setLibrarySearchOpen(false);
                        setLibrarySearch("");
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/78 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setLibrarySearchOpen(true)}
                      className="menu-sweep-hover flex h-full w-14 shrink-0 items-center justify-center border-r border-white/5 text-white/78 transition-colors hover:text-black"
                    >
                      <span className="flex h-7 w-7 items-center justify-center">
                        <Search className="h-4 w-4" />
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="menu-sweep-hover flex h-full min-w-0 flex-1 items-center justify-end gap-2.5 px-4 text-xs font-medium text-white/78 transition-colors outline-none hover:text-black">
                          <span className="truncate">{librarySort === "recents" ? t("sidebar.recents") : t("sidebar.alphabetical")}</span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
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
                    libraryItems.map((item) => {
                      const canAcceptPlaylistDrop = item.type === "liked" || (item.type === "playlist" && item.playlistKind === "user");
                      const canDragLibraryItem = item.type !== "artist";

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
                          onClick={item.onClick}
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
                    })
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
