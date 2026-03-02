import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack, showRightPanel } = usePlayer();
  const location = useLocation();
  useKeyboardShortcuts();

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-background">
      {/* Dynamic blurred background */}
      <div className="fixed inset-0 -z-10">
        <AnimatePresence mode="wait">
          {currentTrack && (
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0"
            >
              <img
                src={currentTrack.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-[120px] opacity-30"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 20% 20%, hsl(${currentTrack.canvasColor} / 0.2), transparent 50%),
                               radial-gradient(ellipse at 80% 80%, hsl(${currentTrack.canvasColor} / 0.1), transparent 50%)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-background/75" />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 pr-2 pt-2">
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 bg-card/40 rounded-t-lg flex flex-col min-w-0 overflow-hidden">
              <TopBar />
              <ScrollArea className="flex-1">
                <motion.main
                  key={location.pathname}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="px-6 pb-8"
                >
                  {children}
                </motion.main>
              </ScrollArea>
            </div>
            <RightPanel />
          </div>
        </div>
      </div>

      <BottomPlayer />
    </div>
  );
}
