import { Home, Library, Search } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerSelectionHaptic } from "@/lib/haptics";
import { motion } from "framer-motion";
import { APP_HOME_PATH } from "@/lib/routes";

export function MobileNav() {
  const { t } = useLanguage();
  const navItems = [
    { title: t("nav.home"), url: APP_HOME_PATH, icon: Home },
    { title: t("nav.search"), url: "/search", icon: Search },
    { title: t("nav.library"), url: "/library", icon: Library },
  ];

  return (
    <nav className="mobile-bottom-nav md:hidden fixed inset-x-0 bottom-0 z-40 px-2">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mobile-bottom-nav-shell mx-auto w-full max-w-[42rem]"
      >
        <div className="flex items-center justify-around w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === APP_HOME_PATH}
              className="mobile-bottom-nav-link flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-white/50 transition-colors"
              activeClassName="is-active text-white"
              onClick={() => {
                triggerSelectionHaptic();
              }}
            >
              <span className="mobile-bottom-nav-link-indicator" aria-hidden="true" />
              <div className="flex h-8 w-8 items-center justify-center">
                <item.icon className="h-6 w-6" />
              </div>
              <span className="mobile-bottom-nav-link-label text-[10px] font-semibold tracking-wide">
                {item.title}
              </span>
            </NavLink>
          ))}
        </div>
      </motion.div>
    </nav>
  );
}
