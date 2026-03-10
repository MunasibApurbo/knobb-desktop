import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CookiesPage from "@/pages/CookiesPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("Legal pages mobile layout", () => {
  it("renders the privacy page inside the shared mobile shell", () => {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );

    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toBeInTheDocument();
  });

  it("renders the terms page inside the shared mobile shell", () => {
    const { container } = render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("Terms of Use")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument();
  });

  it("renders the cookies page inside the shared mobile shell", () => {
    const { container } = render(
      <MemoryRouter>
        <CookiesPage />
      </MemoryRouter>,
    );

    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    expect(screen.getByText("Cookie Policy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toBeInTheDocument();
  });
});
