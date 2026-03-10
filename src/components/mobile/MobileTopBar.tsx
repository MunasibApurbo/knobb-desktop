import { useContext, useMemo } from "react";
import { ChevronLeft, LogIn, LogOut, Settings, UserRound, Bell } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthContext } from "@/contexts/AuthContext";
import { triggerImpactHaptic, triggerSelectionHaptic } from "@/lib/haptics";
import { APP_HOME_PATH } from "@/lib/routes";
import { getMobileRouteMeta } from "@/components/mobile/mobileRouteMeta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getProfileLabel(email?: string | null) {
  const safeEmail = email?.trim();
  if (!safeEmail) return "Guest";
  return safeEmail.split("@")[0] || safeEmail;
}

function getInitials(email?: string | null) {
  const profileLabel = getProfileLabel(email);
  return profileLabel.slice(0, 2).toUpperCase();
}

export function MobileTopBar() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const routeMeta = useMemo(() => getMobileRouteMeta(location.pathname), [location.pathname]);
  const user = auth?.user ?? null;

  const handleNavigate = (href: string) => {
    triggerSelectionHaptic();
    navigate(href);
  };

  const handleBack = () => {
    triggerImpactHaptic("light");
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(routeMeta.fallbackHref);
  };

  return (
    <div className="mobile-top-bar fixed inset-x-0 top-0 z-50 px-3">
      <div className="mobile-top-bar-shell mx-auto flex w-full max-w-[42rem] items-center gap-3">
        <div className="flex w-12 justify-start">
          {routeMeta.showBackButton ? (
            <button
              type="button"
              className="mobile-top-bar-action"
              aria-label={`Go back from ${routeMeta.title}`}
              onClick={handleBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 text-center">
          <p className="mobile-top-bar-title truncate">{routeMeta.title}</p>
          <p className="mobile-top-bar-subtitle truncate">
            {routeMeta.showBackButton ? "Mobile playback" : "Knobb mobile"}
          </p>
        </div>

        <div className="flex w-12 justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mobile-top-bar-action mobile-top-bar-profile"
                aria-label={user ? "Open profile hub" : "Open account menu"}
              >
                {user ? <span className="text-[11px] font-black tracking-[0.18em]">{getInitials(user.email)}</span> : <UserRound className="h-4 w-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 border-white/10 bg-black/95 text-white">
              <div className="px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Profile Hub</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{getProfileLabel(user?.email)}</p>
                <p className="truncate text-xs text-white/55">{user?.email ?? "Sign in to save your library and profile."}</p>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              {user ? (
                <>
                  <DropdownMenuItem className="gap-2 text-white focus:bg-white/10 focus:text-white" onClick={() => handleNavigate("/profile")}>
                    <UserRound className="h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-white focus:bg-white/10 focus:text-white" onClick={() => handleNavigate("/notifications")}>
                    <Bell className="h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem className="gap-2 text-white focus:bg-white/10 focus:text-white" onClick={() => handleNavigate("/settings")}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              {user ? (
                <DropdownMenuItem
                  className="gap-2 text-white focus:bg-white/10 focus:text-white"
                  onClick={() => {
                    triggerImpactHaptic("medium");
                    void auth?.signOut();
                    navigate(APP_HOME_PATH);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2 text-white focus:bg-white/10 focus:text-white" onClick={() => handleNavigate("/auth")}>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
