import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { formatDuration, getTotalDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, Search, Trash2, Loader2, HeartOff, X, Play, ListFilter, ChevronDown } from "lucide-react";
import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { PageTransition } from "@/components/PageTransition";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { VirtualizedTrackList } from "@/components/VirtualizedTrackList";
import { motion } from "framer-motion";
import { getTrackAddedAtLocale } from "@/lib/trackAddedAt";
import { useMainScrollY } from "@/hooks/useMainScrollY";
import { collapseHistoryToLatestUniqueTrack } from "@/lib/playHistoryDisplay";
import type { PlayHistoryEntry } from "@/hooks/usePlayHistory";
import { startPlaylistDrag } from "@/lib/playlistDrag";
import { isSameTrack } from "@/lib/trackIdentity";

type HistoryFilter = "all" | "unliked";

function formatPlayedAt(
  value: string,
  formatters: {
    time: Intl.DateTimeFormat;
    recent: Intl.DateTimeFormat;
    full: Intl.DateTimeFormat;
  }
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (diffDays <= 0) return formatters.time.format(date);
  if (diffDays < 7) return formatters.recent.format(date);
  return formatters.full.format(date);
}

function formatPlayedAtTooltip(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function HistoryPage() {
  const { play, currentTrack, isPlaying } = usePlayer();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const { language } = useLanguage();
  const { getHistory, clearHistory } = usePlayHistory();
  const navigate = useNavigate();
  const scrollY = useMainScrollY();
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const deferredFilterQuery = useDeferredValue(filterQuery);
  const monthAgoIso = useMemo(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    []
  );
  const locale = useMemo(() => getTrackAddedAtLocale(language), [language]);
  const playedAtFormatters = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
      recent: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      full: new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }),
    [locale]
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getHistory({ limit: 5000, since: monthAgoIso }).then(setHistory).finally(() => setLoading(false));

    // Listen for realtime updates to play history
    const channel = supabase
      .channel(`history-page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_history",
        },
        () => {
          // Re-fetch history when changes occur
          getHistory({ limit: 5000, since: monthAgoIso }).then(setHistory);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, getHistory, monthAgoIso]);

  const uniqueHistory = useMemo(() => collapseHistoryToLatestUniqueTrack(history), [history]);

  const filteredHistory = useMemo(() => {
    const query = deferredFilterQuery.trim().toLowerCase();

    return uniqueHistory.filter((entry) => {
      if (filter === "unliked" && isLiked(entry.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableFields = [
        entry.title,
        entry.artist,
        entry.album,
        ...(entry.artists?.map((artist) => artist.name) ?? []),
      ];

      return searchableFields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [deferredFilterQuery, filter, isLiked, uniqueHistory]);

  const coverUrl = uniqueHistory[0]?.coverUrl || "/placeholder.svg";
  const hasActiveFilters = filter !== "all" || filterQuery.trim().length > 0;
  const canPlayHistory = filteredHistory.length > 0;

  const handleClearHistory = async () => {
    const confirmed = window.confirm("Clear your listening history from the last 30 days? This cannot be undone.");
    if (!confirmed) return;

    await clearHistory();
    setHistory([]);
    setFilterQuery("");
    setFilter("all");
  };

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mobile-page-shell">
        <DetailHero
          artworkUrl={coverUrl}
          body={(
            <p>
              Plays from the last 30 days, with quick filtering by track, artist, album, and liked status.
            </p>
          )}
          label="Library"
          meta={(
            <>
              <span className="detail-chip">
                <span>Plays</span>
                <strong>{uniqueHistory.length}</strong>
              </span>
              {filteredHistory.length > 0 ? (
                <span className="detail-chip">
                  <span>Runtime</span>
                  <strong>{getTotalDuration(filteredHistory)}</strong>
                </span>
              ) : null}
              {hasActiveFilters ? (
                <span className="detail-chip">
                  <span>Showing</span>
                  <strong>{filteredHistory.length}</strong>
                </span>
              ) : null}
            </>
          )}
          scrollY={scrollY}
          title="Recently Played"
        />

        <DetailActionBar columns={4}>
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            disabled={!canPlayHistory}
            onClick={() => {
              if (!filteredHistory.length) return;
              play(filteredHistory[0], filteredHistory);
            }}
          >
            <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
            <span className="hero-action-label relative z-10">Play recent</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                className={DETAIL_ACTION_BUTTON_CLASS}
                disabled={uniqueHistory.length === 0}
              >
                <ListFilter className="hero-action-icon w-4 h-4 mr-2" />
                <span className="hero-action-label relative z-10">
                  {filter === "all" ? "All plays" : "Not liked"}
                </span>
                <ChevronDown className="relative z-10 ml-2 h-4 w-4 opacity-72" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[13rem]">
              <DropdownMenuRadioGroup value={filter} onValueChange={(value) => setFilter(value as HistoryFilter)}>
                <DropdownMenuRadioItem value="all" className="gap-2">
                  All plays
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unliked" className="gap-2">
                  <HeartOff className="h-3.5 w-3.5" />
                  Not liked
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {user && !loading && uniqueHistory.length > 0 ? (
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder="Filter by song, artist, or album"
                className="h-full border-white/10 bg-black/25 pl-9 pr-10 text-white placeholder:text-white/34"
                aria-label="Filter listening history"
              />
              {filterQuery ? (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors hover:text-white"
                  aria-label="Clear history filter"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          <Button
            variant="secondary"
            className={DETAIL_ACTION_BUTTON_CLASS}
            disabled={uniqueHistory.length === 0}
            onClick={() => void handleClearHistory()}
          >
            <Trash2 className="hero-action-icon w-4 h-4 mr-2" />
            <span className="hero-action-label relative z-10">Clear history</span>
          </Button>
        </DetailActionBar>

        {!user ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div className="space-y-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">Sign in to see your play history.</p>
              <Button onClick={() => navigate("/auth")}>Sign In</Button>
            </div>
          </section>
        ) : loading ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </section>
        ) : uniqueHistory.length === 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div className="py-12 text-center">
              <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No history yet. Start playing some tracks!</p>
            </div>
          </section>
        ) : filteredHistory.length === 0 ? (
          <section className="border border-white/10 bg-white/[0.02]">
            <div className="space-y-3 py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-white">No matching plays found.</p>
              <p className="text-sm text-muted-foreground">
                Try a different song, artist, album, or switch the filter back to all plays.
              </p>
            </div>
          </section>
        ) : (
          <section className="border border-white/10 bg-white/[0.02]">
            <VirtualizedTrackList
              items={filteredHistory}
              rowHeight={86}
              getItemKey={(track, index) => `${track.id}-${track.playedAt}-${index}`}
              renderRow={(track, i) => {
                const isCurrent = isSameTrack(currentTrack, track);
                const playedAtLabel = formatPlayedAt(track.playedAt, playedAtFormatters);
                const playedAtTooltip = formatPlayedAtTooltip(track.playedAt, locale) || undefined;

                return (
                  <TrackContextMenu key={`${track.id}-${track.playedAt}-${i}`} track={track} tracks={filteredHistory}>
                    <TrackListRow
                      dragHandleLabel={`Drag ${track.title} to a playlist`}
                      desktopMeta={(
                        <div
                          className={`truncate text-sm ${
                            isCurrent
                              ? "text-black"
                              : "text-muted-foreground transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]"
                          }`}
                          title={playedAtTooltip}
                        >
                          {playedAtLabel}
                        </div>
                      )}
                      index={i}
                      isCurrent={isCurrent}
                      isLiked={isLiked(track.id)}
                      isPlaying={isPlaying}
                      mobileMeta={track.album ? `${track.album} • ${playedAtLabel}` : playedAtLabel}
                      onDragHandleStart={(event) => {
                        startPlaylistDrag(event.dataTransfer, {
                          label: track.title,
                          source: "track",
                          tracks: [track],
                        });
                      }}
                      onPlay={() => play(track, filteredHistory)}
                      onToggleLike={() => toggleLike(track)}
                      track={track}
                      trailingContent={formatDuration(track.duration)}
                    />
                  </TrackContextMenu>
                );
              }}
            />
          </section>
        )}
      </motion.div>
    </PageTransition>
  );
}
