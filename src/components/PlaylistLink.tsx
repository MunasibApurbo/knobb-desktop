import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface PlaylistLinkProps {
  title: string;
  playlistId?: string | number;
  kind?: "tidal" | "user" | "shared";
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

  const handleNavigate = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);

    if (targetPath) {
      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
      return;
    }

    navigate(`/search?q=${encodeURIComponent(title)}`);
  };

    return (
    <motion.span
      layoutId={layoutId}
      className={`cursor-pointer hover:underline transition-colors ${className}`}
      onClick={handleNavigate}
    >
      {title}
    </motion.span>
  );
}
