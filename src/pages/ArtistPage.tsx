import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import type { TidalAlbum } from "@/lib/musicApiTypes";
import { useArtistPageData } from "@/hooks/useArtistPageData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, Share, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackListSkeleton } from "@/components/LoadingSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArtistCard } from "@/components/ArtistCard";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { HomeAlbumCard } from "@/components/home/HomeMediaCards";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useIsMobile } from "@/hooks/use-mobile";
import { Track } from "@/types/music";
import { buildArtistMixPath, copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import type { HomeAlbum } from "@/hooks/useHomeFeeds";
import { PageTransition } from "@/components/PageTransition";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";

type PlayTrackHandler = ReturnType<typeof usePlayer>["play"];
type IsTrackLikedHandler = ReturnType<typeof useLikedSongs>["isLiked"];
type ToggleLikeHandler = ReturnType<typeof useLikedSongs>["toggleLike"];
type BioLinkType = "artist" | "album" | "track" | "playlist";

const BIO_LINK_TYPES: BioLinkType[] = ["artist", "album", "track", "playlist"];
const CARD_ROW_FRAME = "artist-page-grid home-section-grid hover-desaturate-grid home-section-carousel-frame border-l border-t border-white/10";

function getCarouselTransform(pageIndex: number, dragOffset = 0) {
  return `translate3d(calc(${-pageIndex * 100}% + ${dragOffset}px), 0, 0)`;
}

function ArtistSectionHeader({
  title,
  showPager,
  onPageBack,
  onPageForward,
  canPageBack,
  canPageForward,
}: {
  title: string;
  showPager?: boolean;
  onPageBack?: () => void;
  onPageForward?: () => void;
  canPageBack?: boolean;
  canPageForward?: boolean;
}) {
  return (
    <div className="artist-page-header home-section-header hover-desaturate-meta flex items-center justify-between border border-white/10 border-b-0 px-4 py-3">
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
      </div>
    </div>
  );
}

function stripArtistBioMarkup(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\[wimpLink[^\]]*\]/gi, "")
    .replace(/\[(artist|album|track|playlist):[^\]]+\]/gi, "")
    .replace(/\[\/wimpLink\]/gi, "")
    .replace(/\[\/(artist|album|track|playlist)\]/gi, "")
    .replace(/\[\[(.*?)\|(.*?)\]\]/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeArtistBio(value: string) {
  return stripArtistBioMarkup(value);
}

function parseWimpLinkAttributes(value: string) {
  for (const type of BIO_LINK_TYPES) {
    const match = value.match(new RegExp(`${type}Id="([^"]+)"`, "i"));
    if (match?.[1]) {
      return { type, id: match[1] };
    }
  }

  return null;
}

function normalizeArtistBioToHtml(value: string) {
  if (!value) return "";

  let parsed = value;

  parsed = parsed.replace(/\[wimpLink ([^\]]+)\]([\s\S]*?)\[\/wimpLink\]/gi, (_match, attrs, label) => {
    const resolved = parseWimpLinkAttributes(String(attrs));
    if (!resolved) return String(label);
    return `<a data-bio-type="${resolved.type}" data-bio-id="${resolved.id}">${label}</a>`;
  });

  parsed = parsed.replace(
    /\[(artist|album|track|playlist):([^\]]+)\]([\s\S]*?)\[\/\1\]/gi,
    (_match, type, id, label) => `<a data-bio-type="${String(type).toLowerCase()}" data-bio-id="${id}">${label}</a>`,
  );

  parsed = parsed.replace(
    /\[\[(.*?)\|(.*?)\]\]/g,
    (_match, label, id) => `<a data-bio-type="artist" data-bio-id="${id}">${label}</a>`,
  );

  return parsed.replace(/\n/g, "<br />");
}

