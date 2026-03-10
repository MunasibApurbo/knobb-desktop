import {
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ArrowRight, ChevronLeft, ChevronRight, Compass, Disc3, ListMusic, Music2, RadioTower, Shapes, type LucideIcon } from "lucide-react";

import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { MediaCardShell } from "@/components/MediaCardShell";
import { MEDIA_CARD_BODY_CLASS } from "@/components/mediaCardStyles";
import { PageTransition } from "@/components/PageTransition";
import { UnreleasedArtistCard } from "@/components/unreleased/UnreleasedArtistCard";
import { Button } from "@/components/ui/button";
import { MediaCardSkeleton } from "@/components/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useBrowseHotNew, type BrowseHotNewSection } from "@/hooks/useBrowseHotNew";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { useUnreleasedArtists } from "@/hooks/useUnreleasedArtists";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import { PlaylistLink } from "@/components/PlaylistLink";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { useCarousel } from "@/hooks/useCarousel";
import { CarouselSection } from "@/components/carousel/CarouselSection";
import { BROWSE_GENRES } from "@/lib/browseGenres";
import { APP_HOME_PATH } from "@/lib/routes";
import {
  MOBILE_ACTION_BUTTON_CLASS,
  MOBILE_SECONDARY_BUTTON_CLASS,
  MobileExperiencePage,
  MobileHero,
  MobileMetaChip,
  MobileRail,
  MobileSection,
} from "@/components/mobile/MobileExperienceLayout";

type BrowseTab = "hotNew" | "unreleased";

type TabMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
};

const TAB_META: Record<BrowseTab, TabMeta> = {
  hotNew: {
    label: "Hot & New",
    description: "Monochrome-inspired picks plus personalized albums, artists, tracks, and playlists in the current Knobb browse layout.",
    icon: Compass,
    emptyTitle: "No hot and new data",
    emptyDescription: "This section is available but currently has no discovery items to show.",
  },
  unreleased: {
    label: "Unreleased",
    description: "ArtistGrid-powered archive data, surfaced directly inside Browse so the unreleased library is no longer a dead tab.",
    icon: RadioTower,
    emptyTitle: "No unreleased data",
    emptyDescription: "The unreleased archive is currently unavailable.",
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
      className={`menu-sweep-hover group relative flex h-12 min-w-0 flex-1 items-center justify-between overflow-hidden rounded-[var(--mobile-control-radius)] border px-3 text-left text-sm font-semibold transition-colors md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:px-4 last:md:border-r-0 ${active ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black" : "border-white/10 bg-transparent text-white/72 hover:text-black"
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
  meta,
  showPager,
  onPageBack,
  onPageForward,
  canPageBack,
  canPageForward,
  onViewAll,
}: {
  title: string;
  meta?: string;
  showPager?: boolean;
  onPageBack?: () => void;
  onPageForward?: () => void;
  canPageBack?: boolean;
  canPageForward?: boolean;
  onViewAll?: () => void;
}) {
  return (
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between px-4 py-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-3">
        {showPager && (
          <>
            <button
              type="button"
              onClick={onPageBack}
              disabled={!canPageBack}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
              aria-label={`Previous ${title}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onPageForward}
              disabled={!canPageForward}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
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
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </button>
        )}
      </div>
    </div>
  );
}

