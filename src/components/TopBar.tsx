import { ChevronLeft, ChevronRight, User, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/PlayerContext";

export function TopBar() {
  const navigate = useNavigate();
  const { currentTrack } = usePlayer();

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 transition-colors duration-500"
      style={{
        background: currentTrack
          ? `linear-gradient(180deg, hsl(${currentTrack.canvasColor} / 0.35) 0%, transparent 100%)`
          : "transparent",
      }}
    >
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
          onClick={() => navigate(1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
        >
          <Bell className="w-4 h-4" />
        </Button>
        <button className="flex items-center gap-2 rounded-full bg-background/60 hover:bg-background/80 transition-colors p-1 pr-3">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
            <User className="w-4 h-4 text-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">Profile</span>
        </button>
      </div>
    </header>
  );
}