function renderArtistBioContent(
  value: string,
  onInternalLinkClick: (type: BioLinkType, id: string, label: string) => void,
): ReactNode[] {
  if (!value) return [];
  if (typeof window === "undefined") return [sanitizeArtistBio(value)];

  const html = normalizeArtistBioToHtml(value);
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return [sanitizeArtistBio(value)];

  const renderNodes = (nodes: Node[], keyPrefix: string): ReactNode[] =>
    nodes.map((node, index) => {
      const key = `${keyPrefix}-${index}`;

      if (node.nodeType === 3) {
        return node.textContent;
      }

      if (node.nodeType !== 1) {
        return null;
      }

      const element = node as HTMLElement;
      const children = renderNodes(Array.from(element.childNodes), key);
      const tagName = element.tagName.toLowerCase();

      if (tagName === "br") {
        return <br key={key} />;
      }

      if (tagName === "a") {
        const bioType = element.getAttribute("data-bio-type") as BioLinkType | null;
        const bioId = element.getAttribute("data-bio-id");
        const label = element.textContent?.trim() || "";
        const href = element.getAttribute("href");

        if (bioType && bioId) {
          return (
            <button
              key={key}
              type="button"
              className="cursor-pointer text-left text-[#f3a79f] underline underline-offset-4 transition-colors hover:text-white"
              onClick={() => onInternalLinkClick(bioType, bioId, label)}
            >
              {children}
            </button>
          );
        }

        if (href) {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#f3a79f] underline underline-offset-4 transition-colors hover:text-white"
            >
              {children}
            </a>
          );
        }
      }

      if (tagName === "strong" || tagName === "b") {
        return <strong key={key}>{children}</strong>;
      }

      if (tagName === "em" || tagName === "i") {
        return <em key={key}>{children}</em>;
      }

      if (tagName === "p") {
        return <p key={key}>{children}</p>;
      }

      return <span key={key}>{children}</span>;
    });

  return renderNodes(Array.from(root.childNodes), "bio");
}

function mapArtistAlbumToHomeAlbum(album: TidalAlbum): HomeAlbum {
  const artistName = album.artists?.map((artist) => artist.name).filter(Boolean).join(", ")
    || album.artist?.name
    || "Various Artists";

  return {
    id: album.id,
    title: album.title,
    artist: artistName,
    artistId: album.artist?.id ?? album.artists?.[0]?.id,
    coverUrl: album.cover ? getTidalImageUrl(album.cover, "750x750") : "/placeholder.svg",
    releaseDate: album.releaseDate,
  };
}

function ArtistTrackSection({
  title,
  tracks,
  currentTrack,
  isPlaying,
  loading,
  play,
  isLiked,
  toggleLike,
  initialVisibleCount,
  showAll,
  onToggleShowAll,
}: {
  title: string;
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  loading: boolean;
  play: PlayTrackHandler;
  isLiked: IsTrackLikedHandler;
  toggleLike: ToggleLikeHandler;
  initialVisibleCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  if (loading && tracks.length === 0) {
    return (
      <section className="artist-page-section border border-white/10 border-t-0 bg-white/[0.02]">
        <div className="artist-page-header home-section-header hover-desaturate-meta flex items-center border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        <TrackListSkeleton count={5} />
      </section>
    );
  }

  if (tracks.length === 0) {
    return null;
  }

  const displayedTracks = showAll ? tracks : tracks.slice(0, initialVisibleCount);

  return (
    <section className="artist-page-section border border-white/10 border-t-0 bg-white/[0.02]">
      <div className="artist-page-header home-section-header hover-desaturate-meta flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {tracks.length > initialVisibleCount && (
          <button
            type="button"
            className="relative z-10 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            onClick={onToggleShowAll}
          >
            {showAll ? "Show less" : "See more"}
          </button>
        )}
      </div>
      <VirtualizedTrackList
        items={displayedTracks}
        getItemKey={(track) => track.id}
        rowHeight={86}
        renderRow={(track, i) => {
          const isCurrent = isSameTrack(currentTrack, track);

          return (
            <TrackContextMenu key={track.id} track={track} tracks={tracks}>
              <TrackListRow
                dragHandleLabel={`Drag ${track.title} to a playlist`}
                index={i}
                isCurrent={isCurrent}
                isLiked={isLiked(track.id)}
                isPlaying={isPlaying}
                mobileMeta={track.album || undefined}
                onDragHandleStart={(event) => {
                  startPlaylistDrag(event.dataTransfer, {
                    label: track.title,
                    source: "track",
                    tracks: [track],
                  });
                }}
                onPlay={() => play(track, tracks)}
                onToggleLike={() => toggleLike(track)}
                track={track}
              />
            </TrackContextMenu>
          );
        }}
      />
    </section>
  );
}

