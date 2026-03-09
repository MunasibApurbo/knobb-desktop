import { motion } from "framer-motion";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  getMotionProfile,
  getPageTransitionVariants,
} from "@/lib/motion";

export function PageTransition({ children }: React.PropsWithChildren) {
  const { motionEnabled, allowShellAmbientMotion, websiteMode } = useMotionPreferences();
  const pageVariants = getPageTransitionVariants(motionEnabled, websiteMode);
  const motionProfile = getMotionProfile(websiteMode);
  const washOpacity = allowShellAmbientMotion ? 0.82 : 0.62;

  if (!motionEnabled) {
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
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      <motion.div
        aria-hidden="true"
        className="premium-page-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem]"
        initial={{ opacity: 0 }}
        animate={{ opacity: washOpacity }}
        exit={{ opacity: 0 }}
        transition={{
          duration: motionProfile.duration.base,
          ease: motionProfile.ease.smooth,
        }}
      />
      <motion.div
        className="relative"
        initial={{ opacity: 0.96 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.96 }}
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
