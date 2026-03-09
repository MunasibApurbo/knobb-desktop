import { type ChangeEvent, useMemo, useRef } from "react";
import { HardDrive, Pause, Play, Shuffle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageTransition } from "@/components/PageTransition";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { PlaylistDragAction } from "@/components/PlaylistDragAction";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { Button } from "@/components/ui/button";
import { useLocalFiles } from "@/contexts/LocalFilesContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";
import { filterPlayableTracks, isTrackPlayable } from "@/lib/trackPlayback";
import { formatDuration, getTotalDuration } from "@/lib/utils";
import type { Track } from "@/types/music";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function LocalFilesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollY = useMainScrollY();
  const { localFiles, importFiles, removeLocalFile, clearLocalFiles, totalBytes, isLoading } = useLocalFiles();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer();

  const playableLocalFiles = useMemo(() => filterPlayableTracks(localFiles), [localFiles]);
  const firstPlayableTrack = playableLocalFiles[0] ?? null;
  const isCurrentLocalTrack = Boolean(currentTrack?.isLocal && localFiles.some((track) => track.id === currentTrack.id));

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const handleImportSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const importedCount = await importFiles(files);
      if (importedCount > 0) {
        toast.success(`Imported ${importedCount} local track${importedCount === 1 ? "" : "s"}.`);
      } else {
        toast.error("No supported audio files were selected.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import local files.");
    } finally {
      event.target.value = "";
    }
  };

  const handleShuffle = () => {
    if (playableLocalFiles.length === 0) return;
    const shuffled = [...playableLocalFiles].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
  };

  const handlePlay = (track: Track) => {
    if (!isTrackPlayable(track)) {
      toast.error(`"${track.title}" is unavailable to play right now.`);
      return;
    }

    play(track, localFiles);
  };

  const handleClearAll = async () => {
    if (localFiles.length === 0) return;

    const confirmed = window.confirm("Remove all imported local files from this device?");
    if (!confirmed) return;

    await clearLocalFiles();
    toast.success("Local files cleared.");
  };

  return (
    <PageTransition>
      <div className="mobile-page-shell">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.aac,.mp4,.webm"
          className="hidden"
          multiple
          onChange={(event) => {
            void handleImportSelection(event);
          }}
        />

        <DetailHero
          artworkUrl="/placeholder.svg"
          accentColor="195 74% 48%"
          label="Library"
          scrollY={scrollY}
          title="Local Files"
          body={(
            <p className="max-w-2xl text-sm text-white/72">
              Import tracks from this device and play them inside Knobb without leaving your library flow.
            </p>
          )}
          meta={(
            <>
              <span className="detail-chip">
                <span>Tracks</span>
                <strong>{localFiles.length}</strong>
              </span>
              {localFiles.length > 0 ? (
                <span className="detail-chip">
                  <span>Runtime</span>
                  <strong>{getTotalDuration(localFiles)}</strong>
                </span>
              ) : null}
              <span className="detail-chip">
                <span>Storage</span>
                <strong>{formatBytes(totalBytes)}</strong>
              </span>
            </>
          )}
        />

        <DetailActionBar columns={5}>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={openPicker}>
            <Upload className="hero-action-icon mr-2 h-4 w-4" />
            <span className="hero-action-label relative z-10">Import</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isCurrentLocalTrack) togglePlay();
              else if (firstPlayableTrack) play(firstPlayableTrack, localFiles);
            }}
            disabled={!isCurrentLocalTrack && !firstPlayableTrack}
          >
            {isCurrentLocalTrack && isPlaying ? (
              <Pause className="hero-action-icon mr-2 h-4 w-4 fill-current" />
            ) : (
              <Play className="hero-action-icon mr-2 h-4 w-4 fill-current" />
            )}
            <span className="hero-action-label relative z-10">Play</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={handleShuffle}
            disabled={playableLocalFiles.length === 0}
          >
            <Shuffle className="hero-action-icon mr-2 h-4 w-4" />
            <span className="hero-action-label relative z-10">Shuffle</span>
          </Button>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              void handleClearAll();
            }}
            disabled={localFiles.length === 0}
          >
            <Trash2 className="hero-action-icon mr-2 h-4 w-4" />
            <span className="hero-action-label relative z-10">Clear</span>
          </Button>
          <PlaylistDragAction
            disabled={localFiles.length === 0}
            payload={{
              label: "Local Files",
              source: "playlist",
              tracks: localFiles,
            }}
          />
        </DetailActionBar>

        {localFiles.length > 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <VirtualizedTrackList
              items={localFiles}
              getItemKey={(track) => track.id}
              rowHeight={86}
              renderRow={(track, index) => {
                const isCurrent = isSameTrack(currentTrack, track);

                return (
                  <TrackListRow
                    dragHandleLabel={`Drag ${track.title} to a playlist`}
                    key={track.id}
                    index={index}
                    track={track}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && isPlaying}
                    onDragHandleStart={(event) => {
                      startPlaylistDrag(event.dataTransfer, {
                        label: track.title,
                        source: "track",
                        tracks: [track],
                      });
                    }}
                    onPlay={() => handlePlay(track)}
                    title={(
                      <div className="flex items-center gap-2">
                        <span className="truncate">{track.title}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                          Local
                        </span>
                      </div>
                    )}
                    subtitle={<span className={isCurrent ? "text-black" : "text-white/62"}>{track.artist}</span>}
                    middleContent={<span className={isCurrent ? "text-black/78" : "text-white/54"}>{track.album}</span>}
                    desktopMeta={<span className={isCurrent ? "text-black/78" : "text-white/54"}>{formatBytes(track.localFileSize || 0)}</span>}
                    actionSlot={(
                      <button
                        type="button"
                        aria-label={`Remove ${track.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--control-radius)] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!track.localFileId) return;
                          void removeLocalFile(track.localFileId).then(() => {
                            toast.success(`Removed "${track.title}" from local files.`);
                          }).catch(() => {
                            toast.error(`Failed to remove "${track.title}".`);
                          });
                        }}
                      >
                        <Trash2 className={isCurrent ? "text-black" : undefined} />
                      </button>
                    )}
                    trailingContent={formatDuration(track.duration)}
                  />
                );
              }}
            />
          </section>
        ) : (
          <section className="border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                <HardDrive className="h-6 w-6 text-white/68" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-foreground">
                  {isLoading ? "Loading your local library..." : "Import tracks from this device"}
                </h2>
                <p className="text-sm text-white/62">
                  Supported audio files stay on this device and appear in your Knobb library for quick playback.
                </p>
              </div>
              <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={openPicker}>
                <Upload className="hero-action-icon mr-2 h-4 w-4" />
                <span className="hero-action-label relative z-10">Choose audio files</span>
              </Button>
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
