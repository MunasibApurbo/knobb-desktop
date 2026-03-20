import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Index from "@/pages/Index";
import type { Track } from "@/types/music";

const indexPageMocks = vi.hoisted(() => ({
  auth: {
    user: null,
    loading: false,
  },
  favoriteArtists: {
    favoriteArtists: [],
    loading: false,
  },
  responsiveCardCount: 5,
  carouselCurrentPage: 0,
  homeFeeds: {
    error: false,
    loaded: false,
    newReleases: [],
    recommendedAlbums: [],
    recommendedAlbumsPersonalized: false,
    recommendedArtists: [],
    recommendedArtistsPersonalized: false,
    recommendedTracks: [],
    recentTracks: [],
    reloadingSection: null,
    reloadSection: vi.fn(),
    retryInitialLoad: vi.fn(),
  },
  carouselSectionProps: [] as Array<{ sectionKey: string; contentKey?: string }>,
  trackCardCalls: [] as Array<{ id: string | number; isPriority: boolean | undefined }>,
}));

function stripMotionProps<T extends Record<string, unknown>>(props: T) {
  const nextProps = { ...props };
  delete nextProps.whileHover;
  delete nextProps.whileTap;
  delete nextProps.initial;
  delete nextProps.animate;
  delete nextProps.exit;
  delete nextProps.variants;
  delete nextProps.transition;
  delete nextProps.custom;
  return nextProps;
}

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      const sanitizedProps = stripMotionProps(props);
      return <div {...sanitizedProps}>{props.children}</div>;
    },
    section: (props: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) => {
      const sanitizedProps = stripMotionProps(props);
      return <section {...sanitizedProps}>{props.children}</section>;
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => indexPageMocks.auth,
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    isLiked: () => false,
    toggleLike: vi.fn(),
  }),
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => indexPageMocks.favoriteArtists,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    cardSize: "comfortable",
  }),
}));

vi.mock("@/hooks/usePlayHistory", () => ({
  usePlayHistory: () => ({
    getHistory: vi.fn(async () => []),
  }),
}));

vi.mock("@/hooks/useHomeFeeds", () => ({
  useHomeFeeds: () => indexPageMocks.homeFeeds,
}));

vi.mock("@/hooks/useSavedAlbums", () => ({
  useSavedAlbums: () => ({
    isSaved: () => false,
    toggleSavedAlbum: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMainScrollY", () => ({
  useMainScrollY: () => 0,
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
    allowAmbientMotion: false,
    websiteMode: "roundish",
    isRoundish: true,
    strongDesktopEffects: false,
  }),
}));

vi.mock("@/hooks/useResponsiveMediaCardCount", () => ({
  useResponsiveMediaCardCount: () => ({
    containerRef: { current: null },
    collapsedCount: indexPageMocks.responsiveCardCount,
  }),
}));

