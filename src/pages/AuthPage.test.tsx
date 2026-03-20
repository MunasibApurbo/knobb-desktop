import type { ComponentPropsWithoutRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AuthPage from "@/pages/AuthPage";

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithDiscord: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  completePasswordRecovery: vi.fn(),
  resendSignUpConfirmation: vi.fn(),
  user: null,
  loading: false,
  isPasswordRecovery: false,
  isPasswordRecoveryPending: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: () => null,
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: true,
    websiteMode: "roundish" as const,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>,
  },
}));

describe("AuthPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    authMocks.signIn.mockReset();
    authMocks.signInWithGoogle.mockReset();
    authMocks.signInWithDiscord.mockReset();
    authMocks.signUp.mockReset();
    authMocks.requestPasswordReset.mockReset();
    authMocks.completePasswordRecovery.mockReset();
    authMocks.resendSignUpConfirmation.mockReset();
    authMocks.user = null;
    authMocks.loading = false;
    authMocks.isPasswordRecovery = false;
    authMocks.isPasswordRecoveryPending = false;
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

  it("stays on the recovery screen instead of redirecting an existing session", () => {
    authMocks.user = { id: "user-1" };
    authMocks.isPasswordRecoveryPending = true;

    renderPage("/auth?next=%2Fsettings#type=recovery");

    expect(screen.getByText(/verifying your reset link/i)).toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("does not redirect away while auth is still restoring a session", () => {
    authMocks.user = { id: "user-1" };
    authMocks.loading = true;

    renderPage("/auth?next=%2Fsettings");

    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("shows an inline timeout error when email sign-in hangs", async () => {
    vi.useFakeTimers();
    authMocks.signIn.mockImplementation(() => new Promise(() => {}));

    renderPage("/auth?next=%2Fsettings");

    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
    });

    expect(
      screen.getByText(
        "Knobb couldn't reach Supabase Auth in time. Try again in a moment. If it keeps happening, check your Supabase Auth status and URL settings.",
      ),
    ).toBeInTheDocument();
  });

  it("shows that the account is not signed up yet when sign-in fails for an unknown email", async () => {
    authMocks.signIn.mockResolvedValue({ error: "This account is not signed up yet." });

    renderPage("/auth?next=%2Fsettings");

    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("This account is not signed up yet.")).toBeInTheDocument();
    });
  });

  it("submits a new password while recovery mode is active", async () => {
    authMocks.isPasswordRecovery = true;
    authMocks.completePasswordRecovery.mockResolvedValue({ error: null });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/^new password$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText(/^confirm new password$/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(authMocks.completePasswordRecovery).toHaveBeenCalledWith("password123");
    });
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

  it("keeps the auth screen inside the desktop page shell", () => {
    const { container } = renderPage();

    expect(container.querySelector(".page-shell")).not.toBeNull();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("renders visible labels for the primary email sign-in fields", () => {
    renderPage();

    expect(screen.getByText("Email")).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByText("Password")).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
  });

  it("renders labeled password reset fields during recovery", () => {
    authMocks.isPasswordRecovery = true;

    renderPage();

    expect(screen.getByText("New password")).toBeVisible();
    expect(screen.getByLabelText("New password")).toBeVisible();
    expect(screen.getByText("Confirm new password")).toBeVisible();
    expect(screen.getByLabelText("Confirm new password")).toBeVisible();
  });
});
