import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type DragEvent,
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
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
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

const LazyPlaylistCreateDialog = lazy(async () => {
  const module = await import("@/components/PlaylistCreateDialog");
  return { default: module.PlaylistCreateDialog };
});

type LibraryCollectionProps = {
  className?: string;
  mode: "desktop" | "mobile";
  showSettingsAction?: boolean;
};

export function LibraryCollection({
  className,
  mode,
  showSettingsAction = false,
}: LibraryCollectionProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);
  const { libraryItemStyle, librarySortDefault } = useSettings();
  const [librarySort, setLibrarySort] = useState<"recents" | "alphabetical">(() => librarySortDefault);
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
  const { motionEnabled } = useMotionPreferences();
  const navigate = useNavigate();
  const location = useLocation();

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

  const renderLibraryItem = useCallback((item: (typeof libraryItems)[number]) => {
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
  }, [
    dropTargetItemId,
    handleDeleteLibraryPlaylist,
    handleLikedSongsDrop,
    handlePlaylistCardDragOver,
    handlePlaylistCardDrop,
    libraryItemStyle,
    likedSongs,
    localFiles,
    userPlaylists,
  ]);

  const actionButtonClassName = mode === "mobile"
    ? "menu-sweep-hover relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[var(--mobile-control-radius)] text-white/78 transition-all hover:text-white"
    : "menu-sweep-hover relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md text-white/78 transition-all hover:text-white";

  const quickAccessItems = libraryItems.filter((item) => item.type === "liked" || item.type === "local");
  const playlistItems = libraryItems.filter((item) => item.type === "playlist");
  const albumItems = libraryItems.filter((item) => item.type === "album");
  const artistItems = libraryItems.filter((item) => item.type === "artist");
  const hasScopedLibraryResults = filter !== "all" || librarySearch.trim().length > 0;

  const renderLibraryGroup = (
    title: string,
    subtitle: string,
    items: typeof libraryItems,
    options?: { className?: string },
  ) => {
    if (items.length === 0) return null;

    return (
      <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.04]">
        <div className="px-4 pb-3 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{subtitle}</p>
          <h2 className="mt-1 text-[1.2rem] font-black tracking-[-0.04em] text-white">{title}</h2>
        </div>
        <div className={options?.className ?? "grid gap-2 px-2 pb-2"}>
          {items.map((item) => renderLibraryItem(item))}
        </div>
      </section>
    );
  };

  if (mode === "mobile") {
    return (
      <div className={className}>
        <section className="mobile-page-panel relative overflow-hidden border border-white/10 bg-white/[0.04]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(252,112,88,0.24),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(81,143,255,0.2),transparent_24%),linear-gradient(180deg,#111111,#040404)]" />
          <div className="relative z-10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">{t("nav.library")}</p>
                <h1 className="mt-2 text-[1.85rem] font-black tracking-[-0.06em] text-white">Your collection, in color.</h1>
                <p className="mt-2 max-w-[32rem] text-sm leading-6 text-white/62">
                  Start with your strongest signals, then move into playlists, albums, and artists without losing depth.
                </p>
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

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-[20px] border border-white/10 bg-black/24 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Liked</p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{likedSongs.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/24 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Local</p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{localFiles.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/24 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Playlists</p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{playlistItems.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/24 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Artists</p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{artistItems.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.04]">
          <div className="flex w-full items-center select-none border-b border-white/10">
            {libraryFilters.map((libraryFilter, index) => {
              const active = filter === libraryFilter.value;

              return (
                <button
                  key={libraryFilter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(active ? "all" : libraryFilter.value)}
                  className={`menu-sweep-hover group relative flex h-11 min-w-0 flex-1 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${index > 0 ? "border-l border-white/5" : ""} ${active ? "bg-[hsl(var(--player-waveform))] text-black" : "text-white/72 hover:text-black"}`}
                >
                  {active ? (
                    <motion.span
                      layoutId={motionEnabled ? `library-filter-${mode}` : undefined}
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

          <div className="flex min-h-12 items-center gap-2 border-b border-white/10 px-3 py-2">
            {librarySearchOpen ? (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/72">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  autoFocus
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder={t("sidebar.searchLibraryPlaceholder")}
                  className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLibrarySearchOpen(false);
                    setLibrarySearch("");
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/72 hover:text-white"
                  aria-label="Close library search"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLibrarySearchOpen(true)}
                  className="menu-sweep-hover flex h-10 flex-1 items-center gap-3 overflow-hidden rounded-[18px] border border-white/10 px-3 text-sm font-medium text-white/78 transition-colors hover:text-black"
                  aria-label={t("sidebar.searchLibraryPlaceholder")}
                >
                  <Search className="h-4 w-4" />
                  <span>{t("sidebar.searchLibraryPlaceholder")}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="menu-sweep-hover flex h-10 min-w-[9rem] items-center justify-between gap-2 overflow-hidden rounded-[18px] border border-white/10 px-3 text-sm font-medium text-white/78 transition-colors hover:text-black"
                      aria-label="Sort library"
                    >
                      <span className="truncate">{librarySort === "recents" ? t("sidebar.recents") : t("sidebar.alphabetical")}</span>
                      <List className="h-4 w-4 shrink-0" />
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
        </section>

        <ScrollArea forceVisibleScrollbar className="sidebar-scroll-area flex-1">
          <div className="space-y-3 pb-2">
            {libraryItems.length === 0 ? (
              <section className="mobile-page-panel border border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm text-muted-foreground">
                {t("sidebar.noMatchesFound")}
              </section>
            ) : hasScopedLibraryResults ? (
              renderLibraryGroup("Filtered Results", "Library", libraryItems)
            ) : (
              <>
                {renderLibraryGroup("Quick Access", "Start here", quickAccessItems, {
                  className: "grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2",
                })}
                {renderLibraryGroup("Playlists", "Saved and created", playlistItems)}
                {renderLibraryGroup("Albums", "Full projects", albumItems)}
                {renderLibraryGroup("Favorite Artists", "Profiles you keep close", artistItems)}
              </>
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

  return (
    <div className={className}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-3 text-white">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <Library className="h-[22px] w-[22px]" />
          </span>
          <span className="truncate text-sm font-bold">{t("sidebar.yourLibrary")}</span>
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

      <div className="flex w-full items-center border-b border-white/10 select-none">
        {libraryFilters.map((libraryFilter, index) => {
          const active = filter === libraryFilter.value;

          return (
            <button
              key={libraryFilter.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? "all" : libraryFilter.value)}
              className={`menu-sweep-hover group relative flex h-10 min-w-0 flex-1 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${index > 0 ? "border-l border-white/5" : ""
                } ${active ? "bg-[hsl(var(--player-waveform))] text-black" : "text-white/70 hover:text-black"}`}
            >
              {active ? (
                <motion.span
                  layoutId={motionEnabled ? `library-filter-${mode}` : undefined}
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
              type="button"
              onClick={() => {
                setLibrarySearchOpen(false);
                setLibrarySearch("");
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/78 hover:text-white"
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
              className="menu-sweep-hover flex h-full w-14 shrink-0 items-center justify-center border-r border-white/5 text-white/78 transition-colors hover:text-black"
              aria-label={t("sidebar.searchLibraryPlaceholder")}
            >
              <span className="flex h-7 w-7 items-center justify-center">
                <Search className="h-4 w-4" />
              </span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="menu-sweep-hover flex h-full min-w-0 flex-1 items-center justify-end gap-2.5 px-4 text-xs font-medium text-white/78 transition-colors outline-none hover:text-black"
                  aria-label="Sort library"
                >
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
            libraryItems.map((item) => renderLibraryItem(item))
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