vi.mock("@/hooks/useCarousel", () => ({
  useCarousel: (cardCount: number) => ({
    canViewAll: () => false,
    shouldShowPager: () => false,
    moveSectionPage: vi.fn(),
    getCurrentPage: () => indexPageMocks.carouselCurrentPage,
    getPageCount: () => 1,
    cardCount,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/carousel/CarouselSection", () => ({
  CarouselSection: ({
    items,
    renderItem,
    sectionKey,
    contentKey,
  }: {
    items: unknown[];
    renderItem: (item: unknown, index: number) => React.ReactNode;
    sectionKey: string;
    contentKey?: string;
  }) => {
    indexPageMocks.carouselSectionProps.push({ sectionKey, contentKey });
    return (
      <div data-section-key={sectionKey} data-content-key={contentKey ?? ""}>
        {items.map((item, index) => (
          <div key={`${sectionKey}-${index}`}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  },
}));

vi.mock("@/components/home/HomeMediaCards", () => ({
  ArtistCardWrapper: () => null,
  HomeAlbumCard: () => null,
  TrackCard: ({
    track,
    isPriority,
  }: {
    track: { id: string | number };
    isPriority?: boolean;
  }) => {
    indexPageMocks.trackCardCalls.push({ id: track.id, isPriority });
    return <div data-testid={`track-card-${track.id}`} data-priority={String(isPriority)} />;
  },
}));

vi.mock("@/lib/motion", () => ({
  getControlHover: () => undefined,
  getControlTap: () => undefined,
  getMotionProfile: () => ({
    duration: { base: 0, slow: 0 },
    ease: { smooth: "linear" },
    spring: { control: {} },
  }),
  getSectionRevealVariants: () => ({}),
  getStaggerContainerVariants: () => ({}),
  getStaggerItemVariants: () => ({}),
  getSurfaceSwapTransition: () => ({ duration: 0 }),
}));

function renderIndexPage(initialEntry = "/app") {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route path="/app" element={<Index />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Index", () => {
  beforeEach(() => {
    indexPageMocks.carouselSectionProps = [];
    indexPageMocks.trackCardCalls = [];
    indexPageMocks.responsiveCardCount = 5;
    indexPageMocks.carouselCurrentPage = 0;
    indexPageMocks.auth.user = null;
    indexPageMocks.auth.loading = false;
    indexPageMocks.favoriteArtists.favoriteArtists = [];
    indexPageMocks.favoriteArtists.loading = false;
    indexPageMocks.homeFeeds = {
      error: false,
      loaded: false,
      newReleases: [],
      recommendedAlbums: [],
      recommendedAlbumsPersonalized: false,
      recommendedArtists: [],
      recommendedArtistsPersonalized: false,
      recommendedTracks: [],
      recentTracks: [],
      reloadingSection: null,
      reloadSection: vi.fn(),
      retryInitialLoad: vi.fn(),
    };
  });

  it("shows the guest hero shell while feeds are still loading", () => {
    renderIndexPage();

    expect(screen.getAllByText("Guest Mode").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Search the catalog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to unlock library" })).toBeInTheDocument();
  });

  it("keeps the guest hero shell available when loading completes without feed rows", () => {
    indexPageMocks.homeFeeds.loaded = true;

    renderIndexPage();

    expect(screen.getAllByText("Guest Mode").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Search the catalog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to unlock library" })).toBeInTheDocument();
  });

  it("keeps the homepage surface visibility overrides applied on the live page shell", () => {
    const { container } = renderIndexPage();

    expect(container.querySelector(".page-shell.home-page-surface")).not.toBeNull();
  });

  it("keeps the recently played carousel content key stable across history-driven updates", () => {
    const recentTracks: Track[] = [
      {
        id: "track-1",
        title: "Track One",
        artist: "Artist One",
        artists: [{ id: "artist-1", name: "Artist One" }],
        coverUrl: "/art-1.jpg",
        duration: 180,
        source: "tidal",
      },
      {
        id: "track-2",
        title: "Track Two",
        artist: "Artist Two",
        artists: [{ id: "artist-2", name: "Artist Two" }],
        coverUrl: "/art-2.jpg",
        duration: 200,
        source: "tidal",
      },
    ];

    indexPageMocks.homeFeeds.loaded = true;
    indexPageMocks.homeFeeds.recentTracks = recentTracks;

    renderIndexPage();

    expect(indexPageMocks.carouselSectionProps).toContainEqual({
      sectionKey: "recent",
      contentKey: "recent",
    });
  });

  it("marks every card on the visible recommended page as priority on wide home rows", () => {
    const recommendedTracks: Track[] = Array.from({ length: 7 }, (_, index) => ({
      id: `track-${index + 1}`,
      title: `Track ${index + 1}`,
      artist: `Artist ${index + 1}`,
      artists: [{ id: `artist-${index + 1}`, name: `Artist ${index + 1}` }],
      coverUrl: `/art-${index + 1}.jpg`,
      duration: 180 + index,
      source: "tidal",
    }));

    indexPageMocks.homeFeeds.loaded = true;
    indexPageMocks.homeFeeds.recommendedTracks = recommendedTracks;
    indexPageMocks.responsiveCardCount = 7;

    renderIndexPage();

    expect(indexPageMocks.trackCardCalls).toHaveLength(7);
    expect(indexPageMocks.trackCardCalls.every(({ isPriority }) => isPriority)).toBe(true);
  });

  it("hides album and artist shelves when they are only fallback suggestions", () => {
    indexPageMocks.homeFeeds.loaded = true;
    indexPageMocks.homeFeeds.recommendedAlbums = [
      {
        id: "album-1",
        title: "Fallback Album",
        artist: "Fallback Artist",
        coverUrl: "/album-1.jpg",
      },
    ];
    indexPageMocks.homeFeeds.recommendedArtists = [
      {
        id: "artist-1",
        name: "Fallback Artist",
        imageUrl: "/artist-1.jpg",
      },
    ];

    renderIndexPage();

    expect(screen.queryByText("Albums You Might Like")).not.toBeInTheDocument();
    expect(screen.queryByText("Artists You Might Like")).not.toBeInTheDocument();
  });

  it("shows album and artist shelves when they are personalized", () => {
    indexPageMocks.homeFeeds.loaded = true;
    indexPageMocks.homeFeeds.recommendedAlbumsPersonalized = true;
    indexPageMocks.homeFeeds.recommendedArtistsPersonalized = true;
    indexPageMocks.homeFeeds.recommendedAlbums = [
      {
        id: "album-1",
        title: "Personal Album",
        artist: "Personal Artist",
        coverUrl: "/album-1.jpg",
      },
    ];
    indexPageMocks.homeFeeds.recommendedArtists = [
      {
        id: "artist-1",
        name: "Personal Artist",
        imageUrl: "/artist-1.jpg",
      },
    ];

    renderIndexPage();

    expect(screen.getByText("Albums You Might Like")).toBeInTheDocument();
    expect(screen.getByText("Artists You Might Like")).toBeInTheDocument();
  });

  it("shows a clearly personal favorite artists shelf when favorites exist", () => {
    indexPageMocks.homeFeeds.loaded = true;
    indexPageMocks.favoriteArtists.favoriteArtists = [
      {
        id: "favorite-1",
        artist_id: 11,
        artist_name: "Emilia",
        artist_image_url: "/emilia.jpg",
        created_at: "2026-03-19T00:00:00.000Z",
      },
    ];

    renderIndexPage();

    expect(screen.getByText("Your Favorite Artists")).toBeInTheDocument();
  });
});
