import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { pushAppDiagnostic } from "@/lib/appDiagnostics";
import { hasCurrentPasswordRecoveryCallback } from "@/lib/authRecovery";
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

function normalizeAuthMessage(message: string) {
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isPasswordRecoveryPending, setIsPasswordRecoveryPending] = useState(
    hasCurrentPasswordRecoveryCallback(),
  );
  const isAdmin = hasAdminRole(user?.app_metadata);

  const surfaceAuthFailure = useCallback((title: string, error: unknown, eventName: string) => {
    const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "Authentication failed";
    const message = normalizeAuthMessage(rawMessage);

    pushAppDiagnostic({
      level: "error",
      title,
      message,
      source: "auth",
      dedupeKey: `${eventName}:${message}`,
    });
    void reportClientErrorLazy(error, eventName);
    return message;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const recoveryCallbackPresent = hasCurrentPasswordRecoveryCallback();

    if (recoveryCallbackPresent) {
      setIsPasswordRecoveryPending(true);
      setIsPasswordRecovery(false);
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

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;

        if (error) {
          surfaceAuthFailure("Couldn't restore your session", error, "auth_get_session_failed");
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (!recoveryCallbackPresent || !session) {
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          captchaToken,
          emailRedirectTo: buildAuthRedirectUrl(returnTo),
        },
      });

      if (error) return { error: surfaceAuthFailure("Sign up failed", error, "auth_sign_up_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Sign up failed", error, "auth_sign_up_failed") };
    }
  }, [surfaceAuthFailure]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });

      if (error) return { error: surfaceAuthFailure("Sign in failed", error, "auth_sign_in_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Sign in failed", error, "auth_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const signInWithGoogle = useCallback(async (returnTo = "/profile") => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthRedirectUrl(returnTo),
        },
      });

      if (error) return { error: surfaceAuthFailure("Google sign-in failed", error, "auth_google_sign_in_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Google sign-in failed", error, "auth_google_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const signInWithDiscord = useCallback(async (returnTo = "/profile") => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: buildAuthRedirectUrl(returnTo),
        },
      });

      if (error) return { error: surfaceAuthFailure("Discord sign-in failed", error, "auth_discord_sign_in_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Discord sign-in failed", error, "auth_discord_sign_in_failed") };
    }
  }, [surfaceAuthFailure]);

  const requestPasswordReset = useCallback(async (email: string, captchaToken?: string) => {
    const redirectTo = buildAuthRedirectUrl();
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
        captchaToken,
      });
      if (error) return { error: surfaceAuthFailure("Password reset failed", error, "auth_password_reset_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Password reset failed", error, "auth_password_reset_failed") };
    }
  }, [surfaceAuthFailure]);

  const completePasswordRecovery = useCallback(async (password: string) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
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
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          captchaToken,
          emailRedirectTo: buildAuthRedirectUrl(returnTo),
        },
      });
      if (error) return { error: surfaceAuthFailure("Verification email failed", error, "auth_resend_confirmation_failed") };
      return { error: null };
    } catch (error) {
      return { error: surfaceAuthFailure("Verification email failed", error, "auth_resend_confirmation_failed") };
    }
  }, [surfaceAuthFailure]);

  const signOut = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
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
      const { error } = await supabase.auth.signOut({ scope: "others" });
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
