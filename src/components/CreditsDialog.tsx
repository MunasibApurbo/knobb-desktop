import { Track } from "@/types/music";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ArtistLink } from "@/components/ArtistLink";
import { AlbumLink } from "@/components/AlbumLink";
import { Disc3, User, Music } from "lucide-react";
import { formatAudioQualityLabel } from "@/lib/audioQuality";

interface CreditsDialogProps {
    track: Track;
    isOpen: boolean;
    onClose: () => void;
}

export function CreditsDialog({ track, isOpen, onClose }: CreditsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Track Credits</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex items-center gap-4">
                        <img src={track.coverUrl} alt="" className="w-16 h-16  object-cover shadow-lg" />
                        <div>
                            <h4 className="font-bold text-foreground">{track.title}</h4>
                            <ArtistLink name={track.artist} artistId={track.artistId} className="text-sm text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <User className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Main Artist</p>
                                <ArtistLink name={track.artist} artistId={track.artistId} className="text-sm !text-foreground" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Disc3 className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Album</p>
                                <AlbumLink title={track.album} albumId={track.albumId} artistName={track.artist} className="text-sm !text-foreground" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Music className="w-4 h-4 mt-1 text-muted-foreground" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Playback Quality</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span
                                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-[2px] leading-none tracking-tighter border ${track.audioQuality === "MAX" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}`}
                                        style={track.audioQuality === "MAX"
                                            ? undefined
                                            : {
                                                color: "hsl(var(--player-waveform))",
                                                borderColor: "hsl(var(--player-waveform) / 0.2)",
                                                backgroundColor: "hsl(var(--player-waveform) / 0.1)",
                                            }}
                                    >
                                        {formatAudioQualityLabel(track.audioQuality)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
