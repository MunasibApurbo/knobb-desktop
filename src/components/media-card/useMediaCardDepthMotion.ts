import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";

type CardDepthProfile = {
  cardShift: number;
  cardTilt: number;
};

type MediaCardDepthMotionOptions = {
  allowDepthMotion: boolean;
  depthProfile: CardDepthProfile;
};

export function useMediaCardDepthMotion({
  allowDepthMotion,
  depthProfile,
}: MediaCardDepthMotionOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerFrameRef = useRef(0);
  const pointerRectRef = useRef<DOMRect | null>(null);
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const settersRef = useRef<{
    pointerX: (value: number) => void;
    pointerY: (value: number) => void;
    rotateX: (value: number) => gsap.core.Tween;
    rotateY: (value: number) => gsap.core.Tween;
    opacity: (value: number) => gsap.core.Tween;
    shiftX: (value: number) => gsap.core.Tween;
    shiftY: (value: number) => gsap.core.Tween;
  } | null>(null);
  const [finePointer, setFinePointer] = useState(false);

  const interactiveDepth = allowDepthMotion && finePointer;

  useEffect(() => {
    if (!containerRef.current || !interactiveDepth) {
      settersRef.current = null;
      return;
    }

    const container = containerRef.current;

    gsap.set(container, {
      force3D: true,
      transformOrigin: "50% 50%",
    });

    settersRef.current = {
      pointerX: gsap.quickSetter(container, "--card-pointer-x", "%") as (value: number) => void,
      pointerY: gsap.quickSetter(container, "--card-pointer-y", "%") as (value: number) => void,
      rotateX: gsap.quickTo(container, "rotateX", {
        duration: 0.28,
        ease: "power4.out",
      }),
      rotateY: gsap.quickTo(container, "rotateY", {
        duration: 0.28,
        ease: "power4.out",
      }),
      opacity: gsap.quickTo(container, "--card-spotlight-opacity", {
        duration: 0.24,
        ease: "power3.out",
      }),
      shiftX: gsap.quickTo(container, "x", {
        duration: 0.32,
        ease: "power4.out",
      }),
      shiftY: gsap.quickTo(container, "y", {
        duration: 0.32,
        ease: "power4.out",
      }),
    };

    return () => {
      gsap.killTweensOf(container);
      settersRef.current = null;
    };
  }, [interactiveDepth]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(pointer: fine)");
    const updateFinePointer = () => setFinePointer(mediaQuery.matches);

    updateFinePointer();
    mediaQuery.addEventListener("change", updateFinePointer);

    return () => mediaQuery.removeEventListener("change", updateFinePointer);
  }, []);

  const cancelPointerFrame = useCallback(() => {
    if (!pointerFrameRef.current) return;
    window.cancelAnimationFrame(pointerFrameRef.current);
    pointerFrameRef.current = 0;
  }, []);

  const clearPointerTracking = useCallback(() => {
    cancelPointerFrame();
    pointerRectRef.current = null;
  }, [cancelPointerFrame]);

  const resetDepth = useCallback(() => {
    clearPointerTracking();
    if (!settersRef.current) return;

    const { opacity, pointerX, pointerY, rotateX, rotateY, shiftX, shiftY } = settersRef.current;
    pointerX(50);
    pointerY(50);
    rotateX(0);
    rotateY(0);
    shiftX(0);
    shiftY(0);
    opacity(0);
  }, [clearPointerTracking]);

  useEffect(() => {
    if (interactiveDepth) return;
    resetDepth();
  }, [interactiveDepth, resetDepth]);

  useEffect(() => () => {
    clearPointerTracking();
  }, [clearPointerTracking]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactiveDepth || !settersRef.current) return;
    pointerRectRef.current = event.currentTarget.getBoundingClientRect();
    gsap.killTweensOf(containerRef.current);
    settersRef.current.opacity(1);
  }, [interactiveDepth]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactiveDepth || !settersRef.current) return;

    pointerPositionRef.current.x = event.clientX;
    pointerPositionRef.current.y = event.clientY;

    if (pointerFrameRef.current) return;

    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = 0;

      const rect = pointerRectRef.current ?? event.currentTarget.getBoundingClientRect();
      pointerRectRef.current = rect;
      if (!settersRef.current || rect.width <= 0 || rect.height <= 0) return;

      const x = Math.max(0, Math.min(1, (pointerPositionRef.current.x - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (pointerPositionRef.current.y - rect.top) / rect.height));
      const { rotateX, rotateY, shiftX, shiftY, pointerX, pointerY } = settersRef.current;

      rotateY((x - 0.5) * depthProfile.cardTilt);
      rotateX((0.5 - y) * (depthProfile.cardTilt * 0.9));
      shiftX((x - 0.5) * depthProfile.cardShift);
      shiftY((y - 0.5) * (depthProfile.cardShift * 0.5));
      pointerX(x * 100);
      pointerY(y * 100);
    });
  }, [depthProfile.cardShift, depthProfile.cardTilt, interactiveDepth]);

  const handlePointerLeave = useCallback(() => {
    resetDepth();
  }, [resetDepth]);

  return {
    containerRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    interactiveDepth,
  };
}
