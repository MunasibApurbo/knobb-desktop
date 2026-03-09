import { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { MOTION_SPRING } from "@/lib/motion";

interface VolumeBarProps {
  volume: number; // 0-1
  onChange: (v: number) => void;
  className?: string;
  variant?: "wavy" | "straight";
}

const BAR_COUNT = 16;

export function VolumeBar({ volume, onChange, className = "", variant = "wavy" }: VolumeBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { motionEnabled } = useMotionPreferences();

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(pct);
    },
    [onChange]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleInteraction(e.clientX);
    },
    [handleInteraction]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      handleInteraction(e.clientX);
    },
    [handleInteraction]
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className={`flex items-end gap-[2px] cursor-pointer h-5 ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        draggingRef.current = false;
        setDragging(false);
        setHovered(false);
      }}
      onPointerEnter={() => setHovered(true)}
      animate={motionEnabled ? { scaleY: dragging ? 1.08 : hovered ? 1.03 : 1 } : undefined}
      transition={MOTION_SPRING.control}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const barPosition = (i + 0.5) / BAR_COUNT; // center of bar
        const isActive = barPosition <= volume;

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
