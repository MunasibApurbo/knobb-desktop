import {
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Compass, FileSpreadsheet, Shapes, type LucideIcon } from "lucide-react";

import { ArtistCardWrapper, HomeAlbumCard, PlaylistCard, TrackCard } from "@/components/home/HomeMediaCards";
import { ArtistGridDirectoryView } from "@/components/artistgrid/ArtistGridDirectoryView";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useBrowseHotNew, type BrowseHotNewSection } from "@/hooks/useBrowseHotNew";
import { useArtistGridDirectory } from "@/hooks/useArtistGridDirectory";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { useCarousel } from "@/hooks/useCarousel";
import { CarouselSection } from "@/components/carousel/CarouselSection";
import { APP_HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { useTidalGenres } from "@/hooks/useTidalGenres";

type BrowseTab = "hotNew" | "artistGrid";

type TabMeta = {
  label: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
};

const TAB_META: Record<BrowseTab, TabMeta> = {
  hotNew: {
    label: "Hot & New",
    icon: Compass,
    emptyTitle: "No hot and new data",
    emptyDescription: "This section is available but currently has no discovery items to show.",
  },
  artistGrid: {
    label: "ArtistGrid Archives",
    icon: FileSpreadsheet,
    emptyTitle: "No ArtistGrid archives",
    emptyDescription: "ArtistGrid archives are available here once tracker data is ready to display.",
  },
};


function BrowseTabButton({
  tab,
  active,
  count,
  onClick,
}: {
  tab: BrowseTab;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`menu-sweep-hover group relative flex h-12 min-w-0 flex-1 items-center justify-between overflow-hidden rounded-[var(--control-radius)] border px-3 text-left text-sm font-semibold transition-colors md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:px-4 last:md:border-r-0 ${active ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black" : "border-white/10 bg-transparent text-white/72 hover:text-black"
        }`}
      style={active ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
    >
      <div className="relative z-10 flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4" />
        <span className="truncate">{meta.label}</span>
      </div>
      <div className="relative z-10 text-xs uppercase tracking-[0.18em] opacity-65">{count}</div>
    </button>
  );
}

function BrowseSectionHeader({
  title,
  showPager,
  onPageBack,
  onPageForward,
  canPageBack,
  canPageForward,
  onViewAll,
}: {
  title: string;
  showPager?: boolean;
  onPageBack?: () => void;
  onPageForward?: () => void;
  canPageBack?: boolean;
  canPageForward?: boolean;
  onViewAll?: () => void;
}) {
  return (
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between">
      <h2 className="home-section-title text-white">{title}</h2>
      <div className="home-section-actions flex items-center gap-2">
        {showPager && (
          <>
            <button
              type="button"
              onClick={onPageBack}
              disabled={!canPageBack}
              className="home-section-icon-button"
              aria-label={`Previous ${title}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onPageForward}
              disabled={!canPageForward}
              className="home-section-icon-button"
              aria-label={`Next ${title}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="home-section-view-all"
          >
            View all
          </button>
        )}
      </div>
    </div>
  );
}

function getPlaylistCoverUrl(image?: string | null, squareImage?: string | null) {
  const candidate = squareImage || image;
  return candidate ? getTidalImageUrl(candidate, "750x750") : "/placeholder.svg";
}

function isVisibleShelfItemPriority(
  currentPage: number,
  pageSize: number,
  itemIndex: number,
) {
  const visibleStart = currentPage * pageSize;
  const visibleEnd = visibleStart + pageSize;

  return itemIndex >= visibleStart && itemIndex < visibleEnd;
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { favoriteArtists } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const { cardSize } = useSettings();
  const { containerRef, collapsedCount: cardCount } = useResponsiveMediaCardCount(cardSize);
  const [activeTab, setActiveTab] = useState<BrowseTab>("hotNew");
  const carousel = useCarousel(cardCount);
  const denseBrowseShelf = cardCount >= 6;
  const { genres } = useTidalGenres();
  const {
    artists: artistGridAllArtists,
    error: artistGridError,
    loaded: artistGridLoaded,
    sortedArtists: artistGridArtists,
  } = useArtistGridDirectory();
  const openGenre = (genreId?: string) => {
    navigate(genreId ? `/genre?genre=${genreId}` : "/genre");
  };

  const {
    error: homeError,
    loaded: homeLoaded,
    newReleases,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    recentTracks,
  } = useHomeFeeds({
    favoriteArtists,
    getHistory,
    userId: user?.id,
  });

  const {
    error: browseError,
    loaded: browseLoaded,
    sections: hotNewSections,
  } = useBrowseHotNew({
    baseLoaded: homeLoaded,
    newReleases,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    recentTracks,
  });

  /* ── Section renderer for a hot-new section ── */
  function renderHotNewSection(section: BrowseHotNewSection) {
    const sectionKey = `browse-${section.id}`;

    if (section.type === "albums") {
      const currentPage = carousel.getCurrentPage(sectionKey, section.items.length);
      return (
        <section key={section.id} className={cn("browse-section home-motion-section page-panel", PANEL_SURFACE_CLASS)}>
          <BrowseSectionHeader
            title={section.title}
            showPager={carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            renderItem={(album, index) => (
              <HomeAlbumCard
                key={album.id}
                album={album}
                saved={isAlbumSaved(album.id)}
                onToggleSave={() => {
                  void toggleSavedAlbum({
                    albumId: album.id,
                    albumTitle: album.title,
                    albumArtist: album.artist || "Various Artists",
                    albumCoverUrl: album.coverUrl,
                    albumYear: album.releaseDate ? new Date(album.releaseDate).getFullYear() : null,
                  });
                }}
                isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index,)}
                lightweight={denseBrowseShelf}
              />
            )}
          />
        </section>
      );
    }

    if (section.type === "artists") {
      const currentPage = carousel.getCurrentPage(sectionKey, section.items.length);
      return (
        <section key={section.id} className={cn("browse-section home-motion-section page-panel", PANEL_SURFACE_CLASS)}>
          <BrowseSectionHeader
            title={section.title}
            showPager={carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            renderItem={(artist, index) => (
              <ArtistCardWrapper
                key={artist.id}
                artist={artist}
                isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
                lightweight={denseBrowseShelf}
              />
            )}
          />
        </section>
      );
    }

    if (section.type === "tracks" || section.type === "videos") {
      const currentPage = carousel.getCurrentPage(sectionKey, section.items.length);
      return (
        <section key={section.id} className={cn("browse-section home-motion-section page-panel", PANEL_SURFACE_CLASS)}>
          <BrowseSectionHeader
            title={section.title}
            showPager={carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            renderItem={(track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                tracks={section.items}
                liked={isLiked(track.id)}
                onToggleLike={() => { void toggleLike(track); }}
                isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
                lightweight={denseBrowseShelf}
              />
            )}
          />
        </section>
      );
    }

    // playlists
    const playlistItems = section.items as Extract<BrowseHotNewSection, { type: "playlists" }>["items"];
    const currentPage = carousel.getCurrentPage(sectionKey, playlistItems.length);

    return (
      <section key={section.id} className={cn("browse-section home-motion-section page-panel", PANEL_SURFACE_CLASS)}>
        <BrowseSectionHeader
          title={section.title}
          showPager={carousel.shouldShowPager(sectionKey, playlistItems.length)}
          onPageBack={() => carousel.moveSectionPage(sectionKey, playlistItems.length, -1)}
          onPageForward={() => carousel.moveSectionPage(sectionKey, playlistItems.length, 1)}
          canPageBack={carousel.getCurrentPage(sectionKey, playlistItems.length) > 0}
          canPageForward={carousel.getCurrentPage(sectionKey, playlistItems.length) < carousel.getPageCount(playlistItems.length) - 1}
        />
        <CarouselSection
          items={playlistItems}
          sectionKey={sectionKey}
          carousel={carousel}
          renderItem={(playlist, index) => (
            <PlaylistCard
              key={playlist.uuid}
              playlistId={playlist.uuid}
              title={playlist.title}
              coverUrl={getPlaylistCoverUrl(playlist.image, playlist.squareImage)}
              trackCount={playlist.numberOfTracks}
              isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
              lightweight={denseBrowseShelf}
            />
          )}
        />
      </section>
    );
  }

  const hotNewSectionsWithoutGenres = useMemo(
    () => hotNewSections.filter((section) => section.type !== "genres" && section.id !== "editors-picks"),
    [hotNewSections],
  );

  const hotNewCount = useMemo(
    () => genres.length + hotNewSectionsWithoutGenres.reduce((sum, section) => sum + section.items.length, 0),
    [genres.length, hotNewSectionsWithoutGenres],
  );
  const artistGridCount = artistGridArtists.length;

  const activeMeta = TAB_META[activeTab];
  const hasHotNewContent = genres.length > 0 || hotNewSectionsWithoutGenres.length > 0;
  const hasArtistGridContent = artistGridArtists.length > 0 || Boolean(artistGridError);
  const hasBrowseContent = activeTab === "artistGrid"
    ? hasArtistGridContent || !artistGridLoaded
    : hasHotNewContent || !browseLoaded;

  return (
    <PageTransition>
      <div ref={containerRef} className="page-shell home-page-surface bg-black hover-desaturate-page">
        <section className={cn("browse-section page-panel", PANEL_SURFACE_CLASS)}>
          <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Browse</p>
                <h1 className="text-[2rem] font-black tracking-tight text-white md:text-5xl">{activeMeta.label}</h1>
              </div>
              {activeTab === "artistGrid" ? (
                <Button
                  variant="outline"
                  onClick={() => window.open("https://artistgrid.cx", "_blank", "noopener,noreferrer")}
                  className="menu-sweep-hover relative overflow-hidden gap-2 self-start border-white/12 bg-white/[0.03] text-white/86 hover:border-white/12 hover:text-black md:self-auto"
                >
                  Open Original
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              ) : genres.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => openGenre()}
                  className="menu-sweep-hover relative overflow-hidden gap-2 self-start border-white/12 bg-white/[0.03] text-white/86 hover:border-white/12 hover:text-black md:self-auto"
                >
                  Genres
                  <Shapes className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex px-3 py-3 md:flex md:gap-0 md:px-0 md:py-0">
            <BrowseTabButton tab="hotNew" active={activeTab === "hotNew"} count={hotNewCount} onClick={() => setActiveTab("hotNew")} />
            <BrowseTabButton
              tab="artistGrid"
              active={activeTab === "artistGrid"}
              count={artistGridCount}
              onClick={() => setActiveTab("artistGrid")}
            />
          </div>
        </section>

        <div className="page-substack">
          {hasBrowseContent ? (
            activeTab === "artistGrid" ? (
              <ArtistGridDirectoryView
                artists={artistGridAllArtists}
                sortedArtists={artistGridArtists}
                loaded={artistGridLoaded}
                error={artistGridError}
              />
            ) : (
              <>
                {hotNewSectionsWithoutGenres.map((section) => renderHotNewSection(section))}
              </>
            )
          ) : (
            <section className={cn("browse-section page-panel", PANEL_SURFACE_CLASS, "px-5 py-12 md:px-6")}>
              <div className="flex flex-col gap-5 bg-white/[0.03] px-6 py-7 md:flex-row md:items-end md:justify-between">
                <div className="max-w-xl">
                  <h4 className="text-2xl font-black tracking-tight text-white">{activeMeta.emptyTitle}</h4>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {activeTab === "hotNew" && (homeError || browseError)
                      ? "Hot & New could not be loaded right now."
                      : activeMeta.emptyDescription}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(activeTab === "artistGrid" ? "/browse/artistgrid" : APP_HOME_PATH)}
                  className="menu-sweep-hover relative overflow-hidden gap-2"
                >
                  {activeTab === "artistGrid" ? "Open ArtistGrid" : "Go Home"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
