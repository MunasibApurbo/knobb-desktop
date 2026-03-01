import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomPlayer } from "@/components/BottomPlayer";
import { RightPanel } from "@/components/RightPanel";
import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      {/* Dynamic blurred background */}
      <div className="fixed inset-0 -z-10">
        {currentTrack && (
          <>
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-[80px] opacity-40 transition-all duration-1000"
            />
            <div
              className="absolute inset-0 transition-all duration-1000"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, hsl(${currentTrack.canvasColor} / 0.15), transparent 60%), 
                             radial-gradient(ellipse at 70% 80%, hsl(${currentTrack.canvasColor} / 0.1), transparent 60%)`,
              }}
            />
          </>
        )}
        <div className="absolute inset-0 bg-background/70" />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <ScrollArea className="flex-1">
            <main className="px-4 pb-4">{children}</main>
          </ScrollArea>
        </div>
        <RightPanel />
      </div>

      {/* Bottom Player */}
      <BottomPlayer />
    </div>
  );
}
