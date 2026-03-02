import { ChevronLeft, ChevronRight, Search, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="h-14 flex items-center justify-between px-4 shrink-0">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 bg-secondary/50 hover:bg-secondary transition-colors"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 bg-secondary/50 hover:bg-secondary transition-colors"
          onClick={() => navigate(1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 glass px-4 py-1.5 cursor-pointer hover:bg-accent/50 transition-all duration-200 max-w-xs hover:border-foreground/20"
        onClick={() => navigate("/search")}
      >
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Search songs, artists...</span>
      </div>

      {/* User */}
      <Button variant="ghost" size="icon" className="w-8 h-8 bg-secondary/50 hover:bg-secondary transition-colors">
        <User className="w-4 h-4" />
      </Button>
    </header>
  );
}