function BrowseSkeleton({ cardCount }: { cardCount: number }) {
  return (
    <div className="space-y-0">
      <div className="home-section-header flex items-center justify-between px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48 max-w-[58vw]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div
        className="home-section-grid hover-desaturate-grid home-section-carousel-frame"
        style={{ "--home-row-columns": Math.max(1, cardCount) } as React.CSSProperties}
      >
        <div className="home-section-carousel-track">
          <div className="home-section-carousel-page">
            {Array.from({ length: cardCount }).map((_, index) => (
              <MediaCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlaylistCoverUrl(image?: string | null, squareImage?: string | null) {
  const candidate = squareImage || image;
  return candidate ? getTidalImageUrl(candidate, "750x750") : "/placeholder.svg";
}

function BrowsePlaylistCard({
  playlistId,
  title,
  coverUrl,
  trackCount,
  onSelect,
}: {
  playlistId: string;
  title: string;
  coverUrl: string;
  trackCount: number;
  onSelect: () => void;
}) {
  return (
    <MediaCardShell onClick={onSelect}>
      <div className="aspect-square overflow-hidden bg-white/[0.04]">
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          onError={(event) => {
            (event.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      </div>
      <div className={`${MEDIA_CARD_BODY_CLASS} relative`}>
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="shell-artwork-wash">
            <img src={coverUrl} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
        <PlaylistLink title={title} playlistId={playlistId} className="block truncate text-sm font-semibold text-white" />
        <p className="truncate text-sm text-white/55">{trackCount} tracks</p>
      </div>
    </MediaCardShell>
  );
}

function BrowseGenresSection({
  items,
  onSelectGenre,
}: {
  items: Array<{ id: string; label: string }>;
  onSelectGenre: (genreId: string) => void;
}) {
  return (
    <section className="mobile-page-panel overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
      <div className="px-4 pb-2 pt-5 md:px-5 md:pt-6">
        <h2 className="text-2xl font-black tracking-tight text-white md:text-[2rem]">Genres</h2>
      </div>
      <div className="flex flex-wrap gap-3 px-4 pb-5 pt-3 md:px-5 md:pb-6">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectGenre(item.id)}
            className="menu-sweep-hover group relative min-h-[4.5rem] overflow-hidden rounded-[var(--surface-radius-md)] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_58%)] px-5 py-4 text-left text-base font-black tracking-tight text-white transition-[transform,color,border-color] duration-300 hover:scale-[1.01] hover:border-white/18 hover:text-black md:min-h-[4.75rem] md:text-[1.04rem]"
          >
            <span className="relative z-10 block">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { favoriteArtists } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const { cardSize } = useSettings();
  const { containerRef, collapsedCount: cardCount } = useResponsiveMediaCardCount(cardSize);
  const [activeTab, setActiveTab] = useState<BrowseTab>("hotNew");
  const carousel = useCarousel(cardCount);
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
  const {
    artists: unreleasedArtists,
    loading: unreleasedLoading,
    error: unreleasedError,
  } = useUnreleasedArtists();


  /* ── Section renderer for a hot-new section ── */
  function renderHotNewSection(section: BrowseHotNewSection) {
    const sectionKey = `browse-${section.id}`;

    if (section.type === "genres") {
      return <BrowseGenresSection key={section.id} items={section.items} onSelectGenre={openGenre} />;
    }

    if (section.type === "albums") {
      return (
        <section key={section.id} className="mobile-page-panel">
          <BrowseSectionHeader
            title={section.title}
            showPager={!isMobile && carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
            onViewAll={carousel.canViewAll(section.items.length) ? () => navigate(`/home-section/${section.id}`) : undefined}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            isMobile={isMobile}
            renderItem={(album) => (
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
              />
            )}
          />
        </section>
      );
    }

    if (section.type === "artists") {
      return (
        <section key={section.id} className="mobile-page-panel">
          <BrowseSectionHeader
            title={section.title}
            showPager={!isMobile && carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
            onViewAll={carousel.canViewAll(section.items.length) ? () => navigate(`/home-section/${section.id}`) : undefined}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            isMobile={isMobile}
            renderItem={(artist, index) => (
              <ArtistCardWrapper key={artist.id} artist={artist} isPriority={index < 5} />
            )}
          />
        </section>
      );
    }

    if (section.type === "tracks") {
      return (
        <section key={section.id} className="mobile-page-panel">
          <BrowseSectionHeader
            title={section.title}
            showPager={!isMobile && carousel.shouldShowPager(sectionKey, section.items.length)}
            onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
            onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
            canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
            canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
            onViewAll={carousel.canViewAll(section.items.length) ? () => navigate(`/home-section/${section.id}`) : undefined}
          />
          <CarouselSection
            items={section.items}
            sectionKey={sectionKey}
            carousel={carousel}
            isMobile={isMobile}
            renderItem={(track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                tracks={section.items}
                liked={isLiked(track.id)}
                onToggleLike={() => { void toggleLike(track); }}
                isPriority={index < 5}
              />
            )}
          />
        </section>
      );
    }

    // playlists
    return (
      <section key={section.id} className="mobile-page-panel">
        <BrowseSectionHeader
          title={section.title}
          showPager={!isMobile && carousel.shouldShowPager(sectionKey, section.items.length)}
          onPageBack={() => carousel.moveSectionPage(sectionKey, section.items.length, -1)}
          onPageForward={() => carousel.moveSectionPage(sectionKey, section.items.length, 1)}
          canPageBack={carousel.getCurrentPage(sectionKey, section.items.length) > 0}
          canPageForward={carousel.getCurrentPage(sectionKey, section.items.length) < carousel.getPageCount(section.items.length) - 1}
          onViewAll={carousel.canViewAll(section.items.length) ? () => navigate(`/home-section/${section.id}`) : undefined}
        />
        <CarouselSection
          items={section.items}
          sectionKey={sectionKey}
          carousel={carousel}
          isMobile={isMobile}
          renderItem={(playlist) => (
            <BrowsePlaylistCard
              key={playlist.uuid}
              playlistId={playlist.uuid}
              title={playlist.title}
              coverUrl={getPlaylistCoverUrl(playlist.image, playlist.squareImage)}
              trackCount={playlist.numberOfTracks}
              onSelect={() => navigate(`/playlist/${playlist.uuid}`)}
            />
          )}
        />
      </section>
    );
  }

  /* ── Render unreleased section ── */
  function renderUnreleasedSection(
    title: string,
    artists: import("@/lib/unreleasedApi").UnreleasedArtist[],
  ) {
    const sectionKey = `unreleased-${title.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <section className="mobile-page-panel">
        <BrowseSectionHeader
          title={title}
          showPager={!isMobile && carousel.shouldShowPager(sectionKey, artists.length)}
          onPageBack={() => carousel.moveSectionPage(sectionKey, artists.length, -1)}
          onPageForward={() => carousel.moveSectionPage(sectionKey, artists.length, 1)}
          canPageBack={carousel.getCurrentPage(sectionKey, artists.length) > 0}
          canPageForward={carousel.getCurrentPage(sectionKey, artists.length) < carousel.getPageCount(artists.length) - 1}
          onViewAll={carousel.canViewAll(artists.length) ? () => navigate("/unreleased") : undefined}
        />
        <CarouselSection
          items={artists}
          sectionKey={sectionKey}
          carousel={carousel}
          isMobile={isMobile}
          renderItem={(artist) => (
            <UnreleasedArtistCard
              key={artist.sheetId}
              artist={artist}
              onClick={() => navigate(`/unreleased/${artist.sheetId}`)}
            />
          )}
        />
      </section>
    );
  }

  const hotNewSectionsWithoutGenres = useMemo(
    () => hotNewSections.filter((section) => section.type !== "genres"),
    [hotNewSections],
  );

  const hotNewCounts = useMemo(() => {
    return hotNewSectionsWithoutGenres.reduce(
      (acc, section) => {
        acc.sections += 1;
        acc[section.type] += section.items.length;
        return acc;
      },
      {
        sections: BROWSE_GENRES.length > 0 ? 1 : 0,
        albums: 0,
        artists: 0,
        tracks: 0,
        playlists: 0,
        genres: BROWSE_GENRES.length,
      },
    );
  }, [hotNewSectionsWithoutGenres]);

  const hotNewCount = useMemo(
    () => BROWSE_GENRES.length + hotNewSectionsWithoutGenres.reduce((sum, section) => sum + section.items.length, 0),
    [hotNewSectionsWithoutGenres],
  );
  const featuredUnreleasedArtists = useMemo(() => unreleasedArtists.slice(0, 12), [unreleasedArtists]);
  const unreleasedStats = useMemo(
    () => [
      { label: "Sections", value: unreleasedArtists.length > 0 ? 2 : 0, icon: Compass },
      { label: "Artists", value: unreleasedArtists.length, icon: RadioTower },
      { label: "Featured", value: featuredUnreleasedArtists.length, icon: Disc3 },
      { label: "Library", value: unreleasedArtists.length, icon: ListMusic },
      { label: "Sources", value: 1, icon: Shapes },
    ],
    [featuredUnreleasedArtists.length, unreleasedArtists.length],
  );

  const activeMeta = TAB_META[activeTab];
  const activeCount = activeTab === "hotNew" ? hotNewCount : unreleasedArtists.length;
  const showLoading = activeTab === "unreleased" && unreleasedLoading && unreleasedArtists.length === 0;
  const hotNewLoadingOnly = !browseLoaded && hotNewSectionsWithoutGenres.length === 0;
  const hasHotNewContent = BROWSE_GENRES.length > 0 || hotNewSectionsWithoutGenres.length > 0;
  const hasUnreleasedContent = unreleasedArtists.length > 0;

  const renderMobileBrowseSection = (section: BrowseHotNewSection) => {
    if (section.type === "genres") {
      return (
        <MobileSection key={section.id} eyebrow="Taste map" title="Genres">
          <div className="flex flex-wrap gap-2">
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openGenre(item.id)}
                className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/82 transition-colors hover:bg-white/[0.1]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </MobileSection>
      );
    }

    if (section.type === "albums") {
      return (
        <MobileSection key={section.id} eyebrow="Fresh projects" title={section.title}>
          <MobileRail itemClassName="w-[min(72vw,18rem)]">
            {section.items.map((album, index) => (
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
                isPriority={index < 4}
              />
            ))}
          </MobileRail>
        </MobileSection>
      );
    }

    if (section.type === "artists") {
      return (
        <MobileSection key={section.id} eyebrow="Profiles" title={section.title}>
          <MobileRail itemClassName="w-[min(68vw,17rem)]">
            {section.items.map((artist, index) => (
              <ArtistCardWrapper key={artist.id} artist={artist} isPriority={index < 4} />
            ))}
          </MobileRail>
        </MobileSection>
      );
    }

    if (section.type === "tracks") {
      return (
        <MobileSection key={section.id} eyebrow="Play now" title={section.title}>
          <MobileRail itemClassName="w-[min(72vw,18rem)]">
            {section.items.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                tracks={section.items}
                liked={isLiked(track.id)}
                onToggleLike={() => { void toggleLike(track); }}
                isPriority={index < 4}
              />
            ))}
          </MobileRail>
        </MobileSection>
      );
    }

    return (
      <MobileSection key={section.id} eyebrow="Collections" title={section.title}>
        <MobileRail itemClassName="w-[min(72vw,18rem)]">
          {section.items.map((playlist) => (
            <BrowsePlaylistCard
              key={playlist.uuid}
              playlistId={playlist.uuid}
              title={playlist.title}
              coverUrl={getPlaylistCoverUrl(playlist.image, playlist.squareImage)}
              trackCount={playlist.numberOfTracks}
              onSelect={() => navigate(`/playlist/${playlist.uuid}`)}
            />
          ))}
        </MobileRail>
      </MobileSection>
    );
  };

  const renderMobileUnreleasedSection = (title: string, artists: import("@/lib/unreleasedApi").UnreleasedArtist[]) => (
    <MobileSection key={title} eyebrow="Archive" title={title}>
      <MobileRail itemClassName="w-[min(72vw,18rem)]">
        {artists.map((artist) => (
          <UnreleasedArtistCard
            key={artist.sheetId}
            artist={artist}
            onClick={() => navigate(`/unreleased/${artist.sheetId}`)}
          />
        ))}
      </MobileRail>
    </MobileSection>
  );

  if (isMobile) {
    return (
      <PageTransition>
        <MobileExperiencePage
          artworkUrl={newReleases[0]?.coverUrl || recommendedAlbums[0]?.coverUrl}
          accentColor={recommendedTracks[0]?.canvasColor}
        >
          <MobileHero
            artworkUrl={newReleases[0]?.coverUrl || recommendedAlbums[0]?.coverUrl}
            artworkAlt="Browse"
            accentColor={recommendedTracks[0]?.canvasColor}
            eyebrow="Browse"
            title={activeMeta.label}
            description={<p>{activeTab === "hotNew" ? "Discovery should feel premium, colorful, and fast enough to keep scrolling addictive." : "The unreleased archive stays reachable without breaking the main app rhythm."}</p>}
            meta={(
              <>
                <MobileMetaChip label="Sections" value={activeTab === "hotNew" ? hotNewCounts.sections : 2} />
                <MobileMetaChip label="Albums" value={hotNewCounts.albums} />
                <MobileMetaChip label="Artists" value={activeTab === "hotNew" ? hotNewCounts.artists : unreleasedArtists.length} />
                <MobileMetaChip label="Tracks" value={hotNewCounts.tracks} />
              </>
            )}
            actions={(
              <>
                <Button
                  variant="ghost"
                  className={activeTab === "hotNew" ? MOBILE_ACTION_BUTTON_CLASS : MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={() => setActiveTab("hotNew")}
                >
                  <Compass className="h-4 w-4" />
                  Hot & New
                </Button>
                <Button
                  variant="ghost"
                  className={activeTab === "unreleased" ? MOBILE_ACTION_BUTTON_CLASS : MOBILE_SECONDARY_BUTTON_CLASS}
                  onClick={() => setActiveTab("unreleased")}
                >
                  <RadioTower className="h-4 w-4" />
                  Unreleased
                </Button>
                <Button variant="ghost" className={MOBILE_SECONDARY_BUTTON_CLASS} onClick={() => navigate("/search")}>
                  <ArrowRight className="h-4 w-4" />
                  Search
                </Button>
                <Button variant="ghost" className={MOBILE_SECONDARY_BUTTON_CLASS} onClick={() => navigate("/library")}>
                  <ListMusic className="h-4 w-4" />
                  Library
                </Button>
              </>
            )}
          />

          {showLoading ? (
            <MobileSection eyebrow="Loading" title="Fetching discovery">
              <BrowseSkeleton cardCount={cardCount} />
            </MobileSection>
          ) : activeTab === "hotNew" && hasHotNewContent ? (
            <>
              {BROWSE_GENRES.length > 0 ? renderMobileBrowseSection({
                id: "genres",
                type: "genres",
                title: "Genres",
                items: BROWSE_GENRES,
                source: "monochrome",
              }) : null}
              {hotNewLoadingOnly ? (
                <MobileSection eyebrow="Loading" title="Building your browse feed">
                  <BrowseSkeleton cardCount={cardCount} />
                </MobileSection>
              ) : (
                hotNewSectionsWithoutGenres.map((section) => renderMobileBrowseSection(section))
              )}
            </>
          ) : activeTab === "unreleased" && hasUnreleasedContent ? (
            <>
              {renderMobileUnreleasedSection("Featured Artists", featuredUnreleasedArtists)}
              {renderMobileUnreleasedSection("All Unreleased Artists", unreleasedArtists)}
            </>
          ) : (
            <MobileSection eyebrow="Nothing here" title={activeMeta.emptyTitle}>
              <p className="text-sm leading-6 text-white/64">
                {activeTab === "hotNew" && (homeError || browseError)
                  ? "Hot & New could not be loaded right now."
                  : activeTab === "unreleased" && unreleasedError
                    ? unreleasedError
                    : activeMeta.emptyDescription}
              </p>
            </MobileSection>
          )}
        </MobileExperiencePage>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div ref={containerRef} className="mobile-page-shell hover-desaturate-page">
        <section className="mobile-page-panel">
          <div className="flex flex-col gap-2 px-4 py-4 md:px-6 md:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Browse</p>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <h1 className="text-[2rem] font-black tracking-tight text-white md:text-5xl">{activeMeta.label}</h1>
              <div className="text-xs uppercase tracking-[0.16em] text-white/45 md:text-sm md:normal-case md:tracking-normal">{activeCount} available</div>
            </div>
            <p className="max-w-3xl text-[13px] leading-5 text-white/58 md:text-sm md:leading-6">{activeMeta.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 px-3 py-3 md:flex md:gap-0 md:px-0 md:py-0">
            <BrowseTabButton tab="hotNew" active={activeTab === "hotNew"} count={hotNewCount} onClick={() => setActiveTab("hotNew")} />
            <BrowseTabButton tab="unreleased" active={activeTab === "unreleased"} count={unreleasedArtists.length} onClick={() => setActiveTab("unreleased")} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5">
            {(activeTab === "hotNew"
              ? [
                { label: "Sections", value: hotNewCounts.sections, icon: Compass },
                { label: "Albums", value: hotNewCounts.albums, icon: Disc3 },
                { label: "Tracks", value: hotNewCounts.tracks, icon: Music2 },
                { label: "Playlists", value: hotNewCounts.playlists, icon: ListMusic },
                { label: "Genres", value: hotNewCounts.genres, icon: Shapes },
              ]
              : unreleasedStats
            ).map((item) => {
              const Icon = item.icon;
              return (
                <div key={`${activeTab}-${item.label}`} className="menu-sweep-hover relative px-3 py-3 last:border-r-0 md:px-4">
                  <div className="relative z-10 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42 md:text-[11px] md:tracking-[0.18em]">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </div>
                  <p className="relative z-10 mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">{item.value}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mobile-page-substack">
          {showLoading ? (
            <section className="mobile-page-panel overflow-hidden bg-white/[0.02]">
              <BrowseSkeleton cardCount={cardCount} />
            </section>
          ) : activeTab === "hotNew" && hasHotNewContent ? (
            <>
              <BrowseGenresSection items={BROWSE_GENRES} onSelectGenre={openGenre} />
              {hotNewLoadingOnly ? (
                <section className="mobile-page-panel overflow-hidden bg-white/[0.02]">
                  <BrowseSkeleton cardCount={cardCount} />
                </section>
              ) : (
                hotNewSectionsWithoutGenres.map((section) => renderHotNewSection(section))
              )}
            </>
          ) : activeTab === "unreleased" && hasUnreleasedContent ? (
            <>
              {renderUnreleasedSection("Featured Artists", featuredUnreleasedArtists)}
              {renderUnreleasedSection("All Unreleased Artists", unreleasedArtists)}
              <section className="mobile-page-panel bg-white/[0.02] px-5 py-8 md:px-6">
                <div className="flex flex-col gap-4 bg-white/[0.03] px-6 py-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Archive access</p>
                    <p className="mt-3 text-sm leading-6 text-white/68">
                      Open the full unreleased archive to search every artist and project page.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/unreleased")} className="gap-2">
                    Open Archive
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            </>
          ) : (
            <section className="mobile-page-panel bg-white/[0.02] px-5 py-12 md:px-6">
              <div className="flex flex-col gap-5 bg-white/[0.03] px-6 py-7 md:flex-row md:items-end md:justify-between">
                <div className="max-w-xl">
                  <h4 className="text-2xl font-black tracking-tight text-white">{activeMeta.emptyTitle}</h4>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {activeTab === "hotNew" && (homeError || browseError)
                      ? "Hot & New could not be loaded right now."
                      : activeTab === "unreleased" && unreleasedError
                        ? unreleasedError
                        : activeMeta.emptyDescription}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(activeTab === "hotNew" ? APP_HOME_PATH : "/unreleased")}
                  className="gap-2"
                >
                  {activeTab === "hotNew" ? "Go Home" : "Open Archive"}
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
