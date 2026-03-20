import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { PlayHistoryEntry, usePlayHistory } from "@/hooks/usePlayHistory";
import { BarChart3, Clock, Music, Disc3, TrendingUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
import { useNavigate } from "react-router-dom";
import { StatsRange, computeListeningStats, filterHistoryByRange } from "@/lib/listeningIntelligence";
import { buildTrackAlbumPath } from "@/lib/mediaNavigation";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";

function formatListenedMinutes(listenedSeconds: number) {
  return `${Math.max(1, Math.round(listenedSeconds / 60))} min`;
}

function formatPeakHour(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2026, 0, 1, normalizedHour, 0, 0));
}

export default function ListeningStatsPage() {
  const { user } = useAuth();
  const { scrobblePercent } = useSettings();
  const { getHistory } = usePlayHistory();
  const navigate = useNavigate();
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [range, setRange] = useState<StatsRange>("30d");

  const parsedScrobblePercent = Number.parseInt(scrobblePercent, 10);
  const normalizedScrobblePercent = Number.isFinite(parsedScrobblePercent)
    ? Math.min(95, Math.max(5, parsedScrobblePercent))
    : 50;

  useEffect(() => {
    if (!user) {
      return;
    }
    getHistory(1000).then(setHistory);
  }, [user, getHistory]);

  const filteredHistory = useMemo(
    () => filterHistoryByRange(history, range),
    [history, range]
  );

  const stats = useMemo(
    () => computeListeningStats(filteredHistory, normalizedScrobblePercent),
    [filteredHistory, normalizedScrobblePercent]
  );
  const topTracksQueue = useMemo(() => stats.topTracks.map(({ track }) => track), [stats.topTracks]);

  if (!user) {
    return (
      <PageTransition>
        <UtilityPageLayout
          eyebrow="Stats"
          title="Listening Stats"
          description="Tracked listening patterns, top artists, and top songs show up here."
        >
          <UtilityPagePanel className="flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">Sign in to see your listening stats.</p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </UtilityPagePanel>
        </UtilityPageLayout>
      </PageTransition>
    );
  }

  const maxHour = Math.max(...stats.hourCounts, 1);

  return (
    <PageTransition>
      <UtilityPageLayout
        eyebrow="Stats"
        title="Listening Stats"
        description="Tracked listening patterns, top artists, and your most played songs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "7d", label: "7D" },
              { value: "30d", label: "30D" },
              { value: "all", label: "All" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value as StatsRange)}
                className={`menu-sweep-hover relative overflow-hidden px-3 py-2 text-xs font-semibold rounded-[var(--control-radius)] transition-colors ${
                  range === option.value
                    ? "text-black"
                    : "text-muted-foreground"
                }`}
                style={range === option.value ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        <UtilityPagePanel className="p-0">
          <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { icon: Music, label: "Counted Plays", value: stats.totalCountedPlays.toString() },
              { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
              { icon: TrendingUp, label: "Peak Hour", value: formatPeakHour(stats.peakHour) },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="group relative isolate cursor-pointer overflow-hidden p-5 text-center sm:p-6 menu-sweep-row"
              >
                <div className="relative z-10 space-y-1">
                  <Icon className="mx-auto h-5 w-5 text-muted-foreground transition-colors duration-300" />
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </UtilityPagePanel>

        <UtilityPagePanel className="space-y-3 px-4 py-5 sm:px-5">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            <Clock className="h-4 w-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
            Activity by Hour
          </h2>
          <div className="flex h-24 items-end gap-[2px] sm:h-32">
            {stats.hourCounts.map((count, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-0.5">
                <div
                  className="w-full transition-[height,background-color] duration-200 ease-out"
                  style={{
                    height: `${(count / maxHour) * 100}%`,
                    minHeight: count > 0 ? 2 : 0,
                    backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </UtilityPagePanel>

        <UtilityPagePanel className="space-y-3 px-4 py-5 sm:px-5">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            <Disc3 className="h-4 w-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
            Top Artists
          </h2>
          {stats.topArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topArtists.map(({ artist, listenedSeconds }, index) => (
                <ArtistContextMenu key={artist} artistName={artist}>
                  <button
                    type="button"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(artist)}`)}
                    className="menu-sweep-hover flex w-full items-center gap-3 rounded-[var(--control-radius)] px-2 py-2 text-left"
                  >
                    <span className="w-5 shrink-0 text-right text-xs font-mono text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <ArtistLink
                        name={artist}
                        className="block truncate text-sm font-semibold text-white"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </ArtistContextMenu>
              ))}
            </div>
          )}
        </UtilityPagePanel>

        <UtilityPagePanel className="space-y-3 px-4 py-5 sm:px-5">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            <Music className="h-4 w-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
            Top Tracks
          </h2>
          {stats.topTracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topTracks.map(({ track, listenedSeconds }, index) => (
                <TrackContextMenu key={track.id} track={track} tracks={topTracksQueue}>
                  <button
                    type="button"
                    onClick={() => {
                      const albumPath = buildTrackAlbumPath(track);
                      if (albumPath) navigate(albumPath);
                    }}
                    className="menu-sweep-hover content-visibility-list flex w-full items-center gap-3 rounded-[var(--control-radius)] px-2 py-2 text-left"
                  >
                    <span className="w-5 shrink-0 text-right text-xs font-mono text-muted-foreground">{index + 1}</span>
                    <img src={track.coverUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
                      <ArtistLink
                        name={track.artist}
                        artistId={track.artistId}
                        className="block truncate text-xs text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </TrackContextMenu>
              ))}
            </div>
          )}
        </UtilityPagePanel>
      </UtilityPageLayout>
    </PageTransition>
  );
}
