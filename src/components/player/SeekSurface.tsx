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
  onSeekPreview?: (time: number) => void;
  onSeekCancel?: () => void;
  style?: CSSProperties;
};

const KEYBOARD_SEEK_STEP_SECONDS = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function matchesActivePointer(activePointerId: number | null, pointerId: number | null | undefined) {
  if (activePointerId === null) return false;
  if (!Number.isFinite(pointerId) || Number(pointerId) <= 0) return true;
  return pointerId === activePointerId;
}

export function SeekSurface({
  ariaLabel,
  children,
  className = "",
  currentTime,
  duration,
  onSeek,
  onSeekPreview,
  onSeekCancel,
  style,
}: SeekSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const queuedPreviewClientXRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime = clamp(Number.isFinite(currentTime) ? currentTime : 0, 0, safeDuration || 0);

  const getTimeFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container || safeDuration <= 0) return null;
    if (!Number.isFinite(clientX)) return null;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return null;

    return clamp((clientX - rect.left) / rect.width, 0, 1) * safeDuration;
  }, [safeDuration]);

  const previewSeekFromClientX = useCallback((clientX: number) => {
    const nextTime = getTimeFromClientX(clientX);
    if (nextTime === null) return null;
    onSeekPreview?.(nextTime);
    return nextTime;
  }, [getTimeFromClientX, onSeekPreview]);

  const cancelQueuedPreview = useCallback(() => {
    if (previewFrameRef.current === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = null;
    queuedPreviewClientXRef.current = null;
  }, []);

  const queuePreviewSeekFromClientX = useCallback((clientX: number) => {
    queuedPreviewClientXRef.current = clientX;

    if (typeof window === "undefined") {
      previewSeekFromClientX(clientX);
      queuedPreviewClientXRef.current = null;
      return;
    }

    if (previewFrameRef.current !== null) return;

    previewFrameRef.current = window.requestAnimationFrame(() => {
      const queuedClientX = queuedPreviewClientXRef.current;
      previewFrameRef.current = null;
      queuedPreviewClientXRef.current = null;
      if (queuedClientX === null) return;
      previewSeekFromClientX(queuedClientX);
    });
  }, [previewSeekFromClientX]);

  const commitSeekFromClientX = useCallback((clientX: number) => {
    const nextTime = getTimeFromClientX(clientX);
    if (nextTime === null) return;
    onSeek(nextTime);
  }, [getTimeFromClientX, onSeek]);

  const releaseActivePointerCapture = useCallback(() => {
    const container = containerRef.current;
    const activePointerId = activePointerIdRef.current;

    if (!container || activePointerId === null || typeof container.hasPointerCapture !== "function") {
      return;
    }

    if (!container.hasPointerCapture(activePointerId) || typeof container.releasePointerCapture !== "function") {
      return;
    }

    try {
      container.releasePointerCapture(activePointerId);
    } catch {
      // Ignore browsers that reject release when the capture already ended.
    }
  }, []);

  const stopDragging = useCallback((options?: { releaseCapture?: boolean }) => {
    cancelQueuedPreview();
    if (options?.releaseCapture !== false) {
      releaseActivePointerCapture();
    }
    activePointerIdRef.current = null;
    setIsDragging(false);
  }, [cancelQueuedPreview, releaseActivePointerCapture]);

  const handleActivePointerMove = useCallback((pointerId: number, clientX: number) => {
    const activePointerId = activePointerIdRef.current;
    if (!matchesActivePointer(activePointerId, pointerId)) return;
    queuePreviewSeekFromClientX(clientX);
  }, [queuePreviewSeekFromClientX]);

  const handleActivePointerUp = useCallback((pointerId: number, clientX: number) => {
    const activePointerId = activePointerIdRef.current;
    if (!matchesActivePointer(activePointerId, pointerId)) return;
    commitSeekFromClientX(clientX);
    stopDragging();
  }, [commitSeekFromClientX, stopDragging]);

  const handleActivePointerCancel = useCallback((pointerId: number) => {
    const activePointerId = activePointerIdRef.current;
    if (!matchesActivePointer(activePointerId, pointerId)) return;
    onSeekCancel?.();
    stopDragging();
  }, [onSeekCancel, stopDragging]);

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

    previewSeekFromClientX(event.clientX);
  }, [previewSeekFromClientX, safeDuration]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      handleActivePointerMove(event.pointerId, event.clientX);
    };

    const handlePointerUp = (event: PointerEvent) => {
      handleActivePointerUp(event.pointerId, event.clientX);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      handleActivePointerCancel(event.pointerId);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [handleActivePointerCancel, handleActivePointerMove, handleActivePointerUp, isDragging]);

  useEffect(() => cancelQueuedPreview, [cancelQueuedPreview]);

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
      onPointerMove={(event) => handleActivePointerMove(event.pointerId, event.clientX)}
      onPointerUp={(event) => handleActivePointerUp(event.pointerId, event.clientX)}
      onPointerCancel={(event) => handleActivePointerCancel(event.pointerId)}
      onLostPointerCapture={(event) => {
        if (!matchesActivePointer(activePointerIdRef.current, event.pointerId)) return;
        onSeekCancel?.();
        stopDragging({ releaseCapture: false });
      }}
    >
      {children}
    </div>
  );
}