function ArtistPageSkeleton({ artistName }: { artistName: string }) {
  const hasName = artistName.trim().length > 0;

  return (
    <div className="artist-page-shell mobile-page-shell hover-desaturate-page animate-fade-in">
      <DetailHero
        artworkUrl="/placeholder.svg"
        label="Artist"
        title={
          hasName ? (
            artistName
          ) : (
            <Skeleton className="h-14 w-[18rem] max-w-full bg-white/10 md:h-16" />
          )
        }
        body={
          <div className="max-w-3xl space-y-2">
            <Skeleton className="h-4 w-[18rem] max-w-full bg-white/10" />
            <Skeleton className="h-4 w-[24rem] max-w-full bg-white/10" />
          </div>
        }
        meta={
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-24 rounded-full bg-white/10" />
            ))}
          </>
        }
      />

      <DetailActionBar columns={5}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex h-14 items-center px-4 md:px-6">
            <Skeleton className="h-4 w-24 bg-white/10" />
          </div>
        ))}
      </DetailActionBar>

      <section className="artist-page-section border border-white/10 bg-white/[0.02]">
        <div className="px-4 h-14 border-b border-white/10 flex items-center">
          <h2 className="text-lg font-bold text-foreground">Popular</h2>
        </div>
        <TrackListSkeleton count={5} />
      </section>
    </div>
  );
}

