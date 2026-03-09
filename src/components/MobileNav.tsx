import { Compass, Home, Library, Search } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

export function MobileNav() {
  const { t } = useLanguage();
  const navItems = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.search"), url: "/search", icon: Search },
    { title: t("nav.browse"), url: "/browse", icon: Compass },
    { title: t("nav.library"), url: "/liked", icon: Library },
  ];

  return (
    <nav className="mobile-bottom-nav md:hidden fixed left-0 right-0 z-40 px-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mobile-bottom-nav-shell mx-auto max-w-[40rem] p-1.5"
      >
        <div className="grid grid-cols-4 gap-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="mobile-bottom-nav-link flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2.5 text-white/48 transition-colors"
            activeClassName="bg-white/[0.06] text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center">
              <item.icon className="h-5 w-5" />
            </div>
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em]">{item.title}</span>
          </NavLink>
        ))}
        </div>
      </motion.div>
    </nav>
  );
}
