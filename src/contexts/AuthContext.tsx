import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { hasCurrentPasswordRecoveryCallback } from "@/lib/authRecovery";
import { navigateToAuthUrl } from "@/lib/authNavigation";
import { hasAdminRole } from "@/lib/authRoles";
import { getSupabaseClient, reportClientErrorLazy } from "@/lib/runtimeModules";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    captchaToken?: string,
    returnTo?: string,
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error: string | null }>;
  signInWithDiscord: (returnTo?: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<{ error: string | null }>;
  completePasswordRecovery: (password: string) => Promise<{ error: string | null }>;
  resendSignUpConfirmation: (email: string, captchaToken?: string, returnTo?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signOutOtherSessions: () => Promise<{ error: string | null }>;
  isPasswordRecovery: boolean;
  isPasswordRecoveryPending: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
const AUTH_REQUEST_TIMEOUT_MS = 12000;
const ACCOUNT_NOT_SIGNED_UP_MESSAGE = "This account is not signed up yet.";

function normalizeAuthMessage(message: string) {
  if (/timed out/i.test(message)) {
    return "Knobb couldn't reach Supabase Auth in time. Try again in a moment. If it keeps happening, check your Supabase Auth status and URL settings.";
  }

  if (/invalid login credentials|invalid_credentials/i.test(message)) {
    return ACCOUNT_NOT_SIGNED_UP_MESSAGE;
  }

  if (/user already registered|already exists|already been registered/i.test(message)) {
    return "An account already exists with this email. Sign in instead.";
  }

  if (/identity is already linked to another user/i.test(message)) {
    return "This Google account is already linked to another Knobb account.";
  }

  if (!/captcha/i.test(message)) return message;

  if (!TURNSTILE_SITE_KEY) {
    return "Captcha is enabled for Supabase Auth, but this build is missing VITE_TURNSTILE_SITE_KEY.";
  }

  return "Captcha verification failed. Complete the challenge again and retry.";
}

function shouldSuppressAuthDiagnostic(message: string) {
  return message === ACCOUNT_NOT_SIGNED_UP_MESSAGE;
}

function sanitizeReturnTo(returnTo?: string) {
  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }

  return "/profile";
}

function buildAuthRedirectUrl(returnTo?: string) {
  const redirectUrl = new URL("/auth", window.location.origin);
  redirectUrl.searchParams.set("next", sanitizeReturnTo(returnTo));
  return redirectUrl.toString();
}

function isDesktopAuthBridgeAvailable() {
  return typeof window !== "undefined" && Boolean(window.knobbDesktop?.isDesktopApp);
}

async function beginDesktopAuthNavigation() {
  if (!isDesktopAuthBridgeAvailable()) {
    return;
  }

  await window.knobbDesktop?.beginAuthSession?.();
}

async function shouldUseDesktopSystemBrowserOAuth() {
  if (!isDesktopAuthBridgeAvailable()) {
    return false;
  }

  try {
    const launchTarget = await window.knobbDesktop?.getLaunchTarget?.();
    return launchTarget?.mode === "bundled-build" && Boolean(launchTarget.url);
  } catch {
    return false;
  }
}

function getAuthCallbackCode(search: string) {
  return new URLSearchParams(search).get("code")?.trim() || null;
}

function cleanupAuthCallbackUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const paramsToClear = [
    "code",
    "error",
    "error_code",
    "error_description",
  ];

  for (const key of paramsToClear) {
    url.searchParams.delete(key);
  }

  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function withAuthTimeout<T>(request: Promise<T>, label: string) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} after ${AUTH_REQUEST_TIMEOUT_MS}ms`));
    }, AUTH_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([request, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const recoveryCallbackPresent = hasCurrentPasswordRecoveryCallback();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isPasswordRecoveryPending, setIsPasswordRecoveryPending] = useState(
    recoveryCallbackPresent,
  );
  const isAdmin = hasAdminRole(user?.app_metadata);

  const surfaceAuthFailure = useCallback((title: string, error: unknown, eventName: string) => {
    const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "Authentication failed";
    const message = normalizeAuthMessage(rawMessage);

    if (!shouldSuppressAuthDiagnostic(message)) {
      pushAppDiagnostic({
        level: "error",
        title,
        message,
        source: "auth",
        dedupeKey: `${eventName}:${message}`,
      });
    }
    void reportClientErrorLazy(error, eventName);
    return message;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const recoveryCallbackDetected = hasCurrentPasswordRecoveryCallback();
    const authCode = typeof window === "undefined" ? null : getAuthCallbackCode(window.location.search);

    if (recoveryCallbackDetected || authCode) {
      setLoading(true);
      if (recoveryCallbackDetected) {
        setIsPasswordRecoveryPending(true);
        setIsPasswordRecovery(false);
      }
    }
    
    void (async () => {
      try {
        const supabase = await getSupabaseClient();
        if (!active) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          setSession(session);
          setUser(session?.user ?? null);

          if (event === "PASSWORD_RECOVERY") {
            setIsPasswordRecovery(true);
            setIsPasswordRecoveryPending(false);
          } else if (event === "USER_UPDATED" || event === "SIGNED_OUT") {
            setIsPasswordRecovery(false);
            setIsPasswordRecoveryPending(false);
          }

          setLoading(false);
        });

        unsubscribe = () => subscription.unsubscribe();

        if (authCode) {
          const { data, error } = await withAuthTimeout(
            supabase.auth.exchangeCodeForSession(authCode),
            "the auth callback",
          );
          if (!active) return;

          if (error) {
            surfaceAuthFailure("Couldn't complete sign-in", error, "auth_exchange_code_failed");
          } else {
            setSession(data.session);
            setUser(data.session?.user ?? null);
          }

          cleanupAuthCallbackUrl();
        }

        const { data: { session }, error } = await withAuthTimeout(
          supabase.auth.getSession(),
          "the auth session",
        );
        if (!active) return;

        if (error) {
          surfaceAuthFailure("Couldn't restore your session", error, "auth_get_session_failed");
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (!recoveryCallbackDetected || !session) {
          setIsPasswordRecoveryPending(false);
        }
      } catch (error) {
        if (!active) return;
        surfaceAuthFailure("Couldn't restore your session", error, "auth_get_session_failed");
        setIsPasswordRecoveryPending(false);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [surfaceAuthFailure]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName?: string,
    captchaToken?: string,
    returnTo?: string,
  ) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          captchaToken,
          emailRedirectTo: buildAuthRedirectUrl(returnTo),
        },
      }), "sign up");

      if (error) return { error: surfaceAuthFailure("Sign up failed", error, "auth_sign_up_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Sign up failed", error, "auth_sign_up_failed") };
    }
  }, [surfaceAuthFailure]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      }), "sign in");

      if (error) return { error: surfaceAuthFailure("Sign in failed", error, "auth_sign_in_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Sign in failed", error, "auth_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const signInWithGoogle = useCallback(async (returnTo = "/profile") => {
    try {
      const supabase = await getSupabaseClient();
      const isDesktopApp = isDesktopAuthBridgeAvailable();
      const useSystemBrowser = await shouldUseDesktopSystemBrowserOAuth();
      const { data, error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthRedirectUrl(returnTo),
          skipBrowserRedirect: isDesktopApp,
        },
      }), "Google sign-in");

      if (error) return { error: surfaceAuthFailure("Google sign-in failed", error, "auth_google_sign_in_failed") };
      if (isDesktopApp && data?.url) {
        await beginDesktopAuthNavigation();
        if (useSystemBrowser) {
          const opened = await window.knobbDesktop?.openExternal?.(data.url);
          if (!opened) {
            return { error: "Knobb couldn't open your default browser for Google sign-in." };
          }
        } else {
          navigateToAuthUrl(data.url);
        }
      }
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Google sign-in failed", error, "auth_google_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const signInWithDiscord = useCallback(async (returnTo = "/profile") => {
    try {
      const supabase = await getSupabaseClient();
      const isDesktopApp = isDesktopAuthBridgeAvailable();
      const useSystemBrowser = await shouldUseDesktopSystemBrowserOAuth();
      const { data, error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: buildAuthRedirectUrl(returnTo),
          skipBrowserRedirect: isDesktopApp,
        },
      }), "Discord sign-in");

      if (error) return { error: surfaceAuthFailure("Discord sign-in failed", error, "auth_discord_sign_in_failed") };
      if (isDesktopApp && data?.url) {
        await beginDesktopAuthNavigation();
        if (useSystemBrowser) {
          const opened = await window.knobbDesktop?.openExternal?.(data.url);
          if (!opened) {
            return { error: "Knobb couldn't open your default browser for Discord sign-in." };
          }
        } else {
          navigateToAuthUrl(data.url);
        }
      }
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Discord sign-in failed", error, "auth_discord_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const requestPasswordReset = useCallback(async (email: string, captchaToken?: string) => {
    const redirectTo = buildAuthRedirectUrl();
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
        captchaToken,
      }), "password reset");
      if (error) return { error: surfaceAuthFailure("Password reset failed", error, "auth_password_reset_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Password reset failed", error, "auth_password_reset_failed") };
    }
  }, [surfaceAuthFailure]);

  const completePasswordRecovery = useCallback(async (password: string) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(
        supabase.auth.updateUser({ password }),
        "password recovery",
      );
      if (error) {
        return {
          error: surfaceAuthFailure(
            "Password update failed",
            error,
            "auth_password_recovery_complete_failed",
          ),
        };
      }

      setIsPasswordRecovery(false);
      setIsPasswordRecoveryPending(false);
      return { error: null };
    } catch (error) {
      return {
        error: surfaceAuthFailure(
          "Password update failed",
          error,
          "auth_password_recovery_complete_failed",
        ),
      };
    }
  }, [surfaceAuthFailure]);

  const resendSignUpConfirmation = useCallback(async (email: string, captchaToken?: string, returnTo?: string) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(supabase.auth.resend({
        type: "signup",
        email,
        options: {
          captchaToken,
          emailRedirectTo: buildAuthRedirectUrl(returnTo),
        },
      }), "verification email");
      if (error) return { error: surfaceAuthFailure("Verification email failed", error, "auth_resend_confirmation_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Verification email failed", error, "auth_resend_confirmation_failed") };
    }
  }, [surfaceAuthFailure]);

  const signOut = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(
        supabase.auth.signOut({ scope: "local" }),
        "sign out",
      );
      if (error) {
        surfaceAuthFailure("Sign out failed", error, "auth_sign_out_failed");
      }
    } catch (error) {
      surfaceAuthFailure("Sign out failed", error, "auth_sign_out_failed");
    }
  }, [surfaceAuthFailure]);

  const signOutOtherSessions = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await withAuthTimeout(
        supabase.auth.signOut({ scope: "others" }),
        "sign out other sessions",
      );
      if (error) {
        return {
          error: surfaceAuthFailure(
            "Sign out other sessions failed",
            error,
            "auth_sign_out_other_sessions_failed",
          ),
        };
      }

      return { error: null };
    } catch (error) {
      return {
        error: surfaceAuthFailure(
          "Sign out other sessions failed",
          error,
          "auth_sign_out_other_sessions_failed",
        ),
      };
    }
  }, [surfaceAuthFailure]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithDiscord,
        requestPasswordReset,
        completePasswordRecovery,
        resendSignUpConfirmation,
        signOut,
        signOutOtherSessions,
        isPasswordRecovery,
        isPasswordRecoveryPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
