import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { safeStorageClear } from "@/lib/safeStorage";

const pushAppDiagnosticMock = vi.hoisted(() => vi.fn());
const navigateToAuthUrlMock = vi.hoisted(() => vi.fn());

const authContextMocks = vi.hoisted(() => {
  const fakeSession = {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      app_metadata: {},
      user_metadata: {},
    },
  } as const;

  const subscription = { unsubscribe: vi.fn() };

  return {
    fakeSession,
    onAuthStateChange: vi.fn(() => ({
      data: { subscription },
    })),
    getSession: vi.fn(async () => ({
      data: { session: fakeSession },
      error: null,
    })),
    exchangeCodeForSession: vi.fn(async () => ({
      data: { session: fakeSession },
      error: null,
    })),
    signInWithPassword: vi.fn(async () => ({
      data: { session: fakeSession, user: fakeSession.user },
      error: null,
    })),
    signInWithOAuth: vi.fn(async () => ({
      data: { url: "https://example.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    })),
  };
});

vi.mock("@/lib/runtimeModules", () => ({
  getSupabaseClient: async () => ({
    auth: {
      onAuthStateChange: authContextMocks.onAuthStateChange,
      getSession: authContextMocks.getSession,
      exchangeCodeForSession: authContextMocks.exchangeCodeForSession,
      signInWithPassword: authContextMocks.signInWithPassword,
      signInWithOAuth: authContextMocks.signInWithOAuth,
    },
  }),
  reportClientErrorLazy: vi.fn(async () => undefined),
}));

vi.mock("@/lib/appDiagnostics", () => ({
  pushAppDiagnostic: pushAppDiagnosticMock,
}));

vi.mock("@/lib/authNavigation", () => ({
  navigateToAuthUrl: navigateToAuthUrlMock,
}));

vi.mock("@/lib/authRecovery", () => ({
  hasCurrentPasswordRecoveryCallback: () => false,
}));

vi.mock("@/lib/authRoles", () => ({
  hasAdminRole: () => false,
}));

function AuthProbe() {
  const { loading, user } = useAuth();
  return <div>{loading ? "loading" : user ? `user:${user.id}` : "signed-out"}</div>;
}

function AuthActionProbe() {
  const { signIn } = useAuth();
  const [result, setResult] = useState<string>("idle");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const response = await signIn("user@example.com", "password123");
          setResult(response.error ?? "ok");
        }}
      >
        Sign in
      </button>
      <div>{result}</div>
    </>
  );
}

function AuthGoogleProbe() {
  const { signInWithGoogle } = useAuth();

  return (
    <button
      type="button"
      onClick={() => {
        void signInWithGoogle("/settings");
      }}
    >
      Google OAuth
    </button>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    safeStorageClear();
    vi.useRealTimers();
    pushAppDiagnosticMock.mockClear();
    authContextMocks.onAuthStateChange.mockClear();
    authContextMocks.getSession.mockClear();
    authContextMocks.exchangeCodeForSession.mockClear();
    authContextMocks.signInWithPassword.mockClear();
    authContextMocks.signInWithOAuth.mockClear();
    navigateToAuthUrlMock.mockClear();
    Object.defineProperty(window, "knobbDesktop", {
      configurable: true,
      value: undefined,
      writable: true,
    });
    window.history.replaceState({}, "", "/auth?next=%2Fprofile&code=exchange-me");
  });

  it("exchanges an auth code callback before restoring the session", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(authContextMocks.exchangeCodeForSession).toHaveBeenCalledWith("exchange-me");
    });

    await waitFor(() => {
      expect(screen.getByText("user:user-1")).toBeInTheDocument();
    });

    expect(window.location.search).toBe("?next=%2Fprofile");
  });

  it("surfaces a helpful error when sign-in hangs on Supabase Auth", async () => {
    vi.useFakeTimers();
    authContextMocks.signInWithPassword.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <AuthActionProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(
      screen.getByText(
        "Knobb couldn't reach Supabase Auth in time. Try again in a moment. If it keeps happening, check your Supabase Auth status and URL settings.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a clear not-signed-up message for unknown accounts without opening a diagnostic", async () => {
    authContextMocks.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("Invalid login credentials"),
    });

    render(
      <AuthProvider>
        <AuthActionProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("This account is not signed up yet.")).toBeInTheDocument();
    });

    expect(pushAppDiagnosticMock).not.toHaveBeenCalled();
  });

  it("uses the default browser for bundled desktop OAuth", async () => {
    window.knobbDesktop = {
      isDesktopApp: true,
      platform: "darwin",
      getLaunchTarget: vi.fn().mockResolvedValue({
        mode: "bundled-build",
        url: "http://127.0.0.1:32146/app",
        error: null,
      }),
      openExternal: vi.fn().mockResolvedValue(true),
      beginAuthSession: vi.fn().mockResolvedValue(true),
    };

    render(
      <AuthProvider>
        <AuthGoogleProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Google OAuth" }));

    await waitFor(() => {
      expect(authContextMocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth?next=%2Fsettings`,
          skipBrowserRedirect: true,
        },
      });
    });

    await waitFor(() => {
      expect(window.knobbDesktop?.beginAuthSession).toHaveBeenCalled();
      expect(window.knobbDesktop?.openExternal).toHaveBeenCalledWith("https://example.supabase.co/auth/v1/authorize?provider=google");
    });

    expect(navigateToAuthUrlMock).not.toHaveBeenCalled();
  });

  it("keeps the in-app OAuth flow for desktop dev builds", async () => {
    window.knobbDesktop = {
      isDesktopApp: true,
      platform: "darwin",
      getLaunchTarget: vi.fn().mockResolvedValue({
        mode: "dev-server",
        url: "http://localhost:5173/app",
        error: null,
      }),
      openExternal: vi.fn().mockResolvedValue(true),
      beginAuthSession: vi.fn().mockResolvedValue(true),
    };

    render(
      <AuthProvider>
        <AuthGoogleProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Google OAuth" }));

    await waitFor(() => {
      expect(window.knobbDesktop?.beginAuthSession).toHaveBeenCalled();
      expect(navigateToAuthUrlMock).toHaveBeenCalledWith("https://example.supabase.co/auth/v1/authorize?provider=google");
    });

    expect(window.knobbDesktop?.openExternal).not.toHaveBeenCalled();
  });
});
