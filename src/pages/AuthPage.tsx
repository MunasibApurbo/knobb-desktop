import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";

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

export default function AuthPage() {
  const { signIn, signInWithGoogle, signInWithDiscord, signUp, requestPasswordReset, resendSignUpConfirmation, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: string; prompt?: string } | null;
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<"google" | "discord" | null>(null);

  const returnTo = resolveReturnTo(location);
  const returnToLabel = returnTo === "/" ? "home" : returnTo.replace(/^\//, "");
  const accessPrompt = routeState?.prompt;
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const captchaEnabled = Boolean(turnstileSiteKey);
  const showSocialAuth = !isResetMode;
  const googleLabel = isSignUp ? "Continue with Google" : "Sign in with Google";
  const discordLabel = isSignUp ? "Continue with Discord" : "Sign in with Discord";

  const resetCaptcha = () => {
    if (!captchaEnabled) return;
    setCaptchaToken(null);
    setCaptchaResetSignal((value) => value + 1);
  };

  useEffect(() => {
    if (user) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (captchaEnabled && !captchaToken) {
      setError("Complete captcha verification to continue.");
      return;
    }

    setLoading(true);

    try {
      if (isResetMode) {
        const { error } = await requestPasswordReset(email, captchaToken ?? undefined);
        if (error) setError(error);
        else setSuccess("Password reset email sent. Check your inbox.");
      } else if (isSignUp) {
        const { error } = await signUp(email, password, displayName, captchaToken ?? undefined, returnTo);
        if (error) setError(error);
        else setSuccess("Check your email to confirm your account.");
      } else {
        const { error } = await signIn(email, password, captchaToken ?? undefined);
        if (error) setError(error);
        else navigate(returnTo, { replace: true });
      }
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
      const { error } = await signInWithGoogle(returnTo);
      if (error) setError(error);
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
      const { error } = await signInWithDiscord(returnTo);
      if (error) setError(error);
    } finally {
      setLoading(false);
      setActiveOAuthProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto grid w-full max-w-5xl gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,25rem)]"
      >
        <div className="hidden overflow-hidden rounded-[var(--panel-radius)] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(61,223,179,0.12),_transparent_34%),radial-gradient(circle_at_85%_18%,_rgba(63,191,255,0.14),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-8 md:flex md:flex-col md:justify-between">
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

          <div className="space-y-3 border-t border-white/10 pt-5">
            <div className="grid gap-2 text-sm text-white/72">
              <p>Save and bulk-manage your library</p>
              <p>Sync your queue and history across sessions</p>
              <p>Unlock playlist editing and personalization</p>
            </div>
            {accessPrompt ? (
              <div className="rounded-[calc(var(--control-radius)+2px)] border border-white/10 bg-black/35 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Why you're here</p>
                <p className="mt-2 text-sm text-white/78">{accessPrompt}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--panel-radius)] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_42%),rgba(0,0,0,0.42)] p-5 md:p-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[calc(var(--control-radius)+4px)] border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:hidden">
              <BrandLogo markClassName="h-8 w-8" className="justify-center" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Knobb</p>
            <h1 className="text-2xl font-bold text-foreground">
              {isResetMode ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isResetMode
                ? "Enter your Knobb account email for a reset link"
                : isSignUp
                  ? "Create your account to save playlists, likes, and listening history"
                  : `Sign in to continue to ${returnToLabel}`}
            </p>
            {accessPrompt ? (
              <div className="rounded-[calc(var(--control-radius)+2px)] border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Unlocking</p>
                <p className="mt-2 text-sm text-white/75">{accessPrompt}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {showSocialAuth ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
                    disabled={loading}
                    onClick={() => void handleGoogleSignIn()}
                  >
                    {activeOAuthProvider === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    <span>{googleLabel}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
                    disabled={loading}
                    onClick={() => void handleDiscordSignIn()}
                  >
                    {activeOAuthProvider === "discord" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DiscordIcon />}
                    <span>{discordLabel}</span>
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>Or continue with email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && !isResetMode && (
                <Input
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-card border-border/30"
                />
              )}
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card border-border/30"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isResetMode}
                minLength={6}
                disabled={isResetMode}
                className="bg-card border-border/30"
              />

              {captchaEnabled ? (
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

              <Button
                type="submit"
                className="w-full border border-white/10 bg-white/[0.92] text-black hover:bg-white"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isResetMode ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
              </Button>
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
                  setError(null);
                  setSuccess(null);
                }}
                className="font-semibold text-foreground hover:underline"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
            {!isSignUp && (
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode((prev) => !prev);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="font-semibold text-foreground hover:underline"
                >
                  {isResetMode ? "Back to sign in" : "Forgot password?"}
                </button>
              </p>
            )}
            <p>
              <button
                type="button"
                onClick={() => navigate("/")}
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
