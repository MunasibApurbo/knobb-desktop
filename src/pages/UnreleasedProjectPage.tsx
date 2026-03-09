import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, Play, Shuffle } from "lucide-react";

import { PlayingIndicator } from "@/components/PlayingIndicator";
import {
  UnreleasedProjectDetailsDialog,
  UnreleasedSongDetailsDialog,
} from "@/components/unreleased/UnreleasedMetadataDialog";
import { UnreleasedProjectCard } from "@/components/unreleased/UnreleasedProjectCard";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { usePlayer } from "@/contexts/PlayerContext";
import { useUnreleasedArtistPage } from "@/hooks/useUnreleasedArtistPage";
import { createUnreleasedTrack } from "@/lib/unreleasedApi";
import { isSameTrack } from "@/lib/trackIdentity";
import { formatDuration, getTotalDuration } from "@/lib/utils";
import { usePageMetadata } from "@/hooks/usePageMetadata";

function decodeProjectName(value: string | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function UnreleasedProjectPage() {
  const navigate = useNavigate();
  const { sheetId, projectName } = useParams();
  const decodedProjectName = decodeProjectName(projectName);
  const { artist, projects, loading, error } = useUnreleasedArtistPage(sheetId);
  const { play, currentTrack, isPlaying } = usePlayer();

  const project = useMemo(
    () => projects.find((entry) => entry.name === decodedProjectName) || null,
    [decodedProjectName, projects],
  );

  const queue = useMemo(() => {
    if (!artist || !project) return [];
    return project.songs
      .map((song, index) => createUnreleasedTrack(song, project, artist, index))
      .filter((track) => Boolean(track.streamUrl));
  }, [artist, project]);

  const relatedProjects = useMemo(
    () => projects.filter((entry) => entry.name !== decodedProjectName).slice(0, 6),
    [decodedProjectName, projects],
  );

  usePageMetadata(artist && project ? {
    title: `${project.name} - ${artist.name}`,
    description: `Explore ${project.name}, an unreleased project by ${artist.name}, on Knobb.`,
    image: project.imageUrl || artist.imageUrl || undefined,
    imageAlt: `${project.name} project artwork`,
    type: "music.album",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: project.name,
      byArtist: {
        "@type": "MusicGroup",
        name: artist.name,
      },
      description: `Explore ${project.name}, an unreleased project by ${artist.name}, on Knobb.`,
      image: project.imageUrl || artist.imageUrl || undefined,
      numTracks: project.trackCount || undefined,
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

  if (!artist || !project || error) {
    return (
      <PageTransition>
        <div className="space-y-4 border border-white/10 bg-white/[0.02] p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Unreleased</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Project not found</h1>
          <p className="text-sm text-white/68">{error || "This unreleased project could not be loaded."}</p>
          <Button variant="outline" onClick={() => navigate("/unreleased")}>Back to Archive</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-0 pb-24">
        <section className="border border-white/10 bg-[radial-gradient(circle_at_top_left,_hsl(var(--player-waveform)/0.24),_transparent_58%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.015))]">
          <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
              <div className="relative aspect-square min-h-[320px] w-full overflow-hidden bg-black">
                <img
                  src={project.imageUrl || artist.imageUrl}
                  alt={project.name}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = artist.imageUrl || "/placeholder.svg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <button
                  type="button"
                  onClick={() => navigate(`/unreleased/${artist.sheetId}`)}
                  className="absolute left-4 top-4 flex items-center gap-2 border border-white/10 bg-black/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Artist
                </button>
              </div>
            </div>

            <div className="px-5 py-6 md:px-8 md:py-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {project.timeline || "Unreleased"}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">{project.name}</h1>
              <p className="mt-3 text-sm leading-6 text-white/70">
                By {artist.name}. Direct-source tracks can play immediately in Knobb. Tracks without a resolved stream keep their source link for reference.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tracks</p>
                  <p className="mt-2 text-2xl font-black text-white">{project.trackCount}</p>
                </div>
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Playable</p>
                  <p className="mt-2 text-2xl font-black text-white">{project.availableCount}</p>
                </div>
                <div className={`${PANEL_SURFACE_CLASS} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Runtime</p>
                  <p className="mt-2 text-2xl font-black text-white">{queue.length > 0 ? getTotalDuration(queue) : "--"}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  className="border border-white/10 bg-white/[0.92] text-black hover:bg-white"
                  disabled={queue.length === 0}
                  onClick={() => {
                    if (queue.length === 0) return;
                    play(queue[0], queue);
                  }}
                >
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  Play project
                </Button>
                <Button
                  variant="outline"
                  disabled={queue.length === 0}
                  onClick={() => {
                    if (queue.length === 0) return;
                    const shuffled = [...queue].sort(() => Math.random() - 0.5);
                    play(shuffled[0], shuffled);
                  }}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle
                </Button>
                <UnreleasedProjectDetailsDialog
                  artist={artist}
                  project={project}
                  trigger={<Button type="button" variant="outline">Project Details</Button>}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border border-t-0 border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 px-5 py-5 md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tracklist</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Project tracks</h2>
          </div>

          <div className="border-b border-white/10">
            {project.songs.map((song, index) => {
              const track = createUnreleasedTrack(song, project, artist, index);
              const isCurrent = isSameTrack(currentTrack, track);

              return (
                <button
                  key={track.id}
                  type="button"
                  disabled={!track.streamUrl}
                  onClick={() => {
                    if (!track.streamUrl) return;
                    play(track, queue);
                  }}
                  className={`content-visibility-list group relative flex w-full items-center gap-4 border-b border-white/10 px-5 py-3 text-left last:border-b-0 ${track.streamUrl ? "transition-colors" : "cursor-default opacity-65"}`}
                  style={isCurrent ? { backgroundColor: "hsl(var(--player-waveform) / 0.95)" } : undefined}
                >
                  {!isCurrent && track.streamUrl ? (
                    <span
                      className="absolute inset-0 origin-left scale-x-0 bg-[hsl(var(--player-waveform)/0.95)] transition-transform duration-300 ease-out group-hover:scale-x-100"
                      aria-hidden="true"
                    />
                  ) : null}

                  <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center text-sm ${isCurrent ? "text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
                    {isCurrent ? <PlayingIndicator isPaused={!isPlaying} /> : `${index + 1}`}
                  </span>

                  <div className="relative z-10 min-w-0 flex-1">
                    <p className={`truncate text-sm ${isCurrent ? "font-semibold text-black" : "font-medium text-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))]"}`}>
                      {song.name}
                    </p>
                    <p className={`truncate text-xs ${isCurrent ? "text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.82)]"}`}>
                      {song.category || "Unreleased"}{song.description ? ` • ${song.description}` : ""}
                    </p>
                  </div>

                  <div className="relative z-10 flex shrink-0 items-center gap-3">
                    <span className={`text-xs ${isCurrent ? "text-black" : "text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.82)]"}`}>
                      {song.duration > 0 ? formatDuration(song.duration) : "--:--"}
                    </span>
                    <UnreleasedSongDetailsDialog
                      artist={artist}
                      project={project}
                      song={song}
                      trigger={
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          className={`text-xs ${isCurrent ? "text-black" : "text-white/72 hover:text-white"}`}
                        >
                          Details
                        </button>
                      }
                    />
                    {song.sourceUrl ? (
                      <a
                        href={song.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        className={`inline-flex items-center gap-1 text-xs ${isCurrent ? "text-black hover:text-black" : "text-white/72 hover:text-white"}`}
                      >
                        Source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className={`text-xs ${isCurrent ? "text-black" : "text-white/42"}`}>No source</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {relatedProjects.length > 0 ? (
          <section className="border border-t-0 border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 px-5 py-5 md:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">More from {artist.name}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Other unreleased projects</h2>
            </div>
            <motion.div
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
              initial="hidden"
              animate="show"
              className="hover-desaturate-page"
            >
              <div className="hover-desaturate-grid media-card-grid gap-0 border-l border-t border-white/10">
                {relatedProjects.map((relatedProject) => {
                  const relatedQueue = relatedProject.songs
                    .map((song, index) => createUnreleasedTrack(song, relatedProject, artist, index))
                    .filter((track) => Boolean(track.streamUrl));

                  return (
                    <UnreleasedProjectCard
                      key={relatedProject.name}
                      artist={artist}
                      project={relatedProject}
                      onClick={() => navigate(`/unreleased/${artist.sheetId}/${encodeURIComponent(relatedProject.name)}`)}
                    onPlay={() => {
                      if (relatedQueue.length === 0) return;
                      play(relatedQueue[0], relatedQueue);
                    }}
                    detailsSlot={(
                      <UnreleasedProjectDetailsDialog
                        artist={artist}
                        project={relatedProject}
                        trigger={<Button type="button" variant="outline" size="sm">Details</Button>}
                      />
                    )}
                  />
                );
              })}
              </div>
            </motion.div>
          </section>
        ) : null}
      </div>
    </PageTransition>
  );
}
