import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { MiniPlayer } from "@/components/MiniPlayer";
import { MobileNav } from "@/components/MobileNav";
// SearchOverlay removed - search results now inline in sidebar
import { usePlayer } from "@/contexts/PlayerContext";
// useSearch no longer needed in layout
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });
export function useSidebarCollapsed() { return useContext(SidebarContext); }

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack, showRightPanel } = usePlayer();
  // search state no longer needed in layout
  const location = useLocation();
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  usePlayHistoryRecorder();
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
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
      <div className="flex-1 min-h-0 relative z-10">
        {!isMobile ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Sidebar */}
            <ResizablePanel
              defaultSize={18}
              minSize={4}
              maxSize={30}
              collapsible
              collapsedSize={4}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
              className="py-2 pl-2"
            >
              <AppSidebar />
            </ResizablePanel>
            <ResizableHandle className="w-1 bg-transparent hover:bg-white/10 transition-colors" />

            {/* Center Content */}
            <ResizablePanel defaultSize={showRightPanel ? 64 : 82} minSize={40} className="pt-2 pr-2">
              <div className="flex flex-col h-full min-h-0">
                <TopBar />
                <ScrollArea className="flex-1" ref={scrollRef}>
                  <main className="px-4 md:px-6 pb-8">
                    {children}
                  </main>
                </ScrollArea>
              </div>
            </ResizablePanel>

            {/* Right Panel */}
            {showRightPanel && (
              <>
                <ResizableHandle className="w-1 bg-transparent hover:bg-white/10 transition-colors" />
                <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="py-2 pr-2">
                  <RightPanel />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <TopBar />
            <ScrollArea className="flex-1" ref={scrollRef}>
              <main className="px-4 pb-8">
                {children}
              </main>
            </ScrollArea>
          </div>
        )}
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
    </SidebarContext.Provider>
  );
}
