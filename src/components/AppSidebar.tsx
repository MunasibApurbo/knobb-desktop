import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, Compass, Loader2, Search, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/BrandLogo";
import { useSidebarCollapsed } from "@/components/Layout";
import { LibraryCollection } from "@/components/library/LibraryCollection";
import { SidebarCollapsedRail } from "@/components/sidebar/SidebarCollapsedRail";
import { SidebarOverflowMenu } from "@/components/sidebar/SidebarOverflowMenu";
import { useSidebarLibraryItems } from "@/components/sidebar/useSidebarLibraryItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useSearch } from "@/contexts/SearchContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { APP_HOME_PATH } from "@/lib/routes";

const LazySidebarSearchResults = lazy(async () => {
  const module = await import("@/components/sidebar/SidebarSearchResults");
  return { default: module.SidebarSearchResults };
});

export function AppSidebar() {
  const { t } = useLanguage();
  const { likedSongs } = useLikedSongs();
  const { savedAlbums } = useSavedAlbums();
  const { favoriteArtists } = useFavoriteArtists();
  const { favoritePlaylists } = useFavoritePlaylists();
  const { playlists: userPlaylists } = usePlaylists();
  const { searchOpen, setSearchOpen, query, onQueryChange, isSearching, closeSearch, handleSearch } = useSearch();
  const { collapsed, expandPanel, setCollapsed } = useSidebarCollapsed();
  const { motionEnabled: sidebarMotionEnabled } = useMotionPreferences();
  const { sidebarStyle } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const navigateHome = useCallback(() => {
    try {
      window.localStorage.setItem("last-route", APP_HOME_PATH);
    } catch {
      // Ignore storage failures.
    }
    navigate(APP_HOME_PATH);
  }, [navigate]);

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

  const isFullSearchPage = location.pathname === "/search";

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
      <div className={`flex flex-col overflow-hidden transition-all duration-300 ${searchOpen ? "flex-1 min-h-0" : ""}`}>
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
              className="menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md text-white/78 transition-colors hover:text-white"
              title={t("sidebar.yourLibrary")}
              onClick={() => setCollapsed(true)}
            >
              <ChevronsLeft className="h-5 w-5" absoluteStrokeWidth />
            </Button>
            <SidebarOverflowMenu
              align="end"
              buttonClassName="menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md text-white/78 transition-colors hover:text-white"
            />
          </div>
        </div>

        {!isFullSearchPage ? (
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
                    {isSearching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black" /> : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 rounded-full text-black hover:bg-black/10"
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
                className={`menu-sweep-hover relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md transition-colors ${location.pathname === "/browse"
                  ? searchOpen
                    ? "text-black hover:text-black"
                    : "text-white hover:text-white"
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
        ) : null}

        {sidebarMotionEnabled ? (
          <AnimatePresence mode="wait">
            {searchOpen ? (
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
            ) : null}
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
          {!searchOpen ? (
            <motion.div
              key="library-section"
              initial={sidebarMotionEnabled ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={sidebarMotionEnabled ? { opacity: 0 } : undefined}
              transition={{ duration: sidebarMotionEnabled ? 0.15 : 0 }}
              className="absolute inset-0 flex flex-col"
            >
              <LibraryCollection
                mode="desktop"
                className="absolute inset-0 flex flex-col"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
