import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getControlHover, getControlTap, getMotionProfile } from "@/lib/motion";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { PUBLIC_HOME_PATH } from "@/lib/routes";

function resolveReturnTo(location: ReturnType<typeof useLocation>) {
  const routeState = location.state as { from?: string } | null;
  const queryValue = new URLSearchParams(location.search).get("next");
  const candidate = typeof routeState?.from === "string" ? routeState.from : queryValue || "/profile";

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  return "/profile";
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#5865F2"
        d="M20.317 4.369A19.791 19.791 0 0 0 15.885 3a13.714 13.714 0 0 0-.629 1.293 18.27 18.27 0 0 0-5.513 0A13.66 13.66 0 0 0 9.114 3a19.736 19.736 0 0 0-4.434 1.371C1.874 8.583 1.117 12.691 1.495 16.743a19.923 19.923 0 0 0 5.427 2.757c.438-.599.828-1.236 1.161-1.903a12.974 12.974 0 0 1-1.829-.873c.154-.114.304-.234.449-.359 3.526 1.653 7.353 1.653 10.838 0 .146.125.296.245.449.359a12.94 12.94 0 0 1-1.833.875c.334.666.724 1.302 1.163 1.901a19.9 19.9 0 0 0 5.43-2.757c.444-4.697-.76-8.767-3.366-12.374M8.02 14.287c-1.058 0-1.928-.968-1.928-2.159s.852-2.159 1.928-2.159c1.085 0 1.946.977 1.928 2.159 0 1.191-.852 2.159-1.928 2.159m7.124 0c-1.058 0-1.928-.968-1.928-2.159s.852-2.159 1.928-2.159c1.085 0 1.946.977 1.928 2.159 0 1.191-.843 2.159-1.928 2.159"
      />
    </svg>
  );
}

const SOCIAL_AUTH_BUTTON_CLASS =
  "menu-sweep-hover website-form-control w-full border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.05] hover:text-black focus-visible:text-black";
const AUTH_UI_TIMEOUT_MS = 13000;
const AUTH_TIMEOUT_MESSAGE =
  "Knobb couldn't reach Supabase Auth in time. Try again in a moment. If it keeps happening, check your Supabase Auth status and URL settings.";

