import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDuration } from "@/lib/utils";

type SeekSurfaceProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  style?: CSSProperties;
};

const KEYBOARD_SEEK_STEP_SECONDS = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SeekSurface({
  ariaLabel,
  children,
  className = "",
  currentTime,
  duration,
  onSeek,
  style,
}: SeekSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime = clamp(Number.isFinite(currentTime) ? currentTime : 0, 0, safeDuration || 0);

  const seekFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container || safeDuration <= 0) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const nextTime = clamp((clientX - rect.left) / rect.width, 0, 1) * safeDuration;
    onSeek(nextTime);
  }, [onSeek, safeDuration]);

  const stopDragging = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    containerRef.current = event.currentTarget;
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.preventDefault();
    event.stopPropagation();

    if (typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore browsers that reject capture for synthetic events.
      }
    }

    seekFromClientX(event.clientX);
  }, [safeDuration, seekFromClientX]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      seekFromClientX(event.clientX);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      seekFromClientX(event.clientX);
      stopDragging();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      stopDragging();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [isDragging, seekFromClientX, stopDragging]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;

    let nextTime: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextTime = safeCurrentTime - KEYBOARD_SEEK_STEP_SECONDS;
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextTime = safeCurrentTime + KEYBOARD_SEEK_STEP_SECONDS;
        break;
      case "Home":
        nextTime = 0;
        break;
      case "End":
        nextTime = safeDuration;
        break;
      default:
        break;
    }

    if (nextTime === null) return;

    event.preventDefault();
    event.stopPropagation();
    onSeek(clamp(nextTime, 0, safeDuration));
  }, [onSeek, safeCurrentTime, safeDuration]);

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemax={Math.max(Math.floor(safeDuration), 0)}
      aria-valuemin={0}
      aria-valuenow={Math.floor(safeCurrentTime)}
      aria-valuetext={`${formatDuration(Math.floor(safeCurrentTime))} of ${formatDuration(Math.floor(safeDuration))}`}
      className={className}
      data-dragging={isDragging ? "true" : "false"}
      role="slider"
      tabIndex={safeDuration > 0 ? 0 : -1}
      style={{ ...style, touchAction: "none" }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      {children}
    </div>
  );
}
