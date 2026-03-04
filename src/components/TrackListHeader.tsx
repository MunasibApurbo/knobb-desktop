import { Clock } from "lucide-react";

interface TrackListHeaderProps {
  showAlbum?: boolean;
}

export function TrackListHeader({ showAlbum = false }: TrackListHeaderProps) {
  const cols = showAlbum
    ? "grid-cols-[32px_1fr_40px_60px] md:grid-cols-[40px_1fr_1fr_1fr_40px_60px]"
    : "grid-cols-[32px_1fr_40px_60px] md:grid-cols-[40px_1fr_1fr_40px_60px]";

  return (
    <div className={`grid ${cols} gap-2 md:gap-4 px-2 md:px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/30 uppercase tracking-widest mb-1`}>
      <span className="text-center">#</span>
      <span>Title</span>
      <span className="hidden md:inline">Artist</span>
      {showAlbum && <span className="hidden md:inline">Album</span>}
      <span></span>
      <span className="text-right"><Clock className="w-4 h-4 inline" /></span>
    </div>
  );
}
