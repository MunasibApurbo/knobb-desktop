import { useEffect, useRef, useState } from "react";

import {
  getMediaCardColumnsForWidth,
  type MediaCardSize,
} from "@/lib/mediaCardSizing";

const MOBILE_BREAKPOINT = 640;
const MOBILE_COLUMNS = 2;

function getColumnsForWidth(width: number, cardSize: MediaCardSize) {
  return getMediaCardColumnsForWidth(width, cardSize, MOBILE_BREAKPOINT, MOBILE_COLUMNS);
}

export function useResponsiveMediaCardCount(cardSize: MediaCardSize) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedCount, setCollapsedCount] = useState(() => {
    const initialWidth = typeof window === "undefined" ? 0 : window.innerWidth;
    return getColumnsForWidth(initialWidth, cardSize);
  });

  useEffect(() => {
    let animationFrame = 0;
    let detach: (() => void) | undefined;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
        const entry = entries[0];
        const nextWidth = entry?.contentRect.width ?? containerRef.current?.clientWidth ?? 0;
        setCollapsedCount((previous) => {
          const next = getColumnsForWidth(nextWidth, cardSize);
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
          const next = getColumnsForWidth(nextWidth, cardSize);
          return previous === next ? previous : next;
        });
      };

      recompute();
      resizeObserver?.observe(container);
      window.addEventListener("resize", recompute);
      detach = () => {
        resizeObserver?.disconnect();
        window.removeEventListener("resize", recompute);
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
