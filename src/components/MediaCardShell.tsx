import { type ReactNode, useEffect, useMemo, useState } from "react";
import { motion, type HTMLMotionProps, useSpring } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { MEDIA_CARD_SHELL_CLASS } from "@/components/mediaCardStyles";
import { getMotionProfile, getStaggerItemVariants } from "@/lib/motion";

type MediaCardShellProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "onClick" | "children" | "className">;

export function MediaCardShell({
  children,
  onClick,
  className = "",
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  style,
  ...props
}: MediaCardShellProps) {
  const { motionEnabled, allowDepthMotion, websiteMode } = useMotionPreferences();
  const motionProfile = useMemo(() => getMotionProfile(websiteMode), [websiteMode]);
  const [finePointer, setFinePointer] = useState(false);
  const [spotlight, setSpotlight] = useState({ x: 50, y: 20, visible: false });
  const rotateX = useSpring(0, motionProfile.spring.card);
  const rotateY = useSpring(0, motionProfile.spring.card);
  const offsetX = useSpring(0, motionProfile.spring.card);
  const offsetY = useSpring(0, motionProfile.spring.card);
  const cardVariants = useMemo(
    () => getStaggerItemVariants(motionEnabled, websiteMode),
    [motionEnabled, websiteMode],
  );
  const interactiveDepth = allowDepthMotion && finePointer;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(pointer: fine)");
    const update = () => setFinePointer(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const resetDepth = () => {
    rotateX.set(0);
    rotateY.set(0);
    offsetX.set(0);
    offsetY.set(0);
    setSpotlight((current) => ({ ...current, visible: false }));
  };

  return (
    <motion.div
      variants={cardVariants}
      className={`${MEDIA_CARD_SHELL_CLASS} ${className}`}
      onClick={onClick}
      onPointerEnter={(event) => {
        if (interactiveDepth) {
          setSpotlight((current) => ({ ...current, visible: true }));
        }
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        if (interactiveDepth) {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

          rotateY.set((x - 0.5) * motionProfile.depth.cardTilt);
          rotateX.set((0.5 - y) * (motionProfile.depth.cardTilt * 0.9));
          offsetX.set((x - 0.5) * motionProfile.depth.cardShift);
          offsetY.set((y - 0.5) * (motionProfile.depth.cardShift * 0.5));
          setSpotlight({ x: x * 100, y: y * 100, visible: true });
        }

        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        resetDepth();
        onPointerLeave?.(event);
      }}
      style={{
        rotateX: interactiveDepth ? rotateX : 0,
        rotateY: interactiveDepth ? rotateY : 0,
        x: interactiveDepth ? offsetX : 0,
        y: interactiveDepth ? offsetY : 0,
        transformPerspective: interactiveDepth ? 1200 : undefined,
        ["--card-pointer-x" as string]: `${spotlight.x}%`,
        ["--card-pointer-y" as string]: `${spotlight.y}%`,
        ["--card-spotlight-opacity" as string]: spotlight.visible && interactiveDepth ? 1 : 0,
        ...style,
      }}
      whileTap={motionEnabled ? { scale: 0.985 } : undefined}
      {...props}
    >
      <div className="media-card-spotlight" aria-hidden="true" />
      {children}
    </motion.div>
  );
}
