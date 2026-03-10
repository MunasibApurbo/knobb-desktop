import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";

import { LibraryCollection } from "@/components/library/LibraryCollection";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_HOME_PATH } from "@/lib/routes";

export default function LibraryPage() {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mobile-page-shell hover-desaturate-page"
    >
      <section className="mobile-page-panel flex min-h-[calc(100dvh-var(--mobile-player-offset)-1.5rem)] flex-col overflow-hidden border border-white/10 bg-white/[0.02]">
        <LibraryCollection
          mode="mobile"
          showSettingsAction
          className="flex min-h-0 flex-1 flex-col"
        />
      </section>
    </motion.div>
  );
}
