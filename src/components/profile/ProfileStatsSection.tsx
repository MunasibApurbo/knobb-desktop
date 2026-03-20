import { BarChart3, Clock, Disc3, Music, TrendingUp, User } from "lucide-react";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistContextMenu } from "@/components/ArtistContextMenu";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UtilityPagePanel } from "@/components/UtilityPageLayout";
import type { ListeningStats, StatsRange } from "@/lib/listeningIntelligence";
import type { Track } from "@/types/music";

type ProfileStatsSectionProps = {
  range: StatsRange;
  stats: ListeningStats;
  maxHour: number;
  artistImages: Record<string, string>;
  onRangeChange: (range: StatsRange) => void;
  onArtistSelect: (artist: string) => void;
  onTrackSelect: (track: Track) => void;
};

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

export function ProfileStatsSection({
  range,
  stats,
  maxHour,
  artistImages,
  onRangeChange,
  onArtistSelect,
  onTrackSelect,
}: ProfileStatsSectionProps) {
  const topTracksQueue = stats.topTracks.map(({ track }) => track);
  const hasListeningData =
    stats.totalCountedPlays > 0 ||
    stats.totalMinutes > 0 ||
    stats.topArtists.length > 0 ||
    stats.topTracks.length > 0 ||
    stats.hourCounts.some((count) => count > 0);

  return (
    <UtilityPagePanel className="profile-stats-panel flex w-full flex-col overflow-hidden p-0 !bg-black">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-black px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <BarChart3 className="w-5 h-5" style={{ color: "hsl(var(--dynamic-accent))" }} />
          Listening Stats
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "all", label: "All" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => onRangeChange(option.value as StatsRange)}
              className={`menu-sweep-hover relative overflow-hidden px-3 py-1 text-xs font-semibold rounded-[var(--control-radius)] transition-colors ${range === option.value
                ? "text-black"
                : "text-muted-foreground"
              }`}
              style={range === option.value ? { backgroundColor: "hsl(var(--player-waveform))" } : undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!hasListeningData ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <BarChart3 className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">No listening stats yet</h3>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Start playing a few songs and we&apos;ll fill this page with your counted plays, favorite artists, top tracks, and activity patterns.
            </p>
          </div>
        </div>
      ) : (
        <>
      <div className="profile-stats-metrics grid grid-cols-1 divide-y divide-white/10 border-b border-white/10 bg-black sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { icon: Music, label: "Counted Plays", value: stats.totalCountedPlays.toString() },
          { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
          { icon: TrendingUp, label: "Peak Hour", value: formatPeakHour(stats.peakHour) },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="profile-stats-card website-card-hover group relative isolate flex cursor-pointer flex-col items-center justify-center overflow-hidden border border-white/10 bg-white/[0.02] p-6 sm:p-8 menu-sweep-row"
          >
            <Icon className="relative z-10 mb-3 h-6 w-6 text-muted-foreground transition-colors duration-200 sm:h-8 sm:w-8" />
            <p className="relative z-10 mb-1 text-2xl font-bold leading-none text-white sm:text-3xl">{value}</p>
            <p className="relative z-10 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-200 sm:text-xs">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col border-b border-white/10 bg-black group">
        <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
            Activity by Hour
          </h2>
        </div>
        <div className="px-4 md:px-6 py-6 pb-4">
          <div className="flex h-24 items-end gap-[2px] sm:h-40">
            {stats.hourCounts.map((count, index) => (
              <div key={index} className="flex-1 flex flex-col items-center group/bar cursor-default h-full justify-end">
                <div
                  className="w-full transition-all duration-300 group-hover/bar:bg-[hsl(var(--dynamic-accent))] group-hover/bar:scale-y-[1.05] origin-bottom"
                  style={{
                    height: `${(count / maxHour) * 100}%`,
                    minHeight: count > 0 ? 2 : 0,
                    backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/50 pt-3 mt-1 font-mono uppercase tracking-wider">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/10 bg-black md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="flex flex-col">
          <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center gap-2">
              <Disc3 className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
              Top Artists
            </h2>
          </div>
          {stats.topArtists.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No data yet.</p>
            </div>
          ) : (
            <div className="profile-stats-list flex flex-col">
              {stats.topArtists.map(({ artist, listenedSeconds }, index) => (
                <ArtistContextMenu key={artist} artistName={artist} artistImageUrl={artistImages[artist]}>
                  <button
                    type="button"
                    className="profile-stats-row group relative overflow-hidden flex w-full items-center gap-4 px-4 py-3 text-left border-b border-white/10 last:border-b-0 md:px-6 menu-sweep-row"
                    onClick={() => onArtistSelect(artist)}
                  >
                    <span className="relative z-10 w-4 text-xs font-mono tabular-nums text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{index + 1}.</span>
                    {artistImages[artist] ? (
                      <img src={artistImages[artist]} alt={artist} loading="lazy" decoding="async" className="relative z-10 h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
                        <User className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.7)]" />
                      </div>
                    )}
                    <div className="relative z-10 min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{artist}</p>
                    </div>
                    <span className="relative z-10 text-[11px] font-mono text-muted-foreground sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </ArtistContextMenu>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex min-h-14 items-center border-b border-white/10 px-4 py-4 md:px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center gap-2">
              <Music className="w-4 h-4" style={{ color: "hsl(var(--dynamic-accent))" }} />
              Top Tracks
            </h2>
          </div>
          {stats.topTracks.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No data yet.</p>
            </div>
          ) : (
            <div className="profile-stats-list flex flex-col">
              {stats.topTracks.map(({ track, listenedSeconds }, index) => (
                <TrackContextMenu key={track.id} track={track} tracks={topTracksQueue}>
                  <button
                    type="button"
                    className="profile-stats-row content-visibility-list group relative overflow-hidden flex w-full items-center gap-4 px-4 py-3 text-left border-b border-white/10 last:border-b-0 md:px-6 menu-sweep-row"
                    onClick={() => onTrackSelect(track)}
                  >
                    <span className="relative z-10 w-4 text-xs font-mono tabular-nums text-muted-foreground transition-colors group-hover:text-[hsl(var(--dynamic-accent-foreground))]">{index + 1}.</span>
                    <img src={track.coverUrl} alt="" loading="lazy" decoding="async" className="relative z-10 h-10 w-10 shrink-0 rounded-full object-cover" />
                    <div className="relative z-10 min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                      <ArtistLink
                        name={track.artist}
                        artistId={track.artistId}
                        className="block truncate text-xs text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                    <span className="relative z-10 text-[11px] font-mono text-muted-foreground sm:text-xs">{formatListenedMinutes(listenedSeconds)}</span>
                  </button>
                </TrackContextMenu>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </UtilityPagePanel>
  );
}
