import { useEffect } from "react";
import { readStartupPerformanceBudget } from "@/lib/performanceProfile";
import { preloadHrefRoute } from "@/lib/routePreload";

function getPreloadAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }

  return anchor;
}

export function NavigationIntentPreloader() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const startupBudget = readStartupPerformanceBudget();
    const hoverPreloadedAnchors = new WeakSet<HTMLAnchorElement>();

    const handleIntent = (event: Event) => {
      const anchor = getPreloadAnchor(event.target);
      if (!anchor) {
        return;
      }

      if (event.type === "mouseover") {
        if (!startupBudget.canPreloadLikelyRoutes || hoverPreloadedAnchors.has(anchor)) {
          return;
        }

        hoverPreloadedAnchors.add(anchor);
      }

      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      void preloadHrefRoute(href);
    };

    document.addEventListener("focusin", handleIntent, { capture: true });
    document.addEventListener("mouseover", handleIntent, { capture: true, passive: true });
    document.addEventListener("pointerdown", handleIntent, { capture: true, passive: true });

    return () => {
      document.removeEventListener("focusin", handleIntent, true);
      document.removeEventListener("mouseover", handleIntent, true);
      document.removeEventListener("pointerdown", handleIntent, true);
    };
  }, []);

  return null;
}
