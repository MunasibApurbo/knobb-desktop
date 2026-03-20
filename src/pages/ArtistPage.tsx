import {
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import type { TidalAlbum } from "@/lib/musicApiTypes";
import { useArtistPageData } from "@/hooks/useArtistPageData";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { Play, Pause, Shuffle, Heart, Share, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArtistCard } from "@/components/ArtistCard";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { useResolvedArtistImage } from "@/hooks/useResolvedArtistImage";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { Track } from "@/types/music";
import { buildArtistMixPath, copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { useSettings } from "@/contexts/SettingsContext";
import { useResponsiveMediaCardCount } from "@/hooks/useResponsiveMediaCardCount";
import { useCarousel } from "@/hooks/useCarousel";
import type { HomeAlbum } from "@/hooks/useHomeFeeds";
import { PageTransition } from "@/components/PageTransition";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";
import { CarouselSection } from "@/components/carousel/CarouselSection";

type PlayTrackHandler = ReturnType<typeof usePlayer>["play"];
type IsTrackLikedHandler = ReturnType<typeof useLikedSongs>["isLiked"];
type ToggleLikeHandler = ReturnType<typeof useLikedSongs>["toggleLike"];
type BioLinkType = "artist" | "album" | "track" | "playlist";

const BIO_LINK_TYPES: BioLinkType[] = ["artist", "album", "track", "playlist"];

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
    <div className="artist-page-header home-section-header hover-desaturate-meta flex items-center justify-between">
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
      </div>
    </div>
  );
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
  play: PlayTrackHandler;
  isLiked: IsTrackLikedHandler;
  toggleLike: ToggleLikeHandler;
  initialVisibleCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  if (tracks.length === 0) {
    return null;
  }

  const displayedTracks = showAll ? tracks : tracks.slice(0, initialVisibleCount);

  return (
    <section className={cn("artist-page-section home-motion-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
      <div className="artist-page-header home-section-header hover-desaturate-meta flex items-center justify-between px-4 pt-6 pb-2 md:px-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{title}</h2>
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
                desktopMeta={track.album || undefined}
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

export default function ArtistPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const artistName = searchParams.get("name") || "";
  const navigate = useNavigate();
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { cardSize } = useSettings();
  const { containerRef, collapsedCount: initialVisibleCount } = useResponsiveMediaCardCount(cardSize);
  const carousel = useCarousel(initialVisibleCount);
  const denseArtistShelf = initialVisibleCount >= 6;
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const { isLiked, toggleLike } = useLikedSongs();
  const { isSaved: isAlbumSaved, toggleSavedAlbum } = useSavedAlbums();
  const {
    albums,
    artist,
    artistVideos = [],
    bio,
    loading,
    relatedArtists,
    setShowAllTracks,
    showAllTracks,
    singlesAndEps,
    topTracks,
  } = useArtistPageData({ artistName, id, includeRadio: false });
  const [bioDialogOpen, setBioDialogOpen] = useState(false);

  useEffect(() => {
    setBioDialogOpen(false);
  }, [artistName, id]);

  function renderArtistSectionRow<T>(
    items: T[],
    section: string,
    renderItem: (item: T, index: number) => ReactNode,
  ) {
    return (
      <CarouselSection
        items={items}
        sectionKey={section}
        carousel={carousel}
        className="artist-page-grid"
        renderItem={renderItem}
      />
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

  if (!artist && !loading) {
    return <div className="p-8 text-foreground">Artist not found.</div>;
  }

  if (!artist) {
    return (
      <PageTransition>
        <div ref={containerRef} className="page-shell home-page-surface bg-black">
          <DetailHero
            artworkUrl={topTracks[0]?.coverUrl || "/placeholder.svg"}
            label="Artist"
            title={artistName || "Artist"}
            body={<p>Opening artist details.</p>}
          />
        </div>
      </PageTransition>
    );
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
          WebkitLineClamp: 3,
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
      {artistVideos.length > 0 ? (
        <span className="detail-chip">
          <span>Videos</span>
          <strong>{artistVideos.length}</strong>
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
      <div ref={containerRef} className="artist-page-shell page-shell home-page-surface bg-black hover-desaturate-page">
        <DetailHero
          artworkUrl={artistImageUrl || topTracks[0]?.coverUrl || "/placeholder.svg"}
          artworkWrapper={(artwork) => (
            <ArtistContextMenu
              artistId={artist.id}
              artistName={artist.name}
              artistImageUrl={artistImageUrl || topTracks[0]?.coverUrl || "/placeholder.svg"}
            >
              {artwork}
            </ArtistContextMenu>
          )}
          body={heroBody}
          dragPayload={topTracks.length > 0 ? {
            label: artist.name,
            source: "selection",
            tracks: topTracks,
          } : undefined}
          label="Artist"
          meta={heroMeta}
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
        play={play}
        isLiked={isLiked}
        toggleLike={toggleLike}
        initialVisibleCount={initialVisibleCount}
        showAll={showAllTracks}
        onToggleShowAll={() => setShowAllTracks((prev) => !prev)}
      />

      {albums.length > 0 && (
        <section className={cn("artist-page-section home-motion-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          {(() => {
            const currentPage = carousel.getCurrentPage("albums", albums.length);
            return (
              <>
          <ArtistSectionHeader
            title="Albums"
            showPager={carousel.shouldShowPager("albums", albums.length)}
            onPageBack={() => carousel.moveSectionPage("albums", albums.length, -1)}
            onPageForward={() => carousel.moveSectionPage("albums", albums.length, 1)}
            canPageBack={carousel.getCurrentPage("albums", albums.length) > 0}
            canPageForward={carousel.getCurrentPage("albums", albums.length) < carousel.getPageCount(albums.length) - 1}
          />
          {renderArtistSectionRow(albums, "albums", (album, index) => (
            <HomeAlbumCard
              key={album.id}
              album={mapArtistAlbumToHomeAlbum(album)}
              saved={isAlbumSaved(album.id)}
              onToggleSave={() => void handleToggleSavedAlbum(album)}
              isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
              lightweight={denseArtistShelf}
            />
          ))}
              </>
            );
          })()}
        </section>
      )}

      {singlesAndEps.length > 0 && (
        <section className={cn("artist-page-section home-motion-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          {(() => {
            const currentPage = carousel.getCurrentPage("singles-and-eps", singlesAndEps.length);
            return (
              <>
          <ArtistSectionHeader
            title="Singles & EPs"
            showPager={carousel.shouldShowPager("singles-and-eps", singlesAndEps.length)}
            onPageBack={() => carousel.moveSectionPage("singles-and-eps", singlesAndEps.length, -1)}
            onPageForward={() => carousel.moveSectionPage("singles-and-eps", singlesAndEps.length, 1)}
            canPageBack={carousel.getCurrentPage("singles-and-eps", singlesAndEps.length) > 0}
            canPageForward={carousel.getCurrentPage("singles-and-eps", singlesAndEps.length) < carousel.getPageCount(singlesAndEps.length) - 1}
          />
          {renderArtistSectionRow(singlesAndEps, "singles-and-eps", (album, index) => (
            <HomeAlbumCard
              key={album.id}
              album={mapArtistAlbumToHomeAlbum(album)}
              saved={isAlbumSaved(album.id)}
              onToggleSave={() => void handleToggleSavedAlbum(album)}
              isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
              lightweight={denseArtistShelf}
            />
          ))}
              </>
            );
          })()}
        </section>
      )}

      {artistVideos.length > 0 && (
        <section className={cn("artist-page-section home-motion-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          {(() => {
            const currentPage = carousel.getCurrentPage("videos", artistVideos.length);
            return (
              <>
          <ArtistSectionHeader
            title="Videos"
            showPager={carousel.shouldShowPager("videos", artistVideos.length)}
            onPageBack={() => carousel.moveSectionPage("videos", artistVideos.length, -1)}
            onPageForward={() => carousel.moveSectionPage("videos", artistVideos.length, 1)}
            canPageBack={carousel.getCurrentPage("videos", artistVideos.length) > 0}
            canPageForward={carousel.getCurrentPage("videos", artistVideos.length) < carousel.getPageCount(artistVideos.length) - 1}
          />
          {renderArtistSectionRow(artistVideos, "videos", (video, index) => (
            <TrackCard
              key={video.id}
              track={video}
              tracks={artistVideos}
              liked={isLiked(video.id)}
              onToggleLike={() => toggleLike(video)}
              isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
              lightweight={denseArtistShelf}
            />
          ))}
              </>
            );
          })()}
        </section>
      )}

      {relatedArtists.length > 0 && (
        <section className={cn("artist-page-section home-motion-section page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
          {(() => {
            const currentPage = carousel.getCurrentPage("related-artists", relatedArtists.length);
            return (
              <>
          <ArtistSectionHeader
            title="Related Artists"
            showPager={carousel.shouldShowPager("related-artists", relatedArtists.length)}
            onPageBack={() => carousel.moveSectionPage("related-artists", relatedArtists.length, -1)}
            onPageForward={() => carousel.moveSectionPage("related-artists", relatedArtists.length, 1)}
            canPageBack={carousel.getCurrentPage("related-artists", relatedArtists.length) > 0}
            canPageForward={carousel.getCurrentPage("related-artists", relatedArtists.length) < carousel.getPageCount(relatedArtists.length) - 1}
          />
          {renderArtistSectionRow(relatedArtists, "related-artists", (relatedArtist, index) => (
            <ArtistCard
              key={relatedArtist.id}
              id={relatedArtist.id}
              name={relatedArtist.name}
              imageUrl={relatedArtist.picture}
              isPriority={isVisibleShelfItemPriority(currentPage, carousel.cardCount, index)}
              lightweight={denseArtistShelf}
            />
          ))}
              </>
            );
          })()}
        </section>
      )}

      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="flex w-[min(1120px,calc(100vw-32px))] max-w-[1120px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-white/10 px-8 py-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">Artist Biography</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 max-h-[min(72vh,calc(100vh-10rem))] overflow-y-auto px-8 py-8">
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
