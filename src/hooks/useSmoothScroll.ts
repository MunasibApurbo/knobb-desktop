import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

import { MAIN_SCROLL_VIEWPORT_SELECTOR } from "@/hooks/useMainScrollY";

type UseSmoothScrollOptions = {
  contentRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  lerp?: number;
  startDelay?: number;
  wheelMultiplier?: number;
  wrapperRef?: RefObject<HTMLElement | null>;
};

function shouldPreventNestedSmoothing(node: HTMLElement, wrapper: HTMLElement) {
  const nestedScrollable = node.closest<HTMLElement>(
    [
      "[data-native-scroll='true']",
      "[data-native-wheel-scroll='true']",
      "[data-radix-scroll-area-viewport]",
      ".overflow-y-auto",
      ".overflow-x-auto",
      ".overflow-auto",
      ".overscroll-contain",
    ].join(", "),
  );

  return Boolean(nestedScrollable && nestedScrollable !== wrapper);
}

export function useSmoothScroll({
  contentRef,
  enabled = true,
  lerp = 0.2,
  startDelay = 900,
  wheelMultiplier = 1,
  wrapperRef,
}: UseSmoothScrollOptions) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const wrapper = wrapperRef?.current;
    const content = contentRef?.current;

    if (!wrapper || !content) {
      return;
    }

    let frameId = 0;
    let startTimeout = 0;
    let lenis: Lenis | null = null;

    const startLenis = () => {
      lenis = new Lenis({
        wrapper,
        content,
        eventsTarget: wrapper,
        autoRaf: false,
        autoResize: true,
        smoothWheel: true,
        syncTouch: false,
        gestureOrientation: "vertical",
        lerp,
        wheelMultiplier,
        allowNestedScroll: true,
        overscroll: false,
        prevent: (node) => shouldPreventNestedSmoothing(node, wrapper),
      });

      lenis.resize();

      if (wrapper.matches(MAIN_SCROLL_VIEWPORT_SELECTOR) && wrapper.scrollTop > 0) {
        lenis.scrollTo(wrapper.scrollTop, { immediate: true, force: true });
      }

      const onFrame = (time: number) => {
        lenis?.raf(time);
        frameId = window.requestAnimationFrame(onFrame);
      };

      frameId = window.requestAnimationFrame(onFrame);
    };

    if (startDelay > 0) {
      startTimeout = window.setTimeout(startLenis, startDelay);
    } else {
      startLenis();
    }

    return () => {
      if (startTimeout) {
        window.clearTimeout(startTimeout);
      }
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      lenis?.destroy();
    };
  }, [contentRef, enabled, lerp, startDelay, wheelMultiplier, wrapperRef]);
}
