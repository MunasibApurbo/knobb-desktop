import { useEffect, useState } from "react";

export const MAIN_SCROLL_VIEWPORT_SELECTOR = "[data-main-scroll-viewport='true']";
const DEFAULT_SCROLL_STEP_PX = 48;
let currentViewport: HTMLElement | null = null;
let attachFrame = 0;
let scrollFrame = 0;
let rawScrollY = 0;
const listeners = new Set<() => void>();

function getMainScrollViewport() {
  return document.querySelector<HTMLElement>(MAIN_SCROLL_VIEWPORT_SELECTOR);
}

function quantizeScrollY(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (step <= 1) return value;
  return Math.floor(value / step) * step;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function cancelAttachFrame() {
  if (!attachFrame || typeof window === "undefined") return;
  window.cancelAnimationFrame(attachFrame);
  attachFrame = 0;
}

function cancelScrollFrame() {
  if (!scrollFrame || typeof window === "undefined") return;
  window.cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
}

function resetScrollStore() {
  cancelAttachFrame();
  cancelScrollFrame();
  detachViewport();
  rawScrollY = 0;
}

function commitScrollY(nextScrollY: number) {
  const normalizedScrollY = Number.isFinite(nextScrollY) && nextScrollY > 0 ? nextScrollY : 0;
  if (rawScrollY === normalizedScrollY) return;
  rawScrollY = normalizedScrollY;
  emitChange();
}

function readViewportScrollY() {
  return currentViewport?.scrollTop ?? 0;
}

function flushScrollY() {
  scrollFrame = 0;
  commitScrollY(readViewportScrollY());
}

function handleViewportScroll() {
  if (typeof window === "undefined" || scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(flushScrollY);
}

function detachViewport() {
  if (!currentViewport) return;
  currentViewport.removeEventListener("scroll", handleViewportScroll);
  currentViewport = null;
}

function attachViewport() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const nextViewport = getMainScrollViewport();
  if (!nextViewport) {
    if (!attachFrame) {
      attachFrame = window.requestAnimationFrame(() => {
        attachFrame = 0;
        attachViewport();
      });
    }
    return;
  }

  cancelAttachFrame();

  if (currentViewport !== nextViewport) {
    detachViewport();
    currentViewport = nextViewport;
    currentViewport.addEventListener("scroll", handleViewportScroll, { passive: true });
  }

  commitScrollY(nextViewport.scrollTop);
}

function subscribeToMainScrollY(listener: () => void) {
  listeners.add(listener);
  attachViewport();

  return () => {
    listeners.delete(listener);

    if (listeners.size > 0) return;

    resetScrollStore();
  };
}

function getScrollSnapshot() {
  return rawScrollY;
}

export function useMainScrollY(enabled = true, step = DEFAULT_SCROLL_STEP_PX) {
  const [scrollY, setScrollY] = useState(() => (enabled ? quantizeScrollY(getScrollSnapshot(), step) : 0));

  useEffect(() => {
    if (!enabled) {
      setScrollY(0);
      return;
    }

    const syncQuantizedScrollY = () => {
      const nextScrollY = quantizeScrollY(getScrollSnapshot(), step);
      setScrollY((currentScrollY) => (currentScrollY === nextScrollY ? currentScrollY : nextScrollY));
    };

    syncQuantizedScrollY();
    return subscribeToMainScrollY(syncQuantizedScrollY);
  }, [enabled, step]);

  return enabled ? scrollY : 0;
}
