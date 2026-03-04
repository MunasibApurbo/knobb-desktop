import { useRef, useCallback } from "react";
import { motion } from "framer-motion";

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
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex items-end gap-[2px] cursor-pointer h-5 ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const barPosition = (i + 0.5) / BAR_COUNT; // center of bar
        const isActive = barPosition <= volume;

        let heightPct = 0.15;
        if (variant === "straight") {
          heightPct = 0.2 + (i / (BAR_COUNT - 1)) * 0.8;
          if (!isActive) heightPct = 0.15;
        } else {
          // Create a wave-like height pattern
          const wave = Math.sin((i / BAR_COUNT) * Math.PI * 2 + Date.now() * 0.001);
          const baseHeight = 0.3 + (i / BAR_COUNT) * 0.7; // grows from left to right
          heightPct = isActive ? Math.max(0.25, baseHeight) : 0.15;
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
              scaleY: { type: "spring", stiffness: 400, damping: 25 },
              opacity: { duration: 0.15 },
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
    </div>
  );
}
