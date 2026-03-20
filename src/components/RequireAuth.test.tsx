import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RequireAdmin, RequireAuth } from "@/components/RequireAuth";

const requireAuthMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  isAdmin: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => requireAuthMocks,
}));

describe("RequireAuth", () => {
  beforeEach(() => {
    requireAuthMocks.user = null;
    requireAuthMocks.loading = false;
    requireAuthMocks.isAdmin = false;
  });

  it("shows a loading fallback while the auth session is restoring", () => {
    requireAuthMocks.loading = true;

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route
            path="/profile"
            element={(
              <RequireAuth>
                <div>Profile</div>
              </RequireAuth>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Restoring your session...")).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("shows an admin access fallback while admin auth is loading", () => {
    requireAuthMocks.loading = true;

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={(
              <RequireAdmin>
                <div>Admin</div>
              </RequireAdmin>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Checking your account access...")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});
