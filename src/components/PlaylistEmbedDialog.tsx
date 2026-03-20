import { Check, Copy, ExternalLink, Lock, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildPlaylistEmbedCode } from "@/lib/playlistSharing";

type EmbedSize = "compact" | "normal";

const DIALOG_CONTENT_CLASS =
  "w-[min(1180px,calc(100vw-32px))] max-w-[1180px] gap-0 overflow-hidden border border-white/10 bg-black/95 p-0 text-white shadow-[0_28px_100px_rgba(0,0,0,0.82)] backdrop-blur-2xl sm:max-h-[90vh] sm:overflow-hidden";

const EMBED_SIZES: Record<EmbedSize, { label: string; height: number; previewClassName: string }> = {
  compact: {
    label: "Compact",
    height: 352,
    previewClassName: "h-[352px]",
  },
  normal: {
    label: "Normal",
    height: 480,
    previewClassName: "h-[480px]",
  },
};

interface PlaylistEmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  embedUrl: string | null;
  canEmbed: boolean;
  disabledReason?: string | null;
}

export function PlaylistEmbedDialog({
  open,
  onOpenChange,
  title,
  embedUrl,
  canEmbed,
  disabledReason,
}: PlaylistEmbedDialogProps) {
  const [size, setSize] = useState<EmbedSize>("compact");
  const [showCode, setShowCode] = useState(false);
  const previewUrl = useMemo(() => {
    if (!embedUrl || typeof window === "undefined") return embedUrl;

    const nextUrl = new URL(embedUrl);
    return new URL(`${nextUrl.pathname}${nextUrl.search}`, window.location.origin).toString();
  }, [embedUrl]);
  const embedCode = useMemo(() => {
    if (!embedUrl) return "";
    return buildPlaylistEmbedCode(embedUrl, {
      title: `${title} - Knobb`,
      height: EMBED_SIZES[size].height,
    });
  }, [embedUrl, size, title]);

  const handleCopyCode = async () => {
    if (!embedCode || !canEmbed) return;
    await navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied");
  };

  const handleOpenSource = () => {
    if (!embedUrl) return;
    const url = new URL(embedUrl);
    url.searchParams.delete("embed");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLASS}>
        <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-4xl font-black tracking-tight text-white">Embed playlist</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-white/58">
                Copy a clean Knobb playlist player for another site without exposing the full app shell.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-7">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Playlist</p>
                <p className="mt-2 text-xl font-semibold text-white">{title}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Size</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(Object.entries(EMBED_SIZES) as Array<[EmbedSize, (typeof EMBED_SIZES)[EmbedSize]]>).map(
                    ([value, option]) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          "rounded-[var(--surface-radius-lg)] border px-4 py-3 text-left transition-colors",
                          size === value
                            ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform)/0.16)] text-white"
                            : "border-white/10 bg-black text-white/68 hover:bg-white/[0.06]",
                        )}
                        onClick={() => setSize(value)}
                      >
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 block text-xs text-white/45">{option.height}px tall</span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              {canEmbed ? null : (
                <div className="rounded-[var(--surface-radius-lg)] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{disabledReason || "Embedding is unavailable for this playlist."}</p>
                  </div>
                </div>
              )}

              <div className="rounded-[var(--surface-radius-lg)] border border-white/10 bg-black p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-3 text-sm text-white/70">
                    <button
                      type="button"
                      aria-pressed={showCode}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-[var(--surface-radius-sm)] border transition-colors",
                        showCode
                          ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black"
                          : "border-white/20 bg-transparent text-transparent",
                      )}
                      onClick={() => setShowCode((current) => !current)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    Show code
                  </label>
                  <Button
                    variant="secondary"
                    className="rounded-[var(--surface-radius-lg)] border border-white/10 bg-[hsl(var(--player-waveform))] px-5 text-black hover:bg-[hsl(var(--player-waveform))] hover:brightness-105"
                    onClick={() => void handleCopyCode()}
                    disabled={!canEmbed || !embedCode}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                {showCode ? (
                  <pre className="mt-3 overflow-x-auto rounded-[var(--surface-radius-lg)] border border-white/10 bg-black p-4 text-xs leading-6 text-white/72">
                    <code>{embedCode || "Embed unavailable."}</code>
                  </pre>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/48">
                    Copy the iframe code directly, or toggle the code view if you need to inspect the markup first.
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                className="w-full justify-between rounded-[var(--surface-radius-lg)] border border-white/10 bg-black px-4 py-6 text-white hover:bg-white/[0.07]"
                onClick={handleOpenSource}
                disabled={!embedUrl}
              >
                Open source playlist
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-[#0b0b0b] p-4 lg:p-8">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <Radio className="h-3.5 w-3.5" />
              Live preview
            </div>
            <div className="rounded-[var(--surface-radius-lg)] border border-white/10 bg-black p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className={cn("overflow-hidden rounded-[var(--surface-radius-md)] border border-white/10 bg-black", EMBED_SIZES[size].previewClassName)}>
                {previewUrl ? (
                  <iframe
                    key={`${previewUrl}-${size}`}
                    src={previewUrl}
                    title={`${title} embed preview`}
                    className="h-full w-full bg-black"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/45">
                    Embed preview unavailable.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
