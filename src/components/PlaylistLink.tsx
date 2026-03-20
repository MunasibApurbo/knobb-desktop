import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { preloadRouteModule } from "@/lib/routePreload";

interface PlaylistLinkProps {
  title: string;
  playlistId?: string | number;
  kind?: "tidal" | "youtube-music" | "user" | "shared";
  shareToken?: string;
  className?: string;
  layoutId?: string;
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
}

export function PlaylistLink({
  title,
  playlistId,
  kind = "tidal",
  shareToken,
  className = "",
  layoutId,
  onClick,
}: PlaylistLinkProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const targetPath = (() => {
    if (kind === "shared") {
      const token = shareToken || String(playlistId || "");
      return token ? `/shared-playlist/${token}` : null;
    }
    if (kind === "user" && playlistId) {
      return `/my-playlist/${playlistId}`;
    }
    if (playlistId) {
      return `/playlist/${playlistId}`;
    }
    return null;
  })();
  const fallbackSearchPath = `/search?q=${encodeURIComponent(title)}`;
  const preloadNavigation = () => void preloadRouteModule(targetPath ?? fallbackSearchPath);

  const handleNavigate = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
    preloadNavigation();

    if (targetPath) {
      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
      return;
    }

    navigate(fallbackSearchPath);
  };

  return (
    <motion.span
      layoutId={layoutId}
      className={`cursor-pointer hover:underline transition-colors ${className}`}
      onClick={handleNavigate}
      onMouseEnter={preloadNavigation}
      onFocus={preloadNavigation}
      onPointerDown={preloadNavigation}
    >
      {title}
    </motion.span>
  );
}
