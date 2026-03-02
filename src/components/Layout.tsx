import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();
  const location = useLocation();

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      {/* Dynamic blurred background */}
      <div className="fixed inset-0 -z-10">
        <AnimatePresence mode="wait">
          {currentTrack && (
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0"
            >
              <img
                src={currentTrack.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-[80px] opacity-40"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 30% 20%, hsl(${currentTrack.canvasColor} / 0.15), transparent 60%), 
                               radial-gradient(ellipse at 70% 80%, hsl(${currentTrack.canvasColor} / 0.1), transparent 60%)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-background/70" />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <ScrollArea className="flex-1">
            <AnimatePresence mode="wait">
              <motion.main
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="px-4 pb-4"
              >
                {children}
              </motion.main>
            </AnimatePresence>
          </ScrollArea>
        </div>
        <RightPanel />
      </div>

      {/* Bottom Player */}
      <BottomPlayer />
    </div>
  );
}
