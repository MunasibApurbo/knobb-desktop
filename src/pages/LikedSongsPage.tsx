import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { formatDuration, getTotalDuration, cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { Track } from "@/types/music";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { Play, Pause, Shuffle, Heart, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { toast } from "sonner";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  formatTrackAddedAt,
  formatTrackAddedAtTooltip,
  getTrackAddedAtLocale,
} from "@/lib/trackAddedAt";
import { copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { filterPlayableTracks, isTrackPlayable } from "@/lib/trackPlayback";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";
import { getLatestLikedSongsArtwork } from "@/lib/likedSongsArtwork";

export default function LikedSongsPage() {
  const { play, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { likedSongs, isLiked, toggleLike } = useLikedSongs();
  const { setActiveScope } = useTrackSelectionShortcutsContext();
  const { language } = useLanguage();
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const addedAtLocale = getTrackAddedAtLocale(language);
  const playableLikedSongs = filterPlayableTracks(likedSongs);
  const firstPlayableLikedSong = playableLikedSongs[0] ?? null;

  const isCurrentLiked = currentTrack && likedSongs.some((track) => track.id === currentTrack.id);
  const coverUrl = getLatestLikedSongsArtwork(likedSongs) || "/placeholder.svg";

  const handleShuffle = () => {
    if (playableLikedSongs.length === 0) return;
    const shuffled = [...playableLikedSongs].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
  };

  const handleShare = async () => {
    const url = window.location.href;
    await copyPlainTextToClipboard(url);
    toast.success("Liked Songs link copied to clipboard");
  };

  useEffect(() => {
    const likedSongIds = new Set(likedSongs.map((track) => track.id));
    setSelectedTrackIds((previous) => previous.filter((id) => likedSongIds.has(id)));
  }, [likedSongs]);

  const clearSelection = useCallback(() => {
    setSelectedTrackIds([]);
    setLastSelectedIndex(null);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTrackIds(likedSongs.map((track) => track.id));
    setLastSelectedIndex(likedSongs.length > 0 ? likedSongs.length - 1 : null);
  }, [likedSongs]);

  const removeSelectedTracks = useCallback(async () => {
    const selectedTracks = likedSongs.filter((track) => selectedTrackIds.includes(track.id));
    for (const track of selectedTracks) {
      await toggleLike(track);
    }
    clearSelection();
  }, [clearSelection, likedSongs, selectedTrackIds, toggleLike]);

  const selectionScope = useMemo(() => ({
    id: "liked-songs",
    selectedCount: selectedTrackIds.length,
    selectAll,
    clearSelection,
    deleteSelection: removeSelectedTracks,
  }), [clearSelection, removeSelectedTracks, selectAll, selectedTrackIds.length]);

  useEffect(() => {
    setActiveScope(selectionScope);

    return () => {
      setActiveScope(null);
    };
  }, [selectionScope, setActiveScope]);

  const handleTrackRowClick = (event: React.MouseEvent<HTMLElement>, track: Track, index: number) => {
    setActiveScope(selectionScope);

    if (event.shiftKey && lastSelectedIndex !== null) {
      event.preventDefault();
      const [start, end] = [lastSelectedIndex, index].sort((a, b) => a - b);
      const rangeIds = likedSongs.slice(start, end + 1).map((item) => item.id);
      setSelectedTrackIds((previous) => Array.from(new Set([...previous, ...rangeIds])));
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      setSelectedTrackIds((previous) =>
        previous.includes(track.id)
          ? previous.filter((id) => id !== track.id)
          : [...previous, track.id],
      );
      setLastSelectedIndex(index);
      return;
    }

    clearSelection();
    if (!isTrackPlayable(track)) {
      toast.error(`"${track.title}" is unavailable to stream right now.`);
      return;
    }
    play(track, likedSongs);
  };

  const handleTrackSelectionClick = (event: React.MouseEvent<HTMLButtonElement>, track: Track, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveScope(selectionScope);

    if (event.shiftKey && lastSelectedIndex !== null) {
      const [start, end] = [lastSelectedIndex, index].sort((a, b) => a - b);
      const rangeIds = likedSongs.slice(start, end + 1).map((item) => item.id);
      setSelectedTrackIds((previous) => Array.from(new Set([...previous, ...rangeIds])));
      return;
    }

    setSelectedTrackIds((previous) =>
      previous.includes(track.id)
        ? previous.filter((id) => id !== track.id)
        : [...previous, track.id],
    );
    setLastSelectedIndex(index);
  };

  return (
    <PageTransition immediate>
      <div className="page-shell">
        <DetailHero
          artworkUrl={coverUrl}
          artworkWrapper={(artwork) => (
            <PlaylistContextMenu
              title="Liked Songs"
              kind="liked"
              tracks={likedSongs}
              coverUrl={coverUrl}
            >
              {artwork}
            </PlaylistContextMenu>
          )}
          dragPayload={likedSongs.length > 0 ? {
            label: "Liked Songs",
            source: "playlist",
            tracks: likedSongs,
          } : undefined}
          label="Playlist"
          title="Liked Songs"
          body={<p>Your saved tracks.</p>}
          meta={
            <>
              <span className="detail-chip">
                <span>Tracks</span>
                <strong>{likedSongs.length}</strong>
              </span>
              {likedSongs.length > 0 ? (
                <span className="detail-chip">
                  <span>Runtime</span>
                  <strong>{getTotalDuration(likedSongs)}</strong>
                </span>
              ) : null}
            </>
          }
        />

        <DetailActionBar columns={4}>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            onClick={() => {
              if (isCurrentLiked) togglePlay();
              else if (firstPlayableLikedSong) play(firstPlayableLikedSong, likedSongs);
            }}
            disabled={!isCurrentLiked && !firstPlayableLikedSong}
          >
            {isCurrentLiked && isPlaying ? (
              <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            ) : (
              <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            )}
            <span className="hero-action-label relative z-10">Play</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleShuffle} disabled={playableLikedSongs.length === 0}>
            <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Shuffle</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} disabled>
            <Heart className="hero-action-icon w-4 h-4 mr-2 fill-white text-white" />
            <span className="hero-action-label relative z-10">Liked</span>
          </Button>
          <Button variant="secondary" className={DETAIL_ACTION_BUTTON_CLASS} onClick={handleShare}>
            <Share className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Share</span>
          </Button>
        </DetailActionBar>

        {likedSongs.length > 0 ? (
          <section className={cn("page-panel overflow-hidden border border-white/10", PANEL_SURFACE_CLASS)}>
            <VirtualizedTrackList
              items={likedSongs}
              getItemKey={(track) => track.id}
              rowHeight={86}
              renderRow={(track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);
                const trackPlayable = isTrackPlayable(track);
                const isSelected = selectedTrackIds.includes(track.id);
                const draggedTracks =
                  isSelected && selectedTrackIds.length > 0
                    ? likedSongs.filter((entry) => selectedTrackIds.includes(entry.id))
                    : [track];
                return (
                  <TrackContextMenu key={track.id} track={track} tracks={likedSongs}>
                    <TrackListRow
                      className={!isCurrent && isSelected ? "bg-white/[0.08]" : undefined}
                      desktopMeta={(
                        <div
                          className={`truncate text-sm ${
                            isCurrent
                              ? "text-black"
                              : trackPlayable
                                ? "text-muted-foreground transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                                : "text-muted-foreground/70"
                          }`}
                          title={formatTrackAddedAtTooltip(track.addedAt, addedAtLocale) || undefined}
                        >
                          {formatTrackAddedAt(track.addedAt, addedAtLocale) || "-"}
                        </div>
                      )}
                      disabled={!trackPlayable}
                      disabledLabel="Unavailable"
                      dragHandleLabel={
                        draggedTracks.length > 1
                          ? `Drag ${draggedTracks.length} selected tracks to a playlist`
                          : `Drag ${track.title} to a playlist`
                      }
                      index={i}
                      isCurrent={isCurrent}
                      isLiked={isLiked(track.id)}
                      isPlaying={isPlaying}
                      onDragHandleStart={(event) => {
                        startPlaylistDrag(event.dataTransfer, {
                          label: draggedTracks.length > 1 ? "Liked Songs selection" : track.title,
                          source: draggedTracks.length > 1 ? "selection" : "track",
                          tracks: draggedTracks,
                        });
                      }}
                      onPlay={(event) => handleTrackRowClick(event, track, i)}
                      onToggleLike={() => toggleLike(track)}
                      leadingSlot={
                        <button
                          type="button"
                          className={`relative z-10 flex h-6 w-6 items-center justify-center text-sm tabular-nums text-center ${
                            isSelected
                              ? "border border-white/30 bg-white/12 text-white"
                              : isCurrent
                                ? "text-black"
                                : trackPlayable
                                  ? "text-muted-foreground transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                                  : "text-muted-foreground/70"
                          }`}
                          onClick={(event) => handleTrackSelectionClick(event, track, i)}
                          aria-label={isSelected ? "Deselect track" : "Select track"}
                        >
                          {isSelected ? "✓" : `${i + 1}.`}
                        </button>
                      }
                      track={track}
                      trailingContent={trackPlayable ? formatDuration(track.duration) : "Unavailable"}
                    />
                  </TrackContextMenu>
                );
              }}
            />
          </section>
        ) : (
          <section className={cn("page-panel overflow-hidden border border-white/10", PANEL_SURFACE_CLASS)}>
            <p className="text-muted-foreground text-sm py-10 text-center">Songs you like will appear here.</p>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
