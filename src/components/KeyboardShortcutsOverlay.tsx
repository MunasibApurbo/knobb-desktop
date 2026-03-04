import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["Space"], action: "Play / Pause" },
  { keys: ["Shift", "→"], action: "Next track" },
  { keys: ["Shift", "←"], action: "Previous track" },
  { keys: ["Shift", "↑"], action: "Volume up" },
  { keys: ["Shift", "↓"], action: "Volume down" },
  { keys: ["M"], action: "Mute / Unmute" },
  { keys: ["Esc"], action: "Close full-screen player" },
  { keys: ["?"], action: "Show shortcuts" },
];

export function KeyboardShortcutsOverlay() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <Keyboard className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{action}</span>
              <div className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-1 text-xs font-mono bg-accent text-foreground border border-border/30 min-w-[28px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
