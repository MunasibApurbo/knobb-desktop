import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { MiniPlayer } from "@/components/MiniPlayer";
import { MobileNav } from "@/components/MobileNav";
import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useCallback, useEffect, useRef } from "react";

// Stub for backwards compatibility — sidebars removed
export function useSidebarCollapsed() {
  return { collapsed: false, setCollapsed: () => {}, expandPanel: () => {} };
}

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  usePlayHistoryRecorder();
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(() => localStorage.getItem("mini-player-enabled") !== "false");
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (miniPlayerEnabled) setMiniPlayerVisible(true);
  }, [miniPlayerEnabled]);

  const toggleMiniPlayerEnabled = useCallback(() => {
    setMiniPlayerEnabled(prev => {
      const next = !prev;
      localStorage.setItem("mini-player-enabled", String(next));
      if (!next) setMiniPlayerVisible(false);
      return next;
    });
  }, []);

  const closeMiniPlayer = useCallback(() => {
    setMiniPlayerVisible(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      {/* Dynamic blurred background from current track artwork */}
      <div className="fixed inset-0 z-0 bg-background">
        {currentTrack && (
          <div className="absolute inset-0">
            <img
              key={currentTrack.id}
              src={currentTrack.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-150 blur-[80px] opacity-50 transition-opacity duration-[1500ms]"
            />
            <div
              className="absolute inset-0 transition-all duration-[1500ms]"
              style={{
                background: `radial-gradient(ellipse at 20% 20%, hsl(${currentTrack.canvasColor} / 0.3), transparent 50%),
                             radial-gradient(ellipse at 80% 80%, hsl(${currentTrack.canvasColor} / 0.15), transparent 50%)`,
              }}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative z-10">
        <div className="flex flex-col h-full min-h-0">
          <TopBar />
          <ScrollArea className="flex-1" ref={scrollRef}>
            <main className="px-4 md:px-6 pb-8">
              {children}
            </main>
          </ScrollArea>
        </div>
      </div>

      {/* Bottom Player - hidden on mobile */}
      {!isMobile && <BottomPlayer onOpenFullScreen={openFullScreen} miniPlayerEnabled={miniPlayerEnabled} onToggleMiniPlayer={toggleMiniPlayerEnabled} />}

      {/* Mobile bottom nav */}
      {isMobile && <MobileNav />}

      {/* Full-screen cinematic player */}
      <FullScreenPlayer open={fullScreenOpen} onClose={closeFullScreen} />

      {/* Mini player (PiP) - desktop only */}
      {!isMobile && <MiniPlayer visible={miniPlayerVisible} onExpand={openFullScreen} onClose={closeMiniPlayer} />}
    </div>
  );
}
