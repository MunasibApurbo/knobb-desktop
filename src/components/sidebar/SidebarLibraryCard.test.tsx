import { render, screen } from "@testing-library/react";

import { SidebarLibraryCard } from "@/components/sidebar/SidebarLibraryCard";

vi.mock("@/hooks/useResolvedArtistImage", () => ({
  useResolvedArtistImage: () => null,
}));

describe("SidebarLibraryCard", () => {
  it("uses the accent sweep hover treatment for inactive list rows", () => {
    render(
      <SidebarLibraryCard
        itemType="playlist"
        title="Liked Songs"
        subtitle="Playlist · 3 songs"
        layout="list"
        onClick={() => {}}
      />,
    );

    const card = screen.getByRole("button", { name: /Liked Songs/i });
    expect(card.className).toContain("menu-sweep-hover");
    expect(card.className).not.toContain("website-card-hover");
    expect(card.className).toContain("hover:text-black");
  });

  it("keeps selected list rows on a tinted accent surface without forcing dark text", () => {
    render(
      <SidebarLibraryCard
        itemType="playlist"
        title="Liked Songs"
        subtitle="Playlist · 3 songs"
        layout="list"
        selected
        onClick={() => {}}
      />,
    );

    const card = screen.getByRole("button", { name: /Liked Songs/i });
    expect(card.className).toContain("bg-[hsl(var(--player-waveform)/0.14)]");
    expect(card.className).toContain("text-white");
    expect(card.className).toContain("ring-[hsl(var(--player-waveform)/0.18)]");
  });
});
