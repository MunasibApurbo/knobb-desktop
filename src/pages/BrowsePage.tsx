import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Disc3, ListMusic, Music2, RadioTower, Shapes, type LucideIcon } from "lucide-react";

import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import { MediaCardShell } from "@/components/MediaCardShell";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { useBrowseHotNew, type BrowseHotNewSection } from "@/hooks/useBrowseHotNew";
import { useSavedAlbums } from "@/hooks/useSavedAlbums";
import { useHomeFeeds } from "@/hooks/useHomeFeeds";
import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import { PlaylistLink } from "@/components/PlaylistLink";
import { useIsMobile } from "@/hooks/use-mobile";

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
    description: "Hot & New feed data, normalized into Knobb sections and rendered with the current Browse UI.",
    icon: Compass,
    emptyTitle: "No hot and new data",
    emptyDescription: "This section is available but currently has no discovery items to show.",
  },
  unreleased: {
    label: "Unreleased",
    description: "This browse tab is currently empty.",
    icon: RadioTower,
    emptyTitle: "No unreleased data",
    emptyDescription: "Unreleased browse data is currently cleared from this page.",
  },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
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
      className={`menu-sweep-hover group relative flex h-12 min-w-0 flex-1 items-center justify-between overflow-hidden rounded-[var(--mobile-control-radius)] border px-3 text-left text-sm font-semibold transition-colors md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:px-4 last:md:border-r-0 ${
        active ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black" : "border-white/10 bg-transparent text-white/72 hover:text-black"
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

function BrowseSectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="home-section-header hover-desaturate-meta flex items-center justify-between border border-white/10 border-b-0 px-4 py-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : <span />}
    </div>
  );
}

function BrowseSectionFrame({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mobile-page-panel">
      <BrowseSectionHeader title={title} meta={meta} />
      <div className="hover-desaturate-page">{children}</div>
    </section>
  );
}

function BrowseSkeleton() {
  return (
    <div className="media-card-grid gap-0 border-l border-t border-white/10">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="border-r border-b border-white/10 bg-white/[0.02]">
          <div className="aspect-square animate-pulse bg-white/[0.06]" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse bg-white/[0.07]" />
            <div className="h-3 w-1/2 animate-pulse bg-white/[0.05]" />
          </div>
        </div>
      ))}
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
      <div className="space-y-1 px-4 pb-4 pt-3">
        <PlaylistLink title={title} playlistId={playlistId} className="block truncate text-sm font-semibold text-white" />
        <p className="truncate text-sm text-white/55">{trackCount} tracks</p>
      </div>
    </MediaCardShell>
  );
}

function BrowseGenresSection({
  labels,
  onOpenBrowseAll,
}: {
  labels: string[];
  onOpenBrowseAll: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border border-white/10 px-4 py-4 md:px-5">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={onOpenBrowseAll}
          className="rounded-[var(--mobile-control-radius)] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/82 transition-colors hover:bg-white/[0.08] md:text-sm md:normal-case md:tracking-normal"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BrowseCollection<T>({
  items,
  isMobile,
  renderItem,
  resolveKey,
}: {
  items: T[];
  isMobile: boolean;
  renderItem: (item: T, index: number) => React.ReactNode;
  resolveKey: (item: T, index: number) => string;
}) {
  if (isMobile) {
    return (
      <div
        className="overflow-x-auto border-l border-r border-b border-white/10 scrollbar-hide"
        style={{ ["--home-row-columns" as string]: 1.72 }}
      >
        <div className="home-section-inline-row scrollbar-hide">
          {items.map((item, index) => (
            <div key={resolveKey(item, index)} className="home-section-inline-item">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hover-desaturate-grid media-card-grid gap-0 border-l border-t border-white/10">
      {items.map((item, index) => (
        <motion.div key={resolveKey(item, index)} variants={stagger} initial="hidden" animate="show">
          {renderItem(item, index)}
        </motion.div>
      ))}
    </div>
  );
}

function BrowseHotNewSection({
  section,
  isMobile,
  isAlbumSaved,
  toggleSavedAlbum,
  isLiked,
  toggleLike,
  navigate,
}: {
  section: BrowseHotNewSection;
  isMobile: boolean;
  isAlbumSaved: (albumId: number) => boolean;
  toggleSavedAlbum: (input: {
    albumId: number;
    albumTitle: string;
    albumArtist: string;
    albumCoverUrl: string;
    albumYear: number | null;
  }) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: import("@/types/music").Track) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (section.type === "genres") {
    return (
      <BrowseSectionFrame title={section.title} meta={`${section.items.length} genres`}>
        <BrowseGenresSection labels={section.items.map((genre) => genre.label)} onOpenBrowseAll={() => navigate("/genre")} />
      </BrowseSectionFrame>
    );
  }

  if (section.type === "albums") {
    return (
      <BrowseSectionFrame title={section.title} meta={`${section.items.length} items`}>
        <BrowseCollection
          items={section.items}
          isMobile={isMobile}
          resolveKey={(album) => `${section.id}-${album.id}`}
          renderItem={(album) => (
              <HomeAlbumCard
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
      </BrowseSectionFrame>
    );
  }

  if (section.type === "artists") {
    return (
      <BrowseSectionFrame title={section.title} meta={`${section.items.length} items`}>
        <BrowseCollection
          items={section.items}
          isMobile={isMobile}
          resolveKey={(artist) => `${section.id}-${artist.id}`}
          renderItem={(artist) => <ArtistCardWrapper artist={artist} />}
        />
      </BrowseSectionFrame>
    );
  }

  if (section.type === "tracks") {
    return (
      <BrowseSectionFrame title={section.title} meta={`${section.items.length} items`}>
        <BrowseCollection
          items={section.items}
          isMobile={isMobile}
          resolveKey={(track) => `${section.id}-${track.id}`}
          renderItem={(track) => (
              <TrackCard
                track={track}
                tracks={section.items}
                liked={isLiked(track.id)}
                onToggleLike={() => {
                  void toggleLike(track);
                }}
              />
          )}
        />
      </BrowseSectionFrame>
    );
  }

  return (
    <BrowseSectionFrame title={section.title} meta={`${section.items.length} items`}>
      <BrowseCollection
        items={section.items}
        isMobile={isMobile}
        resolveKey={(playlist) => `${section.id}-${playlist.uuid}`}
        renderItem={(playlist) => (
            <BrowsePlaylistCard
              playlistId={playlist.uuid}
              title={playlist.title}
              coverUrl={getPlaylistCoverUrl(playlist.image, playlist.squareImage)}
              trackCount={playlist.numberOfTracks}
              onSelect={() => navigate(`/playlist/${playlist.uuid}`)}
            />
        )}
      />
    </BrowseSectionFrame>
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
  const [activeTab, setActiveTab] = useState<BrowseTab>("hotNew");
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

  const hotNewCounts = useMemo(() => {
    return hotNewSections.reduce(
      (acc, section) => {
        acc.sections += 1;
        acc[section.type] += section.items.length;
        return acc;
      },
      {
        sections: 0,
        albums: 0,
        artists: 0,
        tracks: 0,
        playlists: 0,
        genres: 0,
      },
    );
  }, [hotNewSections]);

  const hotNewCount = hotNewSections.reduce((sum, section) => sum + section.items.length, 0);

  const activeMeta = TAB_META[activeTab];
  const activeCount = activeTab === "hotNew" ? hotNewCount : 0;
  const showLoading = activeTab === "hotNew" && (!homeLoaded || !browseLoaded);
  const hasHotNewContent = hotNewSections.length > 0;

  return (
    <PageTransition>
      <div className="mobile-page-shell hover-desaturate-page">
        <section className="mobile-page-panel border border-white/10 border-b-0">
          <div className="flex flex-col gap-2 px-4 py-4 md:px-6 md:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Browse</p>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <h1 className="text-[2rem] font-black tracking-tight text-white md:text-5xl">{activeMeta.label}</h1>
              <div className="text-xs uppercase tracking-[0.16em] text-white/45 md:text-sm md:normal-case md:tracking-normal">{activeCount} available</div>
            </div>
            <p className="max-w-3xl text-[13px] leading-5 text-white/58 md:text-sm md:leading-6">{activeMeta.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-3 py-3 md:flex md:gap-0 md:px-0 md:py-0">
            <BrowseTabButton tab="hotNew" active={activeTab === "hotNew"} count={hotNewCount} onClick={() => setActiveTab("hotNew")} />
            <BrowseTabButton tab="unreleased" active={activeTab === "unreleased"} count={0} onClick={() => setActiveTab("unreleased")} />
          </div>

          <div className="grid grid-cols-2 border-t border-white/10 md:grid-cols-5">
            {(activeTab === "hotNew"
              ? [
                  { label: "Sections", value: hotNewCounts.sections, icon: Compass },
                  { label: "Albums", value: hotNewCounts.albums, icon: Disc3 },
                  { label: "Tracks", value: hotNewCounts.tracks, icon: Music2 },
                  { label: "Playlists", value: hotNewCounts.playlists, icon: ListMusic },
                  { label: "Genres", value: hotNewCounts.genres, icon: Shapes },
                ]
              : Array.from({ length: 5 }).map(() => ({ label: "Empty", value: 0, icon: RadioTower }))
            ).map((item) => {
              const Icon = item.icon;
              return (
                <div key={`${activeTab}-${item.label}`} className="menu-sweep-hover relative border-r border-white/10 px-3 py-3 last:border-r-0 md:px-4">
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
            <section className="mobile-page-panel overflow-hidden border border-white/10 bg-white/[0.02]">
              <BrowseSkeleton />
            </section>
          ) : activeTab === "hotNew" && hasHotNewContent ? (
            <>
              {hotNewSections.map((section) => (
                <BrowseHotNewSection
                  key={section.id}
                  section={section}
                  isMobile={isMobile}
                  isAlbumSaved={isAlbumSaved}
                  toggleSavedAlbum={toggleSavedAlbum}
                  isLiked={isLiked}
                  toggleLike={toggleLike}
                  navigate={navigate}
                />
              ))}
            </>
          ) : (
            <section className="mobile-page-panel border border-white/10 bg-white/[0.02] px-5 py-12 md:px-6">
              <div className="flex flex-col gap-5 border border-white/10 bg-white/[0.03] px-6 py-7 md:flex-row md:items-end md:justify-between">
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
                  onClick={() => navigate(activeTab === "hotNew" ? "/" : "/unreleased")}
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
