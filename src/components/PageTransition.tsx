import { motion } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  getMotionProfile,
  getPageTransitionVariants,
} from "@/lib/motion";

interface PageTransitionProps extends React.PropsWithChildren {
  immediate?: boolean;
}

export function PageTransition({ children, immediate = false }: PageTransitionProps) {
  const { motionEnabled, allowShellAmbientMotion, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);
  const pageVariants = getPageTransitionVariants(motionEnabled, websiteMode);
  const washOpacity = allowShellAmbientMotion ? 0.82 : 0.62;

  if (immediate || !motionEnabled) {
    return (
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="premium-page-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem]"
          style={{ opacity: washOpacity }}
        />
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <motion.div
      className="relative isolate"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        aria-hidden="true"
        className="premium-page-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem]"
        initial={{ opacity: 0, y: motionProfile.depth.pageOffset * 0.2 }}
        animate={{ opacity: washOpacity, y: 0 }}
        exit={{ opacity: 0, y: -motionProfile.depth.pageOffset * 0.12 }}
        transition={{
          duration: motionProfile.duration.base,
          ease: motionProfile.ease.smooth,
        }}
      />
      <motion.div
        className="relative"
        initial={{ opacity: 0.96, y: motionProfile.depth.pageOffset * 0.35 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.92, y: -motionProfile.depth.pageOffset * 0.18 }}
        transition={{
          duration: motionProfile.duration.base,
          ease: motionProfile.ease.smooth,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
