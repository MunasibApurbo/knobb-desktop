import { Home, Search, Library, Compass } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { usePlayer } from "@/contexts/PlayerContext";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Browse", url: "/genre", icon: Compass },
  { title: "Library", url: "/liked", icon: Library },
];

export function MobileNav() {
  const { currentTrack } = usePlayer();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/20"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Now playing mini strip */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/10 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-2">
              <img src={currentTrack.coverUrl} alt="" className="w-8 h-8 object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{currentTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
              <div className="playing-bars flex items-end gap-[2px]">
                <span /><span /><span />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors min-w-0"
            activeClassName="text-foreground"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-semibold">{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
