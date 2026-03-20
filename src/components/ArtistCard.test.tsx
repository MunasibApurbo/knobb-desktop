import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ArtistCard } from "@/components/ArtistCard";

const mockPlayArtist = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      transition: _transition,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
      transition?: unknown;
    }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  },
}));

vi.mock("@/components/ArtistContextMenu", () => ({
  ArtistContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="artist-context-menu">{children}</div>
  ),
}));

vi.mock("@/components/MediaCardShell", () => ({
  MediaCardShell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/media-card", () => ({
  MediaCardArtworkBackdrop: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayerCommands: () => ({
    playArtist: mockPlayArtist,
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
    websiteMode: false,
  }),
}));

vi.mock("@/hooks/useResolvedArtistImage", () => ({
  useResolvedArtistImage: (_id: number | undefined, imageUrl: string) => imageUrl,
}));

vi.mock("@/components/mediaCardStyles", () => ({
  MEDIA_CARD_ACTION_ICON_CLASS: "media-card-action-icon",
  MEDIA_CARD_ARTWORK_CLASS: "media-card-artwork",
  MEDIA_CARD_BODY_CLASS: "media-card-body",
  MEDIA_CARD_FAVORITE_BUTTON_CLASS: "media-card-favorite-button",
  MEDIA_CARD_META_CLASS: "media-card-meta",
  MEDIA_CARD_PLAY_BUTTON_CLASS: "media-card-play-button",
  MEDIA_CARD_TITLE_CLASS: "media-card-title",
}));

vi.mock("@/lib/motion", () => ({
  getControlHover: () => undefined,
  getControlTap: () => undefined,
  getMotionProfile: () => ({
    spring: {
      control: undefined,
    },
  }),
}));

vi.mock("@/lib/mediaNavigation", () => ({
  buildArtistPath: () => "/artist/7",
}));

vi.mock("@/lib/musicApi", () => ({
  warmArtistPageData: vi.fn(),
}));

vi.mock("@/lib/routePreload", () => ({
  preloadRouteModule: vi.fn(),
}));

describe("ArtistCard lightweight context menu", () => {
  beforeEach(() => {
    mockPlayArtist.mockReset();
  });

  it("keeps the artist card wrapped in its context menu when lightweight", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ArtistCard
          id={7}
          name="Emilia"
          imageUrl="/artist.jpg"
          lightweight
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("artist-context-menu")).toBeInTheDocument();
    expect(screen.getByText("Emilia")).toBeInTheDocument();
  });
});
