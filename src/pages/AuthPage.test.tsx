import type { ComponentPropsWithoutRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AuthPage from "@/pages/AuthPage";

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithDiscord: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendSignUpConfirmation: vi.fn(),
  user: null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>,
  },
}));

describe("AuthPage", () => {
  beforeEach(() => {
    authMocks.signIn.mockReset();
    authMocks.signInWithGoogle.mockReset();
    authMocks.signInWithDiscord.mockReset();
    authMocks.signUp.mockReset();
    authMocks.requestPasswordReset.mockReset();
    authMocks.resendSignUpConfirmation.mockReset();
    authMocks.user = null;
  });

  function renderPage(initialEntry = "/auth?next=%2Fsettings") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/settings" element={<div>Settings</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("starts Google OAuth with the sanitized return path", async () => {
    authMocks.signInWithGoogle.mockResolvedValue({ error: null });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));

    await waitFor(() => {
      expect(authMocks.signInWithGoogle).toHaveBeenCalledWith("/settings");
    });
  });

  it("starts Discord OAuth with the sanitized return path", async () => {
    authMocks.signInWithDiscord.mockResolvedValue({ error: null });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /sign in with discord/i }));

    await waitFor(() => {
      expect(authMocks.signInWithDiscord).toHaveBeenCalledWith("/settings");
    });
  });

  it("hides social sign-in while password reset mode is active", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("shows a clearer message when the email is already registered", async () => {
    authMocks.signUp.mockResolvedValue({
      error: "An account already exists with this email. Sign in instead.",
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    fireEvent.change(screen.getByPlaceholderText(/display name/i), { target: { value: "Knobb User" } });
    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(screen.getByText("An account already exists with this email. Sign in instead.")).toBeInTheDocument();
    });
  });
});
