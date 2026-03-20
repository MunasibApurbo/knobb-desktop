import { useEffect, useRef, useState } from "react";

import {
  getMediaCardColumnsForWidth,
  type MediaCardSize,
} from "@/lib/mediaCardSizing";

const COMPACT_WINDOW_COLUMNS = 2;
const COMPACT_WINDOW_BREAKPOINT = 960;

export function getResponsiveMediaCardColumnsForWidth(width: number, cardSize: MediaCardSize) {
  return getMediaCardColumnsForWidth(width, cardSize, COMPACT_WINDOW_BREAKPOINT, COMPACT_WINDOW_COLUMNS);
}

export function useResponsiveMediaCardCount(cardSize: MediaCardSize) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedCount, setCollapsedCount] = useState(() => {
    const initialWidth = typeof window === "undefined" ? 0 : window.innerWidth;
    return getResponsiveMediaCardColumnsForWidth(initialWidth, cardSize);
  });

  useEffect(() => {
    let animationFrame = 0;
    let detach: (() => void) | undefined;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          const entry = entries[0];
          const nextWidth = entry?.contentRect.width ?? containerRef.current?.clientWidth ?? 0;
          setCollapsedCount((previous) => {
            const next = getResponsiveMediaCardColumnsForWidth(nextWidth, cardSize);
            return previous === next ? previous : next;
          });
      })
      : null;

    const attach = () => {
      const container = containerRef.current;
      if (!container) {
        animationFrame = window.requestAnimationFrame(attach);
        return;
      }

      const recompute = () => {
        const nextWidth = container.clientWidth;
        setCollapsedCount((previous) => {
          const next = getResponsiveMediaCardColumnsForWidth(nextWidth, cardSize);
          return previous === next ? previous : next;
        });
      };

      recompute();
      if (resizeObserver) {
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", recompute);
      }
      detach = () => {
        resizeObserver?.disconnect();
        if (!resizeObserver) {
          window.removeEventListener("resize", recompute);
        }
      };
    };

    attach();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      detach?.();
    };
  }, [cardSize]);

  return {
    containerRef,
    collapsedCount,
    expandedCount: Math.max(collapsedCount * 2, collapsedCount),
  };
}
