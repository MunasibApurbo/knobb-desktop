import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import FavoriteArtistsPage from "@/pages/FavoriteArtistsPage";

const favoriteArtistsMocks = vi.hoisted(() => ({
  loading: false,
  favoriteArtists: [
    {
      id: "fav-1",
      artist_id: 101,
      artist_name: "Bonobo",
      artist_image_url: "/bonobo.jpg",
    },
    {
      id: "fav-2",
      artist_id: 102,
      artist_name: "Kiasmos",
      artist_image_url: "/kiasmos.jpg",
    },
  ],
}));

vi.mock("@/contexts/FavoriteArtistsContext", () => ({
  useFavoriteArtists: () => favoriteArtistsMocks,
}));

vi.mock("@/components/ArtistCard", () => ({
  ArtistCard: ({ name }: { name: string }) => <div data-testid="artist-card">{name}</div>,
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>,
  },
}));

describe("FavoriteArtistsPage mobile layout", () => {
  it("renders the shared mobile shell and two-column artist collection panel", () => {
    const { container } = render(
      <MemoryRouter>
        <FavoriteArtistsPage />
      </MemoryRouter>,
    );

    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("Favorite Artists")).toBeInTheDocument();
    expect(screen.getByText("Saved Artists")).toBeInTheDocument();
    expect(screen.getAllByTestId("artist-card")).toHaveLength(2);
  });
});
