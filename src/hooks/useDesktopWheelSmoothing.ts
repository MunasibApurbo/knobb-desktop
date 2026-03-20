import { useEffect, type RefObject } from "react";

type UseDesktopWheelSmoothingOptions = {
  enabled?: boolean;
  viewportRef: RefObject<HTMLElement | null>;
};

const LINE_HEIGHT_PX = 6;
const DISCRETE_PIXEL_DELTA_THRESHOLD = 3;
const DISCRETE_WHEEL_MULTIPLIER = 0.16;
const MIN_STEP_PX = 0.2;
const MOMENTUM_GAIN = 0.3;
const MOMENTUM_DAMPING = 0.925;
const MAX_VELOCITY_PX = 32;
const STOP_VELOCITY_PX = 0.03;
const WHEEL_BURST_WINDOW_MS = 180;
const SCROLL_PRECISION_MULTIPLIER = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function alignToDevicePixel(value: number) {
  if (typeof window === "undefined") return value;
  const ratio = Math.max((window.devicePixelRatio || 1) * SCROLL_PRECISION_MULTIPLIER, 1);
  return Math.round(value * ratio) / ratio;
}

function getNestedScrollableTarget(target: EventTarget | null, viewport: HTMLElement) {
  if (!(target instanceof HTMLElement)) return null;

  const nestedScrollable = target.closest<HTMLElement>(
    [
      "[data-native-scroll='true']",
      "[data-radix-scroll-area-viewport]",
      ".overflow-y-auto",
      ".overflow-x-auto",
      ".overflow-auto",
      ".overscroll-contain",
    ].join(", "),
  );

  if (!nestedScrollable || nestedScrollable === viewport) {
    return null;
  }

  return nestedScrollable;
}

function isLikelyDiscreteWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return false;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE || event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return true;
  }

  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return false;
  }

  return Math.abs(event.deltaY) >= DISCRETE_PIXEL_DELTA_THRESHOLD;
}

function wheelDeltaToPixels(event: WheelEvent, viewport: HTMLElement) {
  let delta = 0;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta = event.deltaY * LINE_HEIGHT_PX;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta = event.deltaY * viewport.clientHeight * 0.9;
  } else {
    delta = event.deltaY;
  }

  const scaledDelta = delta * DISCRETE_WHEEL_MULTIPLIER;
  if (!Number.isFinite(scaledDelta) || scaledDelta === 0) {
    return 0;
  }

  const direction = Math.sign(scaledDelta);
  return direction * Math.max(MIN_STEP_PX, Math.abs(scaledDelta));
}

export function useDesktopWheelSmoothing({
  enabled = true,
  viewportRef,
}: UseDesktopWheelSmoothingOptions) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    let animationFrame = 0;
    let animatedScrollTop = viewport.scrollTop;
    let velocity = 0;
    let lastAnimationTimestamp = 0;
    let lastWheelTimestamp = 0;
    let syncingFromAnimation = false;

    const stopAnimation = () => {
      if (!animationFrame) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      velocity = 0;
    };

    const animateScroll = (timestamp: number) => {
      animationFrame = 0;
      const frameDeltaMs = lastAnimationTimestamp ? timestamp - lastAnimationTimestamp : 16.6667;
      lastAnimationTimestamp = timestamp;
      const frameScale = Math.max(0.5, Math.min(frameDeltaMs / 16.6667, 3));
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

      if (maxScrollTop <= 0 || Math.abs(velocity) < STOP_VELOCITY_PX) {
        velocity = 0;
        animatedScrollTop = alignToDevicePixel(clamp(animatedScrollTop, 0, maxScrollTop));
        syncingFromAnimation = true;
        viewport.scrollTop = animatedScrollTop;
        return;
      }

      const nextScrollTop = alignToDevicePixel(
        clamp(animatedScrollTop + (velocity * frameScale), 0, maxScrollTop),
      );
      const hitBoundary = nextScrollTop === 0 || nextScrollTop === maxScrollTop;
      const didVisiblyMove = nextScrollTop !== animatedScrollTop;

      animatedScrollTop = nextScrollTop;
      syncingFromAnimation = true;
      viewport.scrollTop = nextScrollTop;

      velocity *= Math.pow(MOMENTUM_DAMPING, frameScale);

      if (!didVisiblyMove && Math.abs(velocity) < 0.45) {
        velocity = 0;
      }

      if (hitBoundary && Math.sign(velocity) === Math.sign(animatedScrollTop === 0 ? -1 : 1)) {
        velocity = 0;
      }

      animationFrame = window.requestAnimationFrame(animateScroll);
    };

    const ensureAnimation = () => {
      if (animationFrame) return;
      lastAnimationTimestamp = 0;
      animationFrame = window.requestAnimationFrame(animateScroll);
    };

    const syncAnimatedPosition = () => {
      if (syncingFromAnimation) {
        syncingFromAnimation = false;
        return;
      }

      if (animationFrame) {
        animatedScrollTop = alignToDevicePixel(viewport.scrollTop);
        return;
      }

      animatedScrollTop = alignToDevicePixel(viewport.scrollTop);
      velocity = 0;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isLikelyDiscreteWheel(event)) {
        stopAnimation();
        animatedScrollTop = viewport.scrollTop;
        return;
      }

      if (getNestedScrollableTarget(event.target, viewport)) {
        return;
      }

      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (maxScrollTop <= 0) {
        return;
      }

      const delta = wheelDeltaToPixels(event, viewport);
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }

      const atTop = viewport.scrollTop <= 0;
      const atBottom = viewport.scrollTop >= maxScrollTop - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        return;
      }

      event.preventDefault();
      animatedScrollTop = alignToDevicePixel(viewport.scrollTop);

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const burstGap = now - lastWheelTimestamp;
      lastWheelTimestamp = now;

      if (Math.sign(delta) !== Math.sign(velocity) && Math.abs(velocity) > STOP_VELOCITY_PX) {
        velocity *= burstGap <= WHEEL_BURST_WINDOW_MS ? 0.28 : 0.12;
      }

      velocity = clamp(
        velocity + (delta * MOMENTUM_GAIN),
        -MAX_VELOCITY_PX,
        MAX_VELOCITY_PX,
      );
      ensureAnimation();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("scroll", syncAnimatedPosition, { passive: true });

    return () => {
      stopAnimation();
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("scroll", syncAnimatedPosition);
    };
  }, [enabled, viewportRef]);
}
