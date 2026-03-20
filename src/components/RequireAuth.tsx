import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { APP_HOME_PATH } from "@/lib/routes";

function AuthGateFallback({ message }: { message: string }) {
  return (
    <div className="page-shell flex min-h-full items-center justify-center px-4 py-8">
      <div className="page-panel shell-black-panel w-full max-w-md px-5 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Knobb
        </p>
        <p className="mt-3 text-sm text-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: React.PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthGateFallback message="Restoring your session..." />;
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    const prompt =
      location.pathname === "/liked" || location.pathname.startsWith("/my-playlist")
        ? "Sign in to save playlists, bulk-edit your library, and keep changes in sync."
        : location.pathname.startsWith("/profile")
          ? "Sign in to manage your profile, listening history, and account settings."
          : "Sign in to keep your library, history, and recommendations in sync across devices.";
    return <Navigate to="/auth" state={{ from, prompt }} replace />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: React.PropsWithChildren) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthGateFallback message="Checking your account access..." />;
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/auth" state={{ from, prompt: "Sign in with an admin account to review account data." }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return <>{children}</>;
}
