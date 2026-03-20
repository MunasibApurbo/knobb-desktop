import type { Transition, Variants } from "framer-motion";

import type { WebsiteMode } from "@/contexts/SettingsContext";

export const MOTION_EASE = {
  smooth: [0.22, 1, 0.36, 1] as const,
  swift: [0.16, 1, 0.3, 1] as const,
  settle: [0.28, 0.84, 0.42, 1] as const,
};

export const MOTION_DURATION = {
  instant: 0.12,
  fast: 0.22,
  base: 0.38,
  slow: 0.56,
  ambient: 1.05,
} as const;

export const MOTION_SPRING = {
  shell: {
    type: "spring",
    stiffness: 320,
    damping: 30,
    mass: 0.82,
  } satisfies Transition,
  card: {
    type: "spring",
    stiffness: 360,
    damping: 32,
    mass: 0.72,
  } satisfies Transition,
  control: {
    type: "spring",
    stiffness: 460,
    damping: 34,
    mass: 0.58,
  } satisfies Transition,
} as const;

export const MOTION_DEPTH = {
  pageOffset: 12,
  sectionOffset: 14,
  cardLift: 12,
  cardTilt: 4.25,
  cardShift: 5,
  shellCompress: 14,
} as const;
export function getMotionProfile(websiteMode: WebsiteMode = "roundish") {
  void websiteMode;
  return {
    ease: MOTION_EASE,
    duration: MOTION_DURATION,
    spring: MOTION_SPRING,
    depth: MOTION_DEPTH,
  } as const;
}

export function getPageTransitionVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Variants {
  if (!motionEnabled) {
    return {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease, depth } = getMotionProfile(websiteMode);

  return {
    initial: {
      opacity: 0,
      y: depth.pageOffset,
      scale: 1,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.slow,
        ease: ease.smooth,
      },
    },
    exit: {
      opacity: 0,
      y: -depth.pageOffset * 0.45,
      scale: 0.996,
      transition: {
        duration: duration.fast,
        ease: ease.settle,
      },
    },
  };
}

export function getSectionRevealVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Variants {
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0 },
    };
  }

  const { duration, ease, depth } = getMotionProfile(websiteMode);

  return {
    hidden: {
      opacity: 0,
      y: depth.sectionOffset * 0.45,
      scale: 1,
    },
    show: (index = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.fast,
        ease: ease.smooth,
        delay: index * 0.024,
      },
    }),
  };
}

export function getStaggerContainerVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Variants {
  void websiteMode;
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1 },
      show: { opacity: 1 },
    };
  }

  return {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.016,
        delayChildren: 0.01,
      },
    },
  };
}

export function getStaggerItemVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Variants {
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1, y: 0, scale: 1 },
      show: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease } = getMotionProfile(websiteMode);

  return {
    hidden: {
      opacity: 0,
      y: 10,
      scale: 0.992,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.base,
        ease: ease.smooth,
      },
    },
  };
}

export function getSurfaceSwapTransition(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Transition {
  const { duration, ease } = getMotionProfile(websiteMode);

  return motionEnabled
    ? {
        duration: duration.base,
        ease: ease.smooth,
      }
    : { duration: 0 };
}

export function getSharedArtworkLayoutId(
  kind: "album" | "artist" | "playlist",
  id: string | number | null | undefined,
  motionEnabled: boolean,
) {
  if (!motionEnabled || id === null || id === undefined || id === "") return undefined;
  return `${kind}-art:${id}`;
}

export function getPageTitleLayoutId(
  id: string | number | null | undefined,
  motionEnabled: boolean,
) {
  if (!motionEnabled || id === null || id === undefined || id === "") return undefined;
  return `page-title:${id}`;
}

export function getLoadingPulseTransition(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Transition {
  const { duration, ease } = getMotionProfile(websiteMode);

  return motionEnabled
    ? {
        duration: duration.ambient,
        repeat: Infinity,
        repeatType: "mirror",
        ease: ease.smooth,
      }
    : { duration: 0 };
}

export function getContentSwapVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
): Variants {
  if (!motionEnabled) {
    return {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease } = getMotionProfile(websiteMode);

  return {
    initial: {
      opacity: 0,
      y: 4,
      scale: 1,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.base,
        ease: ease.smooth,
      },
    },
    exit: {
      opacity: 0,
      y: -2,
      scale: 1,
      transition: {
        duration: duration.fast,
        ease: ease.settle,
      },
    },
  };
}

export function getShellCompressionStyles(
  scrollProgress: number,
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
) {
  if (!motionEnabled) {
    return {
      scale: 1,
      y: 0,
      opacity: 1,
      borderOpacity: 0.1,
      blur: 0,
    };
  }

  const { depth } = getMotionProfile(websiteMode);
  const boundedProgress = Math.max(0, Math.min(scrollProgress, 1));

  return {
    scale: 1 - boundedProgress * 0.026,
    y: -boundedProgress * depth.shellCompress,
    opacity: 1 - boundedProgress * 0.12,
    borderOpacity: 0.1 + boundedProgress * 0.08,
    blur: boundedProgress * 10,
  };
}

export function getControlHover(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
) {
  void websiteMode;
  if (!motionEnabled) return undefined;
  return { scale: 1.04, y: -1.4, rotate: 0 };
}

export function getControlTap(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "roundish",
) {
  void websiteMode;
  if (!motionEnabled) return undefined;
  return { scale: 0.972, y: 0.8, rotate: 0 };
}
