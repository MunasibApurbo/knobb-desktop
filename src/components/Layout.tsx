import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { MiniPlayer } from "@/components/MiniPlayer";
import { MobileNav } from "@/components/MobileNav";
import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useCallback, useEffect, useRef } from "react";

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack, showRightPanel } = usePlayer();
  const location = useLocation();
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  usePlayHistoryRecorder();
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = 0;
  }, [location.pathname]);

  const openFullScreen = useCallback(() => {
    setMiniPlayerVisible(false);
    setFullScreenOpen(true);
  }, []);

  const closeFullScreen = useCallback(() => {
    setFullScreenOpen(false);
    setMiniPlayerVisible(true);
  }, []);

  const closeMiniPlayer = useCallback(() => {
    setMiniPlayerVisible(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      {/* Dynamic blurred background from current track artwork */}
      <div className="fixed inset-0 z-0 bg-background">
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
                className="absolute inset-0 w-full h-full object-cover scale-150 blur-[80px] opacity-50"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 20% 20%, hsl(${currentTrack.canvasColor} / 0.3), transparent 50%),
                               radial-gradient(ellipse at 80% 80%, hsl(${currentTrack.canvasColor} / 0.15), transparent 50%)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Sidebar - hidden on mobile */}
        {!isMobile && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0 md:pr-2 md:pt-2">
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <TopBar />
              <ScrollArea className="flex-1" ref={scrollRef}>
                <main className="px-4 md:px-6 pb-8">
                  {children}
                </main>
              </ScrollArea>
            </div>
            {!isMobile && <RightPanel />}
          </div>
        </div>
      </div>

      {/* Bottom Player - hidden on mobile */}
      {!isMobile && <BottomPlayer onOpenFullScreen={openFullScreen} />}

      {/* Mobile bottom nav */}
      {isMobile && <MobileNav />}

      {/* Full-screen cinematic player */}
      <FullScreenPlayer open={fullScreenOpen} onClose={closeFullScreen} />

      {/* Mini player (PiP) - desktop only */}
      {!isMobile && <MiniPlayer visible={miniPlayerVisible} onExpand={openFullScreen} onClose={closeMiniPlayer} />}
    </div>
  );
}
