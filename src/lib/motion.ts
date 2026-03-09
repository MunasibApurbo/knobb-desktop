import type { Transition, Variants } from "framer-motion";

import type { WebsiteMode } from "@/contexts/SettingsContext";

export const MOTION_EASE = {
  smooth: [0.22, 1, 0.36, 1] as const,
  swift: [0.16, 1, 0.3, 1] as const,
  settle: [0.33, 1, 0.68, 1] as const,
};

export const MOTION_DURATION = {
  instant: 0.18,
  fast: 0.26,
  base: 0.42,
  slow: 0.72,
  ambient: 1.1,
} as const;

export const MOTION_SPRING = {
  shell: {
    type: "spring",
    stiffness: 220,
    damping: 28,
    mass: 0.9,
  } satisfies Transition,
  card: {
    type: "spring",
    stiffness: 260,
    damping: 22,
    mass: 0.78,
  } satisfies Transition,
  control: {
    type: "spring",
    stiffness: 360,
    damping: 24,
    mass: 0.7,
  } satisfies Transition,
} as const;

export const MOTION_DEPTH = {
  pageOffset: 18,
  sectionOffset: 24,
  cardLift: 12,
  cardTilt: 8,
  cardShift: 9,
  shellCompress: 22,
} as const;

const ROUNDISH_MOTION_EASE = {
  smooth: [0.18, 1, 0.24, 1] as const,
  swift: [0.14, 1, 0.22, 1] as const,
  settle: [0.28, 1, 0.44, 1] as const,
};

const ROUNDISH_MOTION_DURATION = {
  instant: 0.2,
  fast: 0.34,
  base: 0.56,
  slow: 0.9,
  ambient: 1.4,
} as const;

const ROUNDISH_MOTION_SPRING = {
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

const ROUNDISH_MOTION_DEPTH = {
  pageOffset: 24,
  sectionOffset: 30,
  cardLift: 16,
  cardTilt: 10,
  cardShift: 11,
  shellCompress: 28,
} as const;

function isRoundishMode(websiteMode: WebsiteMode) {
  return websiteMode === "roundish";
}

export function getMotionProfile(websiteMode: WebsiteMode = "edgy") {
  if (isRoundishMode(websiteMode)) {
    return {
      ease: ROUNDISH_MOTION_EASE,
      duration: ROUNDISH_MOTION_DURATION,
      spring: ROUNDISH_MOTION_SPRING,
      depth: ROUNDISH_MOTION_DEPTH,
    } as const;
  }

  return {
    ease: MOTION_EASE,
    duration: MOTION_DURATION,
    spring: MOTION_SPRING,
    depth: MOTION_DEPTH,
  } as const;
}

export function getPageTransitionVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "edgy",
): Variants {
  if (!motionEnabled) {
    return {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease, depth } = getMotionProfile(websiteMode);
  const isRoundish = isRoundishMode(websiteMode);

  return {
    initial: {
      opacity: 0,
      y: depth.pageOffset,
      scale: isRoundish ? 0.986 : 0.992,
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
      y: isRoundish ? -14 : -10,
      scale: isRoundish ? 1.008 : 1.004,
      transition: {
        duration: duration.fast,
        ease: ease.settle,
      },
    },
  };
}

export function getSectionRevealVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "edgy",
): Variants {
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0 },
    };
  }

  const { duration, ease, depth } = getMotionProfile(websiteMode);
  const isRoundish = isRoundishMode(websiteMode);

  return {
    hidden: {
      opacity: 0,
      y: depth.sectionOffset,
      scale: isRoundish ? 0.988 : 1,
    },
    show: (index = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: duration.slow,
        ease: ease.smooth,
        delay: index * (isRoundish ? 0.1 : 0.08),
      },
    }),
  };
}

export function getStaggerContainerVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "edgy",
): Variants {
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1 },
      show: { opacity: 1 },
    };
  }

  const isRoundish = isRoundishMode(websiteMode);

  return {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: isRoundish ? 0.075 : 0.055,
        delayChildren: isRoundish ? 0.05 : 0.03,
      },
    },
  };
}

export function getStaggerItemVariants(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "edgy",
): Variants {
  if (!motionEnabled) {
    return {
      hidden: { opacity: 1, y: 0, scale: 1 },
      show: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease } = getMotionProfile(websiteMode);
  const isRoundish = isRoundishMode(websiteMode);

  return {
    hidden: {
      opacity: 0,
      y: isRoundish ? 24 : 18,
      scale: isRoundish ? 0.972 : 0.985,
      rotateX: isRoundish ? 1.5 : 0,
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
  websiteMode: WebsiteMode = "edgy",
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
  websiteMode: WebsiteMode = "edgy",
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
  websiteMode: WebsiteMode = "edgy",
): Variants {
  if (!motionEnabled) {
    return {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
    };
  }

  const { duration, ease } = getMotionProfile(websiteMode);
  const isRoundish = isRoundishMode(websiteMode);

  return {
    initial: {
      opacity: 0,
      y: isRoundish ? 8 : 6,
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
      y: isRoundish ? -4 : -3,
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
  websiteMode: WebsiteMode = "edgy",
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
  websiteMode: WebsiteMode = "edgy",
) {
  if (!motionEnabled) return undefined;
  if (isRoundishMode(websiteMode)) {
    return { scale: 1.085, y: -2.8, rotate: -1.2 };
  }
  return { scale: 1.05, y: -1.5 };
}

export function getControlTap(
  motionEnabled: boolean,
  websiteMode: WebsiteMode = "edgy",
) {
  if (!motionEnabled) return undefined;
  if (isRoundishMode(websiteMode)) {
    return { scale: 0.94, y: 1.6, rotate: 0.8 };
  }
  return { scale: 0.96, y: 1 };
}
