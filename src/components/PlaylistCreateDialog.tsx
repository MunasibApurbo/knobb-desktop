import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PlaylistVisibility } from "@/hooks/playlists/types";
import type { CsvImportProvider, PlaylistImportFormat, PlaylistImportRequest } from "@/lib/playlistImport";
import { cn } from "@/lib/utils";

export type PlaylistCreateSubmitPayload = {
  coverUrl: string;
  description: string;
  importRequest?: PlaylistImportRequest;
  name: string;
  visibility: Extract<PlaylistVisibility, "private" | "public">;
};

type PlaylistCreateDialogProps = {
  allowImports?: boolean;
  disabled?: boolean;
  open: boolean;
  placeholder?: string;
  submitLabel?: string;
  title?: string;
  value: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PlaylistCreateSubmitPayload) => void | Promise<void>;
  onValueChange: (value: string) => void;
};

const IMPORT_TABS: PlaylistImportFormat[] = ["csv", "jspf", "xspf", "xml", "m3u"];
const DIALOG_CONTENT_CLASS =
  "playlist-create-dialog w-[min(34rem,calc(100vw-32px))] max-w-[34rem] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border border-white/10 p-0 text-white shadow-[0_28px_100px_rgba(0,0,0,0.78)] sm:max-h-[calc(100vh-4rem)]";
const DIALOG_SECTION_CLASS =
  "playlist-create-section overflow-hidden rounded-[var(--surface-radius-lg)] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const FIELD_CLASS =
  "website-form-control h-11 rounded-[var(--surface-radius-lg)] border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white placeholder:text-white/38 focus-visible:border-white/18 focus-visible:ring-0 focus-visible:ring-offset-0";
const TEXTAREA_CLASS =
  "website-form-control min-h-[7.5rem] w-full resize-y rounded-[var(--surface-radius-lg)] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/38 focus:border-white/18";
const SWEEP_BUTTON_CLASS =
  "menu-sweep-hover relative overflow-hidden rounded-[var(--surface-radius-lg)] border border-white/10 bg-transparent text-white/74 transition-colors hover:bg-transparent hover:text-black focus-visible:text-black focus-visible:ring-0 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50";
const SEGMENTED_GROUP_CLASS =
  "grid overflow-hidden rounded-[var(--surface-radius-md)] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";
const SEGMENTED_BUTTON_CLASS =
  "relative flex min-w-0 flex-1 items-center justify-center overflow-hidden text-sm font-semibold transition-colors";
const PREVIEW_TILE_CLASS =
  "flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--surface-radius-sm)] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read cover image"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

function getAcceptForFormat(format: PlaylistImportFormat) {
  switch (format) {
    case "csv":
      return ".csv,text/csv";
    case "jspf":
      return ".json,.jspf,application/json";
    case "xspf":
      return ".xspf,.xml,application/xml,text/xml";
    case "xml":
      return ".xml,application/xml,text/xml";
    case "m3u":
      return ".m3u,.m3u8,audio/x-mpegurl,audio/mpegurl";
    default:
      return "*/*";
  }
}

