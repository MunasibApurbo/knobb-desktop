import { Track } from "@/types/music";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Disc3, User, Calendar, Music2, ShieldCheck } from "lucide-react";

interface CreditsDialogProps {
    track: Track;
    isOpen: boolean;
    onClose: () => void;
}

export function CreditsDialog({ track, isOpen, onClose }: CreditsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-background/95 backdrop-blur-xl border-border/30 max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Track Credits</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex items-center gap-4">
                        <img src={track.coverUrl} alt="" className="w-16 h-16  object-cover shadow-lg" />
                        <div>
                            <h4 className="font-bold text-foreground">{track.title}</h4>
                            <p className="text-sm text-muted-foreground">{track.artist}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <User className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Main Artist</p>
                                <p className="text-sm text-foreground">{track.artist}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Disc3 className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Album</p>
                                <p className="text-sm text-foreground">{track.album}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Calendar className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Release Year</p>
                                <p className="text-sm text-foreground">{track.year}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Music2 className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Audio Quality</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-[2px] leading-none tracking-tighter ${track.audioQuality === "MAX" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                                        }`}>
                                        {track.audioQuality || "HIGH"}
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                        {track.audioQuality === "MAX" ? "24-bit, 192 kHz (FLAC)" : track.audioQuality === "LOSSLESS" ? "16-bit, 44.1 kHz (FLAC)" : "320 kbps (AAC)"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Source</p>
                                <p className="text-sm text-foreground">Verified Streaming Master</p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
