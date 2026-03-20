import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { AppSidebar } from "@/components/AppSidebar";

const appSidebarMocks = vi.hoisted(() => {
  let collapsed = false;

  return {
    expandPanel: vi.fn(),
    setCollapsed: vi.fn(),
    setLibrarySource: vi.fn(),
    setCollapsedState(next: boolean) {
      collapsed = next;
    },
    getCollapsedState() {
      return collapsed;
    },
    reset() {
      collapsed = false;
      this.expandPanel.mockReset();
      this.setCollapsed.mockReset();
      this.setLibrarySource.mockReset();
    },
  };
});

vi.mock("@/components/BrandLogo", () => ({
  BrandLogo: ({ showLabel }: { showLabel?: boolean }) => <span>{showLabel ? "KNOBB" : "K"}</span>,
}));

vi.mock("@/components/Layout", () => ({
  useSidebarCollapsed: () => ({
    collapsed: appSidebarMocks.getCollapsedState(),
    expandPanel: appSidebarMocks.expandPanel,
    setCollapsed: appSidebarMocks.setCollapsed,
  }),
}));

vi.mock("@/components/library/LibraryCollection", () => ({
  LibraryCollection: ({ className }: { className?: string }) => (
    <div className={className} data-testid="library-collection">
      Library
    </div>
  ),
}));

vi.mock("@/components/sidebar/SidebarCollapsedRail", () => ({
  SidebarCollapsedRail: ({ onOpenSearch }: { onOpenSearch: () => void }) => (
    <button type="button" onClick={onOpenSearch}>
      Open collapsed search
    </button>
  ),
}));

vi.mock("@/components/sidebar/SidebarOverflowMenu", () => ({
  SidebarOverflowMenu: () => <button type="button">More</button>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
  }: {
    children: ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <button type="button" onClick={onClick} title={title}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/sidebar/useSidebarLibraryItems", () => ({
  useSidebarLibraryItems: () => [],
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => ({
    favoriteArtists: [],
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "nav.home": "Home",
        "nav.search": "Search",
        "nav.browse": "Browse",
        "sidebar.yourLibrary": "Your Library",
        "common.close": "Close",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/contexts/LikedSongsContext", () => ({
  useLikedSongs: () => ({
    likedSongs: [],
  }),
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    sidebarStyle: "classic",
    setLibrarySource: appSidebarMocks.setLibrarySource,
  }),
}));

vi.mock("@/hooks/useFavoritePlaylists", () => ({
  useFavoritePlaylists: () => ({
    favoritePlaylists: [],
  }),
}));

vi.mock("@/hooks/usePlaylists", () => ({
  usePlaylists: () => ({
    playlists: [],
  }),
}));

vi.mock("@/hooks/useSavedAlbums", () => ({
  useSavedAlbums: () => ({
    savedAlbums: [],
  }),
}));

vi.mock("@/lib/routePreload", () => ({
  preloadRouteModule: vi.fn(),
}));

function renderAppSidebar(initialEntry = "/app") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppSidebar />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

function LocationDisplay() {
  const { pathname } = useLocation();
  return <div data-testid="location-display">{pathname}</div>;
}

describe("AppSidebar", () => {
  beforeEach(() => {
    appSidebarMocks.reset();
  });

  it("opens the inline sidebar search without overriding the selected library source", () => {
    renderAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "meher jain" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(appSidebarMocks.setLibrarySource).not.toHaveBeenCalled();
    expect(screen.getByTestId("location-display")).toHaveTextContent("/search");
  });

  it("hides the top search trigger while already on the search page", () => {
    renderAppSidebar("/search");

    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.getByTestId("library-collection")).toBeInTheDocument();
  });
});
