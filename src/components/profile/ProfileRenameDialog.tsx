import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ProfileRenameDialogProps = {
  open: boolean;
  saving: boolean;
  value: string;
  currentValue: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onSave: () => void;
};

export function ProfileRenameDialog({
  open,
  saving,
  value,
  currentValue,
  onOpenChange,
  onValueChange,
  onSave,
}: ProfileRenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile Name</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Display name"
            className="w-full focus-visible:ring-[hsl(var(--player-waveform))]"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim() && value.trim() !== currentValue) {
                onSave();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || value.trim().length === 0 || value.trim() === currentValue}
            style={{ backgroundColor: "hsl(var(--player-waveform))", color: "white" }}
            className="hover:opacity-90"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
