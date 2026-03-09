import type { ReactNode } from "react";
import { ExternalLink, Info, RadioTower } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import type { UnreleasedArtist, UnreleasedProject, UnreleasedSong } from "@/lib/unreleasedApi";
import { formatDuration } from "@/lib/utils";

function formatMetadataDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString();
}

function renderMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const entries = value.map((entry) => renderMetadataValue(entry)).filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }

  return JSON.stringify(value);
}

function MetadataGrid({ items }: { items: Array<{ label: string; value: unknown }> }) {
  const visibleItems = items
    .map((item) => ({ ...item, rendered: renderMetadataValue(item.value) }))
    .filter((item) => item.rendered);

  if (visibleItems.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visibleItems.map((item) => (
        <div key={item.label} className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-sm leading-6 text-white">{item.rendered}</p>
        </div>
      ))}
    </div>
  );
}

function RawRecordBlock({
  title,
  record,
}: {
  title: string;
  record: Record<string, unknown>;
}) {
  return (
    <div className={`${PANEL_SURFACE_CLASS} overflow-hidden`}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      </div>
      <pre className="max-h-[18rem] overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-xs leading-6 text-white/72">
        {JSON.stringify(record, null, 2)}
      </pre>
    </div>
  );
}

type DialogTriggerProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

function DefaultTrigger({ label = "Details", compact = false, className }: DialogTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "sm" : "default"}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <Info className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

export function UnreleasedSongDetailsDialog({
  artist,
  project,
  song,
  trigger,
}: {
  artist: UnreleasedArtist;
  project: UnreleasedProject;
  song: UnreleasedSong;
  trigger?: ReactNode;
}) {
  const primarySourceUrl = song.sourceUrl || song.trackerMeta.sourceUrls[0] || null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <DefaultTrigger compact />}
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <RadioTower className="h-3.5 w-3.5" />
              Unreleased track metadata
            </div>
            <DialogTitle className="mt-3 text-2xl font-black tracking-tight text-white">{song.name}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/68">
              {artist.name} • {project.name}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <MetadataGrid
              items={[
                { label: "Artist", value: song.trackerMeta.artist || artist.name },
                { label: "Project", value: song.trackerMeta.project || project.name },
                { label: "Era", value: song.trackerMeta.era || project.name },
                { label: "Timeline", value: song.trackerMeta.timeline || project.timeline },
                { label: "Category", value: song.trackerMeta.category || song.category },
                { label: "Track Number", value: song.trackerMeta.trackNumber },
                { label: "Duration", value: song.duration > 0 ? formatDuration(song.duration) : "--:--" },
                { label: "Release Date", value: formatMetadataDate(song.trackerMeta.releaseDate) },
                { label: "Added to Tracker", value: formatMetadataDate(song.trackerMeta.addedDate) },
                { label: "Leak Date", value: formatMetadataDate(song.trackerMeta.leakedDate) },
                { label: "Recording Date", value: formatMetadataDate(song.trackerMeta.recordingDate) },
                { label: "Playable in Knobb", value: song.directUrl ? "Yes" : "No" },
              ]}
            />

            {song.description ? (
              <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Description</p>
                <p className="mt-3 text-sm leading-6 text-white/78">{song.description}</p>
              </div>
            ) : null}

            {song.trackerMeta.notes ? (
              <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes</p>
                <p className="mt-3 text-sm leading-6 text-white/78">{song.trackerMeta.notes}</p>
              </div>
            ) : null}

            {(primarySourceUrl || song.trackerMeta.sourceUrls.length > 0 || song.directUrl) ? (
              <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source Links</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {primarySourceUrl ? (
                    <a
                      href={primarySourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-white underline underline-offset-4"
                    >
                      Original source
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  {song.directUrl ? (
                    <a
                      href={song.directUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-white underline underline-offset-4"
                    >
                      Direct audio URL
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
                {song.trackerMeta.sourceUrls.length > 1 ? (
                  <p className="mt-3 text-xs leading-6 text-white/58">
                    Alternate URLs: {song.trackerMeta.sourceUrls.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <RawRecordBlock title="Raw tracker song record" record={song.trackerMeta.raw} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnreleasedProjectDetailsDialog({
  artist,
  project,
  trigger,
}: {
  artist: UnreleasedArtist;
  project: UnreleasedProject;
  trigger?: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <DefaultTrigger compact label="Project Details" />}
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <RadioTower className="h-3.5 w-3.5" />
              Unreleased project metadata
            </div>
            <DialogTitle className="mt-3 text-2xl font-black tracking-tight text-white">{project.name}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/68">
              {artist.name} • {project.timeline || "Unreleased"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <MetadataGrid
              items={[
                { label: "Artist", value: artist.name },
                { label: "Timeline", value: project.timeline },
                { label: "Tracks", value: project.trackCount },
                { label: "Playable", value: project.availableCount },
                { label: "Song Groups", value: project.trackerMeta.songGroups },
                { label: "Image", value: project.imageUrl },
              ]}
            />

            <RawRecordBlock title="Raw tracker project record" record={project.trackerMeta.raw} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
