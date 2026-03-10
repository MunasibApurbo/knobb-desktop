import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { type WebsiteMode, useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { useCarousel } from "@/hooks/useCarousel";
import { CarouselSection } from "@/components/carousel/CarouselSection";
import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { MobileHomeExperience } from "@/components/mobile/MobileHomeExperience";
import { HOME_SECTION_CONFIG, type HomeSectionKey } from "@/lib/homeSections";
import {
  getControlHover,
  getControlTap,
  getMotionProfile,
  getSectionRevealVariants,
  getStaggerContainerVariants,
  getStaggerItemVariants,
  getSurfaceSwapTransition,
} from "@/lib/motion";
import { APP_HOME_PATH } from "@/lib/routes";

function HomeSectionBlock({
  index,
  motionEnabled,
  websiteMode,
  scrollProgress,
  reloading,
  header,
  children,
}: {
  index: number;
  motionEnabled: boolean;
  websiteMode: WebsiteMode;
  scrollProgress: number;
  reloading: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  const motionProfile = getMotionProfile(websiteMode);
  const isRoundish = websiteMode === "roundish";
  const sectionVariants = getSectionRevealVariants(motionEnabled, websiteMode);

  return (
    <motion.section
      custom={index}
      className="mobile-page-panel home-motion-section relative"
      initial="hidden"
      animate="show"
      variants={sectionVariants}
    >

      <div className="relative z-10">{header}</div>
      <motion.div
        className="relative z-10"
        animate={{
          opacity: reloading && motionEnabled ? 0.7 : 1,
          scale: reloading && motionEnabled ? (isRoundish ? 0.988 : 0.994) : 1,
          y: reloading && motionEnabled ? (isRoundish ? 9 : 6) : 0,
        }}
        transition={{
          duration: motionEnabled ? motionProfile.duration.base : 0,
          ease: motionProfile.ease.smooth,
        }}
      >
        {children}
      </motion.div>
    </motion.section>
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
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between px-4 py-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-3">
        {onReload && (
          <button
            onClick={onReload}
            className="flex items-center justify-center w-7 h-7  text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all"
            title={`Refresh ${title}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
        {showPager && (
          <>
            <button
              onClick={onPageBack}
              disabled={!canPageBack}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
              aria-label={`Previous ${title}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onPageForward}
              disabled={!canPageForward}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
              aria-label={`Next ${title}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
const MOBILE_HERO_HIGHLIGHTS = [
  { eyebrow: "Pulse", title: "Adaptive mixes", meta: "Spotify pace" },
  { eyebrow: "Glow", title: "Color-led cards", meta: "Deezer energy" },
  { eyebrow: "Edit", title: "Premium framing", meta: "TIDAL mood" },
];
const MOBILE_HERO_STATS = [
  { value: "24/7", label: "playback-ready" },
  { value: "HD", label: "clean visuals" },
  { value: "Flow", label: "quick browse" },
];

const Index = () => {
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { isLiked, toggleLike } = useLikedSongs();
  const { favoriteArtists } = useFavoriteArtists();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const { cardSize } = useSettings();
  const isMobile = useIsMobile();
  const { motionEnabled, allowAmbientMotion, websiteMode, isRoundish, strongDesktopEffects } = useMotionPreferences();
  const allowHomeAmbientMotion = allowAmbientMotion && (isMobile || strongDesktopEffects);
  const enableScrollLinkedHomeMotion = !isMobile && allowHomeAmbientMotion;
  const scrollY = useMainScrollY(enableScrollLinkedHomeMotion);
  const motionProfile = getMotionProfile(websiteMode);
  const controlHover = getControlHover(motionEnabled, websiteMode);
  const { containerRef, collapsedCount: homeRowCardCount } = useResponsiveMediaCardCount(cardSize);
  const carousel = useCarousel(homeRowCardCount);
  const navigate = useNavigate();
  const {
    error,
    loaded,
    newReleases,
    recommendedAlbums,
    recommendedArtists,
    recommendedTracks,
    recentTracks,
    reloadingSection,
    reloadSection,
    retryInitialLoad,
  } = useHomeFeeds({
    favoriteArtists,
    getHistory,
    userId: user?.id,
  });

  const openSectionPage = (section: HomeSectionKey) => navigate(`/home-section/${section}`);
  const rowVariants = useMemo(() => getStaggerContainerVariants(motionEnabled, websiteMode), [motionEnabled, websiteMode]);
  const rowItemVariants = useMemo(() => getStaggerItemVariants(motionEnabled, websiteMode), [motionEnabled, websiteMode]);
  const scrollProgress = enableScrollLinkedHomeMotion ? Math.min(scrollY / 320, 1) : 0;
  const heroShift = enableScrollLinkedHomeMotion ? -scrollProgress * 22 : 0;
  const heroScale = enableScrollLinkedHomeMotion ? 1 - scrollProgress * 0.018 : 1;
  const heroOpacity = enableScrollLinkedHomeMotion ? 1 - scrollProgress * 0.12 : 1;

  const handleSectionReload = (section: HomeSectionKey) => {
    void reloadSection(section);
  };

  /** Wraps carousel track with framer-motion AnimatePresence for content swap animations */
  const wrapTrack = (track: ReactNode, contentKey: string) => (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={contentKey}
        className="home-section-carousel-swap-layer"
        initial={motionEnabled ? { opacity: 0.72, y: 10, scale: 0.995 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={motionEnabled ? { opacity: 0.4, y: -10, scale: 1.004 } : undefined}
        transition={getSurfaceSwapTransition(motionEnabled, websiteMode)}
      >
        <motion.div variants={rowVariants} initial="hidden" animate="show">
          {track}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (!loaded) return <LoadingSkeleton />;

  if (
    error &&
    recommendedTracks.length === 0 &&
    recommendedAlbums.length === 0 &&
    recommendedArtists.length === 0 &&
    recentTracks.length === 0
  ) {
    return (
      <PageTransition>
        <div className="home-page-surface hover-desaturate-page">
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

  if (isMobile) {
    return (
      <PageTransition>
        <MobileHomeExperience
          newReleases={newReleases}
          recommendedAlbums={recommendedAlbums}
          recommendedArtists={recommendedArtists}
          recommendedTracks={recommendedTracks}
          recentTracks={recentTracks}
          userId={user?.id}
          isAlbumSaved={isAlbumSaved}
          isTrackLiked={isLiked}
          onToggleLike={(track) => {
            void toggleLike(track);
          }}
          onToggleSavedAlbum={toggleSavedAlbum}
        />
      </PageTransition>
    );
  }

  const hasAnyRows =
    recommendedTracks.length > 0 ||
    recentTracks.length > 0 ||
    recommendedAlbums.length > 0 ||
    recommendedArtists.length > 0;

  return (
    <PageTransition>
      <div ref={containerRef} className="mobile-page-shell mobile-stream-blend-shell home-page-surface hover-desaturate-page">
        <motion.section
          className="mobile-page-panel home-hero-panel relative isolate overflow-hidden border border-white/10 px-4 py-5 sm:px-5 sm:py-6 md:px-7 md:py-7"
          initial={motionEnabled ? { opacity: 0, y: 20, scale: 0.992 } : false}
          animate={{ opacity: heroOpacity, y: heroShift, scale: heroScale }}
          transition={{
            duration: motionEnabled ? motionProfile.duration.slow : 0,
            ease: motionProfile.ease.smooth,
          }}
        >
          <motion.div
            aria-hidden="true"
            className="home-hero-ambient pointer-events-none absolute inset-0"
            animate={
              allowHomeAmbientMotion
                ? {
                  opacity: [0.72, 1, 0.8],
                  scale: [1, isRoundish ? 1.06 : 1.035, 1],
                }
                : { opacity: 0.88, scale: 1 }
            }
            transition={
              allowHomeAmbientMotion
                ? {
                  duration: isRoundish ? 14 : 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
                : { duration: 0 }
            }
          />
          {isMobile ? <div aria-hidden="true" className="home-mobile-grid-lines absolute inset-0" /> : null}
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {user ? "For You" : "Guest Mode"}
              </p>
              {isMobile ? (
                <div className="home-mobile-highlight-row mt-3" aria-label="Mobile home style highlights">
                  {MOBILE_HERO_HIGHLIGHTS.map((item) => (
                    <div key={item.title} className="home-mobile-highlight-card">
                      <p className="home-mobile-highlight-eyebrow">{item.eyebrow}</p>
                      <p className="home-mobile-highlight-title">{item.title}</p>
                      <p className="home-mobile-highlight-meta">{item.meta}</p>
                    </div>
                  ))}
                </div>
              ) : null}
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
              {isMobile ? (
                <div className="home-mobile-stats-row mt-5" aria-label="Mobile feed qualities">
                  {MOBILE_HERO_STATS.map((item) => (
                    <div key={item.label} className="home-mobile-stat-pill">
                      <span className="home-mobile-stat-value">{item.value}</span>
                      <span className="home-mobile-stat-label">{item.label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:min-w-[22rem] xl:w-auto">
              {user ? (
                <>
                  <motion.div
                    className="w-full"
                    whileHover={controlHover}
                    whileTap={getControlTap(motionEnabled, websiteMode)}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/browse")}
                    >
                      Browse new releases
                    </Button>
                  </motion.div>
                  <motion.div
                    className="w-full"
                    whileHover={controlHover}
                    whileTap={getControlTap(motionEnabled, websiteMode)}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/history")}
                    >
                      Open history
                    </Button>
                  </motion.div>
                </>
              ) : (
                <>
                  <motion.div
                    className="w-full"
                    whileHover={controlHover}
                    whileTap={getControlTap(motionEnabled, websiteMode)}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/search")}
                    >
                      Search the catalog
                    </Button>
                  </motion.div>
                  <motion.div
                    className="w-full"
                    whileHover={controlHover}
                    whileTap={getControlTap(motionEnabled, websiteMode)}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      variant="outline"
                      className={HOME_HERO_CTA_CLASS}
                      onClick={() => navigate("/auth", { state: { from: APP_HOME_PATH } })}
                    >
                      Sign in to unlock library
                    </Button>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </motion.section>

        {/* Recommended Tracks (Tidal recommendations) */}
        {recommendedTracks.length > 0 && (
          <HomeSectionBlock
            index={0}
            motionEnabled={motionEnabled}
            websiteMode={websiteMode}
            scrollProgress={scrollProgress}
            reloading={reloadingSection === "recommended"}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recommended.title}
                onViewAll={carousel.canViewAll(recommendedTracks.length) ? () => openSectionPage("recommended") : undefined}
                onReload={() => handleSectionReload("recommended")}
                loading={reloadingSection === "recommended"}
                viewAllLabel="View all"
                showPager={!isMobile && carousel.shouldShowPager("recommended", recommendedTracks.length)}
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
              isMobile={isMobile}
              wrapTrack={wrapTrack}
              contentKey={`recommended:${recommendedTracks.length}:${recommendedTracks[0]?.id ?? "empty"}:${recommendedTracks[recommendedTracks.length - 1]?.id ?? "empty"}`}
              renderItem={(track, index) => (
                <motion.div key={`rec-${track.id}`} variants={rowItemVariants}>
                  <TrackCard
                    track={track}
                    tracks={recommendedTracks}
                    liked={isLiked(track.id)}
                    onToggleLike={() => {
                      void toggleLike(track);
                    }}
                    isPriority={index < 5}
                  />
                </motion.div>
              )}
            />
          </HomeSectionBlock>
        )}

        {/* New Releases for You */}
        {newReleases.length > 0 && (
          <HomeSectionBlock
            index={1}
            motionEnabled={motionEnabled}
            websiteMode={websiteMode}
            scrollProgress={scrollProgress}
            reloading={reloadingSection === "newreleases"}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.newreleases.title}
                onViewAll={carousel.canViewAll(newReleases.length) ? () => openSectionPage("newreleases") : undefined}
                onReload={() => handleSectionReload("newreleases")}
                loading={reloadingSection === "newreleases"}
                viewAllLabel="View all"
                showPager={!isMobile && carousel.shouldShowPager("newreleases", newReleases.length)}
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
              isMobile={isMobile}
              wrapTrack={wrapTrack}
              contentKey={`newreleases:${newReleases.length}:${newReleases[0]?.id ?? "empty"}:${newReleases[newReleases.length - 1]?.id ?? "empty"}`}
              renderItem={(album, index) => (
                <motion.div key={`new-release-${album.id}`} variants={rowItemVariants}>
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
                    isPriority={index < 5}
                  />
                </motion.div>
              )}
            />
          </HomeSectionBlock>
        )}

        {/* Recently Played */}
        {recentTracks.length > 0 && (
          <HomeSectionBlock
            index={2}
            motionEnabled={motionEnabled}
            websiteMode={websiteMode}
            scrollProgress={scrollProgress}
            reloading={reloadingSection === "recent"}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recent.title}
                onViewAll={carousel.canViewAll(recentTracks.length) ? () => openSectionPage("recent") : undefined}
                onReload={() => handleSectionReload("recent")}
                loading={reloadingSection === "recent"}
                viewAllLabel="View all"
                showPager={!isMobile && carousel.shouldShowPager("recent", recentTracks.length)}
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
              isMobile={isMobile}
              wrapTrack={wrapTrack}
              contentKey={`recent:${recentTracks.length}:${recentTracks[0]?.id ?? "empty"}:${recentTracks[recentTracks.length - 1]?.id ?? "empty"}`}
              renderItem={(track, index) => (
                <motion.div key={`recent-${track.id}-${index}`} variants={rowItemVariants}>
                  <TrackCard
                    track={track}
                    tracks={recentTracks}
                    liked={isLiked(track.id)}
                    onToggleLike={() => {
                      void toggleLike(track);
                    }}
                    isPriority={index < 5}
                  />
                </motion.div>
              )}
            />
          </HomeSectionBlock>
        )}

        {/* Recommended Albums */}
        {recommendedAlbums.length > 0 && (
          <HomeSectionBlock
            index={3}
            motionEnabled={motionEnabled}
            websiteMode={websiteMode}
            scrollProgress={scrollProgress}
            reloading={reloadingSection === "recalbums"}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recalbums.title}
                onViewAll={carousel.canViewAll(recommendedAlbums.length) ? () => openSectionPage("recalbums") : undefined}
                onReload={() => handleSectionReload("recalbums")}
                loading={reloadingSection === "recalbums"}
                viewAllLabel="View all"
                showPager={!isMobile && carousel.shouldShowPager("recalbums", recommendedAlbums.length)}
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
              isMobile={isMobile}
              wrapTrack={wrapTrack}
              contentKey={`recalbums:${recommendedAlbums.length}:${recommendedAlbums[0]?.id ?? "empty"}:${recommendedAlbums[recommendedAlbums.length - 1]?.id ?? "empty"}`}
              renderItem={(album) => (
                <motion.div key={`recalbum-${album.id}`} variants={rowItemVariants}>
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
                  />
                </motion.div>
              )}
            />
          </HomeSectionBlock>
        )}

        {/* Recommended Artists */}
        {recommendedArtists.length > 0 && (
          <HomeSectionBlock
            index={4}
            motionEnabled={motionEnabled}
            websiteMode={websiteMode}
            scrollProgress={scrollProgress}
            reloading={reloadingSection === "recartists"}
            header={(
              <SectionHeader
                title={HOME_SECTION_CONFIG.recartists.title}
                onViewAll={carousel.canViewAll(recommendedArtists.length) ? () => openSectionPage("recartists") : undefined}
                onReload={() => handleSectionReload("recartists")}
                loading={reloadingSection === "recartists"}
                viewAllLabel="View all"
                showPager={!isMobile && carousel.shouldShowPager("recartists", recommendedArtists.length)}
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
              isMobile={isMobile}
              wrapTrack={wrapTrack}
              contentKey={`recartists:${recommendedArtists.length}:${recommendedArtists[0]?.id ?? "empty"}:${recommendedArtists[recommendedArtists.length - 1]?.id ?? "empty"}`}
              renderItem={(artist) => (
                <motion.div key={`rec-art-${artist.id}`} variants={rowItemVariants}>
                  <ArtistCardWrapper
                    artist={artist}
                  />
                </motion.div>
              )}
            />
          </HomeSectionBlock>
        )}

        {!hasAnyRows && (
          <div className="px-4 py-10 border-t border-white/10 text-muted-foreground">
            Play a few tracks to personalize your home recommendations.
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default Index;
