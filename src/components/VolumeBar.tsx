import { useRef, useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { MOTION_SPRING } from "@/lib/motion";

interface VolumeBarProps {
  volume: number; // 0-1
  onChange: (v: number) => void;
  ariaLabel: string;
  ariaValueText?: (value: number) => string;
  className?: string;
  variant?: "wavy" | "straight";
}

const BAR_COUNT = 16;
const KEYBOARD_STEP = 0.05;
const PAGE_STEP = 0.1;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function VolumeBar({
  volume,
  onChange,
  ariaLabel,
  ariaValueText,
  className = "",
  variant = "wavy",
}: VolumeBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { motionEnabled } = useMotionPreferences();
  const safeVolume = clamp(Number.isFinite(volume) ? volume : 0);

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = clamp((clientX - rect.left) / rect.width);
      onChange(pct);
    },
    [onChange],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      handleInteraction(e.clientX);
    },
    [handleInteraction]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      handleInteraction(e.clientX);
    },
    [handleInteraction]
  );

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleGlobalPointerEnd = () => {
      stopDragging();
    };

    window.addEventListener("pointerup", handleGlobalPointerEnd);
    window.addEventListener("pointercancel", handleGlobalPointerEnd);
    window.addEventListener("blur", handleGlobalPointerEnd);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerEnd);
      window.removeEventListener("pointercancel", handleGlobalPointerEnd);
      window.removeEventListener("blur", handleGlobalPointerEnd);
    };
  }, [dragging, stopDragging]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextValue: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextValue = safeVolume - KEYBOARD_STEP;
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextValue = safeVolume + KEYBOARD_STEP;
        break;
      case "PageDown":
        nextValue = safeVolume - PAGE_STEP;
        break;
      case "PageUp":
        nextValue = safeVolume + PAGE_STEP;
        break;
      case "Home":
        nextValue = 0;
        break;
      case "End":
        nextValue = 1;
        break;
      default:
        break;
    }

    if (nextValue === null) return;

    event.preventDefault();
    onChange(clamp(nextValue));
  }, [onChange, safeVolume]);

  return (
    <motion.div
      ref={containerRef}
      className={`flex items-end gap-[2px] cursor-pointer h-5 ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeVolume * 100)}
      aria-valuetext={ariaValueText?.(safeVolume) ?? `${Math.round(safeVolume * 100)}%`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
      onPointerLeave={() => {
        if (!draggingRef.current) {
          setHovered(false);
        }
      }}
      onPointerEnter={() => setHovered(true)}
      style={{ touchAction: "none" }}
      animate={motionEnabled ? { scaleY: dragging ? 1.08 : hovered ? 1.03 : 1 } : undefined}
      transition={MOTION_SPRING.control}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const barPosition = (i + 0.5) / BAR_COUNT; // center of bar
        const isActive = barPosition <= safeVolume;

        let heightPct = 0.15;
        if (variant === "straight") {
          heightPct = 0.24 + (i / (BAR_COUNT - 1)) * 0.72;
          if (!isActive) heightPct = 0.15;
        } else {
          const wave = Math.sin((i / (BAR_COUNT - 1)) * Math.PI);
          const baseHeight = 0.3 + wave * 0.26 + (i / (BAR_COUNT - 1)) * 0.26;
          heightPct = isActive ? Math.max(0.3, baseHeight) : hovered ? 0.2 : 0.15;
        }

        if (isActive && (hovered || dragging)) {
          heightPct = Math.min(0.98, heightPct + 0.07);
        }

        return (
          <motion.div
            key={i}
            className="flex-1  origin-bottom"
            animate={{
              scaleY: heightPct,
              opacity: isActive ? 1 : 0.6,
            }}
            transition={{
              scaleY: MOTION_SPRING.control,
              opacity: { duration: motionEnabled ? 0.18 : 0 },
            }}
            style={{
              height: "100%",
              backgroundColor: isActive
                ? `var(--volume-active-color, hsl(var(--player-waveform)))`
                : `var(--volume-inactive-color, hsl(var(--muted-foreground) / 0.3))`,
            }}
          />
        );
      })}
    </motion.div>
  );
}