export default function ArtistPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const artistName = searchParams.get("name") || "";
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { cardSize } = useSettings();
  const { containerRef, collapsedCount: initialVisibleCount } = useResponsiveMediaCardCount(cardSize);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const {
    albums,
    artist,
    bio,
    loading,
    relatedArtists,
    scrollY,
    setShowAllTracks,
    showAllTracks,
    singlesAndEps,
    topTracks,
    tracksLoading,
  } = useArtistPageData({ artistName, id, includeRadio: false });
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [sectionPageIndexes, setSectionPageIndexes] = useState<Record<string, number>>({});
  const [draggingSections, setDraggingSections] = useState<Record<string, boolean>>({});
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionItemCountsRef = useRef<Record<string, number>>({});
  const dragSessionsRef = useRef<Record<string, { pointerId: number; startX: number; lastOffset: number; moved: boolean }>>({});
  const dragAnimationFramesRef = useRef<Record<string, number | undefined>>({});
  const pendingTransformsRef = useRef<Record<string, { pageIndex: number; dragOffset: number } | undefined>>({});
  const clickSuppressionRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setBioDialogOpen(false);
  }, [artistName, id]);

  const getPageCount = (itemsLength: number) =>
    Math.max(1, Math.ceil(itemsLength / Math.max(1, initialVisibleCount)));

  const getCurrentPage = (section: string, itemsLength: number) =>
    Math.min(sectionPageIndexes[section] ?? 0, getPageCount(itemsLength) - 1);

  function getSectionPages<T>(items: T[]) {
    const pageSize = Math.max(1, initialVisibleCount);
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

  const shouldShowPager = (_section: string, itemsLength: number) =>
    getPageCount(itemsLength) > 1;

  const rowStyle = {
    "--home-row-columns": Math.max(1, initialVisibleCount),
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

    const frameWidth = frameRefs.current[section]?.clientWidth ?? event.currentTarget.clientWidth;
    const threshold = Math.max(56, frameWidth * 0.14);

    if (Math.abs(session.lastOffset) >= threshold) {
      moveSectionPage(section, itemsLength, session.lastOffset < 0 ? 1 : -1);
    }

    clickSuppressionRef.current[section] = Date.now() + 220;
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

  function renderArtistSectionRow<T>(
    items: T[],
    section: string,
    renderItem: (item: T, index: number) => ReactNode,
  ) {
    sectionItemCountsRef.current[section] = items.length;

    if (isMobile) {
      return (
        <div
          className="overflow-x-auto border-l border-r border-b border-white/10 scrollbar-hide"
          style={{ ["--home-row-columns" as string]: 1.16 }}
        >
          <div className="home-section-inline-row scrollbar-hide">
            {items.map((item, index) => (
              <div key={`${section}-${index}`} className="home-section-inline-item">
                {renderItem(item, index)}
              </div>
            ))}
          </div>
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
        <div
          ref={setTrackRef(section)}
          className={`home-section-carousel-track ${isDragging ? "is-dragging" : ""}`}
          style={{
            transform: getCarouselTransform(currentPage),
          }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div key={`${section}-page-${pageIndex}`} className="home-section-carousel-page">
              {pageItems.map((item, itemIndex) => renderItem(item, pageIndex * initialVisibleCount + itemIndex))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const artistImageUrl = useResolvedArtistImage(
    artist?.id,
    artist?.picture ? getTidalImageUrl(artist.picture, "750x750") : topTracks[0]?.coverUrl || "",
    artist?.name || artistName,
  );
  const artistDescription = artist
    ? sanitizeArtistBio(bio) ||
      sanitizeArtistBio(artist.bio || "") ||
      `Discover popular tracks, albums and related artists from ${artist.name}.`
    : "";

  usePageMetadata(artist ? {
    title: artist.name,
    description: artistDescription,
    image: artistImageUrl || topTracks[0]?.coverUrl || undefined,
    imageAlt: `${artist.name} artist image`,
    type: "profile",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: artist.name,
      description: artistDescription,
      image: artistImageUrl || topTracks[0]?.coverUrl || undefined,
      url:
        typeof window !== "undefined"
          ? new URL(window.location.pathname, window.location.origin).toString()
          : undefined,
    },
  } : null);

  if (loading && !artist) {
    return <ArtistPageSkeleton artistName={artistName} />;
  }

  if (!artist) {
    return <div className="p-8 text-foreground">Artist not found.</div>;
  }

  const isCurrentArtist = currentTrack && topTracks.some((t) => t.id === currentTrack.id);
  const hasArtistMix = Boolean(artist.mixes?.ARTIST_MIX);
  const favorite = isFavorite(artist.id);

  const handleToggleFavorite = async () => {
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const success = await toggleFavorite({
      artistId: artist.id,
      artistName: artist.name,
      artistImageUrl,
    });

    if (!success) {
      toast.error("Failed to update favorite artist");
      return;
    }
    toast.success(favorite ? `Removed ${artist.name} from favorites` : `Added ${artist.name} to favorites`);
  };

  const handleToggleSavedAlbum = async (album: TidalAlbum) => {
    if (!user) {
      const from = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate("/auth", { state: { from } });
      return;
    }

    const albumArtist = album.artists?.[0]?.name || album.artist?.name || artist.name;
    const albumCoverUrl = getTidalImageUrl(album.cover, "320x320");
    const albumYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;
    const wasSaved = isAlbumSaved(album.id);

    const success = await toggleSavedAlbum({
      albumId: album.id,
      albumTitle: album.title,
      albumArtist,
      albumCoverUrl,
      albumYear,
    });

    if (!success) {
      toast.error("Failed to update saved album");
      return;
    }

    toast.success(wasSaved ? `Removed ${album.title} from saved albums` : `Saved ${album.title}`);
  };

  const cleanBio = sanitizeArtistBio(bio);
  const rawHeroBio = bio || artist.bio || "";
  const fallbackDescription = `Discover popular tracks, albums and related artists from ${artist.name}.`;
  const heroBio = cleanBio || sanitizeArtistBio(artist.bio || "") || fallbackDescription;
  const hasDedicatedBiography = rawHeroBio.trim().length > 0;

  const handleBioLinkClick = (type: BioLinkType, targetId: string, label: string) => {
    setBioDialogOpen(false);

    if (type === "artist") {
      navigate(`/artist/${targetId}?name=${encodeURIComponent(label)}`);
      return;
    }

    if (type === "album") {
      const params = new URLSearchParams();
      if (label) params.set("title", label);
      const query = params.toString();
      navigate(`/album/tidal-${targetId}${query ? `?${query}` : ""}`);
      return;
    }

    if (type === "playlist") {
      navigate(`/playlist/${targetId}`);
      return;
    }

    navigate(`/search?q=${encodeURIComponent(label || targetId)}`);
  };

  const biographyContent = hasDedicatedBiography
    ? renderArtistBioContent(rawHeroBio, handleBioLinkClick)
    : [];

  const heroBody = (
    <div className="max-w-3xl">
      <p
        className="overflow-hidden text-sm leading-7 text-white/84 md:text-[15px] md:leading-8"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: isMobile ? 4 : 3,
        }}
      >
        {heroBio}
      </p>
      {hasDedicatedBiography ? (
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-white underline underline-offset-4 transition-colors hover:text-white/80"
          onClick={() => setBioDialogOpen(true)}
        >
          Read more
        </button>
      ) : null}
    </div>
  );

  const heroMeta = (
    <>
      <span className="detail-chip">
        <span>Top tracks</span>
        <strong>{topTracks.length}</strong>
      </span>
      {albums.length > 0 ? (
        <span className="detail-chip">
          <span>Albums</span>
          <strong>{albums.length}</strong>
        </span>
      ) : null}
      {singlesAndEps.length > 0 ? (
        <span className="detail-chip">
          <span>Singles</span>
          <strong>{singlesAndEps.length}</strong>
        </span>
      ) : null}
      {relatedArtists.length > 0 ? (
        <span className="detail-chip">
          <span>Related</span>
          <strong>{relatedArtists.length}</strong>
        </span>
      ) : null}
    </>
  );

  const handleShareArtist = async () => {
    const url = window.location.href;
    await copyPlainTextToClipboard(url);
    toast.success("Artist link copied to clipboard");
  };

  const handleShuffleArtist = () => {
    if (topTracks.length === 0) return;
    const shuffledTracks = [...topTracks].sort(() => Math.random() - 0.5);
    play(shuffledTracks[0], shuffledTracks);
  };

  return (
    <PageTransition>
      <div ref={containerRef} className="artist-page-shell mobile-page-shell hover-desaturate-page">
        <DetailHero
          artworkUrl={artistImageUrl || topTracks[0]?.coverUrl || "/placeholder.svg"}
          body={heroBody}
          dragPayload={topTracks.length > 0 ? {
            label: artist.name,
            source: "selection",
            tracks: topTracks,
          } : undefined}
          label="Artist"
          meta={heroMeta}
          scrollY={scrollY}
          title={artist.name}
        />

        <DetailActionBar columns={5}>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={() => {
            if (isCurrentArtist) togglePlay();
            else if (topTracks.length) play(topTracks[0], topTracks);
          }}
        >
          {isCurrentArtist && isPlaying ? (
            <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
          ) : (
            <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
          )}
          <span className="hero-action-label relative z-10">Play</span>
        </Button>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={handleShuffleArtist}
        >
          <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
          <span className="hero-action-label relative z-10">Shuffle</span>
        </Button>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={() => navigate(buildArtistMixPath(artist.id, artist.name))}
        >
          <Music className="hero-action-icon w-4 h-4 mr-2" />
          <span className="hero-action-label relative z-10">{hasArtistMix ? "Mix" : "Radio"}</span>
        </Button>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={handleToggleFavorite}
        >
          <Heart
            className={`hero-action-icon w-4 h-4 mr-2 transition-colors ${favorite
              ? "fill-current text-[hsl(var(--player-waveform))] group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
              : ""
              }`}
          />
          <span className="hero-action-label relative z-10">{favorite ? "Favorited" : "Add"}</span>
        </Button>
        <Button
          variant="secondary"
          className={DETAIL_ACTION_BUTTON_CLASS}
          onClick={handleShareArtist}
        >
          <Share className="hero-action-icon w-4 h-4 mr-2" />
          <span className="hero-action-label relative z-10">Share</span>
        </Button>
        </DetailActionBar>

      <ArtistTrackSection
        title="Popular"
        tracks={topTracks}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        loading={tracksLoading}
        play={play}
        isLiked={isLiked}
        toggleLike={toggleLike}
        initialVisibleCount={initialVisibleCount}
        showAll={showAllTracks}
        onToggleShowAll={() => setShowAllTracks((prev) => !prev)}
      />

      {albums.length > 0 && (
        <section>
          <ArtistSectionHeader
            title="Albums"
            showPager={!isMobile && shouldShowPager("albums", albums.length)}
            onPageBack={() => moveSectionPage("albums", albums.length, -1)}
            onPageForward={() => moveSectionPage("albums", albums.length, 1)}
            canPageBack={getCurrentPage("albums", albums.length) > 0}
            canPageForward={getCurrentPage("albums", albums.length) < getPageCount(albums.length) - 1}
          />
          {renderArtistSectionRow(albums, "albums", (album) => (
            <HomeAlbumCard
              key={album.id}
              album={mapArtistAlbumToHomeAlbum(album)}
              saved={isAlbumSaved(album.id)}
              onToggleSave={() => void handleToggleSavedAlbum(album)}
            />
          ))}
        </section>
      )}

      {singlesAndEps.length > 0 && (
        <section>
          <ArtistSectionHeader
            title="Singles & EPs"
            showPager={!isMobile && shouldShowPager("singles-and-eps", singlesAndEps.length)}
            onPageBack={() => moveSectionPage("singles-and-eps", singlesAndEps.length, -1)}
            onPageForward={() => moveSectionPage("singles-and-eps", singlesAndEps.length, 1)}
            canPageBack={getCurrentPage("singles-and-eps", singlesAndEps.length) > 0}
            canPageForward={getCurrentPage("singles-and-eps", singlesAndEps.length) < getPageCount(singlesAndEps.length) - 1}
          />
          {renderArtistSectionRow(singlesAndEps, "singles-and-eps", (album) => (
            <HomeAlbumCard
              key={album.id}
              album={mapArtistAlbumToHomeAlbum(album)}
              saved={isAlbumSaved(album.id)}
              onToggleSave={() => void handleToggleSavedAlbum(album)}
            />
          ))}
        </section>
      )}

      {relatedArtists.length > 0 && (
        <section>
          <ArtistSectionHeader
            title="Related Artists"
            showPager={!isMobile && shouldShowPager("related-artists", relatedArtists.length)}
            onPageBack={() => moveSectionPage("related-artists", relatedArtists.length, -1)}
            onPageForward={() => moveSectionPage("related-artists", relatedArtists.length, 1)}
            canPageBack={getCurrentPage("related-artists", relatedArtists.length) > 0}
            canPageForward={getCurrentPage("related-artists", relatedArtists.length) < getPageCount(relatedArtists.length) - 1}
          />
          {renderArtistSectionRow(relatedArtists, "related-artists", (relatedArtist) => (
            <ArtistCard
              key={relatedArtist.id}
              id={relatedArtist.id}
              name={relatedArtist.name}
              imageUrl={relatedArtist.picture}
            />
          ))}
        </section>
      )}

      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="w-[min(1120px,calc(100vw-32px))] max-w-[1120px] p-0">
          <DialogHeader className="border-b border-white/10 px-8 py-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">Artist Biography</DialogTitle>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto px-8 py-8">
            <div className="space-y-6 text-[1.05rem] leading-[1.95] text-white/92">
              {biographyContent}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PageTransition>
  );
}
