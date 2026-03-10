import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { MobileNav } from "@/components/MobileNav";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "nav.home": "Home",
        "nav.search": "Search",
        "nav.library": "Library",
      };

      return labels[key] ?? key;
    },
  }),
}));

describe("MobileNav", () => {
  it("shows the three mobile destinations with no dedicated browse tab", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.queryByText("Browse")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
