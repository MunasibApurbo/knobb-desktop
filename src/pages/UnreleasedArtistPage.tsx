import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, RadioTower } from "lucide-react";

import { UnreleasedProjectDetailsDialog } from "@/components/unreleased/UnreleasedMetadataDialog";
import { UnreleasedProjectCard } from "@/components/unreleased/UnreleasedProjectCard";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { usePlayer } from "@/contexts/PlayerContext";
import { useUnreleasedArtistPage } from "@/hooks/useUnreleasedArtistPage";
import { createUnreleasedTrack } from "@/lib/unreleasedApi";
import { getTotalDuration } from "@/lib/utils";
import { usePageMetadata } from "@/hooks/usePageMetadata";

export default function UnreleasedArtistPage() {
  const navigate = useNavigate();
  const { sheetId } = useParams();
  const { play } = usePlayer();
  const { artist, projects, loading, error } = useUnreleasedArtistPage(sheetId);

  const availableTracks = useMemo(() => {
    if (!artist) return [];
    return projects.flatMap((project) =>
      project.songs
        .map((song, index) => createUnreleasedTrack(song, project, artist, index))
        .filter((track) => Boolean(track.streamUrl)),
    );
  }, [artist, projects]);

  const totalTrackCount = useMemo(
    () => projects.reduce((sum, project) => sum + project.trackCount, 0),
    [projects],
  );

  const totalAvailableCount = useMemo(
    () => projects.reduce((sum, project) => sum + project.availableCount, 0),
    [projects],
  );

  usePageMetadata(artist ? {
    title: `${artist.name} Unreleased`,
    description: `Browse unreleased projects and direct-source tracks from ${artist.name} on Knobb.`,
    image: artist.imageUrl || undefined,
    imageAlt: `${artist.name} archive artwork`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: artist.name,
      description: `Browse unreleased projects and direct-source tracks from ${artist.name} on Knobb.`,
      image: artist.imageUrl || undefined,
      url:
        typeof window !== "undefined"
          ? new URL(window.location.pathname, window.location.origin).toString()
          : undefined,
    },
  } : null);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artist || error) {
    return (
      <PageTransition>
        <div className="space-y-4 border border-white/10 bg-white/[0.02] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Unreleased</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Artist not found</h1>
          <p className="text-sm text-white/68">{error || "This unreleased archive could not be loaded."}</p>
          <Button variant="outline" onClick={() => navigate("/unreleased")}>Back to Archive</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-0 pb-24">
        <section className="border border-white/10 bg-[radial-gradient(circle_at_top_left,_hsl(var(--player-waveform)/0.24),_transparent_58%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))]">
          <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
              <div className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden bg-black">
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <button
                  type="button"
                  onClick={() => navigate("/unreleased")}
                  className="absolute left-4 top-4 flex items-center gap-2 border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Archive
                </button>
              </div>
            </div>

            <div className="px-5 py-6 md:px-8 md:py-8">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" />
                ArtistGrid archive
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">{artist.name}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
                Unreleased projects indexed from ArtistGrid. Tracks with direct sources can play inside Knobb; the rest keep their source metadata for reference.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Projects</p>
                  <p className="mt-2 text-2xl font-black text-white">{projects.length}</p>
                </div>
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tracks</p>
                  <p className="mt-2 text-2xl font-black text-white">{totalTrackCount}</p>
                </div>
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Playable</p>
                  <p className="mt-2 text-2xl font-black text-white">{totalAvailableCount}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  className="border border-white/10 bg-white/[0.92] text-black hover:bg-white"
                  disabled={availableTracks.length === 0}
                  onClick={() => {
                    if (availableTracks.length === 0) return;
                    play(availableTracks[0], availableTracks);
                  }}
                >
                  Play available tracks
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <a href={artist.url} target="_blank" rel="noreferrer">
                    Open ArtistGrid
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <p className="text-xs text-white/54">
                  Total runtime from direct sources: {availableTracks.length > 0 ? getTotalDuration(availableTracks) : "Unavailable"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-t-0 border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 px-5 py-5 md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Projects</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Unreleased eras and drafts</h2>
          </div>
          <motion.div
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
            initial="hidden"
            animate="show"
            className="hover-desaturate-page"
          >
            <div className="hover-desaturate-grid media-card-grid gap-0 border-l border-t border-white/10">
              {projects.map((project) => {
                const queue = project.songs
                  .map((song, index) => createUnreleasedTrack(song, project, artist, index))
                  .filter((track) => Boolean(track.streamUrl));

                return (
                  <UnreleasedProjectCard
                    key={project.name}
                    artist={artist}
                    project={project}
                    onClick={() => navigate(`/unreleased/${artist.sheetId}/${encodeURIComponent(project.name)}`)}
                    onPlay={() => {
                      if (queue.length === 0) return;
                      play(queue[0], queue);
                    }}
                    detailsSlot={(
                      <UnreleasedProjectDetailsDialog
                        artist={artist}
                        project={project}
                        trigger={<Button type="button" variant="outline" size="sm">Details</Button>}
                      />
                    )}
                  />
                );
              })}
            </div>
          </motion.div>
        </section>
      </div>
    </PageTransition>
  );
}
