import type { Transition, Variants } from "framer-motion";

import type { WebsiteMode } from "@/contexts/SettingsContext";

export const MOTION_EASE = {
  smooth: [0.18, 1, 0.24, 1] as const,
  swift: [0.14, 1, 0.22, 1] as const,
  settle: [0.28, 1, 0.44, 1] as const,
};

export const MOTION_DURATION = {
  instant: 0.2,
  fast: 0.34,
  base: 0.56,
  slow: 0.9,
  ambient: 1.4,
} as const;

export const MOTION_SPRING = {
  shell: {
    type: "spring",
    stiffness: 178,
    damping: 22,
    mass: 1.06,
  } satisfies Transition,
  card: {
    type: "spring",
    stiffness: 205,
    damping: 18,
    mass: 0.92,
  } satisfies Transition,
  control: {
    type: "spring",
    stiffness: 285,
    damping: 18,
    mass: 0.82,
  } satisfies Transition,
} as const;

export const MOTION_DEPTH = {
  pageOffset: 24,
  sectionOffset: 30,
  cardLift: 16,
  cardTilt: 10,
  cardShift: 11,
  shellCompress: 28,
} as const;
export function getMotionProfile(_websiteMode: WebsiteMode = "roundish") {
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
      scale: 0.986,
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
      y: -14,
      scale: 1.008,
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
      y: depth.sectionOffset,
      scale: 0.988,
    },
    show: (index = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.slow,
        ease: ease.smooth,
        delay: index * 0.1,
      },
    }),
  };
}

export function getStaggerContainerVariants(
  motionEnabled: boolean,
  _websiteMode: WebsiteMode = "roundish",
): Variants {
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
        staggerChildren: 0.075,
        delayChildren: 0.05,
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
      y: 24,
      scale: 0.972,
      rotateX: 1.5,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
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
      y: 8,
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
      y: -4,
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
  _websiteMode: WebsiteMode = "roundish",
) {
  if (!motionEnabled) return undefined;
  return { scale: 1.085, y: -2.8, rotate: -1.2 };
}

export function getControlTap(
  motionEnabled: boolean,
  _websiteMode: WebsiteMode = "roundish",
) {
  if (!motionEnabled) return undefined;
  return { scale: 0.94, y: 1.6, rotate: 0.8 };
}
