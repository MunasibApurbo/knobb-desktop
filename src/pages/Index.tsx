import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
import { ChevronLeft, ChevronRight, AlertCircle, Download, ExternalLink, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { HOME_SECTION_CONFIG, type HomeSectionKey } from "@/lib/homeSections";
import {
  detectDesktopDownloadPlatform,
  isDesktopDownloadRecommended,
  KNOBB_MAC_DOWNLOAD_URL,
  KNOBB_RELEASES_URL,
  KNOBB_WINDOWS_DOWNLOAD_URL,
} from "@/lib/desktopDownloads";
import { isKnobbDesktopApp } from "@/lib/desktopApp";
import {
  getControlTap,
  getMotionProfile,
  getSectionRevealVariants,
  getStaggerContainerVariants,
  getStaggerItemVariants,
  getSurfaceSwapTransition,
} from "@/lib/motion";

function getCarouselTransform(pageIndex: number, dragOffset = 0) {
  return `translate3d(calc(${-pageIndex * 100}% + ${dragOffset}px), 0, 0)`;
}

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
  websiteMode: "edgy" | "roundish";
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
      style={{
        ["--home-section-accent-opacity" as string]: 0.18 + (1 - scrollProgress) * 0.1,
      }}
    >
      <motion.div
        aria-hidden="true"
        className="home-section-accent pointer-events-none absolute inset-x-0 top-0 h-28"
        animate={{
          opacity: motionEnabled ? 0.32 + (1 - scrollProgress) * 0.16 : 0.3,
          y: motionEnabled ? -scrollProgress * (isRoundish ? 18 : 14) : 0,
          scaleX: motionEnabled ? 1 + scrollProgress * (isRoundish ? 0.05 : 0.035) : 1,
        }}
        transition={{
          duration: motionEnabled ? motionProfile.duration.base : 0,
          ease: motionProfile.ease.smooth,
        }}
      />
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
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between px-4 py-3 border border-white/10 border-b-0">
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

const CARD_ROW_FRAME = "website-mode-grid-frame home-section-grid hover-desaturate-grid home-section-carousel-frame border-l border-t border-white/10";
const HOME_HERO_CTA_BASE_CLASS =
  "home-hero-cta rounded-none !h-14 !w-full justify-center !border !px-4 sm:!px-5 md:!px-6 !text-sm sm:!text-base !font-semibold tracking-[-0.01em] transition-colors";
const HOME_HERO_CTA_PRIMARY_CLASS =
  `${HOME_HERO_CTA_BASE_CLASS} !border-white/10 !bg-white !text-black hover:!bg-white/90 hover:!text-black`;
const HOME_HERO_CTA_SECONDARY_CLASS =
  `${HOME_HERO_CTA_BASE_CLASS} !border-white/10 !bg-white/[0.04] !text-white hover:!bg-white/[0.1] hover:!text-white`;

const Index = () => {
  const { user } = useAuth();
  const { getHistory } = usePlayHistory();
  const { isLiked, toggleLike } = useLikedSongs();
  const { favoriteArtists } = useFavoriteArtists();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const { cardSize } = useSettings();
  const isMobile = useIsMobile();
  const { motionEnabled, allowAmbientMotion, websiteMode, isRoundish, strongDesktopEffects } = useMotionPreferences();
  const desktopApp = useMemo(() => isKnobbDesktopApp(), []);
  const desktopDownloadPlatform = useMemo(() => detectDesktopDownloadPlatform(), []);
  const allowHomeAmbientMotion = allowAmbientMotion && (isMobile || strongDesktopEffects);
  const enableScrollLinkedHomeMotion = !isMobile && allowHomeAmbientMotion;
  const scrollY = useMainScrollY(enableScrollLinkedHomeMotion);
  const motionProfile = getMotionProfile(websiteMode);
  const { containerRef, collapsedCount: homeRowCardCount } = useResponsiveMediaCardCount(cardSize);
  const [sectionPageIndexes, setSectionPageIndexes] = useState<Record<string, number>>({});
  const [draggingSections, setDraggingSections] = useState<Record<string, boolean>>({});
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionItemCountsRef = useRef<Record<string, number>>({});
  const dragSessionsRef = useRef<Record<string, { pointerId: number; startX: number; lastOffset: number; moved: boolean }>>({});
  const dragAnimationFramesRef = useRef<Record<string, number | undefined>>({});
  const pendingTransformsRef = useRef<Record<string, { pageIndex: number; dragOffset: number } | undefined>>({});
  const clickSuppressionRef = useRef<Record<string, number>>({});
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

  const getPageCount = (itemsLength: number) =>
    Math.max(1, Math.ceil(itemsLength / Math.max(1, homeRowCardCount)));

  const getCurrentPage = (section: string, itemsLength: number) =>
    Math.min(sectionPageIndexes[section] ?? 0, getPageCount(itemsLength) - 1);

  function getSectionPages<T>(items: T[]) {
    const pageSize = Math.max(1, homeRowCardCount);
    const pages: T[][] = [];

    for (let index = 0; index < items.length; index += pageSize) {
      pages.push(items.slice(index, index + pageSize));
    }

    return pages;
  }

  const moveSectionPage = (section: string, itemsLength: number, direction: -1 | 1) => {
    setSectionPageIndexes((previous) => {
      const pageCount = getPageCount(itemsLength);
      const currentPage = Math.min(previous[section] ?? 0, pageCount - 1);
      const nextPage = Math.max(0, Math.min(pageCount - 1, currentPage + direction));
      if (nextPage === currentPage) return previous;
      return { ...previous, [section]: nextPage };
    });
  };

  const canExpandSection = (items: { length: number }) => items.length > homeRowCardCount;

  const shouldShowPager = (_section: string, itemsLength: number) => getPageCount(itemsLength) > 1;

  const handleSectionReload = (section: HomeSectionKey) => {
    setSectionPageIndexes((previous) => (
      previous[section] === 0 ? previous : { ...previous, [section]: 0 }
    ));
    void reloadSection(section);
  };

  const rowStyle = {
    "--home-row-columns": Math.max(1, homeRowCardCount),
  } as CSSProperties;

  const setFrameRef = (section: string) => (node: HTMLDivElement | null) => {
    frameRefs.current[section] = node;
  };

  const setTrackRef = (section: string) => (node: HTMLDivElement | null) => {
    trackRefs.current[section] = node;
  };

  const getTrackedItemsLength = (section: string) => sectionItemCountsRef.current[section] ?? 0;

  const snapSectionTransform = (section: string, pageIndex: number, dragOffset = 0) => {
    const track = trackRefs.current[section];
    if (!track) return;
    track.style.transform = getCarouselTransform(pageIndex, dragOffset);
  };

  const flushSectionTransform = (section: string) => {
    const pendingTransform = pendingTransformsRef.current[section];
    const track = trackRefs.current[section];
    dragAnimationFramesRef.current[section] = undefined;

    if (!pendingTransform || !track) return;

    track.style.transform = getCarouselTransform(pendingTransform.pageIndex, pendingTransform.dragOffset);
  };

  const scheduleSectionTransform = (section: string, pageIndex: number, dragOffset: number) => {
    pendingTransformsRef.current[section] = { pageIndex, dragOffset };

    if (dragAnimationFramesRef.current[section] != null) return;

    dragAnimationFramesRef.current[section] = window.requestAnimationFrame(() => {
      flushSectionTransform(section);
    });
  };

  const clearSectionAnimationFrame = (section: string) => {
    const frame = dragAnimationFramesRef.current[section];
    if (frame == null) return;
    window.cancelAnimationFrame(frame);
    dragAnimationFramesRef.current[section] = undefined;
  };

  useEffect(() => {
    const activeFrames = dragAnimationFramesRef.current;
    return () => {
      Object.keys(activeFrames).forEach((section) => {
        const frame = activeFrames[section];
        if (frame == null) return;
        window.cancelAnimationFrame(frame);
      });
    };
  }, []);

  const setSectionDragging = (section: string, next: boolean) => {
    setDraggingSections((previous) => {
      if (!!previous[section] === next) return previous;
      if (!next && !previous[section]) return previous;
      if (!next) {
        const rest = { ...previous };
        delete rest[section];
        return rest;
      }
      return { ...previous, [section]: true };
    });
  };

  const cancelCarouselDrag = (
    section: string,
    currentTarget?: HTMLDivElement,
    pointerId?: number,
  ) => {
    const session = dragSessionsRef.current[section];
    if (!session) return;

    delete dragSessionsRef.current[section];
    clearSectionAnimationFrame(section);
    pendingTransformsRef.current[section] = undefined;

    if (currentTarget && pointerId != null && currentTarget.hasPointerCapture(pointerId)) {
      currentTarget.releasePointerCapture(pointerId);
    }

    setSectionDragging(section, false);
    snapSectionTransform(section, getCurrentPage(section, getTrackedItemsLength(section)));
  };

  const cancelCarouselDragRef = useRef(cancelCarouselDrag);
  cancelCarouselDragRef.current = cancelCarouselDrag;

  const handleCarouselPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    section: string,
    itemsLength: number,
  ) => {
    if (getPageCount(itemsLength) <= 1) return;
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button'], [data-no-carousel-drag='true']")) {
      return;
    }

    dragSessionsRef.current[section] = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastOffset: 0,
      moved: false,
    };

    clearSectionAnimationFrame(section);
    pendingTransformsRef.current[section] = undefined;
  };

  const handleCarouselPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    section: string,
    itemsLength: number,
  ) => {
    const session = dragSessionsRef.current[section];
    if (!session || session.pointerId !== event.pointerId) return;

    if (event.buttons === 0) {
      cancelCarouselDrag(section, event.currentTarget, event.pointerId);
      return;
    }

    const pageCount = getPageCount(itemsLength);
    const currentPage = getCurrentPage(section, itemsLength);
    const rawDelta = event.clientX - session.startX;
    const isOverscrollingStart = currentPage === 0 && rawDelta > 0;
    const isOverscrollingEnd = currentPage === pageCount - 1 && rawDelta < 0;
    const nextOffset = (isOverscrollingStart || isOverscrollingEnd ? rawDelta * 0.28 : rawDelta * 0.94);

    session.lastOffset = nextOffset;
    if (Math.abs(rawDelta) > 6) {
      if (!session.moved) {
        session.moved = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setSectionDragging(section, true);
      }
    }

    if (!session.moved) return;

    scheduleSectionTransform(section, currentPage, nextOffset);
  };

  const finishCarouselDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    section: string,
    itemsLength: number,
  ) => {
    const session = dragSessionsRef.current[section];
    if (!session || session.pointerId !== event.pointerId) return;

    delete dragSessionsRef.current[section];
    clearSectionAnimationFrame(section);
    pendingTransformsRef.current[section] = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!session.moved) return;

    setSectionDragging(section, false);

    const pageCount = getPageCount(itemsLength);
    const currentPage = getCurrentPage(section, itemsLength);
    const frameWidth = frameRefs.current[section]?.clientWidth ?? event.currentTarget.clientWidth;
    const threshold = Math.max(56, frameWidth * 0.14);
    const direction = Math.abs(session.lastOffset) >= threshold
      ? (session.lastOffset < 0 ? 1 : -1)
      : 0;
    const targetPage = Math.max(0, Math.min(pageCount - 1, currentPage + direction));

    snapSectionTransform(section, targetPage);

    if (targetPage !== currentPage) {
      moveSectionPage(section, itemsLength, direction as -1 | 1);
    }

    if (session.moved) {
      clickSuppressionRef.current[section] = Date.now() + 220;
    }
  };

  const handleCarouselClickCapture = (event: MouseEvent<HTMLDivElement>, section: string) => {
    const suppressUntil = clickSuppressionRef.current[section];
    if (!suppressUntil || suppressUntil < Date.now()) return;

    event.preventDefault();
    event.stopPropagation();
    delete clickSuppressionRef.current[section];
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cancelAllCarouselDrags = () => {
      Object.keys(dragSessionsRef.current).forEach((section) => {
        cancelCarouselDragRef.current(section);
      });
    };

    window.addEventListener("blur", cancelAllCarouselDrags);
    document.addEventListener("visibilitychange", cancelAllCarouselDrags);

    return () => {
      window.removeEventListener("blur", cancelAllCarouselDrags);
      document.removeEventListener("visibilitychange", cancelAllCarouselDrags);
    };
  }, []);

  function renderSectionRow<T>(
    items: T[],
    section: string,
    renderItem: (item: T, index: number) => ReactNode,
    contentKey: string,
  ) {
    sectionItemCountsRef.current[section] = items.length;

    if (isMobile) {
      return (
        <div
          className={`${CARD_ROW_FRAME} overflow-x-auto border-r border-b border-white/10 scrollbar-hide`}
          style={{
            ...rowStyle,
            ["--home-row-columns" as string]: 2.08,
          }}
        >
          <motion.div
            key={contentKey}
            className="home-section-inline-row scrollbar-hide"
            initial={motionEnabled ? { opacity: 0.82, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={getSurfaceSwapTransition(motionEnabled, websiteMode)}
          >
            {items.map((item, index) => (
              <div key={`${section}-inline-${index}`} className="home-section-inline-item">
                {renderItem(item, index)}
              </div>
            ))}
          </motion.div>
        </div>
      );
    }

    const pages = getSectionPages(items);
    const currentPage = getCurrentPage(section, items.length);
    const isDragging = !!draggingSections[section];

    return (
      <div
        ref={setFrameRef(section)}
        className={`${CARD_ROW_FRAME} ${isDragging ? "is-dragging" : ""}`}
        style={rowStyle}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => handleCarouselPointerDown(event, section, items.length)}
        onPointerMove={(event) => handleCarouselPointerMove(event, section, items.length)}
        onPointerUp={(event) => finishCarouselDrag(event, section, items.length)}
        onPointerCancel={(event) => cancelCarouselDrag(section, event.currentTarget, event.pointerId)}
        onLostPointerCapture={(event) => cancelCarouselDrag(section, event.currentTarget, event.pointerId)}
        onClickCapture={(event) => handleCarouselClickCapture(event, section)}
      >
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
              <div
                ref={setTrackRef(section)}
                className={`home-section-carousel-track ${isDragging ? "is-dragging" : ""}`}
                style={{
                  transform: getCarouselTransform(currentPage),
                }}
              >
                {pages.map((pageItems, pageIndex) => (
                  <div
                    key={`${section}-page-${pageIndex}`}
                    className="home-section-carousel-page"
                  >
                    {pageItems.map((item, itemIndex) => renderItem(item, pageIndex * homeRowCardCount + itemIndex))}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

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

  const hasAnyRows =
    recommendedTracks.length > 0 ||
    recentTracks.length > 0 ||
    recommendedAlbums.length > 0 ||
    recommendedArtists.length > 0;

  return (
    <PageTransition>
      <div ref={containerRef} className="mobile-page-shell home-page-surface hover-desaturate-page">
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
                  <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                    <Button
                      className={HOME_HERO_CTA_PRIMARY_CLASS}
                      onClick={() => navigate("/browse")}
                    >
                      Browse new releases
                    </Button>
                  </motion.div>
                  <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                    <Button
                      className={HOME_HERO_CTA_SECONDARY_CLASS}
                      onClick={() => navigate("/history")}
                    >
                      Open history
                    </Button>
                  </motion.div>
                </>
              ) : (
                <>
                  <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                    <Button
                      className={HOME_HERO_CTA_PRIMARY_CLASS}
                      onClick={() => navigate("/auth", { state: { from: "/" } })}
                    >
                      Sign in to unlock library
                    </Button>
                  </motion.div>
                  <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                    <Button
                      className={HOME_HERO_CTA_SECONDARY_CLASS}
                      onClick={() => navigate("/browse")}
                    >
                      Browse new releases
                    </Button>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </motion.section>

        {!desktopApp ? (
          <motion.section
            className="mobile-page-panel border border-white/10 bg-[linear-gradient(135deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.02))]"
            initial="hidden"
            animate="show"
            variants={getSectionRevealVariants(motionEnabled, websiteMode)}
          >
            <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Desktop app
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white md:text-3xl">
                  Download Knobb for macOS and Windows
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/66 sm:text-[15px]">
                  Desktop builds now ship from the dedicated Knobb Desktop repo. Both apps auto-update, and required updates are enforced through the release channel.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-3xl">
                <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                  <Button
                    asChild
                    variant={isDesktopDownloadRecommended("macos", desktopDownloadPlatform) ? "default" : "outline"}
                    className={isDesktopDownloadRecommended("macos", desktopDownloadPlatform) ? HOME_HERO_CTA_PRIMARY_CLASS : HOME_HERO_CTA_SECONDARY_CLASS}
                  >
                    <a href={KNOBB_MAC_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                      Download for macOS <Download className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
                <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                  <Button
                    asChild
                    variant={isDesktopDownloadRecommended("windows", desktopDownloadPlatform) ? "default" : "outline"}
                    className={isDesktopDownloadRecommended("windows", desktopDownloadPlatform) ? HOME_HERO_CTA_PRIMARY_CLASS : HOME_HERO_CTA_SECONDARY_CLASS}
                  >
                    <a href={KNOBB_WINDOWS_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                      Download for Windows <Download className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
                <motion.div whileTap={getControlTap(motionEnabled, websiteMode)}>
                  <Button
                    asChild
                    className={HOME_HERO_CTA_SECONDARY_CLASS}
                  >
                    <a href={KNOBB_RELEASES_URL} target="_blank" rel="noreferrer">
                      View latest release <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.section>
        ) : null}

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
                onViewAll={canExpandSection(recommendedTracks) ? () => openSectionPage("recommended") : undefined}
                onReload={() => handleSectionReload("recommended")}
                loading={reloadingSection === "recommended"}
                viewAllLabel="View all"
                showPager={!isMobile && shouldShowPager("recommended", recommendedTracks.length)}
                onPageBack={() => moveSectionPage("recommended", recommendedTracks.length, -1)}
                onPageForward={() => moveSectionPage("recommended", recommendedTracks.length, 1)}
                canPageBack={getCurrentPage("recommended", recommendedTracks.length) > 0}
                canPageForward={getCurrentPage("recommended", recommendedTracks.length) < getPageCount(recommendedTracks.length) - 1}
              />
            )}
          >
            {renderSectionRow(recommendedTracks, "recommended", (track) => (
              <motion.div key={`rec-${track.id}`} variants={rowItemVariants}>
                <TrackCard
                  track={track}
                  tracks={recommendedTracks}
                  liked={isLiked(track.id)}
                  onToggleLike={() => {
                    void toggleLike(track);
                  }}
                />
              </motion.div>
            ), `recommended:${recommendedTracks.length}:${recommendedTracks[0]?.id ?? "empty"}:${recommendedTracks[recommendedTracks.length - 1]?.id ?? "empty"}`)}
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
                onViewAll={canExpandSection(newReleases) ? () => openSectionPage("newreleases") : undefined}
                onReload={() => handleSectionReload("newreleases")}
                loading={reloadingSection === "newreleases"}
                viewAllLabel="View all"
                showPager={!isMobile && shouldShowPager("newreleases", newReleases.length)}
                onPageBack={() => moveSectionPage("newreleases", newReleases.length, -1)}
                onPageForward={() => moveSectionPage("newreleases", newReleases.length, 1)}
                canPageBack={getCurrentPage("newreleases", newReleases.length) > 0}
                canPageForward={getCurrentPage("newreleases", newReleases.length) < getPageCount(newReleases.length) - 1}
              />
            )}
          >
            {renderSectionRow(newReleases, "newreleases", (album) => (
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
                />
              </motion.div>
            ), `newreleases:${newReleases.length}:${newReleases[0]?.id ?? "empty"}:${newReleases[newReleases.length - 1]?.id ?? "empty"}`)}
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
                onViewAll={canExpandSection(recentTracks) ? () => openSectionPage("recent") : undefined}
                onReload={() => handleSectionReload("recent")}
                loading={reloadingSection === "recent"}
                viewAllLabel="View all"
                showPager={!isMobile && shouldShowPager("recent", recentTracks.length)}
                onPageBack={() => moveSectionPage("recent", recentTracks.length, -1)}
                onPageForward={() => moveSectionPage("recent", recentTracks.length, 1)}
                canPageBack={getCurrentPage("recent", recentTracks.length) > 0}
                canPageForward={getCurrentPage("recent", recentTracks.length) < getPageCount(recentTracks.length) - 1}
              />
            )}
          >
            {renderSectionRow(recentTracks, "recent", (track, index) => (
              <motion.div key={`recent-${track.id}-${index}`} variants={rowItemVariants}>
                <TrackCard
                  track={track}
                  tracks={recentTracks}
                  liked={isLiked(track.id)}
                  onToggleLike={() => {
                    void toggleLike(track);
                  }}
                />
              </motion.div>
            ), `recent:${recentTracks.length}:${recentTracks[0]?.id ?? "empty"}:${recentTracks[recentTracks.length - 1]?.id ?? "empty"}`)}
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
                onViewAll={canExpandSection(recommendedAlbums) ? () => openSectionPage("recalbums") : undefined}
                onReload={() => handleSectionReload("recalbums")}
                loading={reloadingSection === "recalbums"}
                viewAllLabel="View all"
                showPager={!isMobile && shouldShowPager("recalbums", recommendedAlbums.length)}
                onPageBack={() => moveSectionPage("recalbums", recommendedAlbums.length, -1)}
                onPageForward={() => moveSectionPage("recalbums", recommendedAlbums.length, 1)}
                canPageBack={getCurrentPage("recalbums", recommendedAlbums.length) > 0}
                canPageForward={getCurrentPage("recalbums", recommendedAlbums.length) < getPageCount(recommendedAlbums.length) - 1}
              />
            )}
          >
            {renderSectionRow(recommendedAlbums, "recalbums", (album) => (
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
            ), `recalbums:${recommendedAlbums.length}:${recommendedAlbums[0]?.id ?? "empty"}:${recommendedAlbums[recommendedAlbums.length - 1]?.id ?? "empty"}`)}
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
                onViewAll={canExpandSection(recommendedArtists) ? () => openSectionPage("recartists") : undefined}
                onReload={() => handleSectionReload("recartists")}
                loading={reloadingSection === "recartists"}
                viewAllLabel="View all"
                showPager={!isMobile && shouldShowPager("recartists", recommendedArtists.length)}
                onPageBack={() => moveSectionPage("recartists", recommendedArtists.length, -1)}
                onPageForward={() => moveSectionPage("recartists", recommendedArtists.length, 1)}
                canPageBack={getCurrentPage("recartists", recommendedArtists.length) > 0}
                canPageForward={getCurrentPage("recartists", recommendedArtists.length) < getPageCount(recommendedArtists.length) - 1}
              />
            )}
          >
            {renderSectionRow(recommendedArtists, "recartists", (artist) => (
              <motion.div key={`rec-art-${artist.id}`} variants={rowItemVariants}>
                <ArtistCardWrapper
                  artist={artist}
                />
              </motion.div>
            ), `recartists:${recommendedArtists.length}:${recommendedArtists[0]?.id ?? "empty"}:${recommendedArtists[recommendedArtists.length - 1]?.id ?? "empty"}`)}
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
