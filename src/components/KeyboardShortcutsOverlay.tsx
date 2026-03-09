import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["Space", "K"], action: "Play / Pause" },
  { keys: ["J"], action: "Rewind 10s" },
  { keys: ["L"], action: "Forward 10s" },
  { keys: ["←"], action: "Rewind 5s" },
  { keys: ["→"], action: "Forward 5s" },
  { keys: ["↑"], action: "Volume up" },
  { keys: ["↓"], action: "Volume down" },
  { keys: ["M"], action: "Mute / Unmute" },
  { keys: ["Ctrl/⌘", "→"], action: "Next track" },
  { keys: ["Ctrl/⌘", "←"], action: "Previous track" },
  { keys: ["0–9"], action: "Jump to %" },
  { keys: ["Ctrl/⌘", "A"], action: "Select all tracks" },
  { keys: ["Delete"], action: "Remove selected tracks" },
  { keys: ["Esc"], action: "Clear track selection" },
];

export function KeyboardShortcutsOverlay() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <Keyboard className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
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
