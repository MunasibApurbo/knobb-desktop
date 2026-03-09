import { Check, CircleHelp, Copy, ExternalLink, Lock } from "lucide-react";
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
import { buildTrackEmbedCode } from "@/lib/trackSharing";
import type { Track } from "@/types/music";

type EmbedSize = "compact" | "normal";
type EmbedTheme = "ocean" | "graphite";

const EMBED_SIZES: Record<EmbedSize, { label: string; height: number }> = {
  compact: {
    label: "Normal (352px)",
    height: 352,
  },
  normal: {
    label: "Tall (420px)",
    height: 420,
  },
};

const DIALOG_CONTENT_CLASS =
  "w-[min(1360px,calc(100vw-32px))] max-w-[1360px] gap-0 overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,_hsl(var(--player-waveform)/0.14),transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015)),rgba(0,0,0,0.98)] p-0 text-white shadow-[0_28px_100px_rgba(0,0,0,0.82)] backdrop-blur-2xl sm:max-h-[92vh] sm:overflow-auto";
const CONTROL_SURFACE_CLASS =
  "website-form-control h-[62px] rounded-[var(--surface-radius-lg)] border border-white/10 bg-black px-7 text-[19px] text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

interface TrackEmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: Pick<Track, "artist" | "canvasColor" | "coverUrl" | "title">;
  embedUrl: string | null;
  sourceUrl: string | null;
  canEmbed: boolean;
  disabledReason?: string | null;
}

export function TrackEmbedDialog({
  open,
  onOpenChange,
  track,
  embedUrl,
  sourceUrl,
  canEmbed,
  disabledReason,
}: TrackEmbedDialogProps) {
  const [size, setSize] = useState<EmbedSize>("compact");
  const [theme, setTheme] = useState<EmbedTheme>("ocean");
  const [showCode, setShowCode] = useState(false);

  const embedUrlWithTheme = useMemo(() => {
    if (!embedUrl) return "";
    const nextUrl = new URL(embedUrl);
    nextUrl.searchParams.set("theme", theme);
    return nextUrl.toString();
  }, [embedUrl, theme]);

  const previewUrl = useMemo(() => {
    if (!embedUrlWithTheme || typeof window === "undefined") return embedUrlWithTheme;

    const nextUrl = new URL(embedUrlWithTheme);
    return new URL(`${nextUrl.pathname}${nextUrl.search}`, window.location.origin).toString();
  }, [embedUrlWithTheme]);

  const embedCode = useMemo(() => {
    if (!embedUrlWithTheme) return "";
    return buildTrackEmbedCode(embedUrlWithTheme, {
      title: `${track.title} - ${track.artist} - Knobb`,
      height: EMBED_SIZES[size].height,
    });
  }, [embedUrlWithTheme, size, track.artist, track.title]);

  const handleCopyCode = async () => {
    if (!embedCode || !canEmbed) return;
    await navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied");
  };

  const handleOpenSource = () => {
    if (!sourceUrl) return;
    window.open(sourceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CONTENT_CLASS}>
        <DialogHeader className="sr-only">
          <DialogTitle>Embed track</DialogTitle>
          <DialogDescription>Copy a Knobb track embed.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-8 pt-10 sm:px-10">
          <div className="flex flex-col gap-8">
            <h2 className="text-5xl font-black tracking-tight text-white">Embed track</h2>

            <div className="flex flex-col gap-5 text-white lg:flex-row lg:flex-wrap lg:items-center lg:gap-8">
              <div className="flex items-center gap-4">
                <span className="text-[19px] text-white/90">Color</span>
                <div className="flex items-center gap-4">
                  {(["ocean", "graphite"] as EmbedTheme[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Use ${value} theme`}
                        className={cn(
                          "h-14 w-14 rounded-[var(--surface-radius-sm)] border-2 transition-transform hover:scale-[1.03]",
                          theme === value ? "border-white" : "border-white/10",
                          value === "graphite" ? "bg-black" : undefined,
                        )}
                        style={value === "ocean" ? { backgroundColor: `hsl(${track.canvasColor})` } : undefined}
                        onClick={() => setTheme(value)}
                      />
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:ml-auto">
                <span className="text-[19px] text-white/90">Size:</span>
                <div className="relative">
                  <select
                    value={size}
                    onChange={(event) => setSize(event.target.value as EmbedSize)}
                    className={cn(CONTROL_SURFACE_CLASS, "min-w-[280px] appearance-none pr-14 lg:min-w-[350px]")}
                  >
                    {(Object.entries(EMBED_SIZES) as Array<[EmbedSize, (typeof EMBED_SIZES)[EmbedSize]]>).map(
                      ([value, option]) => (
                        <option key={value} value={value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-white/60">
                    ˅
                  </span>
                </div>
                <span className="hidden text-[26px] text-white/55 sm:block">×</span>
                <div className={cn(CONTROL_SURFACE_CLASS, "flex min-w-[220px] items-center justify-between lg:min-w-[280px]")}>
                  <span>100%</span>
                  <CircleHelp className="h-6 w-6 text-white/70" />
                </div>
              </div>
            </div>

            {canEmbed ? null : (
              <div className="rounded-[var(--surface-radius-lg)] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{disabledReason || "Embedding is unavailable for this track."}</p>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-[var(--surface-radius-lg)] border border-white/10 bg-black p-3 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
              <div
                className={cn(
                  "overflow-hidden rounded-[var(--surface-radius-md)] border border-white/10 bg-black",
                  size === "compact" ? "h-[352px]" : "h-[420px]",
                )}
              >
                {previewUrl ? (
                  <iframe
                    key={`${previewUrl}-${size}-${theme}`}
                    src={previewUrl}
                    title={`${track.title} embed preview`}
                    className="h-full w-full border-0 bg-transparent"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,hsl(var(--player-waveform)/0.4),rgba(0,0,0,0.9))] px-8 text-center text-sm text-white/72">
                    Embed preview unavailable.
                  </div>
                )}
              </div>
            </div>

            {showCode ? (
              <pre className="overflow-x-auto rounded-[var(--surface-radius-lg)] border border-white/10 bg-black p-5 text-xs leading-7 text-white/78">
                <code>{embedCode || "Embed unavailable."}</code>
              </pre>
            ) : null}

            <div className="flex flex-col gap-6 border-t border-white/8 pt-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl text-[15px] leading-8 text-white/56">
                By embedding a Knobb player on your site, you agree to Knobb&apos;s embed guidelines and playback rules.
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="flex items-center gap-3 text-[15px] text-white/78"
                  onClick={() => setShowCode((current) => !current)}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-[var(--surface-radius-sm)] border transition-colors",
                      showCode
                        ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black"
                        : "border-white/25 bg-transparent text-transparent",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  Show code
                </button>

                <Button
                  variant="secondary"
                  className="h-14 rounded-[var(--surface-radius-lg)] border-0 bg-[hsl(var(--player-waveform))] px-8 text-[18px] font-semibold text-black hover:bg-[hsl(var(--player-waveform))] hover:brightness-105"
                  onClick={() => void handleCopyCode()}
                  disabled={!canEmbed || !embedCode}
                >
                  <Copy className="h-5 w-5" />
                  Copy
                </Button>

                <Button
                  variant="ghost"
                  className="h-14 rounded-[var(--surface-radius-lg)] border border-white/10 bg-black px-6 text-[16px] text-white hover:bg-white/10"
                  onClick={handleOpenSource}
                  disabled={!sourceUrl}
                >
                  Open
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