export function PlaylistCreateDialog({
  allowImports = false,
  disabled = false,
  open,
  placeholder = "Playlist name",
  submitLabel = "Save",
  title = "Create Playlist",
  value,
  onOpenChange,
  onSubmit,
  onValueChange,
}: PlaylistCreateDialogProps) {
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [coverDataUrl, setCoverDataUrl] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [activeTab, setActiveTab] = useState<PlaylistImportFormat>("csv");
  const [csvProvider, setCsvProvider] = useState<CsvImportProvider>("spotify");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [youtubeMusicUrl, setYoutubeMusicUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    setDescription("");
    setVisibility("private");
    setCoverDataUrl("");
    setCoverFileName("");
    setActiveTab("csv");
    setCsvProvider("spotify");
    setImportFile(null);
    setYoutubeMusicUrl("");
    setIsSubmitting(false);
  }, [open]);

  const isValid = useMemo(() => Boolean(value.trim()), [value]);

  const importHelpText =
    activeTab === "csv"
      ? csvProvider === "spotify"
        ? "Upload a Spotify CSV export, ideally from Exportify."
        : csvProvider === "appleMusic"
          ? "Upload an Apple Music CSV export. Matching may be less accurate."
          : "Paste a public YouTube Music playlist URL."
      : activeTab === "jspf"
        ? "Upload a JSPF playlist file."
        : activeTab === "xspf"
          ? "Upload an XSPF playlist file."
          : activeTab === "xml"
            ? "Upload a generic XML playlist export."
            : "Upload an M3U or M3U8 playlist file.";
  const providerOptions = [
    { id: "spotify", label: "Spotify" },
    { id: "appleMusic", label: "Apple Music" },
    { id: "youtubeMusic", label: "YouTube Music" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className={DIALOG_CONTENT_CLASS}>
        <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
          <div className="mb-1.5 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/42">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--player-waveform))" }} />
            Library
          </div>
          <DialogTitle className="text-[1.65rem] font-bold tracking-tight text-white">{title}</DialogTitle>
        </DialogHeader>

        <form
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isValid || disabled || isSubmitting) return;

            setIsSubmitting(true);
            try {
              let importRequest: PlaylistImportRequest | undefined;
              if (allowImports) {
                if (activeTab === "csv" && csvProvider === "youtubeMusic" && youtubeMusicUrl.trim()) {
                  importRequest = {
                    format: "csv",
                    provider: "youtubeMusic",
                    url: youtubeMusicUrl.trim(),
                  };
                } else if (importFile) {
                  if (activeTab === "csv") {
                    importRequest = {
                      file: importFile,
                      format: "csv",
                      provider: csvProvider as Exclude<CsvImportProvider, "youtubeMusic">,
                    };
                  } else {
                    importRequest = {
                      file: importFile,
                      format: activeTab,
                    };
                  }
                }
              }

              await onSubmit({
                coverUrl: coverDataUrl,
                description: description.trim(),
                importRequest,
                name: value.trim(),
                visibility,
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <Input
              placeholder={placeholder}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              autoFocus
              className={cn(FIELD_CLASS, "text-[0.95rem]")}
            />

            <div className={cn(DIALOG_SECTION_CLASS, "p-3")}>
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
                <div>
                  <p className="text-sm font-semibold text-white">Cover artwork</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-white/52">Optional.</p>
                </div>
                {coverFileName ? <span className="truncate text-xs font-medium text-white/58">{coverFileName}</span> : null}
              </div>
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await fileToDataUrl(file);
                  setCoverDataUrl(dataUrl);
                  setCoverFileName(file.name);
                }}
              />
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                {coverDataUrl ? (
                  <img
                    src={coverDataUrl}
                    alt="Playlist cover preview"
                    className="h-14 w-14 shrink-0 rounded-[var(--surface-radius-sm)] object-cover"
                  />
                ) : (
                  <div
                    className={PREVIEW_TILE_CLASS}
                    style={{ color: "hsl(var(--player-waveform))" }}
                  >
                    <Upload className="h-4 w-4" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    coverFileInputRef.current?.click();
                  }}
                  className={cn(
                    SWEEP_BUTTON_CLASS,
                    "flex h-14 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold",
                  )}
                >
                  <Upload className="h-4 w-4" style={{ color: "hsl(var(--player-waveform))" }} />
                  {coverFileName || "Upload cover"}
                </button>
              </div>
            </div>

            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={TEXTAREA_CLASS}
            />

            {allowImports ? (
              <section className={cn(DIALOG_SECTION_CLASS, "p-3")}>
                <div className="mb-3 border-b border-white/10 pb-2.5">
                  <div className="mb-2.5">
                    <p className="text-sm font-semibold text-white">Import source</p>
                    <p className="mt-0.5 text-[11px] text-white/52">Playlist transfer</p>
                  </div>
                  <div className={cn(SEGMENTED_GROUP_CLASS, "w-full grid-cols-5")}>
                    {IMPORT_TABS.map((tab, index) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab);
                          setImportFile(null);
                        }}
                        className={`${SEGMENTED_BUTTON_CLASS} h-10 text-[0.68rem] uppercase tracking-[0.16em] ${
                          activeTab === tab
                            ? "bg-[hsl(var(--player-waveform))] text-black"
                            : "menu-sweep-hover text-white/68 hover:text-black"
                        }`}
                        style={index === 0 ? undefined : { borderLeft: "1px solid hsl(0 0% 100% / 0.06)" }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[0.95rem] font-semibold tracking-tight text-white">
                      {`Import from ${activeTab.toUpperCase()}`}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-white/52">{importHelpText}</p>
                  </div>

                  {activeTab === "csv" ? (
                    <div className={cn(SEGMENTED_GROUP_CLASS, "md:grid-cols-3")}>
                      {providerOptions.map((provider, index) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => {
                            setCsvProvider(provider.id);
                            setImportFile(null);
                          }}
                          className={`${SEGMENTED_BUTTON_CLASS} h-11 px-3 ${
                            csvProvider === provider.id
                              ? "bg-[hsl(var(--player-waveform))] text-black"
                              : "menu-sweep-hover bg-transparent text-white/74 hover:text-black"
                          }`}
                          style={index === 0 ? undefined : { borderLeft: "1px solid hsl(0 0% 100% / 0.06)" }}
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {activeTab === "csv" && csvProvider === "youtubeMusic" ? (
                    <Input
                      type="url"
                      placeholder="https://music.youtube.com/playlist?list=..."
                      value={youtubeMusicUrl}
                      onChange={(event) => setYoutubeMusicUrl(event.target.value)}
                      className={FIELD_CLASS}
                    />
                  ) : (
                    <div className="space-y-2">
                      <input
                        ref={importFileInputRef}
                        type="file"
                        className="hidden"
                        accept={getAcceptForFormat(activeTab)}
                        onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        onClick={() => importFileInputRef.current?.click()}
                        className={cn(SWEEP_BUTTON_CLASS, "flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold")}
                      >
                        <Upload className="h-4 w-4" style={{ color: "hsl(var(--player-waveform))" }} />
                        {importFile?.name || `Upload ${activeTab.toUpperCase()} file`}
                      </button>
                    </div>
                  )}

                  <div className="rounded-[var(--surface-radius-sm)] border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-100/85">
                    <span className="font-semibold text-amber-100">Import note:</span> matches can be imperfect. Review the playlist after saving and remove anything unwanted.
                  </div>
                </div>
              </section>
            ) : null}

            <div className={cn(DIALOG_SECTION_CLASS, "flex items-center justify-between px-3.5 py-3")}>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold tracking-tight text-white">Public playlist</div>
                <p className="text-xs text-white/52">Visible to anyone with the link.</p>
              </div>
              <Switch
                checked={visibility === "public"}
                onCheckedChange={(checked) => setVisibility(checked ? "public" : "private")}
                className="h-7 w-12 rounded-[var(--settings-switch-radius)] border border-white/10 data-[state=unchecked]:bg-white/[0.06] data-[state=checked]:bg-[hsl(var(--player-waveform))]"
              />
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={cn(SWEEP_BUTTON_CLASS, "h-11 min-w-[7.5rem] px-5 text-sm font-semibold")}
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={disabled || !isValid || isSubmitting}
                className="h-11 min-w-[8.75rem] rounded-[var(--surface-radius-lg)] bg-[hsl(var(--player-waveform))] px-5 text-sm font-semibold text-black hover:bg-[hsl(var(--player-waveform))] hover:brightness-105"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </span>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