function runWithUiTimeout<T>(request: Promise<T>) {
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(AUTH_TIMEOUT_MESSAGE));
    }, AUTH_UI_TIMEOUT_MS);
  });

  return Promise.race([request, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

export default function AuthPage() {
  const {
    signIn,
    signInWithGoogle,
    signInWithDiscord,
    signUp,
    requestPasswordReset,
    completePasswordRecovery,
    resendSignUpConfirmation,
    user,
    loading: authLoading,
    isPasswordRecovery,
    isPasswordRecoveryPending,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const routeState = location.state as { from?: string; prompt?: string } | null;
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<"google" | "discord" | null>(null);
  const [recoveryVerificationTimedOut, setRecoveryVerificationTimedOut] = useState(false);

  const returnTo = resolveReturnTo(location);
  const accessPrompt = routeState?.prompt;
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const captchaEnabled = Boolean(turnstileSiteKey);
  const showPasswordRecoveryFlow = isPasswordRecovery || (isPasswordRecoveryPending && !recoveryVerificationTimedOut);
  const showResetRequestForm = isResetMode && !showPasswordRecoveryFlow;
  const showRecoveryVerification = showPasswordRecoveryFlow && !isPasswordRecovery;
  const showSocialAuth = !showResetRequestForm && !showPasswordRecoveryFlow;
  const googleLabel = isSignUp ? "Continue with Google" : "Sign in with Google";
  const discordLabel = isSignUp ? "Continue with Discord" : "Sign in with Discord";
  const controlHover = getControlHover(motionEnabled, websiteMode);
  const controlTap = getControlTap(motionEnabled, websiteMode);

  const resetCaptcha = () => {
    if (!captchaEnabled) return;
    setCaptchaToken(null);
    setCaptchaResetSignal((value) => value + 1);
  };

  useEffect(() => {
    if (!authLoading && user && !showPasswordRecoveryFlow) navigate(returnTo, { replace: true });
  }, [authLoading, navigate, returnTo, showPasswordRecoveryFlow, user]);

  useEffect(() => {
    if (!isPasswordRecoveryPending || isPasswordRecovery || loading) {
      setRecoveryVerificationTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecoveryVerificationTimedOut(true);
      setError((currentError) => currentError ?? "This reset link is invalid or expired. Request a new reset email and try again.");
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isPasswordRecovery, isPasswordRecoveryPending, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (showRecoveryVerification) {
      return;
    }

    if (isPasswordRecovery) {
      if (password.length < 6) {
        setError("Use at least 6 characters for your new password.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    } else if (captchaEnabled && !captchaToken) {
      setError("Complete captcha verification to continue.");
      return;
    }

    setLoading(true);

    try {
      if (isPasswordRecovery) {
        const { error } = await runWithUiTimeout(completePasswordRecovery(password));
        if (error) setError(error);
        else {
          setSuccess("Password updated. Redirecting...");
          navigate(returnTo, { replace: true });
        }
      } else if (showResetRequestForm) {
        const { error } = await runWithUiTimeout(requestPasswordReset(email, captchaToken ?? undefined));
        if (error) setError(error);
        else setSuccess("Password reset email sent. Check your inbox.");
      } else if (isSignUp) {
        const { error } = await runWithUiTimeout(
          signUp(email, password, displayName, captchaToken ?? undefined, returnTo),
        );
        if (error) setError(error);
        else setSuccess("Check your email to confirm your account.");
      } else {
        const { error } = await runWithUiTimeout(signIn(email, password, captchaToken ?? undefined));
        if (error) setError(error);
        else navigate(returnTo, { replace: true });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    setActiveOAuthProvider("google");

    try {
      const { error } = await runWithUiTimeout(signInWithGoogle(returnTo));
      if (error) setError(error);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
      setActiveOAuthProvider(null);
    }
  };

  const handleDiscordSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    setActiveOAuthProvider("discord");

    try {
      const { error } = await runWithUiTimeout(signInWithDiscord(returnTo));
      if (error) setError(error);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Discord sign-in failed.");
    } finally {
      setLoading(false);
      setActiveOAuthProvider(null);
    }
  };

  return (
    <div className="page-shell min-h-full bg-background py-3 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto grid w-full max-w-5xl gap-4 md:gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,25rem)]"
      >
        <div className="hidden overflow-hidden rounded-[var(--panel-radius)] border border-white/10 bg-[#111111] p-8 md:flex md:flex-col">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[calc(var(--control-radius)+4px)] border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <BrandLogo markClassName="h-8 w-8" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Knobb</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Keep your library, queue, and listening history in one place.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/72">
              Sign in once and Knobb keeps liked songs, playlists, search context, and listening continuity attached to your account instead of this browser tab.
            </p>
          </div>
        </div>

        <div className="page-panel overflow-hidden rounded-[var(--panel-radius)] border border-white/10 bg-black/45 p-4 sm:p-5 md:p-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[calc(var(--control-radius)+4px)] border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:hidden">
              <BrandLogo markClassName="h-8 w-8" className="justify-center" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Knobb</p>
            <h1 className="text-2xl font-bold text-foreground">
              {showRecoveryVerification
                ? "Reset Your Password"
                : isPasswordRecovery
                  ? "Set New Password"
                  : showResetRequestForm
                    ? "Reset Password"
                    : isSignUp
                      ? "Create Account"
                      : "Welcome Back"}
            </h1>
            {showRecoveryVerification || isPasswordRecovery || showResetRequestForm || isSignUp ? (
              <p className="text-sm text-muted-foreground">
                {showRecoveryVerification
                  ? "Verifying your reset link..."
                  : isPasswordRecovery
                    ? "Enter a new password to finish resetting your account"
                    : showResetRequestForm
                      ? "Enter your Knobb account email for a reset link"
                      : "Create your account to save playlists, likes, and listening history"}
              </p>
            ) : null}
            {accessPrompt ? (
              <div className="rounded-[calc(var(--control-radius)+2px)] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/65">Unlocking</p>
                <p className="mt-2 text-sm text-emerald-50/88">{accessPrompt}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {showSocialAuth ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <motion.div
                    className="w-full"
                    whileHover={loading ? undefined : controlHover}
                    whileTap={loading ? undefined : controlTap}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className={SOCIAL_AUTH_BUTTON_CLASS}
                      disabled={loading}
                      onClick={() => void handleGoogleSignIn()}
                    >
                      {activeOAuthProvider === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                      <span>{googleLabel}</span>
                    </Button>
                  </motion.div>
                  <motion.div
                    className="w-full"
                    whileHover={loading ? undefined : controlHover}
                    whileTap={loading ? undefined : controlTap}
                    transition={motionProfile.spring.control}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className={SOCIAL_AUTH_BUTTON_CLASS}
                      disabled={loading}
                      onClick={() => void handleDiscordSignIn()}
                    >
                      {activeOAuthProvider === "discord" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DiscordIcon />}
                      <span>{discordLabel}</span>
                    </Button>
                  </motion.div>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>Or continue with email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-4">
              {showRecoveryVerification ? (
                <div className="rounded-[calc(var(--control-radius)+2px)] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/72">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking the reset link from your email</span>
                  </div>
                </div>
              ) : null}
              {isSignUp && !showResetRequestForm && !showPasswordRecoveryFlow && (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Display name</span>
                  <Input
                    aria-label="Display name"
                    placeholder="Display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-card border-border/30"
                  />
                </label>
              )}
              {isPasswordRecovery ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">New password</span>
                    <Input
                      type="password"
                      aria-label="New password"
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-card border-border/30"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Confirm new password</span>
                    <Input
                      type="password"
                      aria-label="Confirm new password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-card border-border/30"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Email</span>
                    <Input
                      type="email"
                      aria-label="Email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-card border-border/30"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Password</span>
                    <Input
                      type="password"
                      aria-label="Password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!showResetRequestForm}
                      minLength={6}
                      disabled={showResetRequestForm}
                      className="bg-card border-border/30"
                    />
                  </label>
                </>
              )}

              {captchaEnabled && !showPasswordRecoveryFlow ? (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  resetSignal={captchaResetSignal}
                  onTokenChange={setCaptchaToken}
                  onLoadError={setError}
                />
              ) : null}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && (
                <div className="text-sm space-y-2" style={{ color: `hsl(var(--dynamic-accent))` }}>
                  <p>{success}</p>
                  {isSignUp && !isResetMode && (
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:opacity-80"
                      onClick={async () => {
                        setError(null);
                        setSuccess(null);

                        if (captchaEnabled && !captchaToken) {
                          setError("Complete captcha verification to resend the email.");
                          return;
                        }

                        setLoading(true);
                        try {
                          const { error } = await resendSignUpConfirmation(email, captchaToken ?? undefined, returnTo);
                          if (error) setError(error);
                          else setSuccess("Verification email resent.");
                        } finally {
                          setLoading(false);
                          resetCaptcha();
                        }
                      }}
                    >
                      Resend verification email
                    </button>
                  )}
                </div>
              )}

              {!showRecoveryVerification ? (
                <motion.div
                  className="w-full"
                  whileHover={loading ? undefined : controlHover}
                  whileTap={loading ? undefined : controlTap}
                  transition={motionProfile.spring.control}
                >
                  <Button
                    type="submit"
                    className="website-form-control w-full border border-white/10 bg-white/[0.92] text-black hover:bg-white"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isPasswordRecovery
                      ? "Update Password"
                      : showResetRequestForm
                        ? "Send Reset Link"
                        : isSignUp
                          ? "Sign Up"
                          : "Sign In"}
                  </Button>
                </motion.div>
              ) : null}
            </form>
          </div>

          <div className="mt-5 space-y-1.5 text-center text-sm text-muted-foreground">
            <p>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setIsResetMode(false);
                  setConfirmPassword("");
                  setError(null);
                  setSuccess(null);
                }}
                className="font-semibold text-foreground hover:underline"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
            {!isSignUp && !showPasswordRecoveryFlow ? (
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode((prev) => !prev);
                    setConfirmPassword("");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-semibold text-foreground hover:underline"
                >
                  {isResetMode ? "Back to sign in" : "Forgot password?"}
                </button>
              </p>
            ) : null}
            <p>
              <button
                type="button"
                onClick={() => navigate(PUBLIC_HOME_PATH)}
                className="font-semibold text-foreground hover:underline"
              >
                Continue in guest mode
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
