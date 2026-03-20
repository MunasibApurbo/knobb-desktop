import { useLocation } from "react-router-dom";

export function useEmbedMode() {
  const location = useLocation();
  if (location.pathname.startsWith("/embed/") || location.pathname.startsWith("/embed-player/")) {
    return true;
  }

  const params = new URLSearchParams(location.search);
  const embed = params.get("embed");
  return embed === "1" || embed === "true";
}
