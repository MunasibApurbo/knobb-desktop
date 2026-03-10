import { useEffect, useState } from "react";

export const MAIN_SCROLL_VIEWPORT_SELECTOR = "[data-main-scroll-viewport='true']";
const DEFAULT_SCROLL_STEP_PX = 8;

function getMainScrollViewport() {
  return document.querySelector<HTMLElement>(MAIN_SCROLL_VIEWPORT_SELECTOR);
}

function quantizeScrollY(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (step <= 1) return value;
  return Math.round(value / step) * step;
}

export function useMainScrollY(enabled = true, step = DEFAULT_SCROLL_STEP_PX) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setScrollY(0);
      return;
    }

    let animationFrame = 0;
    let scrollFrame = 0;
    let detach: (() => void) | undefined;

    const attach = () => {
      const scrollContainer = getMainScrollViewport();
      if (!scrollContainer) {
        animationFrame = window.requestAnimationFrame(attach);
        return;
      }

      const handleScroll = () => {
        if (scrollFrame) return;

        scrollFrame = window.requestAnimationFrame(() => {
          scrollFrame = 0;
          setScrollY((previous) => {
            const next = quantizeScrollY(scrollContainer.scrollTop, step);
            return previous === next ? previous : next;
          });
        });
      };

      handleScroll();
      scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
      detach = () => {
        scrollContainer.removeEventListener("scroll", handleScroll);
        if (scrollFrame) {
          window.cancelAnimationFrame(scrollFrame);
          scrollFrame = 0;
        }
      };
    };

    attach();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      detach?.();
    };
  }, [enabled, step]);

  return scrollY;
}
