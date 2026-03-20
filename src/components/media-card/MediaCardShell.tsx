import {
  type CSSProperties,
  type FocusEvent,
  type ForwardedRef,
  forwardRef,
  memo,
  type PointerEvent,
  type ReactNode,
  useMemo,
} from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getStaggerItemVariants } from "@/lib/motion";
import { MEDIA_CARD_SHELL_CLASS } from "./styles";

type MediaCardShellProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  disableDepthMotion?: boolean;
  hoverProfile?: "auto" | "static" | "lite" | "balanced" | "premium";
} & Omit<HTMLMotionProps<"div">, "onClick" | "children" | "className">;

const HOVER_ACTIVE_ATTRIBUTE = "data-hover-card-active";

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

function getHoverContainer(node: HTMLElement | null) {
  return node?.closest<HTMLElement>(".hover-desaturate-page") ?? null;
}

function isMainScrollInteractionActive() {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-main-scrolling") === "true";
}

export const MediaCardShell = memo(forwardRef<HTMLDivElement, MediaCardShellProps>(function MediaCardShell({
  children,
  onClick,
  className = "",
  disableDepthMotion = false,
  hoverProfile = "auto",
  onBlur,
  onFocus,
  onMouseEnter,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  style,
  ...props
}: MediaCardShellProps, forwardedRef) {
  const {
    motionEnabled,
    cardHoverProfile,
    lowEndDevice,
    strongDesktopEffects,
    websiteMode,
  } = useMotionPreferences();
  const cardVariants = useMemo(
    () => getStaggerItemVariants(motionEnabled, websiteMode),
    [motionEnabled, websiteMode],
  );
  const resolvedHoverProfile = useMemo(() => {
    if (hoverProfile !== "auto") return hoverProfile;
    if (cardHoverProfile) return cardHoverProfile;
    if (!motionEnabled) return "static";
    if (lowEndDevice) return "lite";
    if (strongDesktopEffects) return "premium";
    return "balanced";
  }, [cardHoverProfile, hoverProfile, lowEndDevice, motionEnabled, strongDesktopEffects]);
  const tapAnimation = motionEnabled && resolvedHoverProfile !== "static" ? { scale: 0.985 } : undefined;
  void disableDepthMotion;
  const motionDivProps = {
    variants: cardVariants,
    className: `${MEDIA_CARD_SHELL_CLASS} ${className}`,
    onClick,
    onMouseEnter: (event) => {
      if (isMainScrollInteractionActive()) {
        return;
      }
      onMouseEnter?.(event);
    },
    onPointerEnter: (event: PointerEvent<HTMLDivElement>) => {
      if (isMainScrollInteractionActive()) {
        getHoverContainer(event.currentTarget)?.removeAttribute(HOVER_ACTIVE_ATTRIBUTE);
        return;
      }
      getHoverContainer(event.currentTarget)?.setAttribute(HOVER_ACTIVE_ATTRIBUTE, "true");
      onPointerEnter?.(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (isMainScrollInteractionActive()) {
        return;
      }
      onPointerMove?.(event);
    },
    onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
      getHoverContainer(event.currentTarget)?.removeAttribute(HOVER_ACTIVE_ATTRIBUTE);
      onPointerLeave?.(event);
    },
    onFocus: (event: FocusEvent<HTMLDivElement>) => {
      getHoverContainer(event.currentTarget)?.setAttribute(HOVER_ACTIVE_ATTRIBUTE, "true");
      onFocus?.(event);
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      const hoverContainer = getHoverContainer(event.currentTarget);
      const nextFocusedNode = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!hoverContainer?.contains(nextFocusedNode)) {
        hoverContainer?.removeAttribute(HOVER_ACTIVE_ATTRIBUTE);
      }
      onBlur?.(event);
    },
    whileTap: tapAnimation,
    ...props,
  } satisfies Omit<HTMLMotionProps<"div">, "children">;

  return (
    <motion.div
      {...motionDivProps}
      ref={forwardedRef}
      data-card-hover-profile={resolvedHoverProfile}
      data-card-depth-active="false"
      style={style as CSSProperties}
    >
      {children}
    </motion.div>
  );
}));

MediaCardShell.displayName = "MediaCardShell";
