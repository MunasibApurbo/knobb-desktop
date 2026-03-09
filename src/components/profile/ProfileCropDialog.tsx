import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ProfileCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  crop: { x: number; y: number };
  zoom: number;
  onOpenChange: (open: boolean) => void;
  onCropChange: (value: { x: number; y: number }) => void;
  onCropComplete: (_croppedArea: Area, nextCroppedAreaPixels: Area) => void;
  onZoomChange: (value: number) => void;
  onSave: () => void;
  onClose: () => void;
};

export function ProfileCropDialog({
  open,
  imageSrc,
  crop,
  zoom,
  onOpenChange,
  onCropChange,
  onCropComplete,
  onZoomChange,
  onSave,
  onClose,
}: ProfileCropDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col overflow-hidden bg-black p-0">
        <DialogHeader className="p-6 border-b border-white/10 z-10 bg-background/80 backdrop-blur-md">
          <DialogTitle>Crop Cover Image</DialogTitle>
        </DialogHeader>
        <div className="relative flex-1 bg-black w-full min-h-[300px]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={21 / 9}
              onCropChange={onCropChange}
              onCropComplete={onCropComplete}
              onZoomChange={onZoomChange}
              showGrid
              classes={{ containerClassName: "absolute inset-0" }}
            />
          )}
        </div>
        <DialogFooter className="p-6 border-t border-white/10 bg-background/80 backdrop-blur-md z-10 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex-1 flex items-center justify-start gap-3 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground mr-1">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(event) => {
                onZoomChange(Number(event.target.value));
              }}
              className="w-32 accent-white"
            />
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <Button variant="ghost" onClick={onClose} className="hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={onSave} className="bg-white text-black hover:bg-white/90">
              Set Cover Image
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
