import { Album, Compass, HardDrive, Heart, Library, List, Music2, Search } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarOverflowMenu } from "@/components/sidebar/SidebarOverflowMenu";
import type { SidebarLibraryItem } from "@/components/sidebar/sidebarTypes";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { APP_HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

type SidebarCollapsedRailProps = {
  expandPanel: () => void;
  navigate: NavigateFunction;
  items: SidebarLibraryItem[];
  onOpenSearch: () => void;
};

export function SidebarCollapsedRail({
  expandPanel,
  items,
  navigate,
  onOpenSearch,
}: SidebarCollapsedRailProps) {
  const location = useLocation();
  const { t } = useLanguage();
  const { sidebarStyle } = useSettings();
  const navigateHome = () => {
    try {
      window.localStorage.setItem("last-route", APP_HOME_PATH);
    } catch {
      // Ignore storage failures.
    }
    navigate(APP_HOME_PATH);
  };
  const railIconClassName = "sidebar-rail-icon h-5 w-5 shrink-0";
  const iconRowClass = (active = false) =>
    cn(
      "sidebar-rail-button flex h-16 w-full items-center justify-center border-b border-white/5 bg-transparent outline-none",
      active ? "text-[hsl(var(--player-waveform))]" : "text-white/70",
    );
  const iconInnerClass = (active = false) =>
    cn(
      "menu-sweep-hover relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md transition-colors",
      active
        ? "text-[hsl(var(--player-waveform))]"
        : "group-hover:text-white group-focus-visible:text-white",
    );

  return (
    <div className={`desktop-shell-sidebar sidebar-collapsed-rail sidebar-shell sidebar-shell-${sidebarStyle} relative isolate flex h-full w-full flex-col gap-0 overflow-hidden border-r border-white/5 chrome-bar transition-colors duration-1000`}>
      <div className="flex flex-col items-center border-b border-white/10">
        <button
          type="button"
          onClick={navigateHome}
          className={cn(iconRowClass(location.pathname === APP_HOME_PATH), "group")}
          title={t("nav.home")}
          aria-label={t("nav.home")}
        >
          <div className={iconInnerClass(location.pathname === APP_HOME_PATH)}>
            <BrandLogo
              markClassName={cn("sidebar-rail-logo h-[22px] w-[22px]")}
            />
          </div>
        </button>
        <button
          onClick={() => {
            onOpenSearch();
            expandPanel();
          }}
          className={cn(iconRowClass(location.pathname === "/search"), "group")}
          title={t("nav.search")}
        >
          <div className={iconInnerClass(location.pathname === "/search")}>
            <Search className={railIconClassName} absoluteStrokeWidth />
          </div>
        </button>
        <button
          onClick={() => {
            navigate("/browse");
            expandPanel();
          }}
          className={cn(iconRowClass(location.pathname === "/browse"), "group")}
          title={t("nav.browse")}
        >
          <div className={iconInnerClass(location.pathname === "/browse")}>
            <Compass className={railIconClassName} absoluteStrokeWidth />
          </div>
        </button>
        <div className="flex h-16 w-full items-center justify-center border-b border-white/5 bg-transparent p-0">
          <SidebarOverflowMenu
            align="start"
            buttonClassName="sidebar-rail-button menu-sweep-hover relative h-9 w-9 overflow-hidden rounded-md bg-transparent p-0 flex items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:text-white focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!h-5 [&_svg]:!w-5"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
        <button
          type="button"
          onClick={expandPanel}
          className="sidebar-rail-button group relative flex h-16 w-full shrink-0 items-center justify-center border-b border-white/10 bg-transparent text-white/70 transition-colors outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          title={t("sidebar.yourLibrary")}
        >
          <div className="menu-sweep-hover relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md transition-colors group-hover:text-white group-focus-visible:text-white">
            <List className={railIconClassName} absoluteStrokeWidth />
          </div>
        </button>
        <ScrollArea forceVisibleScrollbar className="sidebar-scroll-area w-full flex-1">
          <div className="flex flex-col items-center gap-2 px-2 pb-3">
            {items.map((item) => (
              <CollapsedLibraryTile key={item.id} item={item} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function CollapsedLibraryTile({ item }: { item: SidebarLibraryItem }) {
  const resolvedArtistImage = useResolvedArtistImage(item.artistId, item.imageUrl, item.artistId ? item.title : undefined);
  const imageUrl = item.artistId ? resolvedArtistImage : item.imageUrl;
  const isArtist = item.type === "artist";
  const isLiked = item.type === "liked";
  const isAlbum = item.type === "album";

  return (
    <button
      type="button"
      onClick={item.onClick}
      title={item.title}
      className={`sidebar-collapsed-tile content-visibility-tile group relative shrink-0 transition-all duration-200 ${isArtist ? "website-avatar h-14 w-14 rounded-full" : "h-12 w-12 rounded-xl"
        } ${item.active
          ? "scale-[1.02] ring-1 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.32)]"
          : "hover:scale-[1.03] hover:brightness-110"
        }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${isArtist ? "website-avatar rounded-full" : "rounded-xl"}`}
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      ) : isLiked ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(145deg, hsl(254 84% 67%), hsl(198 78% 71%))" }}
        >
          <Heart className="h-5 w-5 fill-white text-white" />
        </div>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-white/[0.08] ${isArtist ? "website-avatar rounded-full" : "rounded-xl"
            }`}
        >
          {isAlbum ? (
            <Album className="h-5 w-5 text-white/70" />
          ) : item.type === "local" ? (
            <HardDrive className="h-5 w-5 text-white/70" />
          ) : item.type === "playlist" ? (
            <Library className="h-5 w-5 text-white/70" />
          ) : (
            <Music2 className="h-5 w-5 text-white/70" />
          )}
        </div>
      )}

      {!isArtist && !isLiked ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 rounded-b-xl bg-gradient-to-t from-black/60 to-transparent" />
      ) : null}

      {item.active ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute -left-1 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[hsl(var(--player-waveform))]" />
        </div>
      ) : null}
    </button>
  );
}
