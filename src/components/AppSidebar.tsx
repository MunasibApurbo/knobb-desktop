import { ChevronsLeft, Compass, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/BrandLogo";
import { useSidebarCollapsed } from "@/components/Layout";
import { LibraryCollection } from "@/components/library/LibraryCollection";
import { SidebarCollapsedRail } from "@/components/sidebar/SidebarCollapsedRail";
import { SidebarOverflowMenu } from "@/components/sidebar/SidebarOverflowMenu";
import { useSidebarLibraryItems } from "@/components/sidebar/useSidebarLibraryItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useFavoritePlaylists } from "@/hooks/useFavoritePlaylists";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { preloadRouteModule } from "@/lib/routePreload";
import { APP_HOME_PATH } from "@/lib/routes";

export function AppSidebar() {
  const { t } = useLanguage();
  const { likedSongs } = useLikedSongs();
  const { savedAlbums } = useSavedAlbums();
  const { favoriteArtists } = useFavoriteArtists();
  const { favoritePlaylists } = useFavoritePlaylists();
  const { playlists: userPlaylists } = usePlaylists();
  const { collapsed, expandPanel, setCollapsed } = useSidebarCollapsed();
  const { sidebarStyle } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const preloadBrowse = useCallback(() => {
    void preloadRouteModule("/browse");
  }, []);

  const preloadHome = useCallback(() => {
    void preloadRouteModule(APP_HOME_PATH);
  }, []);

  const navigateHome = useCallback(() => {
    try {
      window.localStorage.setItem("last-route", APP_HOME_PATH);
    } catch {
      // Ignore storage failures.
    }
    void preloadRouteModule(APP_HOME_PATH);
    navigate(APP_HOME_PATH);
  }, [navigate]);

  const navigateToSearchPage = useCallback((query?: string) => {
    const trimmedQuery = query?.trim() ?? "";
    setSidebarSearchOpen(false);
    setSidebarSearchQuery("");
    void preloadRouteModule("/search");
    navigate(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : "/search");
  }, [navigate]);

  useEffect(() => {
    if (!sidebarSearchOpen) return;
    inputRef.current?.focus();
  }, [sidebarSearchOpen]);

  useEffect(() => {
    if (location.pathname === "/search") {
      setSidebarSearchOpen(false);
      setSidebarSearchQuery("");
      return;
    }
  }, [location.pathname]);

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
  const sidebarRowActionButtonClassName =
    "menu-sweep-hover relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/78 transition-colors hover:text-white";

  if (collapsed) {
    return (
      <SidebarCollapsedRail
        expandPanel={expandPanel}
        items={compactLibraryItems}
        navigate={navigate}
        onOpenSearch={navigateToSearchPage}
      />
    );
  }

  return (
    <div className={`desktop-shell-sidebar sidebar-shell sidebar-shell-${sidebarStyle} shell-black-chrome relative isolate flex h-full w-full flex-col overflow-hidden chrome-bar transition-colors duration-1000`}>
      <div className="flex h-16 items-center justify-between px-4">
        <button
          type="button"
          onClick={navigateHome}
          onMouseEnter={preloadHome}
          onFocus={preloadHome}
          onPointerDown={preloadHome}
          className="flex items-center"
          aria-label={t("nav.home")}
        >
          <BrandLogo showLabel markClassName="h-7 w-7" />
        </button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className={sidebarRowActionButtonClassName}
            title={t("sidebar.yourLibrary")}
            onClick={() => setCollapsed(true)}
          >
            <ChevronsLeft className="h-5 w-5" absoluteStrokeWidth />
          </Button>
          <SidebarOverflowMenu
            align="end"
            buttonClassName={sidebarRowActionButtonClassName}
          />
        </div>
      </div>

      {!isFullSearchPage ? (
        <div className="relative flex h-16 items-center gap-2 px-4">
          {sidebarSearchOpen ? (
            <div
              className="group relative flex h-11 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full px-4 text-black"
              onMouseEnter={() => void preloadRouteModule("/search")}
            >
              <span
                className="absolute inset-0"
                style={{ backgroundColor: "hsl(var(--player-waveform))" }}
                aria-hidden="true"
              />
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                <Search className="h-5 w-5" />
              </span>
              <Input
                ref={inputRef}
                value={sidebarSearchQuery}
                onChange={(event) => setSidebarSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    navigateToSearchPage(sidebarSearchQuery);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSidebarSearchOpen(false);
                    setSidebarSearchQuery("");
                  }
                }}
                placeholder={t("nav.search")}
                className="relative z-10 h-auto min-w-0 border-0 bg-transparent p-0 text-sm font-semibold leading-none text-black placeholder:text-black/60 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <button
                type="button"
                className="menu-sweep-hover relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/10 hover:text-black"
                onClick={() => {
                  setSidebarSearchOpen(false);
                  setSidebarSearchQuery("");
                }}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="menu-sweep-hover group relative flex h-11 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full px-4 text-left text-white/74 transition-colors hover:text-black"
              onClick={() => setSidebarSearchOpen(true)}
              onMouseEnter={() => void preloadRouteModule("/search")}
              onFocus={() => void preloadRouteModule("/search")}
              onPointerDown={() => void preloadRouteModule("/search")}
              aria-label={t("nav.search")}
            >
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                <Search className="h-5 w-5" />
              </span>
              <span className="relative z-10 min-w-0 flex-1 truncate text-sm font-semibold leading-none">
                {t("nav.search")}
              </span>
            </button>
          )}

          <button
            type="button"
            className={`menu-sweep-hover relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors ${
              location.pathname === "/browse"
                ? sidebarSearchOpen
                  ? "text-black"
                  : "text-white"
                : sidebarSearchOpen
                  ? "text-black/70 hover:text-black"
                  : "text-white/70 hover:text-white"
            }`}
            title={t("nav.browse")}
            onClick={() => {
              setSidebarSearchOpen(false);
              void preloadRouteModule("/browse");
              navigate("/browse");
            }}
            onMouseEnter={preloadBrowse}
            onFocus={preloadBrowse}
            onPointerDown={preloadBrowse}
          >
            <Compass className="h-5 w-5" absoluteStrokeWidth />
          </button>
        </div>
      ) : null}

      <LibraryCollection className="min-h-0 flex-1" />
    </div>
  );
}
