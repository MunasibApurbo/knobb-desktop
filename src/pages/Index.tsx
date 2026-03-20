import { type ReactNode, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { useCarousel } from "@/hooks/useCarousel";
import { CarouselSection } from "@/components/carousel/CarouselSection";
import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { HOME_SECTION_CONFIG, type HomeSectionKey } from "@/lib/homeSections";
import { APP_HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CarouselApi } from "@/hooks/useCarousel";

function HomeSectionBlock({
  index,
  header,
  children,
}: {
  index: number;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      data-home-section-index={index}
      className={cn("home-motion-section relative")}
    >
      <div className="relative z-10">{header}</div>
      <div className="relative z-10">
        {children}
      </div>
    </section>
  );
}

/* ── Section header with optional "See all" and reload button ── */
function SectionHeader({
  title,
  onViewAll,
  onReload,
  loading,
  viewAllLabel = "View all",
  onPageBack,
  onPageForward,
  canPageBack,
  canPageForward,
  showPager,
}: {
  title: string;
  onViewAll?: () => void;
  onReload?: () => void;
  loading?: boolean;
  viewAllLabel?: string;
  onPageBack?: () => void;
  onPageForward?: () => void;
  canPageBack?: boolean;
  canPageForward?: boolean;
  showPager?: boolean;
}) {
  return (
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between">
      <h2 className="home-section-title text-white">{title}</h2>
      <div className="home-section-actions flex items-center gap-2">
        {onReload && (
          <button
            onClick={onReload}
            className="home-section-icon-button"
            title={`Refresh ${title}`}
            aria-label={`Refresh ${title}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
        {showPager && (
          <>
            <button
              onClick={onPageBack}
              disabled={!canPageBack}
              className="home-section-icon-button"
              aria-label={`Previous ${title}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onPageForward}
              disabled={!canPageForward}
              className="home-section-icon-button"
              aria-label={`Next ${title}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="home-section-view-all"
          >
            {viewAllLabel}
          </button>
        )}
      </div>
    </div>
  );
}


const HOME_HERO_CTA_CLASS =
  "menu-sweep-hover website-form-control w-full h-14 border-white/10 bg-white/[0.03] px-4 text-sm font-semibold tracking-[-0.01em] text-foreground hover:bg-white/[0.05] hover:text-black focus-visible:text-black sm:px-5 sm:text-base md:px-6";

function isVisibleShelfItemPriority(
  carousel: CarouselApi,
  sectionKey: string,
  itemIndex: number,
  itemCount: number,
) {
  const pageSize = Math.max(1, carousel.cardCount);
  const currentPage = carousel.getCurrentPage(sectionKey, itemCount);
  const visibleStart = currentPage * pageSize;
  const visibleEnd = visibleStart + pageSize;

  return itemIndex >= visibleStart && itemIndex < visibleEnd;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { getHistory } = usePlayHistory();
  const { isLiked, toggleLike } = useLikedSongs();
  const { favoriteArtists, loading: favoriteArtistsLoading } = useFavoriteArtists();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const { cardSize } = useSettings();
  const enableScrollLinkedHomeMotion = false;
  const { containerRef, collapsedCount: homeRowCardCount } = useResponsiveMediaCardCount(cardSize);
  const carousel = useCarousel(homeRowCardCount);
  const navigate = useNavigate();
  const {
    error,
    loaded,
    newReleases,
    recommendedAlbums,
    recommendedAlbumsPersonalized,
    recommendedArtists,
    recommendedArtistsPersonalized,
    recommendedTracks,
    recentTracks,
    reloadingSection,
    reloadSection,
    retryInitialLoad,
  } = useHomeFeeds({
    authLoading,
    favoriteArtists,
    favoriteArtistsLoading,
    getHistory,
    userId: user?.id,
  });

  const openSectionPage = (section: HomeSectionKey) => navigate(`/home-section/${section}`);
  const denseHomeShelf = homeRowCardCount >= 6;
  const favoriteArtistShelf = useMemo(
    () =>
      favoriteArtists.map((artist) => ({
        id: artist.artist_id,
        name: artist.artist_name,
        imageUrl: artist.artist_image_url || "/placeholder.svg",
        source: "tidal" as const,
      })),
    [favoriteArtists],
  );
  const scrollProgress = 0;
  const heroShift = enableScrollLinkedHomeMotion ? -scrollProgress * 22 : 0;
  const heroScale = enableScrollLinkedHomeMotion ? 1 - scrollProgress * 0.018 : 1;
  const heroOpacity = enableScrollLinkedHomeMotion ? 1 - scrollProgress * 0.12 : 1;

  const handleSectionReload = (section: HomeSectionKey) => {
    void reloadSection(section);
  };
  const showRecommendedAlbums = recommendedAlbumsPersonalized && recommendedAlbums.length > 0;
  const showRecommendedArtists = recommendedArtistsPersonalized && recommendedArtists.length > 0;

  /** Keep replacements in sync so feed rows never sit empty while old content exits. */
  const wrapTrack = (track: ReactNode, contentKey: string) => {
    return (
      <div key={contentKey} className="home-section-carousel-swap-layer">
        {track}
      </div>
    );
  };

  if (
    loaded &&
    error &&
    recommendedTracks.length === 0 &&
    showRecommendedAlbums === false &&
    showRecommendedArtists === false &&
    recentTracks.length === 0
  ) {
    return (
      <PageTransition>
        <div className="bg-black hover-desaturate-page">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <AlertCircle className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-lg font-medium">Failed to load content</p>
            <Button
              variant="outline"
              onClick={() => {
                void retryInitialLoad();
              }}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div ref={containerRef} className="page-shell home-page-surface bg-black hover-desaturate-page">
        <section
          className="home-desktop-hero page-panel home-hero-panel relative isolate overflow-hidden border border-white/10 px-4 py-5 sm:px-5 sm:py-6 md:px-7 md:py-7"
          style={{ opacity: heroOpacity, transform: `translateY(${heroShift}px) scale(${heroScale})` }}
        >
          <div
            aria-hidden="true"
            className="home-hero-ambient pointer-events-none absolute inset-0"
            style={{ opacity: 0.88, transform: "scale(1)" }}
          />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {user ? "For You" : "Guest Mode"}
              </p>
              <h1 className="mt-3 max-w-none text-[clamp(2rem,8.4vw,3.9rem)] font-black leading-[0.94] tracking-[-0.05em] text-white sm:max-w-[13ch] md:max-w-none md:text-5xl md:leading-[0.95]">
                {user
                  ? "Fresh picks, recent plays, and artists worth revisiting."
                  : "Browse the catalog now. Sign in when you want Knobb to remember it."}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/66 sm:text-[15px]">
                {user
                  ? "Knobb keeps the home feed close to your listening habits, then opens outward into new releases and deeper cuts."
                  : "You can explore releases, search artists, and play tracks without an account. Sign in when you want liked songs, playlists, library edits, and listening history to sync across sessions."}
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:min-w-[22rem] xl:w-auto">
              {user ? (
                <>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/browse")}
                    >
                      Browse new releases
                    </Button>
                  </div>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/history")}
                    >
                      Open history
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/search")}
                    >
                      Search the catalog
                    </Button>
                  </div>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/auth", { state: { from: APP_HOME_PATH } })}
                    >
                      Sign in to unlock library
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>


        {/* Favorite Artists */}
        {favoriteArtistShelf.length > 0 && (
          <HomeSectionBlock
            index={0}
            header={(
              <SectionHeader
                title="Your Favorite Artists"
                onViewAll={() => navigate("/favorite-artists")}
                viewAllLabel="Open list"
                showPager={carousel.shouldShowPager("favoriteartists", favoriteArtistShelf.length)}
                onPageBack={() => carousel.moveSectionPage("favoriteartists", favoriteArtistShelf.length, -1)}
                onPageForward={() => carousel.moveSectionPage("favoriteartists", favoriteArtistShelf.length, 1)}
                canPageBack={carousel.getCurrentPage("favoriteartists", favoriteArtistShelf.length) > 0}
                canPageForward={carousel.getCurrentPage("favoriteartists", favoriteArtistShelf.length) < carousel.getPageCount(favoriteArtistShelf.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={favoriteArtistShelf}
              sectionKey="favoriteartists"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey={`favoriteartists:${favoriteArtistShelf.length}:${favoriteArtistShelf[0]?.id ?? "empty"}:${favoriteArtistShelf[favoriteArtistShelf.length - 1]?.id ?? "empty"}`}
              renderItem={(artist, index) =>
                <div key={`favorite-artist-${artist.id}`}>
                  <ArtistCardWrapper
                    artist={artist}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "favoriteartists",
                      index,
                      favoriteArtistShelf.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

        {/* Recommended Tracks (Tidal recommendations) */}
        {recommendedTracks.length > 0 && (
          <HomeSectionBlock
            index={favoriteArtistShelf.length > 0 ? 1 : 0}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recommended.title}
                onViewAll={carousel.canViewAll(recommendedTracks.length) ? () => openSectionPage("recommended") : undefined}
                onReload={() => handleSectionReload("recommended")}
                loading={reloadingSection === "recommended"}
                viewAllLabel="View all"
                showPager={carousel.shouldShowPager("recommended", recommendedTracks.length)}
                onPageBack={() => carousel.moveSectionPage("recommended", recommendedTracks.length, -1)}
                onPageForward={() => carousel.moveSectionPage("recommended", recommendedTracks.length, 1)}
                canPageBack={carousel.getCurrentPage("recommended", recommendedTracks.length) > 0}
                canPageForward={carousel.getCurrentPage("recommended", recommendedTracks.length) < carousel.getPageCount(recommendedTracks.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={recommendedTracks}
              sectionKey="recommended"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey={`recommended:${recommendedTracks.length}:${recommendedTracks[0]?.id ?? "empty"}:${recommendedTracks[recommendedTracks.length - 1]?.id ?? "empty"}`}
              renderItem={(track, index) =>
                <div key={`rec-${track.id}`}>
                  <TrackCard
                    track={track}
                    tracks={recommendedTracks}
                    liked={isLiked(track.id)}
                    onToggleLike={() => {
                      void toggleLike(track);
                    }}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "recommended",
                      index,
                      recommendedTracks.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

        {/* New Releases for You */}
        {newReleases.length > 0 && (
          <HomeSectionBlock
            index={favoriteArtistShelf.length > 0 ? 2 : 1}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.newreleases.title}
                onViewAll={carousel.canViewAll(newReleases.length) ? () => openSectionPage("newreleases") : undefined}
                onReload={() => handleSectionReload("newreleases")}
                loading={reloadingSection === "newreleases"}
                viewAllLabel="View all"
                showPager={carousel.shouldShowPager("newreleases", newReleases.length)}
                onPageBack={() => carousel.moveSectionPage("newreleases", newReleases.length, -1)}
                onPageForward={() => carousel.moveSectionPage("newreleases", newReleases.length, 1)}
                canPageBack={carousel.getCurrentPage("newreleases", newReleases.length) > 0}
                canPageForward={carousel.getCurrentPage("newreleases", newReleases.length) < carousel.getPageCount(newReleases.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={newReleases}
              sectionKey="newreleases"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey={`newreleases:${newReleases.length}:${newReleases[0]?.id ?? "empty"}:${newReleases[newReleases.length - 1]?.id ?? "empty"}`}
              renderItem={(album, index) =>
                <div key={`new-release-${album.id}`}>
                  <HomeAlbumCard
                    album={album}
                    saved={isAlbumSaved(album.id)}
                    onToggleSave={() => {
                      void toggleSavedAlbum({
                        albumId: album.id,
                        albumTitle: album.title,
                        albumArtist: album.artist || "Various Artists",
                        albumCoverUrl: album.coverUrl,
                      });
                    }}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "newreleases",
                      index,
                      newReleases.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

        {/* Recently Played */}
        {recentTracks.length > 0 && (
          <HomeSectionBlock
            index={favoriteArtistShelf.length > 0 ? 3 : 2}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recent.title}
                onViewAll={carousel.canViewAll(recentTracks.length) ? () => openSectionPage("recent") : undefined}
                onReload={() => handleSectionReload("recent")}
                loading={reloadingSection === "recent"}
                viewAllLabel="View all"
                showPager={carousel.shouldShowPager("recent", recentTracks.length)}
                onPageBack={() => carousel.moveSectionPage("recent", recentTracks.length, -1)}
                onPageForward={() => carousel.moveSectionPage("recent", recentTracks.length, 1)}
                canPageBack={carousel.getCurrentPage("recent", recentTracks.length) > 0}
                canPageForward={carousel.getCurrentPage("recent", recentTracks.length) < carousel.getPageCount(recentTracks.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={recentTracks}
              sectionKey="recent"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey="recent"
              renderItem={(track, index) =>
                <div key={`recent-${track.id}-${index}`}>
                  <TrackCard
                    track={track}
                    tracks={recentTracks}
                    liked={isLiked(track.id)}
                    onToggleLike={() => {
                      void toggleLike(track);
                    }}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "recent",
                      index,
                      recentTracks.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

        {/* Recommended Albums */}
        {showRecommendedAlbums && (
          <HomeSectionBlock
            index={favoriteArtistShelf.length > 0 ? 4 : 3}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recalbums.title}
                onViewAll={carousel.canViewAll(recommendedAlbums.length) ? () => openSectionPage("recalbums") : undefined}
                onReload={() => handleSectionReload("recalbums")}
                loading={reloadingSection === "recalbums"}
                viewAllLabel="View all"
                showPager={carousel.shouldShowPager("recalbums", recommendedAlbums.length)}
                onPageBack={() => carousel.moveSectionPage("recalbums", recommendedAlbums.length, -1)}
                onPageForward={() => carousel.moveSectionPage("recalbums", recommendedAlbums.length, 1)}
                canPageBack={carousel.getCurrentPage("recalbums", recommendedAlbums.length) > 0}
                canPageForward={carousel.getCurrentPage("recalbums", recommendedAlbums.length) < carousel.getPageCount(recommendedAlbums.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={recommendedAlbums}
              sectionKey="recalbums"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey={`recalbums:${recommendedAlbums.length}:${recommendedAlbums[0]?.id ?? "empty"}:${recommendedAlbums[recommendedAlbums.length - 1]?.id ?? "empty"}`}
              renderItem={(album, index) =>
                <div key={`recalbum-${album.id}`}>
                  <HomeAlbumCard
                    album={album}
                    saved={isAlbumSaved(album.id)}
                    onToggleSave={() => {
                      void toggleSavedAlbum({
                        albumId: album.id,
                        albumTitle: album.title,
                        albumArtist: album.artist || "Various Artists",
                        albumCoverUrl: album.coverUrl,
                      });
                    }}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "recalbums",
                      index,
                      recommendedAlbums.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

        {/* Recommended Artists */}
        {showRecommendedArtists && (
          <HomeSectionBlock
            index={favoriteArtistShelf.length > 0 ? 5 : 4}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recartists.title}
                onViewAll={carousel.canViewAll(recommendedArtists.length) ? () => openSectionPage("recartists") : undefined}
                onReload={() => handleSectionReload("recartists")}
                loading={reloadingSection === "recartists"}
                viewAllLabel="View all"
                showPager={carousel.shouldShowPager("recartists", recommendedArtists.length)}
                onPageBack={() => carousel.moveSectionPage("recartists", recommendedArtists.length, -1)}
                onPageForward={() => carousel.moveSectionPage("recartists", recommendedArtists.length, 1)}
                canPageBack={carousel.getCurrentPage("recartists", recommendedArtists.length) > 0}
                canPageForward={carousel.getCurrentPage("recartists", recommendedArtists.length) < carousel.getPageCount(recommendedArtists.length) - 1}
              />
            )}
          >
            <CarouselSection
              items={recommendedArtists}
              sectionKey="recartists"
              carousel={carousel}
              overscanPages={0}
              wrapTrack={wrapTrack}
              contentKey={`recartists:${recommendedArtists.length}:${recommendedArtists[0]?.id ?? "empty"}:${recommendedArtists[recommendedArtists.length - 1]?.id ?? "empty"}`}
              renderItem={(artist, index) =>
                <div key={`rec-art-${artist.id}`}>
                  <ArtistCardWrapper
                    artist={artist}
                    isPriority={isVisibleShelfItemPriority(
                      carousel,
                      "recartists",
                      index,
                      recommendedArtists.length,
                    )}
                    lightweight={denseHomeShelf}
                  />
                </div>
              }
            />
          </HomeSectionBlock>
        )}

      </div>
    </PageTransition>
  );
};

export default Index;
