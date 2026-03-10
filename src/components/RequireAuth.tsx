import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { APP_HOME_PATH } from "@/lib/routes";

export function RequireAuth({ children }: React.PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
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
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
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
